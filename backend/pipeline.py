from google import genai
from google.genai import types
from google.genai.errors import ClientError
import os
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv
import re

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client()
TOP_K = 3

try:
    df = pd.read_csv("data/accelerators.csv", encoding="utf-8")
except UnicodeDecodeError:
    df = pd.read_csv("data/accelerators.csv", encoding="cp1252")

texts = []
cols = ['name', 'description']

def convert(row):
    parts = []
    for c in cols:
        if pd.notna(row[c]) and str(row[c].strip()):
            parts.append(str(row[c]).strip())
    return " | ".join(parts)

texts = [convert(row) for _, row in df.iterrows()]

DOMAIN_TOKENS = {}

with open("data/tokens.txt", "r") as fp:
    tokens = fp.read().split("\n")
    DOMAIN_TOKENS = set(tokens)

tokenize = lambda s: set(re.findall(r"[a-z0-9]+", s.lower()))

try:
    resp = client.models.embed_content(
        model="gemini-embedding-001",
        contents=texts,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
    )
    embeddings_matrix = np.array([np.array(e.values) for e in resp.embeddings])
except ClientError:
    print("Reached maximum Gemini quota! (wait a bit)")
    exit()
except Exception:
    print("Error! (probably reached quota...)")
    exit()

while True:
    inp = input("Ask a question: ")
    if not inp: break

    if not (tokenize(inp) & DOMAIN_TOKENS):
        print("We dont seem to have an accelerator for this use case yet!")
        continue
    
    resp = client.models.embed_content(
        model="gemini-embedding-001",
        contents=[inp],
        config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
    )

    inp_embedding = np.array(resp.embeddings[0].values).reshape(1, -1)
    similarities = cosine_similarity(inp_embedding, embeddings_matrix)[0]
    idxs = np.argsort(-similarities)[:TOP_K]

    best_idx = int(idxs[0])
    best_score = float(similarities[best_idx])

    if best_score < 0.15:
        print("We dont seem to have an accelerator for this use case yet!")
        exit()

    print("The best accelerators for you are:")
    for i in idxs:
        if len(texts[i]) > 120:
            print(f"{texts[i][:120]}...")
        else:
            print(f"{texts[i][:120]}")