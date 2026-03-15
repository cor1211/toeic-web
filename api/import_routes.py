"""Import routes — handles HTML + audio upload and exam parsing."""

from __future__ import annotations

import re
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

router = APIRouter(prefix="/imports", tags=["Import"])


def _slugify(text: str) -> str:
    """Create a URL-safe slug from text."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_]+", "-", text)[:200]


@router.post("/exams", response_model=ImportResult)
async def import_exam(
    html_file: UploadFile = File(...),
    audio_file: UploadFile | None = File(default=None),
    title: str = Form(default=""),
    tags: str = Form(default=""),
    session: AsyncSession = Depends(get_session),
) -> ImportResult:
    """Import a TOEIC exam from an NN24H HTML file.

    Accepts:
      - *html_file*: The saved HTML page of a completed/reviewed NN24H exam.
      - *audio_file* (optional): The audio file for listening sections.
      - *title* (optional): Override the exam title extracted from HTML.
      - *tags* (optional): Comma-separated tags (e.g. "part1,listening").
    """
    # --- Read & save HTML (locally for now as it's small and used for parsing) ---
    html_content = (await html_file.read()).decode("utf-8", errors="replace")
    html_filename = html_file.filename or "exam.html"
    html_save_path = UPLOAD_HTML_DIR / html_filename
    html_save_path.write_text(html_content, encoding="utf-8")

    # --- Parse HTML ---
    try:
        parsed = parse_nn24h_html(html_content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    exam_title = title or parsed.title or html_filename
    slug = _slugify(exam_title)

    # --- Save audio via Storage Abstraction ---
    audio_store_path: str | None = None
    if audio_file is not None and audio_file.filename:
        audio_data = await audio_file.read()
        audio_store_path = await upload_file(audio_data, audio_file.filename, folder="audio")

    # --- Download images ---
    all_image_urls: list[str] = []
    for section in parsed.sections:
        for q in section.questions:
            if q.image_url:
                all_image_urls.append(q.image_url)

    image_map = await download_all_images(all_image_urls)

    # --- Persist to DB ---
    repo = ExamRepository(session)
    exam_db = await repo.create_exam(
        title=exam_title,
        slug=slug,
        source_html_path=str(html_filename), # Just store filename as ref
        audio_local_path=audio_store_path, # This is now the URL or local path
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

            # Track image as media asset
            if q.image_url and local_img:
                await repo.add_media_asset(
                    exam_db.id,
                    question_id=question_db.id,
                    asset_type="image",
                    original_url=q.image_url,
                    local_path=local_img,
                )

    await session.commit()

    return ImportResult(
        exam_id=exam_db.id,
        title=exam_title,
        question_count=parsed.question_count,
        images_downloaded=sum(1 for v in image_map.values() if v),
    )
