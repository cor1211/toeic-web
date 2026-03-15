"""Unit tests for the NN24H HTML parser."""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from infrastructure.parser_nn24h import parse_nn24h_html


SAMPLE_HTML_PATH = Path(__file__).resolve().parent.parent / "html_template.txt"


def _load_sample() -> str:
    """Load the sample HTML content."""
    return SAMPLE_HTML_PATH.read_text(encoding="utf-8", errors="replace")


def test_parse_exam_title():
    """Should extract the exam title from the HTML <title> tag."""
    html = _load_sample()
    exam = parse_nn24h_html(html)
    assert "Photos of People" in exam.title or "Đề số 01" in exam.title
    assert exam.title  # Must not be empty


def test_parse_has_sections():
    """Should find at least one section."""
    html = _load_sample()
    exam = parse_nn24h_html(html)
    assert len(exam.sections) >= 1


def test_parse_question_count():
    """Should find 10 questions (Question 1-10 in the sample)."""
    html = _load_sample()
    exam = parse_nn24h_html(html)
    total = exam.question_count
    assert total == 10, f"Expected 10 questions, got {total}"


def test_parse_question_has_image():
    """Each Part 1 question should have an image URL."""
    html = _load_sample()
    exam = parse_nn24h_html(html)
    for section in exam.sections:
        for q in section.questions:
            assert q.image_url, f"Question {q.order_index} has no image URL"
            assert q.image_url.startswith("http"), f"Bad URL: {q.image_url}"


def test_parse_choices():
    """Each question should have 4 choices (A-D)."""
    html = _load_sample()
    exam = parse_nn24h_html(html)
    for section in exam.sections:
        for q in section.questions:
            assert len(q.choices) == 4, (
                f"Question {q.order_index}: expected 4 choices, got {len(q.choices)}"
            )
            keys = {c.choice_key for c in q.choices}
            assert keys == {"A", "B", "C", "D"}, (
                f"Question {q.order_index}: bad choice keys {keys}"
            )


def test_parse_correct_answer():
    """Each question should have a correct answer identified."""
    html = _load_sample()
    exam = parse_nn24h_html(html)
    for section in exam.sections:
        for q in section.questions:
            assert q.correct_choice_key in {"A", "B", "C", "D"}, (
                f"Question {q.order_index}: bad correct key '{q.correct_choice_key}'"
            )


def test_parse_explanations():
    """Each question should have an explanation."""
    html = _load_sample()
    exam = parse_nn24h_html(html)
    for section in exam.sections:
        for q in section.questions:
            assert q.explanation_html, (
                f"Question {q.order_index} has no explanation"
            )


def test_known_answers():
    """Verify specific correct answers for known questions."""
    html = _load_sample()
    exam = parse_nn24h_html(html)
    questions = exam.sections[0].questions

    expected = {
        1: "D",  # picture frames hanging on wall
        2: "C",  # mobile food stand
        3: "B",  # light fixtures mounted on wall
        4: "A",  # employee walking with empty tray
        5: "C",  # facing refrigerated display case
    }

    for idx, expected_key in expected.items():
        q = next((q for q in questions if q.order_index == idx), None)
        assert q is not None, f"Question {idx} not found"
        assert q.correct_choice_key == expected_key, (
            f"Question {idx}: expected {expected_key}, got {q.correct_choice_key}"
        )


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
