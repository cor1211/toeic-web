"""Storage abstraction layer — handles local vs cloud file operations."""

import os
import aiofiles
from pathlib import Path
from typing import Optional
from supabase import create_client, Client
from config import STORAGE_MODE, SUPABASE_URL, SUPABASE_KEY, SUPABASE_BUCKET, UPLOAD_AUDIO_DIR, UPLOAD_IMAGES_DIR

# Initialize Supabase client if in cloud mode
_supabase: Optional[Client] = None
if STORAGE_MODE == "CLOUD":
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set for CLOUD storage mode.")
    _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

async def upload_file(
    content: bytes, 
    filename: str, 
    folder: str = "images"
) -> str:
    """
    Upload a file to storage and return its accessible URL/path.
    
    Args:
        content: The file bytes.
        filename: Name of the file.
        folder: "images" or "audio".
        
    Returns:
        For LOCAL mode: The relative path (e.g., "/uploads/images/abc.jpg").
        For CLOUD mode: The public URL from Supabase.
    """
    if STORAGE_MODE == "CLOUD":
        # Upload to Supabase Storage
        path_on_bucket = f"{folder}/{filename}"
        # Supabase sync client is used for now as the basic SDK is not fully async for storage
        # but we wrap it to be consistent
        _supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=path_on_bucket,
            file=content,
            file_options={"content-type": _get_content_type(filename)}
        )
        # Get public URL
        url_resp = _supabase.storage.from_(SUPABASE_BUCKET).get_public_url(path_on_bucket)
        return url_resp
    else:
        # Save locally
        target_dir = UPLOAD_IMAGES_DIR if folder == "images" else UPLOAD_AUDIO_DIR
        file_path = target_dir / filename
        async with aiofiles.open(file_path, mode="wb") as f:
            await f.write(content)
        
        # Return path compatible with main.py static serving
        return f"/uploads/{folder}/{filename}"

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
        path_on_bucket = f"{folder}/{filename}"
        try:
            # list() returns items in the path
            res = _supabase.storage.from_(SUPABASE_BUCKET).list(f"{folder}")
            return any(item['name'] == filename for item in res)
        except Exception:
            return False
    else:
        target_dir = UPLOAD_IMAGES_DIR if folder == "images" else UPLOAD_AUDIO_DIR
        return (target_dir / filename).exists()
