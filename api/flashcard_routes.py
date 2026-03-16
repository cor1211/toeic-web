"""Flashcard routes — CRUD, selection capture, and spaced repetition review."""

from __future__ import annotations

import re
from datetime import datetime

from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas import (
    FlashcardCreateIn,
    FlashcardOut,
    FlashcardReviewIn,
    FlashcardSelectionIn,
    FlashcardUpdateIn,
)
from infrastructure.database import get_session
from infrastructure.db_models import FlashcardDB
from infrastructure.repositories import FlashcardRepository

router = APIRouter(prefix="/flashcards", tags=["Flashcards"])


@router.post("", response_model=FlashcardOut)
async def create_flashcard(
    body: FlashcardCreateIn,
    session: AsyncSession = Depends(get_session),
) -> FlashcardOut:
    """Create a flashcard from manual input."""
    repo = FlashcardRepository(session)
    card = await repo.create_flashcard(
        term=_sanitize_required_text(body.term, "term"),
        meaning=_sanitize_plain_text(body.meaning),
        example=_sanitize_plain_text(body.example),
        source_type=body.source_type,
        source_exam_id=body.exam_id,
        source_question_id=body.question_id,
        source_part=body.part,
        tags_csv=_tags_to_csv(body.tags),
        deck_name=_sanitize_deck_name(body.deck_name),
    )
    await session.commit()
    return _build_flashcard_out(card)


@router.get("", response_model=list[FlashcardOut])
async def list_flashcards(
    search: str = Query(default=""),
    deck: str = Query(default=""),
    tag: str = Query(default=""),
    part: int | None = Query(default=None),
    due_only: bool = Query(default=False),
    session: AsyncSession = Depends(get_session),
) -> list[FlashcardOut]:
    """List flashcards with optional filters."""
    repo = FlashcardRepository(session)
    cards = await repo.list_flashcards()
    filtered = _filter_flashcards(cards, search, deck, tag, part, due_only)
    return [_build_flashcard_out(card) for card in filtered]


@router.post("/from-selection", response_model=FlashcardOut)
async def create_flashcard_from_selection(
    body: FlashcardSelectionIn,
    session: AsyncSession = Depends(get_session),
) -> FlashcardOut:
    """Create a flashcard from selected review text."""
    term = _sanitize_required_text(body.selected_text, "selected_text")
    example = _sanitize_plain_text(body.example)
    if not example and body.context_html:
        example = _sanitize_plain_text(body.context_html)

    repo = FlashcardRepository(session)
    card = await repo.create_flashcard(
        term=term,
        meaning=_sanitize_plain_text(body.meaning),
        example=example,
        source_type=body.source_type,
        source_exam_id=body.exam_id,
        source_question_id=body.question_id,
        source_part=body.part,
        tags_csv=_tags_to_csv(body.tags),
        deck_name=_sanitize_deck_name(body.deck_name),
    )
    await session.commit()
    return _build_flashcard_out(card)


@router.get("/review/due", response_model=list[FlashcardOut])
async def list_due_flashcards(
    limit: int = Query(default=20, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[FlashcardOut]:
    """Return flashcards that are currently due for review."""
    repo = FlashcardRepository(session)
    cards = await repo.list_due_flashcards(limit=limit)
    return [_build_flashcard_out(card) for card in cards]


@router.patch("/{flashcard_id}", response_model=FlashcardOut)
async def update_flashcard(
    flashcard_id: int,
    body: FlashcardUpdateIn,
    session: AsyncSession = Depends(get_session),
) -> FlashcardOut:
    """Update mutable flashcard fields."""
    repo = FlashcardRepository(session)
    card = await repo.get_flashcard(flashcard_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    changes = _build_update_payload(body)
    if not changes:
        return _build_flashcard_out(card)

    updated = await repo.update_flashcard(card, **changes)
    await session.commit()
    return _build_flashcard_out(updated)


@router.delete("/{flashcard_id}")
async def delete_flashcard(
    flashcard_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Delete a flashcard."""
    repo = FlashcardRepository(session)
    deleted = await repo.delete_flashcard(flashcard_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    await session.commit()
    return {"deleted": True, "flashcard_id": flashcard_id}


@router.post("/{flashcard_id}/review", response_model=FlashcardOut)
async def review_flashcard(
    flashcard_id: int,
    body: FlashcardReviewIn,
    session: AsyncSession = Depends(get_session),
) -> FlashcardOut:
    """Apply a review result and reschedule the flashcard."""
    repo = FlashcardRepository(session)
    card = await repo.review_flashcard(flashcard_id, result=body.result)
    if card is None:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    await session.commit()
    return _build_flashcard_out(card)


def _build_update_payload(body: FlashcardUpdateIn) -> dict[str, object]:
    """Translate API update payload into ORM field changes."""
    changes = body.model_dump(exclude_unset=True)
    mapped: dict[str, object] = {}
    if "term" in changes:
        mapped["term"] = _sanitize_required_text(str(changes["term"]), "term")
    if "meaning" in changes:
        mapped["meaning"] = _sanitize_plain_text(str(changes["meaning"] or ""))
    if "example" in changes:
        mapped["example"] = _sanitize_plain_text(str(changes["example"] or ""))
    if "source_type" in changes:
        mapped["source_type"] = changes["source_type"]
    if "exam_id" in changes:
        mapped["source_exam_id"] = changes["exam_id"]
    if "question_id" in changes:
        mapped["source_question_id"] = changes["question_id"]
    if "part" in changes:
        mapped["source_part"] = changes["part"]
    if "tags" in changes:
        mapped["tags_csv"] = _tags_to_csv(changes["tags"] or [])
    if "deck_name" in changes:
        mapped["deck_name"] = _sanitize_deck_name(str(changes["deck_name"] or ""))
    mapped["updated_at"] = datetime.utcnow()
    return mapped


def _filter_flashcards(
    cards: list[FlashcardDB] | tuple[FlashcardDB, ...],
    search: str,
    deck: str,
    tag: str,
    part: int | None,
    due_only: bool,
) -> list[FlashcardDB]:
    """Apply list filters in memory for simple SQLite compatibility."""
    now = datetime.utcnow()
    search_term = search.strip().casefold()
    deck_term = deck.strip().casefold()
    tag_term = tag.strip().casefold()
    filtered: list[FlashcardDB] = []

    for card in cards:
        tags = [item.casefold() for item in _csv_to_tags(card.tags_csv)]
        haystack = " ".join([card.term, card.meaning, card.example]).casefold()
        if search_term and search_term not in haystack:
            continue
        if deck_term and card.deck_name.casefold() != deck_term:
            continue
        if tag_term and tag_term not in tags:
            continue
        if part is not None and card.source_part != part:
            continue
        if due_only and card.next_review_at > now:
            continue
        filtered.append(card)

    return filtered


def _build_flashcard_out(card: FlashcardDB) -> FlashcardOut:
    """Convert ORM object to API response."""
    return FlashcardOut(
        id=card.id,
        term=card.term,
        meaning=card.meaning,
        example=card.example,
        source_type=card.source_type,
        exam_id=card.source_exam_id,
        question_id=card.source_question_id,
        part=card.source_part,
        tags=_csv_to_tags(card.tags_csv),
        deck_name=card.deck_name,
        next_review_at=card.next_review_at,
        interval_days=card.interval_days,
        ease_factor=card.ease_factor,
        repetition=card.repetition,
        last_result=card.last_result,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


def _sanitize_required_text(value: str, field_name: str) -> str:
    """Return sanitized plain text or raise when empty."""
    sanitized = _sanitize_plain_text(value)
    if not sanitized:
        raise HTTPException(status_code=422, detail=f"{field_name} must not be empty")
    return sanitized


def _sanitize_plain_text(value: str) -> str:
    """Strip HTML and collapse whitespace to keep stored text XSS-safe."""
    plain_text = BeautifulSoup(value or "", "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", plain_text).strip()


def _sanitize_deck_name(deck_name: str) -> str:
    """Normalize deck names and fall back to the default deck."""
    normalized = _sanitize_plain_text(deck_name)
    return normalized or "Default"


def _tags_to_csv(tags: list[str]) -> str:
    """Normalize user tags and persist them as CSV."""
    seen: set[str] = set()
    normalized: list[str] = []
    for raw_tag in tags:
        tag = _sanitize_plain_text(raw_tag)
        key = tag.casefold()
        if not tag or key in seen:
            continue
        seen.add(key)
        normalized.append(tag)
    return ",".join(normalized)


def _csv_to_tags(tags_csv: str) -> list[str]:
    """Expand CSV tags into a trimmed list."""
    return [tag.strip() for tag in tags_csv.split(",") if tag.strip()]
