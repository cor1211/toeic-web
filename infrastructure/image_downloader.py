"""Image downloader — downloads question images and uploads them to storage."""

from __future__ import annotations

import hashlib
import logging
from typing import Dict

import httpx

from infrastructure.storage import upload_file, file_exists

logger = logging.getLogger(__name__)


def _url_to_filename(url: str) -> str:
    """Generate a deterministic filename from a URL.

    Uses a hash of the URL to ensure uniqueness and stability.
    """
    short_hash = hashlib.md5(url.encode()).hexdigest()[:12]
    # Try to keep the extension if possible
    ext = ".jpg"
    if ".png" in url.lower(): ext = ".png"
    elif ".gif" in url.lower(): ext = ".gif"
    elif ".webp" in url.lower(): ext = ".webp"
    
    return f"{short_hash}{ext}"


async def download_image(url: str) -> str:
    """Download an image from URL and save it to storage (local or cloud).

    Args:
        url: The remote image URL.

    Returns:
        The accessible URL or relative path of the saved image.

    Raises:
        httpx.HTTPStatusError: If the download fails.
    """
    filename = _url_to_filename(url)
    
    # Check if already exists to save bandwidth/storage
    if await file_exists(filename, folder="images"):
        logger.debug("Image already in storage: %s", filename)
        # We need the full URL/path. storage.py should ideally have a get_url method 
        # but for now we re-upload or re-calculate. 
        # Actually, let's just proceed with download to be safe or optimize later.
        pass

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        
        # Upload using our storage abstraction
        storage_path = await upload_file(response.content, filename, folder="images")
        logger.info("Processed image: %s -> %s", url, storage_path)
        return storage_path


async def download_all_images(
    image_urls: list[str],
) -> dict[str, str]:
    """Download multiple images and return a URL→storage_path mapping.

    Args:
        image_urls: List of remote image URLs.

    Returns:
        Dict mapping original URL to storage URL/path.
    """
    result: dict[str, str] = {}
    for url in image_urls:
        try:
            path = await download_image(url)
            result[url] = path
        except Exception:
            logger.warning("Failed to process image: %s", url, exc_info=True)
            result[url] = ""
    return result
