import os
import numpy as np
from google import genai

LOCAL_MODEL = None

# various helpers :)

def use_model():
    global LOCAL_MODEL

    if LOCAL_MODEL is None:
        from sentence_transformers import SentenceTransformer
        LOCAL_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return LOCAL_MODEL

def gemini_model(client, texts, task):
    res = client.models.embed_content(
        model="gemini-embedding-001",
        contents=texts,
        config=genai.types.EmbedContentConfig(task_type=task),
    )
    return np.array([np.array(e.values, dtype=np.float32) for e in res.embeddings])

def local_embedding(texts):
    model = use_model()
    vec = model.encode(texts, convert_to_numpy=True, normalize_embeddings=False)
    return vec.astype(np.float32)

def normalize(vec):
    denom = np.linalg.norm(vec, axis=1, keepdims=True) + 1e-12
    return vec/denom

def fully_embed(client, texts, task, use_local=True):
    try:
        vec = gemini_model(client, texts, task)
        return vec
    except genai.errors.ClientError:
        if use_local:
            print("gemini rate limited...")
            return local_embedding(texts)

def save_cache(vec_path, text_path, vec, texts):
    os.makedirs(os.path.dirname(vec_path), exist_ok=True)
    np.save(vec_path, vec)
    with open(text_path, "w", encoding="utf-8") as f:
        for t in texts:
            f.write(t.replace("\n", " ").strip() + "\n")

def load_cache(vec_path, text_path):
    if not (os.path.exists(vec_path) and os.path.exists(text_path)):
        return None, None

    vec = np.load(vec_path)

    with open(text_path, "r", encoding="utf-8") as f:
        texts = [line.rstrip("\n") for line in f]
    return vec, texts