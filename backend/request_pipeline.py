from google import genai
import os
import numpy as np
import pandas as pd
from dotenv import load_dotenv
import re

from embed import fully_embed, normalize, save_cache, load_cache, convert

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client()

TOP_K = 3
VEC_PATH = "data/user_vectors.npy"
TXT_PATH = "data/user_text.txt"

try:
    df = pd.read_csv("data/u_hack.csv", encoding="utf-8")
except UnicodeDecodeError:
    df = pd.read_csv("data/u_hack.csv", encoding="cp1252")

texts = []
cols = ["number", "capability", "company", "description", "initiative_title", "primary_category"]
texts = [convert(row, cols) for _, row in df.iterrows()]

DOMAIN_TOKENS = {}

with open("data/hack_tokens.txt", "r") as fp:
    tokens = fp.read().splitlines()
    DOMAIN_TOKENS = set(tokens)

tokenize = lambda x: set(re.findall(r"[a-z0-9]+", x.lower()))

embeddings_matrix, cache = load_cache(VEC_PATH, TXT_PATH)

if embeddings_matrix is None or cache != texts:
    vec = fully_embed(client, texts, "RETRIEVAL_DOCUMENT", True)
    vec = normalize(vec)

    save_cache(VEC_PATH, TXT_PATH, vec, texts)
    embeddings_matrix, _ = load_cache(VEC_PATH, TXT_PATH)

while True:
    inp = input("Query this dataset: ")
    if not inp: break

    if not (tokenize(inp) & DOMAIN_TOKENS):
        print("\nLess precise input")

    q_vec = fully_embed(client, [inp], "RETRIEVAL_QUERY", True)
    q_vec = normalize(q_vec)
    if q_vec.ndim == 1:
        q_vec = q_vec[None, :]

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
        print("\nWe don't seem to have a user request for this use case yet!")
        continue

    print("\nThe best user requests for you are:")
    for i in idxs:
        if len(texts[i]) > 120:
            print(f"{texts[i][:120]}...")
        else:
            print(f"{texts[i][:120]}")