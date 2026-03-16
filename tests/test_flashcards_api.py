"""API tests for flashcards and study regressions."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from infrastructure.database import Base, get_session
from infrastructure.repositories import ExamRepository, FlashcardRepository
from main import app


@pytest.fixture
async def test_context(tmp_path: Path):
    """Create an isolated app context with a temporary SQLite database."""
    db_path = tmp_path / "test_flashcards.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", future=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_session():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    try:
        yield {"app": app, "session_factory": session_factory}
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.fixture
async def client(test_context):
    """Create an async HTTP client bound to the temporary app."""
    transport = ASGITransport(app=test_context["app"])
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


@pytest.fixture
async def seeded_exam(test_context):
    """Create one exam, section, and question for source-reference tests."""
    session_factory = test_context["session_factory"]
    async with session_factory() as session:
        repo = ExamRepository(session)
        exam = await repo.create_exam(title="Seed Exam", question_count=1, tags="part1")
        section = await repo.add_section(
            exam.id,
            title="Part 1",
            part=1,
            order_index=1,
            instructions_html="<p>Listen and choose.</p>",
        )
        question = await repo.add_question(
            exam.id,
            section.id,
            order_index=1,
            prompt_html="<p>A man is waiting near the train station.</p>",
            explanation_html="<p>The correct phrase is <strong>train station</strong>.</p>",
            correct_choice_key="A",
        )
        await repo.add_choice(question.id, choice_key="A", content_html="At the station", is_correct=True)
        await repo.add_choice(question.id, choice_key="B", content_html="At the airport", is_correct=False)
        await session.commit()
        return {"exam_id": exam.id, "question_id": question.id, "part": 1}


@pytest.mark.anyio
async def test_flashcard_crud_and_filters(client: AsyncClient, test_context, seeded_exam):
    """Should create, list, filter, update, and delete flashcards via API."""
    payload_one = {
        "term": "train station",
        "meaning": "ga tau",
        "example": "The train station is crowded.",
        "source_type": "question_prompt",
        "exam_id": seeded_exam["exam_id"],
        "question_id": seeded_exam["question_id"],
        "part": seeded_exam["part"],
        "tags": ["travel", "phrase"],
        "deck_name": "Travel",
    }
    payload_two = {
        "term": "boarding pass",
        "meaning": "the len may bay",
        "example": "Please show your boarding pass.",
        "source_type": "manual",
        "part": 2,
        "tags": ["airport", "travel"],
        "deck_name": "Airport",
    }

    response_one = await client.post("/api/flashcards", json=payload_one)
    response_two = await client.post("/api/flashcards", json=payload_two)
    assert response_one.status_code == 200
    assert response_two.status_code == 200

    first_card = response_one.json()
    second_card = response_two.json()
    assert first_card["tags"] == ["travel", "phrase"]
    assert first_card["deck_name"] == "Travel"

    update_response = await client.patch(
        f"/api/flashcards/{second_card['id']}",
        json={
            "meaning": "ve len may bay",
            "deck_name": "Trips",
            "tags": ["airport", "document", "airport"],
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["tags"] == ["airport", "document"]
    assert update_response.json()["deck_name"] == "Trips"

    list_response = await client.get("/api/flashcards", params={"search": "train"})
    deck_response = await client.get("/api/flashcards", params={"deck": "Trips"})
    tag_response = await client.get("/api/flashcards", params={"tag": "phrase"})
    part_response = await client.get("/api/flashcards", params={"part": 2})
    due_response = await client.get("/api/flashcards", params={"due_only": "true"})

    assert [card["term"] for card in list_response.json()] == ["train station"]
    assert [card["term"] for card in deck_response.json()] == ["boarding pass"]
    assert [card["term"] for card in tag_response.json()] == ["train station"]
    assert [card["term"] for card in part_response.json()] == ["boarding pass"]
    assert len(due_response.json()) == 2

    delete_response = await client.delete(f"/api/flashcards/{first_card['id']}")
    missing_response = await client.get("/api/flashcards", params={"search": "train"})
    assert delete_response.status_code == 200
    assert missing_response.json() == []

    session_factory = test_context["session_factory"]
    async with session_factory() as session:
        repo = FlashcardRepository(session)
        card = await repo.get_flashcard(second_card["id"])
        card.next_review_at = datetime.utcnow() + timedelta(days=3)
        await session.commit()

    filtered_due = await client.get("/api/flashcards", params={"due_only": "true"})
    assert [card["term"] for card in filtered_due.json()] == []


@pytest.mark.anyio
async def test_flashcard_selection_due_order_and_review_schedule(client: AsyncClient, test_context, seeded_exam):
    """Should create flashcards from selection, order due cards, and apply SM-2 lite."""
    selection_payload = {
        "selected_text": "train station",
        "context_html": "<p>The correct phrase is <strong>train station</strong> near the office.</p>",
        "source_type": "explanation",
        "exam_id": seeded_exam["exam_id"],
        "question_id": seeded_exam["question_id"],
        "part": seeded_exam["part"],
        "tags": ["mistake", "transport"],
        "deck_name": "Mistakes",
    }
    selection_response = await client.post("/api/flashcards/from-selection", json=selection_payload)
    assert selection_response.status_code == 200

    selection_card = selection_response.json()
    assert selection_card["example"] == "The correct phrase is train station near the office."
    assert selection_card["exam_id"] == seeded_exam["exam_id"]
    assert selection_card["question_id"] == seeded_exam["question_id"]
    assert selection_card["part"] == seeded_exam["part"]

    results = {}
    for result_name in ("again", "hard", "good", "easy"):
        response = await client.post(
            "/api/flashcards",
            json={"term": f"card-{result_name}", "source_type": "manual"},
        )
        card = response.json()
        review_response = await client.post(
            f"/api/flashcards/{card['id']}/review",
            json={"result": result_name},
        )
        assert review_response.status_code == 200
        results[result_name] = review_response.json()

    assert results["again"]["repetition"] == 0
    assert results["again"]["interval_days"] == 1
    assert results["again"]["ease_factor"] == pytest.approx(2.3)

    assert results["hard"]["repetition"] == 1
    assert results["hard"]["interval_days"] == 2
    assert results["hard"]["ease_factor"] == pytest.approx(2.35)

    assert results["good"]["repetition"] == 1
    assert results["good"]["interval_days"] == 1
    assert results["good"]["ease_factor"] == pytest.approx(2.5)

    assert results["easy"]["repetition"] == 1
    assert results["easy"]["interval_days"] == 3
    assert results["easy"]["ease_factor"] == pytest.approx(2.65)

    session_factory = test_context["session_factory"]
    async with session_factory() as session:
        repo = FlashcardRepository(session)
        selected = await repo.get_flashcard(selection_card["id"])
        selected.next_review_at = datetime.utcnow() - timedelta(hours=4)
        selected.updated_at = datetime.utcnow() - timedelta(minutes=20)

        due_alpha = await repo.create_flashcard(term="alpha", source_type="manual")
        due_alpha.next_review_at = datetime.utcnow() - timedelta(hours=2)
        due_alpha.updated_at = datetime.utcnow() - timedelta(minutes=10)

        due_beta = await repo.create_flashcard(term="beta", source_type="manual")
        due_beta.next_review_at = datetime.utcnow() - timedelta(hours=1)
        due_beta.updated_at = datetime.utcnow() - timedelta(minutes=5)

        future = await repo.create_flashcard(term="future", source_type="manual")
        future.next_review_at = datetime.utcnow() + timedelta(days=1)
        await session.commit()

    due_response = await client.get("/api/flashcards/review/due", params={"limit": 10})
    due_terms = [card["term"] for card in due_response.json()]
    assert due_terms[:3] == ["train station", "alpha", "beta"]
    assert "future" not in due_terms


@pytest.mark.anyio
async def test_note_and_bookmark_routes_still_work(client: AsyncClient, seeded_exam):
    """Notes and bookmarks should still behave after adding flashcards."""
    note_response = await client.post(
        f"/api/questions/{seeded_exam['question_id']}/notes",
        json={"content": "Need to review this image."},
    )
    bookmark_on = await client.post(f"/api/questions/{seeded_exam['question_id']}/bookmark")
    bookmark_off = await client.post(f"/api/questions/{seeded_exam['question_id']}/bookmark")

    assert note_response.status_code == 200
    assert note_response.json()["content"] == "Need to review this image."
    assert bookmark_on.status_code == 200
    assert bookmark_on.json()["is_bookmarked"] is True
    assert bookmark_off.status_code == 200
    assert bookmark_off.json()["is_bookmarked"] is False
