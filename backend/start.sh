#!/usr/bin/env bash
# start.sh — launch the RAG API defined in api.py
# Usage: ./start.sh
# Optional: PORT=8080 ./start.sh

set -euo pipefail

# --- paths ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR=".venv"
PYBIN="$(command -v python3.11 || command -v python3 || command -v python)"
PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

echo "▶ Using Python: $PYBIN"
echo "▶ Project root: $SCRIPT_DIR"
echo "▶ Host/Port    : $HOST:$PORT"

# --- create venv if missing ---
if [[ ! -d "$VENV_DIR" ]]; then
  echo "📦 Creating virtualenv at $VENV_DIR ..."
  "$PYBIN" -m venv "$VENV_DIR"
fi

# --- activate venv ---
# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

# --- upgrade pip ---
python -m pip install --upgrade pip wheel setuptools

# --- install deps ---
if [[ -f "requirements.txt" ]]; then
  echo "📦 Installing from requirements.txt ..."
  pip install --no-input -r requirements.txt
else
  echo "📦 Installing minimal dependencies ..."
  pip install --no-input \
    fastapi uvicorn[standard] gunicorn python-dotenv \
    google-generativeai google-genai \
    numpy pandas charset-normalizer
fi

# --- load env file if present ---
if [[ -f ".env" ]]; then
  echo "🔐 Loading .env ..."
  # export non-comment, non-empty lines as env vars
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# --- sanity checks ---
if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "❌ Missing GEMINI_API_KEY (set it in environment or .env)."
  exit 1
fi

# Ensure data directory exists (embeddings & CSVs live here)
mkdir -p data

# --- info ---
echo "✅ Environment ready."
echo "ℹ️  First boot may take longer while embeddings/caches are built from:"
echo "    - data/accelerators.csv"
echo "    - data/u_hack.csv"
echo "    - caches: data/*.npy / data/*_text.txt"

# --- run app ---
# api.py defines: app = FastAPI(...)
# so the ASGI target is "api:app"
echo "🚀 Starting Gunicorn (UvicornWorker) ..."
exec gunicorn -k uvicorn.workers.UvicornWorker api:app \
  --bind "${HOST}:${PORT}" \
  --workers 2 \
  --timeout 180 \
  --access-logfile - \
  --error-logfile -
