"""Exam routes — list and detail endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import ExamDetail, ExamListItem, QuestionOut, SectionOut
from infrastructure.database import get_session
from infrastructure.repositories import ExamRepository

router = APIRouter(prefix="/exams", tags=["Exams"])


@router.get("", response_model=list[ExamListItem])
async def list_exams(
    session: AsyncSession = Depends(get_session),
) -> list[ExamListItem]:
    """List all imported exams."""
    repo = ExamRepository(session)
    exams = await repo.list_exams()
    return [
        ExamListItem(
            id=e.id,
            title=e.title,
            slug=e.slug,
            source_type=e.source_type,
            question_count=e.question_count,
            tags=e.tags,
            has_audio=bool(e.audio_local_path),
            created_at=e.created_at,
        )
        for e in exams
    ]


@router.get("/{exam_id}", response_model=ExamDetail)
async def get_exam(
    exam_id: int,
    session: AsyncSession = Depends(get_session),
) -> ExamDetail:
    """Get full exam detail including sections, questions, and choices."""
    repo = ExamRepository(session)
    exam = await repo.get_exam(exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")

    sections_out: list[SectionOut] = []
    for sec in sorted(exam.sections, key=lambda s: s.order_index):
        questions_out: list[QuestionOut] = []
        for q in sorted(sec.questions, key=lambda q: q.order_index):
            questions_out.append(
                QuestionOut(
                    id=q.id,
                    order_index=q.order_index,
                    prompt_html=q.prompt_html,
                    image_url=q.image_url,
                    image_local_path=q.image_local_path,
                    explanation_html=q.explanation_html,
                    correct_choice_key=q.correct_choice_key,
                    choices=[],  # populated from relationship
                    is_bookmarked=bool(q.bookmarks),
                    note_content=q.notes[0].content if q.notes else "",
                )
            )
            # Add choices from ORM relationship
            questions_out[-1].choices = [
                {
                    "id": c.id,
                    "choice_key": c.choice_key,
                    "content_html": c.content_html,
                    "is_correct": c.is_correct,
                }
                for c in q.choices
            ]

        sections_out.append(
            SectionOut(
                id=sec.id,
                title=sec.title,
                part=sec.part,
                order_index=sec.order_index,
                instructions_html=sec.instructions_html,
                questions=questions_out,
            )
        )

    return ExamDetail(
        id=exam.id,
        title=exam.title,
        slug=exam.slug,
        source_type=exam.source_type,
        audio_local_path=exam.audio_local_path,
        duration_seconds=exam.duration_seconds,
        question_count=exam.question_count,
        tags=exam.tags,
        created_at=exam.created_at,
        sections=sections_out,
    )


@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Delete an exam and all related data."""
    repo = ExamRepository(session)
    deleted = await repo.delete_exam(exam_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Exam not found")
    await session.commit()
    return {"deleted": True, "exam_id": exam_id}
