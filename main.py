"""FastAPI application entry point for TOEIC 2-Skills Mastery App."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.attempt_routes import router as attempt_router
from api.exam_routes import router as exam_router
from api.flashcard_routes import router as flashcard_router
from api.import_routes import router as import_router
from api.study_routes import router as study_router
from config import API_PREFIX, DATA_DIR, UPLOAD_AUDIO_DIR, UPLOAD_IMAGES_DIR
from infrastructure.database import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    logger.info("Initializing database…")
    await init_db()
    logger.info("Database ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="TOEIC 2-Skills Mastery",
    version="0.1.0",
    lifespan=lifespan,
)

# --- CORS (dev) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API routers ---
app.include_router(import_router, prefix=API_PREFIX)
app.include_router(exam_router, prefix=API_PREFIX)
app.include_router(attempt_router, prefix=API_PREFIX)
app.include_router(study_router, prefix=API_PREFIX)
app.include_router(flashcard_router, prefix=API_PREFIX)

# --- Static file serving for uploaded media ---
UPLOAD_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads/images",
    StaticFiles(directory=str(UPLOAD_IMAGES_DIR)),
    name="images",
)
app.mount(
    "/uploads/audio",
    StaticFiles(directory=str(UPLOAD_AUDIO_DIR)),
    name="audio",
)

# --- Serve uploaded images via /data/ path as well ---
app.mount(
    "/data",
    StaticFiles(directory=str(DATA_DIR)),
    name="data",
)

# --- Serve frontend ---
FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"
FRONTEND_STATIC = FRONTEND_DIST / "static"

if FRONTEND_STATIC.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_STATIC)), name="frontend_static")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Catch-all route: serve index.html for SPA routing."""
    from fastapi.responses import FileResponse

    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"detail": "Frontend not found"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
