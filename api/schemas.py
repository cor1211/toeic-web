"""API Pydantic response/request schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Exam
# ---------------------------------------------------------------------------

class ChoiceOut(BaseModel):
    id: int
    choice_key: str
    content_html: str
    is_correct: bool

    class Config:
        from_attributes = True


class QuestionOut(BaseModel):
    id: int
    order_index: int
    prompt_html: str
    image_url: Optional[str] = None
    image_local_path: Optional[str] = None
    explanation_html: str
    correct_choice_key: str
    choices: list[ChoiceOut] = []
    is_bookmarked: bool = False
    note_content: str = ""

    class Config:
        from_attributes = True


class SectionOut(BaseModel):
    id: int
    title: str
    part: Optional[int] = None
    order_index: int
    instructions_html: str
    questions: list[QuestionOut] = []

    class Config:
        from_attributes = True


class ExamListItem(BaseModel):
    id: int
    title: str
    slug: str
    source_type: str
    question_count: int
    tags: str
    has_audio: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ExamDetail(BaseModel):
    id: int
    title: str
    slug: str
    source_type: str
    audio_local_path: Optional[str] = None
    duration_seconds: int
    question_count: int
    tags: str
    created_at: datetime
    sections: list[SectionOut] = []

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    exam_id: int
    title: str
    question_count: int
    images_downloaded: int


# ---------------------------------------------------------------------------
# Attempt
# ---------------------------------------------------------------------------

class AttemptAnswerIn(BaseModel):
    question_id: int
    selected_choice_key: Optional[str] = None
    flagged: bool = False
    elapsed_seconds: int = 0


class AttemptSaveIn(BaseModel):
    answers: list[AttemptAnswerIn] = []
    elapsed_seconds: int = 0


class AttemptAnswerOut(BaseModel):
    id: int
    question_id: int
    selected_choice_key: Optional[str] = None
    is_correct: Optional[bool] = None
    flagged: bool
    elapsed_seconds: int

    class Config:
        from_attributes = True


class AttemptOut(BaseModel):
    id: int
    exam_id: int
    started_at: datetime
    submitted_at: Optional[datetime] = None
    status: str
    elapsed_seconds: int
    correct_count: int
    incorrect_count: int
    flagged_count: int
    raw_score: float
    answers: list[AttemptAnswerOut] = []

    class Config:
        from_attributes = True


class AttemptCreateIn(BaseModel):
    exam_id: int


# ---------------------------------------------------------------------------
# Study
# ---------------------------------------------------------------------------

class NoteIn(BaseModel):
    content: str


class NoteOut(BaseModel):
    id: int
    question_id: int
    content: str
    updated_at: datetime

    class Config:
        from_attributes = True


class BookmarkOut(BaseModel):
    question_id: int
    is_bookmarked: bool
