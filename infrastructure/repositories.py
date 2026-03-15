"""Repository classes — data-access layer for all database operations."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from infrastructure.db_models import (
    AttemptAnswerDB,
    AttemptDB,
    BookmarkDB,
    ChoiceDB,
    ExamDB,
    ExamSectionDB,
    MediaAssetDB,
    QuestionDB,
    StudyNoteDB,
)


class ExamRepository:
    """CRUD operations for Exam and related entities."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_exam(
        self,
        *,
        title: str,
        slug: str = "",
        source_type: str = "nn24h",
        source_html_path: str = "",
        audio_local_path: Optional[str] = None,
        duration_seconds: int = 0,
        question_count: int = 0,
        tags: str = "",
    ) -> ExamDB:
        """Insert a new exam record and return it."""
        exam = ExamDB(
            title=title,
            slug=slug,
            source_type=source_type,
            source_html_path=source_html_path,
            audio_local_path=audio_local_path,
            duration_seconds=duration_seconds,
            question_count=question_count,
            tags=tags,
        )
        self._session.add(exam)
        await self._session.flush()
        return exam

    async def add_section(
        self,
        exam_id: int,
        *,
        title: str = "",
        part: Optional[int] = None,
        order_index: int = 0,
        instructions_html: str = "",
    ) -> ExamSectionDB:
        """Add a section to an exam."""
        section = ExamSectionDB(
            exam_id=exam_id,
            title=title,
            part=part,
            order_index=order_index,
            instructions_html=instructions_html,
        )
        self._session.add(section)
        await self._session.flush()
        return section

    async def add_question(
        self,
        exam_id: int,
        section_id: int,
        *,
        order_index: int = 0,
        source_dom_id: str = "",
        prompt_html: str = "",
        explanation_html: str = "",
        correct_choice_key: str = "",
        image_url: Optional[str] = None,
        image_local_path: Optional[str] = None,
    ) -> QuestionDB:
        """Add a question to a section."""
        question = QuestionDB(
            exam_id=exam_id,
            section_id=section_id,
            order_index=order_index,
            source_dom_id=source_dom_id,
            prompt_html=prompt_html,
            explanation_html=explanation_html,
            correct_choice_key=correct_choice_key,
            image_url=image_url,
            image_local_path=image_local_path,
        )
        self._session.add(question)
        await self._session.flush()
        return question

    async def add_choice(
        self,
        question_id: int,
        *,
        choice_key: str,
        content_html: str = "",
        is_correct: bool = False,
    ) -> ChoiceDB:
        """Add a choice to a question."""
        choice = ChoiceDB(
            question_id=question_id,
            choice_key=choice_key,
            content_html=content_html,
            is_correct=is_correct,
        )
        self._session.add(choice)
        await self._session.flush()
        return choice

    async def add_media_asset(
        self,
        exam_id: int,
        *,
        question_id: Optional[int] = None,
        asset_type: str = "image",
        original_url: str = "",
        local_path: str = "",
        mime_type: str = "",
    ) -> MediaAssetDB:
        """Track a downloaded media asset."""
        asset = MediaAssetDB(
            exam_id=exam_id,
            question_id=question_id,
            asset_type=asset_type,
            original_url=original_url,
            local_path=local_path,
            mime_type=mime_type,
        )
        self._session.add(asset)
        await self._session.flush()
        return asset

    async def list_exams(self) -> Sequence[ExamDB]:
        """Return all exams ordered by creation date descending."""
        result = await self._session.execute(
            select(ExamDB).order_by(ExamDB.created_at.desc())
        )
        return result.scalars().all()

    async def get_exam(self, exam_id: int) -> Optional[ExamDB]:
        """Get a single exam with all nested relationships loaded."""
        result = await self._session.execute(
            select(ExamDB)
            .where(ExamDB.id == exam_id)
            .options(
                selectinload(ExamDB.sections)
                .selectinload(ExamSectionDB.questions)
                .selectinload(QuestionDB.choices),
                selectinload(ExamDB.sections)
                .selectinload(ExamSectionDB.questions)
                .selectinload(QuestionDB.notes),
                selectinload(ExamDB.sections)
                .selectinload(ExamSectionDB.questions)
                .selectinload(QuestionDB.bookmarks),
            )
        )
        return result.scalar_one_or_none()

    async def delete_exam(self, exam_id: int) -> bool:
        """Delete an exam and all cascaded children. Returns True if found."""
        exam = await self.get_exam(exam_id)
        if exam is None:
            return False
        await self._session.delete(exam)
        await self._session.flush()
        return True


class AttemptRepository:
    """CRUD operations for Attempts."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_attempt(self, exam_id: int) -> AttemptDB:
        """Start a new attempt for an exam."""
        attempt = AttemptDB(exam_id=exam_id)
        self._session.add(attempt)
        await self._session.flush()
        return attempt

    async def get_attempt(self, attempt_id: int) -> Optional[AttemptDB]:
        """Get an attempt with its answers loaded."""
        result = await self._session.execute(
            select(AttemptDB)
            .where(AttemptDB.id == attempt_id)
            .options(selectinload(AttemptDB.answers))
        )
        return result.scalar_one_or_none()

    async def save_answer(
        self,
        attempt_id: int,
        question_id: int,
        *,
        selected_choice_key: Optional[str] = None,
        flagged: bool = False,
        elapsed_seconds: int = 0,
    ) -> AttemptAnswerDB:
        """Save or update an answer for a question in an attempt."""
        result = await self._session.execute(
            select(AttemptAnswerDB).where(
                AttemptAnswerDB.attempt_id == attempt_id,
                AttemptAnswerDB.question_id == question_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.selected_choice_key = selected_choice_key
            existing.flagged = flagged
            existing.elapsed_seconds = elapsed_seconds
            await self._session.flush()
            return existing

        answer = AttemptAnswerDB(
            attempt_id=attempt_id,
            question_id=question_id,
            selected_choice_key=selected_choice_key,
            flagged=flagged,
            elapsed_seconds=elapsed_seconds,
        )
        self._session.add(answer)
        await self._session.flush()
        return answer

    async def submit_attempt(
        self,
        attempt_id: int,
        elapsed_seconds: int = 0,
    ) -> Optional[AttemptDB]:
        """Grade and finalize an attempt.

        Compares each answer against the question's correct_choice_key.
        """
        attempt = await self.get_attempt(attempt_id)
        if attempt is None:
            return None

        correct = 0
        incorrect = 0
        flagged = 0

        for answer in attempt.answers:
            # Look up the correct answer
            q_result = await self._session.execute(
                select(QuestionDB).where(QuestionDB.id == answer.question_id)
            )
            question = q_result.scalar_one_or_none()
            if question is None:
                continue

            is_correct = (
                answer.selected_choice_key is not None
                and answer.selected_choice_key == question.correct_choice_key
            )
            answer.is_correct = is_correct
            if is_correct:
                correct += 1
            elif answer.selected_choice_key is not None:
                incorrect += 1
            if answer.flagged:
                flagged += 1

        attempt.correct_count = correct
        attempt.incorrect_count = incorrect
        attempt.flagged_count = flagged
        attempt.status = "submitted"
        attempt.submitted_at = datetime.utcnow()
        attempt.elapsed_seconds = elapsed_seconds
        attempt.raw_score = (
            round(correct / max(len(attempt.answers), 1) * 100, 1)
        )

        await self._session.flush()
        return attempt

    async def list_attempts_for_exam(
        self, exam_id: int
    ) -> Sequence[AttemptDB]:
        """List all attempts for a given exam."""
        result = await self._session.execute(
            select(AttemptDB)
            .where(AttemptDB.exam_id == exam_id)
            .order_by(AttemptDB.started_at.desc())
        )
        return result.scalars().all()


class StudyRepository:
    """CRUD operations for notes and bookmarks."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save_note(
        self, question_id: int, content: str
    ) -> StudyNoteDB:
        """Create or update a study note for a question."""
        result = await self._session.execute(
            select(StudyNoteDB).where(StudyNoteDB.question_id == question_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.content = content
            existing.updated_at = datetime.utcnow()
            await self._session.flush()
            return existing

        note = StudyNoteDB(question_id=question_id, content=content)
        self._session.add(note)
        await self._session.flush()
        return note

    async def toggle_bookmark(self, question_id: int) -> bool:
        """Toggle bookmark for a question. Returns True if now bookmarked."""
        result = await self._session.execute(
            select(BookmarkDB).where(BookmarkDB.question_id == question_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            await self._session.delete(existing)
            await self._session.flush()
            return False

        bookmark = BookmarkDB(question_id=question_id)
        self._session.add(bookmark)
        await self._session.flush()
        return True
