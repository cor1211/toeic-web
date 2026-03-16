"""Application configuration with Cloud/Local environment support."""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:  # pragma: no cover - optional dependency fallback
    def load_dotenv() -> bool:
        """Fallback when python-dotenv is not installed."""
        return False

# Load .env file if it exists
load_dotenv()

# --- Project Paths ---
BASE_DIR: Path = Path(__file__).resolve().parent
DATA_DIR: Path = BASE_DIR / "data"

# Sub-directories
UPLOAD_HTML_DIR: Path = DATA_DIR / "uploads" / "html"
UPLOAD_AUDIO_DIR: Path = DATA_DIR / "uploads" / "audio"
UPLOAD_IMAGES_DIR: Path = DATA_DIR / "uploads" / "images"

# --- Database & Storage Configuration ---
# STORAGE_MODE: "LOCAL" or "CLOUD"
STORAGE_MODE: str = os.getenv("STORAGE_MODE", "LOCAL")

# Fallback to local SQLite if DATABASE_URL is not set
DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DATA_DIR}/app.db")

# Supabase Credentials (required for STORAGE_MODE="CLOUD")
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "toeic-assets")

# --- API ---
API_PREFIX: str = "/api"
CORS_ORIGINS: list[str] = ["*"]

# Ensure local directories exist
for _dir in (DATA_DIR, UPLOAD_HTML_DIR, UPLOAD_AUDIO_DIR, UPLOAD_IMAGES_DIR):
    _dir.mkdir(parents=True, exist_ok=True)
