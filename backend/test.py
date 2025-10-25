from google import genai
from dotenv import load_dotenv
import os

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Who is Snoopy?"
)

print(response.text)