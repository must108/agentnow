from google import genai
from google.genai import types
import os
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client()

texts = [
    "Extend Your AI Search | Prescriptive guidance on extending your AI Search beyond the foundational level",
    "Jumpstart Your Success Dashboard | Applied demonstration of how the Success Dashboard provides insight into the performance and quality metrics of your ITSM and HR implementation.",
    "UX: Catalog Request Experience Review | Improvement of your service catalog forms through focused user feedback sessions. Gaining actionable insights and expert recommendations in a comprehensive report."
]

database = [
    np.array(e.values) for e in client.models.embed_content(
        model="gemini-embedding-001",
        contents=texts,
        config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY")).embeddings
]

embeddings_matrix = np.array(database)

while True:
    inp = input("Ask a question: ")
    
    resp = client.models.embed_content(
        model="gemini-embedding-001",
        contents=[inp],
        config=types.EmbedContentConfig(task_type="SEMANTIC_SIMILARITY")
    )

    inp_embedding = np.array(resp.embeddings[0].values).reshape(1, -1)
    similarities = cosine_similarity(inp_embedding, embeddings_matrix)[0]

    final = sorted(zip(texts, similarities), key=lambda x: x[1], reverse=True)
    print(f"The best accelerator for you is: {final[0][0]}")