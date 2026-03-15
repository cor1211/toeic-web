"""Import routes — handles HTML + audio upload and exam parsing."""

from __future__ import annotations

import re
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import ImportResult
from config import UPLOAD_HTML_DIR
from infrastructure.database import get_session
from infrastructure.image_downloader import download_all_images
from infrastructure.parser_nn24h import parse_nn24h_html
from infrastructure.repositories import ExamRepository
from infrastructure.storage import upload_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/imports", tags=["Import"])


def _slugify(text: str) -> str:
    """Create a URL-safe slug from text."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_]+", "-", text)[:200]


@router.post("/exams", response_model=ImportResult)
async def import_exam(
    html_file: UploadFile | None = File(default=None),
    html_content_pasted: str = Form(default=""),
    audio_file: UploadFile | None = File(default=None),
    title: str = Form(default=""),
    tags: str = Form(default=""),
    session: AsyncSession = Depends(get_session),
) -> ImportResult:
    """Import a TOEIC exam from an NN24H HTML file or pasted content."""
    
    # --- Read & parse HTML ---
    if html_content_pasted.strip():
        logger.info("Starting exam import: Pasted HTML content")
        html_content = html_content_pasted
        html_filename = "pasted_exam.html"
    elif html_file and html_file.filename:
        logger.info("Starting exam import: File %s", html_file.filename)
        html_content = (await html_file.read()).decode("utf-8", errors="replace")
        html_filename = html_file.filename
    else:
        raise HTTPException(status_code=400, detail="Either html_file or html_content_pasted must be provided.")

    try:
        parsed = parse_nn24h_html(html_content)
        logger.info("HTML parsed: %s questions found", parsed.question_count)
    except Exception as exc:
        logger.error("Parsing failed: %s", str(exc), exc_info=True)
        raise HTTPException(status_code=422, detail=f"Parsing error: {str(exc)}")

    exam_title = title or parsed.title or html_file.filename or "Untitled Exam"
    slug = _slugify(exam_title)

    # --- Save audio via Storage Abstraction ---
    audio_store_path: str | None = None
    if audio_file is not None and audio_file.filename:
        try:
            logger.info("Uploading audio file: %s", audio_file.filename)
            audio_data = await audio_file.read()
            audio_store_path = await upload_file(audio_data, audio_file.filename, folder="audio")
        except Exception as exc:
            logger.error("Audio upload failed: %s", str(exc), exc_info=True)
            raise HTTPException(status_code=500, detail=f"Audio upload error: {str(exc)}")

    # --- Download images ---
    all_image_urls: list[str] = []
    for section in parsed.sections:
        for q in section.questions:
            if q.image_url:
                all_image_urls.append(q.image_url)

    logger.info("Downloading %d images...", len(all_image_urls))
    image_map = await download_all_images(all_image_urls)

    # --- Persist to DB ---
    try:
        logger.info("Saving exam to database: %s", exam_title)
        repo = ExamRepository(session)
        exam_db = await repo.create_exam(
            title=exam_title,
            slug=slug,
            source_html_path=html_file.filename or "exam.html", 
            audio_local_path=audio_store_path,
            question_count=parsed.question_count,
            tags=tags,
        )

        for section in parsed.sections:
            section_db = await repo.add_section(
                exam_db.id,
                title=section.title,
                part=section.part,
                order_index=section.order_index,
                instructions_html=section.instructions_html,
            )

            for q in section.questions:
                local_img = image_map.get(q.image_url or "", None)
                question_db = await repo.add_question(
                    exam_db.id,
                    section_db.id,
                    order_index=q.order_index,
                    source_dom_id=q.source_dom_id,
                    prompt_html=q.prompt_html,
                    explanation_html=q.explanation_html,
                    correct_choice_key=q.correct_choice_key,
                    image_url=q.image_url,
                    image_local_path=local_img,
                )

                for choice in q.choices:
                    await repo.add_choice(
                        question_db.id,
                        choice_key=choice.choice_key,
                        content_html=choice.content_html,
                        is_correct=choice.is_correct,
                    )

                if q.image_url and local_img:
                    await repo.add_media_asset(
                        exam_db.id,
                        question_id=question_db.id,
                        asset_type="image",
                        original_url=q.image_url,
                        local_path=local_img,
                    )

        await session.commit()
        logger.info("Exam import completed successfully: ID %d", exam_db.id)
    except Exception as exc:
        logger.error("Database persistence failed: %s", str(exc), exc_info=True)
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(exc)}")

    return ImportResult(
        exam_id=exam_db.id,
        title=exam_title,
        question_count=parsed.question_count,
        images_downloaded=sum(1 for v in image_map.values() if v),
    )
