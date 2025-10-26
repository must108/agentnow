from google import genai as genai_client
import google.generativeai as genai
import os
import numpy as np
import pandas as pd
from dotenv import load_dotenv
import re
import json

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from collections import Counter

from embed import fully_embed, normalize, save_cache, load_cache, convert

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai_client.Client(api_key=api_key)
genai.configure(api_key=api_key)

STT_MODEL_NAME = "base"

ROLLING_TEXT = []
LAST_SUGGESTION = None

TOP_K = 3

ACCEL_VEC_PATH = "data/accel_vectors.npy"
ACCEL_TXT_PATH = "data/accel_text.txt"

REQ_VEC_PATH = "data/user_vectors.npy"
REQ_TXT_PATH = "data/user_text.txt"

try:
    accel_df = pd.read_csv("data/accelerators.csv", encoding="utf-8")
    reqs_df = pd.read_csv("data/u_hack.csv", encoding="utf-8")
except UnicodeDecodeError:
    accel_df = pd.read_csv("data/accelerators.csv", encoding="cp1252")
    reqs_df = pd.read_csv("data/u_hack.csv", encoding="cp1252")

accel_texts = []
reqs_texts = []

accel_cols = ['name', 'description']
reqs_cols = ["number", "capability", "company", "description", "initiative_title", "primary_category"]

accel_texts = [convert(row, accel_cols) for _, row in accel_df.iterrows()]
reqs_texts = [convert(row, reqs_cols) for _, row in reqs_df.iterrows()]

ACCEL_TOKENS = {}
REQ_TOKENS = {}

with open("data/accel_tokens.txt", "r") as fp:
    tokens = fp.read().splitlines()
    ACCEL_TOKENS = set(tokens)

with open("data/hack_tokens.txt", "r") as fp:
    tokens = fp.read().splitlines()
    REQ_TOKENS = set(tokens)

tokenize = lambda x: set(re.findall(r"[a-z0-9]+", x.lower()))

accel_embed, accel_cache = load_cache(ACCEL_VEC_PATH, ACCEL_TXT_PATH)
req_embed, req_cache = load_cache(REQ_VEC_PATH, REQ_TXT_PATH)

if accel_embed is None or accel_cache != accel_texts:
    vec = fully_embed(client, accel_texts, "RETRIEVAL_DOCUMENT", True)
    vec = normalize(vec)

    save_cache(ACCEL_VEC_PATH, ACCEL_TXT_PATH, vec, accel_texts)
    accel_embed, _ = load_cache(ACCEL_VEC_PATH, ACCEL_TXT_PATH)

if req_embed is None or req_cache != reqs_texts:
    vec = fully_embed(client, reqs_texts, "RETRIEVAL_DOCUMENT", True)
    vec = normalize(vec)

    save_cache(REQ_VEC_PATH, REQ_TXT_PATH, vec, reqs_texts)
    req_embed, _ = load_cache(REQ_VEC_PATH, REQ_TXT_PATH)

GAP_FREQ = Counter()

for text in reqs_texts:
    toks = tokenize(text)
    for t in toks:
        if t in REQ_TOKENS and t not in ACCEL_TOKENS:
            GAP_FREQ[t] += 1

def top_gap_topics(k):
    return [w for w, _ in GAP_FREQ.most_common(k)]


app = FastAPI(title="Search")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/hello")
def hello():
    return {
        "message": "hello, world!"
    }

@app.get("/query")
def query(payload, mode):
    global accel_embed, req_embed
    q = payload.strip()

    if not q:
        raise HTTPException(400, "Empty query")
    
    results = { 
        "message": None,
        "accelerators": [],
        "user_requests": []
    }

    q_vec = fully_embed(client, [q], "RETRIEVAL_QUERY", True)
    q_vec = normalize(q_vec)

    if q_vec.ndim == 1:
        q_vec = q_vec[None, :]

    if q_vec.shape[1] != accel_embed.shape[1]:
         vec = fully_embed(client, accel_texts, "RETRIEVAL_DOCUMENT", True)
         vec = normalize(vec)
         save_cache(ACCEL_VEC_PATH, ACCEL_TXT_PATH, vec, accel_texts)
         accel_embed, _ = load_cache(ACCEL_VEC_PATH, ACCEL_TXT_PATH)

    if q_vec.shape[1] != req_embed.shape[1]:
        vec = fully_embed(client, reqs_texts, "RETRIEVAL_DOCUMENT", True)
        vec = normalize(vec)
        save_cache(REQ_VEC_PATH, REQ_TXT_PATH, vec, reqs_texts)
        req_embed, _ = load_cache(REQ_VEC_PATH, REQ_TXT_PATH)

    accel_similarities = (q_vec @ accel_embed.T)[0]
    req_similarities = (q_vec @ req_embed.T)[0]

    accel_idxs = np.argsort(-accel_similarities)[:TOP_K]
    req_idxs = np.argsort(-req_similarities)[:TOP_K]

    accel_best_idx = int(accel_idxs[0])
    req_best_idx = int(req_idxs[0])

    accel_best_score = float(accel_similarities[accel_best_idx])
    req_best_score = float(req_similarities[req_best_idx])
    
    bad_message = False

    if accel_best_score < 0.15:
        results["message"] = "Please only speak to me about technical accelerators. It's all I know."
        bad_message = True
    else:
        results["accelerators"] = [
            {
                "text": accel_texts[i],
                "title": accel_df.iloc[i]["name"]
            }
            for i in accel_idxs
        ]

    if req_best_score < 0.15 or bad_message:
        results["message"] = "Please only speak to me about technical accelerators. It's all I know."
    else:
        results["user_requests"] = [
            {
                "text": reqs_texts[i]
            }
            for i in req_idxs
        ]

    if bad_message:
        use_case_type = "not_relevant"
    elif req_best_score >= 0.15:
        use_case_type = "existing_user_request"
    elif accel_best_score >= 0.15:
        use_case_type = "non_existing_user_request"
    else:
        use_case_type = "not_relevant"

    results["use_case"] = use_case_type
    results["gap_topics"] = top_gap_topics(7)

    system_text = ""
    if mode == "voice":
        system_text += (
            " RESPOND IN PLAIN TEXT ONLY (NO MARKDOWN). "
            "Then provide a compact JSON OBJECT at the very end with keys {\"title\": string, \"text\": string} "
            "for the single best accelerator (if any). elaborate a bit on the accelerator for the text field."
            "If no accelerator is appropriate, use an empty string for \"title\" and still provide \"text\". "
            "State clearly whether the user's use case is: "
            "\"existing user request\", \"non existing user request\", or \"not relevant to accelerators or tech at all\". "
            "If the user asks about accelerators that are in demand but not in the current portfolio, use the provided "
            "gap topics to discuss the most requested missing areas and suggest next steps. In this case, it would not be a user request, but a non existing one."
        )
    else:
        system_text += (
            "Provide a compact JSON OBJECT at the very end with keys {\"title\": string, \"text\": string} "
            "for the single best accelerator (if any). elaborate a bit on the accelerator for the text field."
            "If no accelerator is appropriate, use an empty string for \"title\" and still provide \"text\". "
            "State clearly whether the user's use case is: "
            "\"existing user request\", \"non existing user request\", or \"not relevant to accelerators or tech at all\". "
            "If the user asks about accelerators that are in demand but not in the current portfolio, use the provided "
            "gap topics to discuss the most requested missing areas and suggest next steps. In this case, it would not be a user request, but a non existing one."
        )
        
    system_text += "If the query is not relevant, please say: 'This query is not related to accelerators.', and ask for a query related to accelerators. Do not provide the JSON object in this case."

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system_text
    )

    context = {
        "user_query": payload,
        "use_case_hint": results.get("use_case"),
        "top_matching_accelerators": results.get("accelerators", []),
        "top_similar_user_requests": results.get("user_requests", []),
        "gap_topics_in_demand_not_in_portfolio": results.get("gap_topics", []),
    }
    model_input = json.dumps(context, ensure_ascii=False)

    response = model.generate_content(model_input)
    generated = (response.text or "").strip()

    title = ""
    try:
        import re as _re
        m = list(_re.finditer(r"\{[^{}]*\}", generated))
        if m:
            tail_json = generated[m[-1].start():m[-1].end()]
            parsed = json.loads(tail_json)
            if isinstance(parsed, dict) and "text" in parsed and "title" in parsed:
                title = parsed.get("title", "") or ""
                generated = parsed.get("text", "") or generated
    except Exception:
        pass

    if results.get("accelerators") and not title:
        title = results["accelerators"][0].get("title", "") or ""

    use_case = results.get("use_case", "unknown")

    return JSONResponse({
        "text": generated,
        "title": title,
        "use_case": use_case
    })

@app.get("/report")
def report(k: int = 10, threshold: float = 0.15):
    """
    Returns a JSON report of insights:
      - dataset summary
      - coverage of user requests by accelerators (based on similarity threshold)
      - top 'gap topics' (in-demand but not in portfolio)
      - accelerator leaderboards (by hits and mean similarity)
      - similarity statistics across all requests
      - token coverage stats
    Query params:
      k: how many top items (gap topics, leaderboards) to return
      threshold: similarity threshold for 'covered' requests
    """
    global accel_embed, req_embed

    n_accel = len(accel_texts)
    n_reqs = len(reqs_texts)

    if n_accel == 0 or n_reqs == 0:
        raise HTTPException(500, "No data loaded for accelerators or requests.")

    try:
        sim = req_embed @ accel_embed.T
    except Exception as e:
        raise HTTPException(500, f"Similarity computation failed: {e}")

    best_idx = np.argmax(sim, axis=1)
    best_scores = sim[np.arange(sim.shape[0]), best_idx]

    covered_mask = best_scores >= threshold
    covered_count = int(np.sum(covered_mask))
    uncovered_count = int(n_reqs - covered_count)
    coverage_rate = float(covered_count / max(n_reqs, 1))

    hits = np.zeros(n_accel, dtype=int)
    for i, j in enumerate(best_idx):
        if best_scores[i] >= threshold:
            hits[j] += 1

    hit_order = np.argsort(-hits)[:k]
    leaderboard_by_hits = [
        {
            "rank": int(rank + 1),
            "accelerator_title": str(accel_df.iloc[j]["name"]),
            "hits": int(hits[j]),
        }
        for rank, j in enumerate(hit_order)
        if hits[j] > 0
    ]

    mean_sim_by_accel = np.mean(sim, axis=0)
    mean_order = np.argsort(-mean_sim_by_accel)[:k]
    leaderboard_by_mean = [
        {
            "rank": int(rank + 1),
            "accelerator_title": str(accel_df.iloc[j]["name"]),
            "mean_similarity": float(mean_sim_by_accel[j]),
        }
        for rank, j in enumerate(mean_order)
    ]

    all_scores = best_scores
    sim_stats = {
        "mean_best_similarity": float(np.mean(all_scores)),
        "median_best_similarity": float(np.median(all_scores)),
        "p90_best_similarity": float(np.percentile(all_scores, 90)),
        "min_best_similarity": float(np.min(all_scores)),
        "max_best_similarity": float(np.max(all_scores)),
        "threshold": float(threshold),
    }

    req_only_tokens = [t for t in (REQ_TOKENS - ACCEL_TOKENS)]
    accel_only_tokens = [t for t in (ACCEL_TOKENS - REQ_TOKENS)]
    overlap_tokens = [t for t in (REQ_TOKENS & ACCEL_TOKENS)]

    token_stats = {
        "req_token_count": int(len(REQ_TOKENS)),
        "accel_token_count": int(len(ACCEL_TOKENS)),
        "overlap_token_count": int(len(overlap_tokens)),
        "jaccard_overlap": float(len(overlap_tokens) / max(len(REQ_TOKENS | ACCEL_TOKENS), 1)),
        "top_gap_topics": top_gap_topics(k),
        "sample_req_only_tokens": req_only_tokens[:k],
        "sample_accel_only_tokens": accel_only_tokens[:k],
    }

    report = {
        "summary": {
            "accelerator_count": int(n_accel),
            "user_request_count": int(n_reqs),
            "embedding_dim": int(accel_embed.shape[1]),
        },
        "coverage": {
            "covered_requests": covered_count,
            "uncovered_requests": uncovered_count,
            "coverage_rate": coverage_rate,
        },
        "leaderboards": {
            "by_hits": leaderboard_by_hits,
            "by_mean_similarity": leaderboard_by_mean,
        },
        "similarity_stats": sim_stats,
        "token_stats": token_stats,
        "generated_at": pd.Timestamp.utcnow().isoformat() + "Z",
    }

    return JSONResponse(report)