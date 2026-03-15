"""Attempt routes — lifecycle management for exam attempts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import AttemptCreateIn, AttemptOut, AttemptSaveIn
from infrastructure.database import get_session
from infrastructure.repositories import AttemptRepository, ExamRepository

router = APIRouter(prefix="/attempts", tags=["Attempts"])


@router.post("", response_model=AttemptOut)
async def create_attempt(
    body: AttemptCreateIn,
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    """Start a new attempt for an exam."""
    # Validate exam exists
    exam_repo = ExamRepository(session)
    exam = await exam_repo.get_exam(body.exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Exam not found")

    repo = AttemptRepository(session)
    attempt = await repo.create_attempt(body.exam_id)
    await session.commit()

    # Reload with eager-loaded relationships to avoid MissingGreenlet
    loaded = await repo.get_attempt(attempt.id)
    return loaded


@router.get("/{attempt_id}", response_model=AttemptOut)
async def get_attempt(
    attempt_id: int,
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    """Get attempt details with answers."""
    repo = AttemptRepository(session)
    attempt = await repo.get_attempt(attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt


@router.patch("/{attempt_id}", response_model=AttemptOut)
async def save_progress(
    attempt_id: int,
    body: AttemptSaveIn,
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    """Auto-save answers and flags during an attempt."""
    repo = AttemptRepository(session)
    attempt = await repo.get_attempt(attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status == "submitted":
        raise HTTPException(status_code=400, detail="Attempt already submitted")

    for ans in body.answers:
        await repo.save_answer(
            attempt_id,
            ans.question_id,
            selected_choice_key=ans.selected_choice_key,
            flagged=ans.flagged,
            elapsed_seconds=ans.elapsed_seconds,
        )

    await session.commit()

    # Reload to get updated answers
    updated = await repo.get_attempt(attempt_id)
    return updated


@router.post("/{attempt_id}/submit", response_model=AttemptOut)
async def submit_attempt(
    attempt_id: int,
    body: AttemptSaveIn | None = None,
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    """Submit and grade an attempt."""
    repo = AttemptRepository(session)

    # Save any last-minute answers
    if body and body.answers:
        for ans in body.answers:
            await repo.save_answer(
                attempt_id,
                ans.question_id,
                selected_choice_key=ans.selected_choice_key,
                flagged=ans.flagged,
                elapsed_seconds=ans.elapsed_seconds,
            )

    elapsed = body.elapsed_seconds if body else 0
    result = await repo.submit_attempt(attempt_id, elapsed_seconds=elapsed)
    if result is None:
        raise HTTPException(status_code=404, detail="Attempt not found")

    await session.commit()
    return result
