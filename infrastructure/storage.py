"""Storage abstraction layer — handles local vs cloud file operations."""

import os
import logging
import aiofiles
import io
from pathlib import Path
from typing import Optional
from supabase import create_client, Client
from config import STORAGE_MODE, SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET, UPLOAD_AUDIO_DIR, UPLOAD_IMAGES_DIR

logger = logging.getLogger(__name__)

# Initialize Supabase client if in cloud mode
_supabase: Optional[Client] = None
if STORAGE_MODE == "CLOUD":
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE_URL and SUPABASE_KEY must be set for CLOUD storage mode.")
    else:
        try:
            _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("Supabase client initialized for bucket: %s", SUPABASE_BUCKET)
        except Exception as e:
            logger.error("Failed to initialize Supabase client: %s", str(e))

async def upload_file(
    content: bytes, 
    filename: str, 
    folder: str = "images"
) -> str:
    """
    Upload a file to storage and return its accessible URL/path.
    """
    logger.info("Uploading file: %s to folder: %s (Mode: %s)", filename, folder, STORAGE_MODE)
    
    if STORAGE_MODE == "CLOUD":
        if not _supabase:
            raise ValueError("Supabase client not initialized. Check your environment variables.")
            
        path_on_bucket = f"{folder}/{filename}"
        try:
            logger.debug("Attempting Supabase upload: %s", path_on_bucket)
            # Use BytesIO to ensure compatibility with Supabase SDK
            file_object = io.BytesIO(content)
            
            # Note: upload might fail if file exists, so we use upsert=True if supported 
            # or just handle the error.
            res = _supabase.storage.from_(SUPABASE_BUCKET).upload(
                path=path_on_bucket,
                file=file_object,
                file_options={
                    "content-type": _get_content_type(filename),
                    "x-upsert": "true" # Custom flag some SDKs use or just handle error
                }
            )
            
            # Get public URL
            url_resp = _supabase.storage.from_(SUPABASE_BUCKET).get_public_url(path_on_bucket)
            # url_resp might be a string or an object depending on version
            url = url_resp if isinstance(url_resp, str) else getattr(url_resp, "url", str(url_resp))
            
            logger.info("Cloud upload successful: %s", url)
            return url
        except Exception as e:
            logger.error("Cloud upload failed for %s: %s", path_on_bucket, str(e), exc_info=True)
            raise RuntimeError(f"Cloud storage error: {str(e)}") from e
    else:
        # Save locally
        try:
            target_dir = UPLOAD_IMAGES_DIR if folder == "images" else UPLOAD_AUDIO_DIR
            target_dir.mkdir(parents=True, exist_ok=True)
            file_path = target_dir / filename
            
            async with aiofiles.open(file_path, mode="wb") as f:
                await f.write(content)
            
            logger.info("Local upload successful: %s", file_path)
            return f"/uploads/{folder}/{filename}"
        except Exception as e:
            logger.error("Local upload failed for %s: %s", filename, str(e), exc_info=True)
            raise

def _get_content_type(filename: str) -> str:
    """Simple helper to guess content type from extension."""
    ext = Path(filename).suffix.lower()
    types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".html": "text/html",
    }
    return types.get(ext, "application/octet-stream")

async def file_exists(filename: str, folder: str = "images") -> bool:
    """Check if a file already exists in storage."""
    if STORAGE_MODE == "CLOUD":
        if not _supabase: return False
        path_on_bucket = f"{folder}/{filename}"
        try:
            # Check if file exists in list
            res = _supabase.storage.from_(SUPABASE_BUCKET).list(folder)
            return any(item['name'] == filename for item in res)
        except Exception:
            return False
    else:
        target_dir = UPLOAD_IMAGES_DIR if folder == "images" else UPLOAD_AUDIO_DIR
        return (target_dir / filename).exists()
