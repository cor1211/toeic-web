"""Storage abstraction layer — handles local vs cloud file operations."""

import os
import logging
import aiofiles
import io
from pathlib import Path
from typing import Optional

try:
    from supabase import Client, create_client
except ModuleNotFoundError:  # pragma: no cover - optional dependency fallback
    Client = object  # type: ignore[assignment]

    def create_client(*args, **kwargs):  # type: ignore[no-untyped-def]
        """Fallback helper when Supabase SDK is unavailable."""
        raise ModuleNotFoundError("supabase package is required for CLOUD storage mode")

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
            
            # The Supabase SDK expects bytes, str, or PathLike for the 'file' argument.
            # We also use 'upsert=True' to overwrite existing files.
            _supabase.storage.from_(SUPABASE_BUCKET).upload(
                path=path_on_bucket,
                file=content,
                file_options={
                    "content-type": _get_content_type(filename),
                    "upsert": "true"
                }
            )
            
            # Get public URL
            url_resp = _supabase.storage.from_(SUPABASE_BUCKET).get_public_url(path_on_bucket)
            
            # Robustly extract the URL string
            if isinstance(url_resp, str):
                url = url_resp
            elif hasattr(url_resp, "public_url"):
                url = url_resp.public_url
            elif hasattr(url_resp, "url"):
                url = url_resp.url
            else:
                url = str(url_resp)
            
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

async def delete_file(path_or_url: str) -> None:
    """Delete a file from storage (local or cloud)."""
    if not path_or_url: return
    
    logger.info("Deleting file: %s (Mode: %s)", path_or_url, STORAGE_MODE)
    
    if STORAGE_MODE == "CLOUD":
        if not _supabase: return
        # Extract path from URL: .../bucket_name/folder/filename
        # Example: https://.../toeic-assets/images/abc.jpg -> images/abc.jpg
        try:
            if SUPABASE_BUCKET in path_or_url:
                path_on_bucket = path_or_url.split(f"{SUPABASE_BUCKET}/")[-1]
                logger.debug("Extracted bucket path for deletion: %s", path_on_bucket)
                _supabase.storage.from_(SUPABASE_BUCKET).remove([path_on_bucket])
                logger.info("Cloud deletion successful: %s", path_on_bucket)
        except Exception as e:
            logger.warning("Cloud deletion failed for %s: %s", path_or_url, str(e))
    else:
        # Local deletion
        try:
            # path_or_url is like "/uploads/images/abc.jpg"
            rel_path = path_or_url.lstrip("/")
            full_path = Path(os.getcwd()) / rel_path
            if full_path.exists():
                full_path.unlink()
                logger.info("Local deletion successful: %s", full_path)
        except Exception as e:
            logger.warning("Local deletion failed for %s: %s", path_or_url, str(e))

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
