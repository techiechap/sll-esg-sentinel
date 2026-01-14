
# ESG Sentinel

Desktop-grade dashboard for Sustainability-Linked Loans (SLL): parses LMA-style loan agreements to extract Sustainability Performance Targets (SPTs) and provides a real-time margin ratchet calculator (bps).

## Features
- Automated document ingestion (SPT extraction)
- Tactical command-center UI (React + Tailwind v4)
- Live margin ratchet calculator (bps adjustments)
- Audit-friendly ESG-to-pricing linkage

## Tech
- Frontend: React, Tailwind CSS v4
- Backend: FastAPI (Python)

## Run locally (quickstart)
### Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

### Frontend
cd frontend
npm i
npm run dev
