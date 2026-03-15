"""Study routes — notes and bookmarks for questions."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import BookmarkOut, NoteIn, NoteOut
from infrastructure.database import get_session
from infrastructure.repositories import StudyRepository

router = APIRouter(prefix="/questions", tags=["Study"])


@router.post("/{question_id}/notes", response_model=NoteOut)
async def save_note(
    question_id: int,
    body: NoteIn,
    session: AsyncSession = Depends(get_session),
) -> NoteOut:
    """Create or update a study note for a question."""
    repo = StudyRepository(session)
    note = await repo.save_note(question_id, body.content)
    await session.commit()
    return note


@router.post("/{question_id}/bookmark", response_model=BookmarkOut)
async def toggle_bookmark(
    question_id: int,
    session: AsyncSession = Depends(get_session),
) -> BookmarkOut:
    """Toggle bookmark on/off for a question."""
    repo = StudyRepository(session)
    is_bookmarked = await repo.toggle_bookmark(question_id)
    await session.commit()
    return BookmarkOut(question_id=question_id, is_bookmarked=is_bookmarked)
