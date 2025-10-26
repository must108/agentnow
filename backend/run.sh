cd backend

# for windows
venv\Scripts\Activate.ps1

# for unix
source venv/bin/activate

python -m uvicorn api:app --reload --port 8000