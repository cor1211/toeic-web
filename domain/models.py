"""Domain models — Pydantic entities for the TOEIC exam domain."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Exam & Content
# ---------------------------------------------------------------------------

class Choice(BaseModel):
    """A single answer choice for a question."""

    choice_key: str = Field(..., description="A, B, C, or D")
    content_html: str = Field(default="", description="Display text or HTML")
    is_correct: bool = False


class Question(BaseModel):
    """A single TOEIC question."""

    order_index: int
    source_dom_id: str = ""
    prompt_html: str = ""
    image_url: Optional[str] = None
    image_local_path: Optional[str] = None
    explanation_html: str = ""
    correct_choice_key: str = ""
    choices: list[Choice] = Field(default_factory=list)


class ExamSection(BaseModel):
    """A logical section in an exam (e.g. Part 1 Questions 1-10)."""

    title: str = ""
    part: Optional[int] = None
    order_index: int = 0
    instructions_html: str = ""
    questions: list[Question] = Field(default_factory=list)


class Exam(BaseModel):
    """Top-level exam entity."""

    title: str
    slug: str = ""
    source_type: str = "nn24h"
    source_html_path: str = ""
    audio_local_path: Optional[str] = None
    duration_seconds: int = 0
    question_count: int = 0
    tags: str = ""
    sections: list[ExamSection] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Attempt & Learning
# ---------------------------------------------------------------------------

class AttemptAnswer(BaseModel):
    """User's answer for a single question in an attempt."""

    question_id: int
    selected_choice_key: Optional[str] = None
    is_correct: Optional[bool] = None
    flagged: bool = False
    elapsed_seconds: int = 0


class Attempt(BaseModel):
    """A single exam attempt session."""

    exam_id: int
    started_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    status: str = "in_progress"  # in_progress | submitted
    elapsed_seconds: int = 0
    correct_count: int = 0
    incorrect_count: int = 0
    flagged_count: int = 0
    raw_score: float = 0.0
    answers: list[AttemptAnswer] = Field(default_factory=list)


class StudyNote(BaseModel):
    """User note attached to a question."""

    question_id: int
    content: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Bookmark(BaseModel):
    """Bookmark marker for a question."""

    question_id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Flashcard(BaseModel):
    """A study flashcard with spaced-repetition metadata."""

    term: str
    meaning: str = ""
    example: str = ""
    source_type: str = "manual"
    source_exam_id: Optional[int] = None
    source_question_id: Optional[int] = None
    source_part: Optional[int] = None
    tags: list[str] = Field(default_factory=list)
    deck_name: str = "Default"
    next_review_at: datetime = Field(default_factory=datetime.utcnow)
    interval_days: int = 0
    ease_factor: float = 2.5
    repetition: int = 0
    last_result: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
