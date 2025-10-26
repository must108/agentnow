from google import genai
import os
import numpy as np
import pandas as pd
from dotenv import load_dotenv
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from embed import fully_embed, normalize, save_cache, load_cache, convert

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client()

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
def query(payload):
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
    
    if accel_best_score < 0.15:
        results["message"] = "We don't seem to have an accelerator related to this query yet!"
    else:
        results["accelerators"] = [
            {
                "text": accel_texts[i]
            }
            for i in accel_idxs
        ]

    if req_best_score < 0.15:
        results["message"] = "We don't seem to have an user request related to this query yet!"
    else:
        results["user_requests"] = [
            {
                "text": reqs_texts[i]
            }
            for i in req_idxs
        ]

    return results

'''
<button id="ptt">🎙️ Hold to talk</button>
<script>
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new SR(); r.lang="en-US"; r.interimResults=true; r.continuous=false;
  let finalText = "";
  r.onresult = e => finalText = [...e.results].map(x=>x[0].transcript).join("");
  r.onend = () => window.postMessage({ type:"VOICE_TEXT", text: finalText });
  const btn = document.getElementById("ptt");
  btn.onmousedown = ()=>r.start();
  btn.onmouseup   = ()=>r.stop();
</script>

'''