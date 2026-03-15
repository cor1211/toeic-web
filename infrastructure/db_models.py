"""SQLAlchemy ORM models matching the schema in ARCHITECTURE.md."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.database import Base


# ---------------------------------------------------------------------------
# Exam & Content
# ---------------------------------------------------------------------------

class ExamDB(Base):
    """Exam entity — represents a single imported TOEIC exam."""

    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), default="", index=True)
    source_type: Mapped[str] = mapped_column(String(50), default="nn24h")
    source_html_path: Mapped[str] = mapped_column(String(1000), default="")
    audio_local_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    question_count: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    sections: Mapped[list["ExamSectionDB"]] = relationship(
        back_populates="exam", cascade="all, delete-orphan", lazy="selectin",
    )
    media_assets: Mapped[list["MediaAssetDB"]] = relationship(
        back_populates="exam", cascade="all, delete-orphan", lazy="selectin",
    )
    attempts: Mapped[list["AttemptDB"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin",
    )


class ExamSectionDB(Base):
    """Logical section inside an exam (e.g. Part 1, Part 5)."""

    __tablename__ = "exam_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), default="")
    part: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    instructions_html: Mapped[str] = mapped_column(Text, default="")

    exam: Mapped["ExamDB"] = relationship(back_populates="sections")
    questions: Mapped[list["QuestionDB"]] = relationship(
        back_populates="section", cascade="all, delete-orphan", lazy="selectin",
    )


class QuestionDB(Base):
    """A single question."""

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False)
    section_id: Mapped[int] = mapped_column(ForeignKey("exam_sections.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    source_dom_id: Mapped[str] = mapped_column(String(200), default="")
    prompt_html: Mapped[str] = mapped_column(Text, default="")
    explanation_html: Mapped[str] = mapped_column(Text, default="")
    correct_choice_key: Mapped[str] = mapped_column(String(5), default="")
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    image_local_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    section: Mapped["ExamSectionDB"] = relationship(back_populates="questions")
    choices: Mapped[list["ChoiceDB"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", lazy="selectin",
    )
    notes: Mapped[list["StudyNoteDB"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", lazy="selectin",
    )
    bookmarks: Mapped[list["BookmarkDB"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", lazy="selectin",
    )


class ChoiceDB(Base):
    """A single choice for a question."""

    __tablename__ = "choices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    choice_key: Mapped[str] = mapped_column(String(5), nullable=False)
    content_html: Mapped[str] = mapped_column(Text, default="")
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    question: Mapped["QuestionDB"] = relationship(back_populates="choices")


class MediaAssetDB(Base):
    """Media file associated with an exam or question."""

    __tablename__ = "media_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False)
    question_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    asset_type: Mapped[str] = mapped_column(String(50), default="image")
    original_url: Mapped[str] = mapped_column(String(1000), default="")
    local_path: Mapped[str] = mapped_column(String(1000), default="")
    mime_type: Mapped[str] = mapped_column(String(100), default="")
    checksum: Mapped[str] = mapped_column(String(64), default="")

    exam: Mapped["ExamDB"] = relationship(back_populates="media_assets")


# ---------------------------------------------------------------------------
# Attempt & Learning
# ---------------------------------------------------------------------------

class AttemptDB(Base):
    """An exam attempt session."""

    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    elapsed_seconds: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    incorrect_count: Mapped[int] = mapped_column(Integer, default=0)
    flagged_count: Mapped[int] = mapped_column(Integer, default=0)
    raw_score: Mapped[float] = mapped_column(Float, default=0.0)

    answers: Mapped[list["AttemptAnswerDB"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", lazy="selectin",
    )


class AttemptAnswerDB(Base):
    """User's answer for one question in an attempt."""

    __tablename__ = "attempt_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("attempts.id"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    selected_choice_key: Mapped[str | None] = mapped_column(String(5), nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    elapsed_seconds: Mapped[int] = mapped_column(Integer, default=0)

    attempt: Mapped["AttemptDB"] = relationship(back_populates="answers")


class StudyNoteDB(Base):
    """User study note attached to a question."""

    __tablename__ = "study_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    question: Mapped["QuestionDB"] = relationship(back_populates="notes")


class BookmarkDB(Base):
    """Bookmark marker for a question."""

    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    question: Mapped["QuestionDB"] = relationship(back_populates="bookmarks")


class ReviewTagDB(Base):
    """Review tag attached to a question."""

    __tablename__ = "review_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    tag: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
