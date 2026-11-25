"""
CyberHash Toolkit — FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.database import init_db

FRONTEND_ORIGINS = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000,http://localhost:8000",
).split(",")

app = FastAPI(
    title="CyberHash Toolkit API",
    description="Hash generation, identification, comparison, encoding, and bounded educational cracking demos.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(api_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "CyberHash Toolkit API"}


# Serve the static frontend from the same origin, at "/", when the
# frontend/ directory sits alongside backend/ (the default project layout).
_frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
if os.path.isdir(_frontend_dir):
    app.mount("/", StaticFiles(directory=_frontend_dir, html=True), name="frontend")
