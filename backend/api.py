from google import genai as genai_client
import google.generativeai as genai
import os
import io
import json
import re
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from threading import Lock
from typing import Sequence, Optional
from collections import Counter, defaultdict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from embed import fully_embed, normalize, save_cache, load_cache, convert

# -------------------------------------------------
# Optional encoding detector (safe if not installed)
#   pip install charset-normalizer
# -------------------------------------------------
try:
    from charset_normalizer import from_bytes as _cn_from_bytes  # type: ignore
except Exception:
    _cn_from_bytes = None

_WORD_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_\-+/\.]*")

# --- cosine-safe L2 normalization (even if you've normalized at write-time) ---
def l2_normalize(mat: np.ndarray) -> np.ndarray:
    if mat is None:
        return mat
    norms = np.linalg.norm(mat, axis=1, keepdims=True) + 1e-12
    return mat / norms

# --- stronger stoplist to avoid generic "goal/technical/best" tokens showing up ---
_STOP_EXTRA = {
    "goal","technical","practices","best","ensure","solution","solutions","understand",
    "product","aims","seeks","leverage","optimize","improve","support","enable",
    "request","requests","accelerator","accelerators","program","programs","project","projects",
    "learn","learning","initiative","initiatives","overview","foundations","platform","platforms",
    "guide","guides","prescriptive","demonstration","readiness","management","capability","capabilities"
}

def is_good_token(t: str, min_len: int = 3) -> bool:
    if len(t) < min_len:
        return False
    if t in _STOP_EXTRA:
        return False
    return True

def simple_tokenize(text: str) -> list[str]:
    return [w.lower() for w in _WORD_RE.findall(text or "")]

def build_uncovered_theme_recs(
    uncovered_idxs: np.ndarray,
    k: int = 10,
    min_len_token: int = 3,
    stop: set[str] = None,
) -> list[dict]:
    """
    Rank uncovered 'themes' by demand and return structured recs.
    If 'uncovered_idxs' is empty, we'll fallback to overall GAP_FREQ-driven themes.
    """
    if stop is None:
        stop = {
            "and","or","the","a","an","for","to","in","on","of","with","by",
            "from","at","as","is","are","be","that","this","it","we","you",
            "your","our","their","via","using","use","into","across","per",
            "new","latest","best","good","great","help","support","accel",
            "accelerator","accelerators","program","project","request","requests",
            "build","create","implement","implementation","pilot","po","poc"
        }
    stop = stop | _STOP_EXTRA

    # --- Fallback if nothing to analyze ---
    if uncovered_idxs is None or len(uncovered_idxs) == 0:
        # Use your global GAP_FREQ as a resilient fallback
        top = [(w, c) for w, c in GAP_FREQ.most_common(k) if is_good_token(w, min_len_token)]
        recs = []
        for rank, (tok, cnt) in enumerate(top, start=1):
            # find up to 3 sample requests containing the token
            samples = []
            for i, txt in enumerate(reqs_texts):
                if tok in tokenize(txt):
                    if "title" in reqs_df.columns and pd.notna(reqs_df.iloc[i].get("title", "")):
                        samples.append(str(reqs_df.iloc[i]["title"]))
                    else:
                        samples.append(re.sub(r"\s+", " ", txt).strip()[:220])
                if len(samples) >= 3:
                    break
            recs.append({
                "rank": rank,
                "theme": tok,
                "demand": int(cnt),
                "sample_requests": samples,
                "top_related_tokens": []
            })
        return recs

    # --- Normal uncovered-token mining path ---
    req_uncovered_tokens: list[list[str]] = []
    token_to_reqidxs: defaultdict[str, list[int]] = defaultdict(list)

    # map from absolute req index to local position inside uncovered_idxs (for co-occurrence)
    local_index_of = {int(idx): pos for pos, idx in enumerate(uncovered_idxs.tolist())}

    for r_idx in uncovered_idxs:
        txt = reqs_texts[int(r_idx)]
        toks = [t for t in simple_tokenize(txt)
                if is_good_token(t, min_len_token)
                and t not in stop
                and t not in ACCEL_TOKENS]
        uniq = sorted(set(toks))
        req_uncovered_tokens.append(uniq)
        for t in uniq:
            token_to_reqidxs[t].append(int(r_idx))

    demand = [(t, len(idxs)) for t, idxs in token_to_reqidxs.items()]
    demand.sort(key=lambda x: (-x[1], x[0]))
    top = demand[:k]

    recs = []
    for rank, (tok, cnt) in enumerate(top, start=1):
        idxs = token_to_reqidxs[tok]
        co_counter = Counter()
        for abs_i in idxs:
            li = local_index_of.get(abs_i, None)
            if li is None:
                continue
            for ct in req_uncovered_tokens[li]:
                if ct != tok:
                    co_counter[ct] += 1
        top_related = [t for t, _ in co_counter.most_common(5)]

        samples = []
        for abs_i in idxs[:3]:
            if "title" in reqs_df.columns and pd.notna(reqs_df.iloc[abs_i].get("title", "")):
                samples.append(str(reqs_df.iloc[abs_i]["title"]))
            else:
                samples.append(re.sub(r"\s+", " ", reqs_texts[abs_i]).strip()[:220])

        recs.append({
            "rank": rank,
            "theme": tok,
            "demand": int(cnt),
            "sample_requests": samples,
            "top_related_tokens": top_related,
        })

    return recs


# -------------------------------------------------
# Robust CSV loader to tolerate mixed encodings
# -------------------------------------------------
def read_csv_robust(
    path: str,
    encodings: Sequence[str] = ("utf-8", "utf-8-sig", "cp1252", "latin-1", "iso-8859-1"),
    **kwargs,
) -> pd.DataFrame:
    """
    Try several encodings, then optional charset detection, then latin-1 fallback.
    Uses forgiving parser defaults to avoid hard crashes on bad rows.
    """
    base_kwargs = dict(
        dtype=str,              # keep raw strings; parse later if needed
        keep_default_na=False,  # don't coerce "NA" etc. to NaN
        on_bad_lines="skip",    # skip malformed lines
        engine="python",        # more forgiving tokenizer
    )
    base_kwargs.update(kwargs)

    # 1) quick encodings
    for enc in encodings:
        try:
            return pd.read_csv(path, encoding=enc, **base_kwargs)
        except UnicodeDecodeError:
            continue
        except FileNotFoundError:
            raise

    # 2) detect if possible
    if _cn_from_bytes is not None:
        with open(path, "rb") as f:
            raw = f.read()
        res = _cn_from_bytes(raw).best()
        if res:
            try:
                return pd.read_csv(io.BytesIO(raw), encoding=res.encoding or "utf-8", **base_kwargs)
            except UnicodeDecodeError:
                pass

    # 3) final latin-1 pass + NBSP normalization
    with open(path, "rb") as f:
        raw = f.read()
    txt = raw.decode("latin-1")
    txt = txt.replace("\u00a0", " ")  # NBSP -> space
    return pd.read_csv(io.StringIO(txt), **base_kwargs)


# ---------------------------
# Setup & Globals
# ---------------------------

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("Missing GEMINI_API_KEY in environment.")
client = genai_client.Client(api_key=api_key)
genai.configure(api_key=api_key)

TOP_K = 3

ACCEL_VEC_PATH = "data/accel_vectors.npy"
ACCEL_TXT_PATH = "data/accel_text.txt"

REQ_VEC_PATH = "data/user_vectors.npy"
REQ_TXT_PATH = "data/user_text.txt"

# Concurrency guard for request logging / embedding updates
REQ_LOCK = Lock()

def _norm_text(s: str) -> str:
    """Normalize text for dedup: lowercase + collapse whitespace."""
    return re.sub(r"\s+", " ", (s or "").strip().lower())

# ---------------------------
# Load data (robustly)
# ---------------------------

try:
    accel_df = read_csv_robust("data/accelerators.csv")
    reqs_df  = read_csv_robust("data/u_hack.csv")
except FileNotFoundError as e:
    raise RuntimeError(f"Required CSV not found: {e.filename}") from e

accel_cols = ['name', 'description']
reqs_cols  = ["number", "capability", "company", "description", "initiative_title", "primary_category"]

accel_texts = [convert(row, accel_cols) for _, row in accel_df.iterrows()]
reqs_texts  = [convert(row, reqs_cols)  for _, row in reqs_df.iterrows()]

# ---------------------------
# Token sets (robust read)
# ---------------------------

def _read_lines_robust(path: str) -> list[str]:
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1", "iso-8859-1"):
        try:
            with open(path, "r", encoding=enc, errors="strict") as fp:
                return [ln.rstrip("\n\r") for ln in fp]
        except UnicodeDecodeError:
            continue
    # last resort
    with open(path, "r", encoding="latin-1", errors="ignore") as fp:
        return [ln.rstrip("\n\r") for ln in fp]

try:
    ACCEL_TOKENS = set(_read_lines_robust("data/accel_tokens.txt"))
except FileNotFoundError:
    ACCEL_TOKENS = set()

try:
    REQ_TOKENS = set(_read_lines_robust("data/hack_tokens.txt"))
except FileNotFoundError:
    REQ_TOKENS = set()

tokenize = lambda x: set(re.findall(r"[a-z0-9]+", x.lower()))

# ---------------------------
# Load / ensure caches
# ---------------------------

accel_embed, accel_cache = load_cache(ACCEL_VEC_PATH, ACCEL_TXT_PATH)
req_embed,   req_cache   = load_cache(REQ_VEC_PATH, REQ_TXT_PATH)

# Ensure accelerator embeddings
if accel_embed is None or accel_cache != accel_texts:
    vec = fully_embed(client, accel_texts, "RETRIEVAL_DOCUMENT", True)
    vec = normalize(vec)
    save_cache(ACCEL_VEC_PATH, ACCEL_TXT_PATH, vec, accel_texts)
    accel_embed, _ = load_cache(ACCEL_VEC_PATH, ACCEL_TXT_PATH)

# Ensure request embeddings
if req_embed is None or req_cache != reqs_texts:
    vec = fully_embed(client, reqs_texts, "RETRIEVAL_DOCUMENT", True)
    vec = normalize(vec)
    save_cache(REQ_VEC_PATH, REQ_TXT_PATH, vec, reqs_texts)
    req_embed, _ = load_cache(REQ_VEC_PATH, REQ_TXT_PATH)

# ---------------------------
# Initial gap frequencies
# ---------------------------

GAP_FREQ = Counter()
for text in reqs_texts:
    toks = tokenize(text)
    for t in toks:
        if t in REQ_TOKENS and t not in ACCEL_TOKENS:
            GAP_FREQ[t] += 1

def top_gap_topics(k: int) -> list[str]:
    return [w for w, _ in GAP_FREQ.most_common(k)]

# ---------------------------
# Persistence / Incremental embedding
# ---------------------------

def persist_user_request(text: str, meta: Optional[dict] = None):
    """
    Persist a new user request and update embeddings/caches incrementally.

    Steps:
    - Deduplicate by normalized text
    - Append to reqs_texts/reqs_df
    - Embed only the new text; if dim mismatch, re-embed all
    - Update caches (npy + txt), token sets, GAP_FREQ
    - Save CSV back to disk
    """
    global reqs_df, reqs_texts, req_embed, REQ_TOKENS, GAP_FREQ

    t_clean = (text or "").strip()
    if not t_clean:
        return {"status": "skipped", "reason": "empty"}

    # Dedup
    nset = {_norm_text(t) for t in reqs_texts}
    if _norm_text(t_clean) in nset:
        return {"status": "skipped", "reason": "duplicate"}

    with REQ_LOCK:
        # ---- 1) Append in memory and DataFrame (keep schema) ----
        reqs_texts.append(t_clean)

        new_row = {
            "number": "",
            "capability": "",
            "company": "",
            "description": t_clean,
            "initiative_title": "",
            "primary_category": "",
        }
        reqs_df = pd.concat([reqs_df, pd.DataFrame([new_row])], ignore_index=True)

        # ---- 2) Embed & update req_embed ----
        try:
            new_vec = fully_embed(client, [t_clean], "RETRIEVAL_DOCUMENT", True)
            new_vec = normalize(new_vec)
        except Exception as e:
            return {"status": "error", "reason": f"embed_failed: {e}"}

        if req_embed is None:
            req_embed = new_vec
        else:
            if new_vec.shape[1] != req_embed.shape[1]:
                # Mismatch (e.g., model changed) -> re-embed all
                all_vecs = fully_embed(client, reqs_texts, "RETRIEVAL_DOCUMENT", True)
                req_embed = normalize(all_vecs)
            else:
                req_embed = np.vstack([req_embed, new_vec])

        # ---- 3) Save cache to disk ----
        save_cache(REQ_VEC_PATH, REQ_TXT_PATH, req_embed, reqs_texts)

        # ---- 4) Update tokens & gap counts ----
        toks = tokenize(t_clean)
        REQ_TOKENS.update(toks)
        for t in toks:
            if t in REQ_TOKENS and t not in ACCEL_TOKENS:
                GAP_FREQ[t] += 1

        # ---- 5) Save CSV ----
        try:
            reqs_df.to_csv("data/u_hack.csv", index=False, encoding="utf-8")
        except Exception:
            # very rare fallback on Windows if a weird char sneaks in
            reqs_df.to_csv("data/u_hack.csv", index=False, encoding="cp1252")

    return {"status": "ok"}

# ---------------------------
# FastAPI App
# ---------------------------

app = FastAPI(title="Search")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust to your domains in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/hello")
def hello():
    return {"message": "hello, world!"}

# Optional: manual ingestion endpoint
class RequestIn(BaseModel):
    text: str
    meta: Optional[dict] = None

@app.post("/requests")
def add_request(body: RequestIn):
    res = persist_user_request(body.text, body.meta)
    if res.get("status") == "error":
        raise HTTPException(500, res.get("reason", "unknown"))
    return res

# Optional: full reindex (if model changed)
@app.post("/reindex")
def reindex_requests():
    global req_embed
    try:
        with REQ_LOCK:
            vec = fully_embed(client, reqs_texts, "RETRIEVAL_DOCUMENT", True)
            req_embed = normalize(vec)
            save_cache(REQ_VEC_PATH, REQ_TXT_PATH, req_embed, reqs_texts)
        return {"status": "ok", "count": len(reqs_texts)}
    except Exception as e:
        raise HTTPException(500, f"reindex_failed: {e}")

@app.get("/query")
def query(payload: str, mode: str):
    global accel_embed, req_embed
    q = (payload or "").strip()

    if not q:
        raise HTTPException(400, "Empty query")
    
    results = { 
        "message": None,
        "accelerators": [],
        "user_requests": []
    }

    # Embed query
    q_vec = fully_embed(client, [q], "RETRIEVAL_QUERY", True)
    q_vec = normalize(q_vec)
    if q_vec.ndim == 1:
        q_vec = q_vec[None, :]

    # Ensure dims match against current caches (rebuild if needed)
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

    # Similarities
    accel_similarities = (q_vec @ accel_embed.T)[0]
    req_similarities = (q_vec @ req_embed.T)[0]

    accel_idxs = np.argsort(-accel_similarities)[:TOP_K]
    req_idxs = np.argsort(-req_similarities)[:TOP_K]

    accel_best_idx = int(accel_idxs[0])
    req_best_idx   = int(req_idxs[0])

    accel_best_score = float(accel_similarities[accel_best_idx])
    req_best_score   = float(req_similarities[req_best_idx])
    
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
            {"text": reqs_texts[i]}
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

    # ✅ Persist accelerator-relevant queries as user requests
    if use_case_type != "not_relevant":
        try:
            persist_user_request(
                q,
                meta={
                    "mode": mode,
                    "accel_best_score": accel_best_score,
                    "req_best_score": req_best_score,
                },
            )
        except Exception:
            # don't block response if logging fails
            pass

    # ----- LLM synthesis -----
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
        m = list(re.finditer(r"\{[^{}]*\}", generated))
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
def report(k: int = 10, threshold: float = 0.15, margin_delta: float = 0.03):
    """
    Returns a lean JSON report with:
      - summary
      - coverage (with adaptive threshold/margin if needed)
      - leaderboards.by_hits
      - token_stats
      - recommendations.top_uncovered_themes (true-uncovered, margin-based weakly-covered, or GAP_FREQ fallback)
    """
    global accel_embed, req_embed

    n_accel = len(accel_texts)
    n_reqs  = len(reqs_texts)
    if n_accel == 0 or n_reqs == 0:
        raise HTTPException(500, "No data loaded for accelerators or requests.")

    # --- cosine-safe normalization (even if already normalized at caching time) ---
    accel_mat = l2_normalize(accel_embed)
    req_mat   = l2_normalize(req_embed)

    # --- similarity ---
    try:
        sim = req_mat @ accel_mat.T
    except Exception as e:
        raise HTTPException(500, f"Similarity computation failed: {e}")

    # --- best & second-best for margin ---
    best_idx    = np.argmax(sim, axis=1)
    best_scores = sim[np.arange(sim.shape[0]), best_idx]

    # partition to get second best efficiently
    if sim.shape[1] >= 2:
        part_sorted = np.partition(sim, -2, axis=1)
        second_best = part_sorted[:, -2]
    else:
        # degenerate case: only one accelerator -> second_best = -inf
        second_best = np.full_like(best_scores, -1e9)
    margins = best_scores - second_best

    # --- initial coverage ---
    covered_mask = (best_scores >= threshold) & (margins >= margin_delta)
    coverage_rate = float(covered_mask.mean())

    # --- adapt if everything looks covered (common when threshold is too low) ---
    if coverage_rate > 0.98:
        # raise threshold to 80th percentile of best scores
        adaptive_thr = float(np.percentile(best_scores, 80))
        threshold = max(threshold, adaptive_thr)
        covered_mask = (best_scores >= threshold) & (margins >= margin_delta)
        coverage_rate = float(covered_mask.mean())

    covered_indices   = np.where(covered_mask)[0]
    uncovered_indices = np.where(~covered_mask)[0]

    covered_count   = int(covered_mask.sum())
    uncovered_count = int(n_reqs - covered_count)

    # --- Leaderboard by hits (kept) ---
    hits = np.zeros(n_accel, dtype=int)
    for i, j in enumerate(best_idx):
        if covered_mask[i]:
            hits[j] += 1
    hit_order = np.argsort(-hits)[:k]
    leaderboard_by_hits = [
        {"rank": int(rank + 1),
         "accelerator_title": str(accel_df.iloc[j]["name"]),
         "hits": int(hits[j])}
        for rank, j in enumerate(hit_order) if hits[j] > 0
    ]

    # --- Recommendations: prefer true uncovered; else margin-weak; else GAP_FREQ fallback ---
    recs: list[dict]
    if len(uncovered_indices) > 0:
        recs = build_uncovered_theme_recs(uncovered_indices, k=k)
    else:
        # Weakly-covered: best exceeds threshold but margin is small -> ambiguous mapping
        weak_mask = (best_scores >= threshold) & (margins < margin_delta)
        weak_indices = np.where(weak_mask)[0]
        if len(weak_indices) > 0:
            recs = build_uncovered_theme_recs(weak_indices, k=k)
        else:
            # final fallback to global gaps
            recs = build_uncovered_theme_recs(np.array([], dtype=int), k=k)

    # --- Token overlap (kept) ---
    req_only_tokens   = [t for t in (REQ_TOKENS - ACCEL_TOKENS)]
    accel_only_tokens = [t for t in (ACCEL_TOKENS - REQ_TOKENS)]
    overlap_tokens    = [t for t in (REQ_TOKENS & ACCEL_TOKENS)]

    token_stats = {
        "req_token_count": int(len(REQ_TOKENS)),
        "accel_token_count": int(len(ACCEL_TOKENS)),
        "overlap_token_count": int(len(overlap_tokens)),
        "jaccard_overlap": float(len(overlap_tokens) / max(len(REQ_TOKENS | ACCEL_TOKENS), 1)),
        "top_gap_topics": top_gap_topics(k),
        "sample_req_only_tokens": req_only_tokens[:k],
        "sample_accel_only_tokens": accel_only_tokens[:k],
    }

    # --- final report (lean) ---
    report = {
        "summary": {
            "accelerator_count": int(n_accel),
            "user_request_count": int(n_reqs),
            "embedding_dim": int(accel_mat.shape[1]),
        },
        "coverage": {
            "covered_requests": covered_count,
            "uncovered_requests": uncovered_count,
            "coverage_rate": coverage_rate,
        },
        "leaderboards": {
            "by_hits": leaderboard_by_hits,
        },
        "token_stats": token_stats,
        "recommendations": {
            "top_uncovered_themes": recs
        },
        # tiny, useful debug (doesn't clutter UI)
        "debug": {
            "threshold_used": float(threshold),
            "margin_used": float(margin_delta),
        },
        "generated_at": pd.Timestamp.utcnow().isoformat() + "Z",
    }
    return JSONResponse(report)
