from google import genai
import os
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv
import re

from embed import fully_embed, normalize, save_cache, load_cache

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client()

TOP_K = 3
VEC_PATH = "data/vectors.npy"
TXT_PATH = "data/texts.txt"

try:
    df = pd.read_csv("data/accelerators.csv", encoding="utf-8")
except UnicodeDecodeError:
    df = pd.read_csv("data/accelerators.csv", encoding="cp1252")

texts = []
cols = ['name', 'description']

def convert(row, cols):
    parts = []
    for c in cols:
        if pd.notna(row[c]) and str(row[c].strip()):
            parts.append(str(row[c]).strip())
    return " | ".join(parts)

texts = [convert(row, cols) for _, row in df.iterrows()]

DOMAIN_TOKENS = {}

with open("data/tokens.txt", "r") as fp:
    tokens = fp.read().split("\n")
    DOMAIN_TOKENS = set(tokens)

tokenize = lambda s: set(re.findall(r"[a-z0-9]+", s.lower()))

embeddings_matrix, cache = load_cache(VEC_PATH, TXT_PATH)

if embeddings_matrix is None or cache != texts:
    vec = fully_embed(client, texts, "RETRIEVAL_DOCUMENT", True)
    vec = normalize(vec)

    save_cache(VEC_PATH, TXT_PATH, vec, texts) 
    embeddings_matrix, _ = load_cache(VEC_PATH, TXT_PATH)

while True:
    inp = input("Ask a question: ")
    if not inp: break

    if not (tokenize(inp) & DOMAIN_TOKENS):
        print("\nWe dont seem to have an accelerator for this use case yet!")
        continue

    q_vec = fully_embed(client, [inp], "RETRIEVAL_QUERY", True)
    q_vec = normalize(q_vec)

    if q_vec.shape[1] != embeddings_matrix.shape[1]:
        vec = fully_embed(client, texts, "RETRIEVAL_DOCUMENT", True)
        vec = normalize(vec)
        save_cache(VEC_PATH, TXT_PATH, vec, texts)
        embeddings_matrix, _ = load_cache(VEC_PATH, TXT_PATH)

    similarities = (q_vec @ embeddings_matrix.T)[0]
    idxs = np.argsort(-similarities)[:TOP_K]

    best_idx = int(idxs[0])
    best_score = float(similarities[best_idx])

    if best_score < 0.15:
        print("\nWe dont seem to have an accelerator for this use case yet!")
        exit()

    print("\nThe best accelerators for you are:")
    for i in idxs:
        if len(texts[i]) > 120:
            print(f"{texts[i][:120]}...")
        else:
            print(f"{texts[i][:120]}")