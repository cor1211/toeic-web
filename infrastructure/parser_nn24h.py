"""NN24H HTML Parser — extracts TOEIC exam data from ngoaingu24h.vn HTML dumps.

This parser targets the specific DOM structure used by NN24H's online exam view.
It extracts: exam title, sections, questions, choices, correct answers,
explanations, and image URLs.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from bs4 import BeautifulSoup, Tag


@dataclass
class ParsedChoice:
    """A parsed answer choice."""

    choice_key: str  # "A", "B", "C", "D"
    content_html: str = ""
    is_correct: bool = False


@dataclass
class ParsedQuestion:
    """A parsed question from the HTML."""

    order_index: int = 0
    source_dom_id: str = ""
    prompt_html: str = ""
    image_url: Optional[str] = None
    explanation_html: str = ""
    correct_choice_key: str = ""
    choices: list[ParsedChoice] = field(default_factory=list)


@dataclass
class ParsedSection:
    """A parsed exam section."""

    title: str = ""
    part: Optional[int] = None
    order_index: int = 0
    instructions_html: str = ""
    questions: list[ParsedQuestion] = field(default_factory=list)


@dataclass
class ParsedExam:
    """Complete parsed exam result."""

    title: str = ""
    source_url: str = ""
    sections: list[ParsedSection] = field(default_factory=list)

    @property
    def question_count(self) -> int:
        """Total number of questions across all sections."""
        return sum(len(s.questions) for s in self.sections)


def _extract_text_clean(tag: Optional[Tag]) -> str:
    """Extract visible text from a tag, stripped and cleaned."""
    if tag is None:
        return ""
    return tag.get_text(strip=True)


def _extract_inner_html(tag: Optional[Tag]) -> str:
    """Get the inner HTML of a tag as a string."""
    if tag is None:
        return ""
    return "".join(str(child) for child in tag.children)


def _parse_choice_key(text: str) -> str:
    """Extract choice letter from text like '(A)' or '(D)'."""
    match = re.search(r"\(([A-D])\)", text)
    return match.group(1) if match else ""


def _detect_part_number(title_text: str) -> Optional[int]:
    """Try to detect TOEIC Part number from section title."""
    match = re.search(r"Part\s*(\d)", title_text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    # Heuristic: "Photos of People" → Part 1
    lower = title_text.lower()
    if "photo" in lower:
        return 1
    if "question-response" in lower or "question response" in lower:
        return 2
    if "conversation" in lower:
        return 3
    if "talk" in lower or "short talk" in lower:
        return 4
    if "incomplete sentence" in lower:
        return 5
    if "text completion" in lower:
        return 6
    if "reading comprehension" in lower or "single passage" in lower or "double passage" in lower:
        return 7
    return None


def _parse_question_block(
    block: Tag,
    fallback_index: int,
) -> ParsedQuestion:
    """Parse a single question from a game-object-child-wrap block.

    Args:
        block: The div.game-object-child-wrap element.
        fallback_index: Used if the question index cannot be extracted from HTML.

    Returns:
        A ParsedQuestion with all extractable fields populated.
    """
    question = ParsedQuestion()

    # --- DOM ID ---
    dom_id = block.get("id", "")
    question.source_dom_id = str(dom_id)

    # --- Question index ---
    index_el = block.select_one(".game-object-view-question-index span")
    if index_el:
        idx_text = _extract_text_clean(index_el).replace(".", "")
        question.order_index = int(idx_text) if idx_text.isdigit() else fallback_index
    else:
        question.order_index = fallback_index

    # --- Question prompt text ---
    prompt_el = block.select_one(
        ".quiz-game-object-question .game-object-question-extend-v2-text"
    )
    prompt_text = _extract_inner_html(prompt_el).strip()
    if prompt_text and prompt_text not in ("&nbsp;", "\xa0", ""):
        question.prompt_html = prompt_text

    # --- Image URL ---
    img_container = block.select_one(".game-image-widget-container img")
    if img_container and img_container.get("src"):
        src = str(img_container["src"])
        # Skip preview/backdrop images
        if "preview-" not in img_container.get("alt", ""):
            question.image_url = src

    # --- Choices ---
    choice_items = block.select(".game-object-quiz-choices .quiz-choice-item")
    for item in choice_items:
        content_el = item.select_one(".quiz-choice-item-content")
        if content_el is None:
            continue
        content_text = _extract_text_clean(content_el)
        key = _parse_choice_key(content_text)
        if not key:
            continue

        is_correct = "correct" in (content_el.get("class") or [])
        choice = ParsedChoice(
            choice_key=key,
            content_html=content_text,
            is_correct=is_correct,
        )
        question.choices.append(choice)

        if is_correct:
            question.correct_choice_key = key

    # --- Explanation ---
    explanation_el = block.select_one(".game-object-explanation-content")
    if explanation_el:
        question.explanation_html = _extract_inner_html(explanation_el)

    return question


def _parse_section_block(
    block: Tag,
    section_index: int,
) -> ParsedSection:
    """Parse a section (para block) from a game-object-view-container.

    Args:
        block: The div.game-object-view-container parent for the section.
        section_index: Sequential index for ordering.

    Returns:
        A ParsedSection with its child questions populated.
    """
    section = ParsedSection(order_index=section_index)

    # --- Section title ---
    title_el = block.select_one(".game-object-view-aio-question-index")
    if title_el:
        section.title = _extract_text_clean(title_el)
        section.part = _detect_part_number(section.title)

    # --- Section instructions ---
    instr_el = block.select_one(
        ".game-object-question-extend-v2-text"
    )
    if instr_el:
        # Only take the top-level instruction, not per-question ones
        parent_question = instr_el.find_parent(class_="quiz-game-object-question")
        if parent_question is None:
            section.instructions_html = _extract_inner_html(instr_el)

    # --- Questions ---
    question_blocks = block.select(".game-object-child-wrap")
    for idx, q_block in enumerate(question_blocks, start=1):
        question = _parse_question_block(q_block, fallback_index=idx)
        section.questions.append(question)

    return section


def parse_nn24h_html(html_content: str) -> ParsedExam:
    """Parse a full NN24H exam HTML page into structured data.

    Args:
        html_content: The complete HTML string from a saved NN24H exam page.

    Returns:
        A ParsedExam containing all extractable sections and questions.

    Raises:
        ValueError: If no exam content is found in the HTML.
    """
    soup = BeautifulSoup(html_content, "html.parser")
    exam = ParsedExam()

    # --- Exam title ---
    title_tag = soup.find("title")
    if title_tag:
        raw_title = _extract_text_clean(title_tag)
        # Remove the common "Thi Online: " prefix
        exam.title = re.sub(r"^Thi Online:\s*", "", raw_title).strip()

    # --- Source URL (from canonical link) ---
    canonical = soup.find("link", attrs={"rel": "canonical"})
    if canonical and canonical.get("href"):
        exam.source_url = str(canonical["href"])

    # --- Section blocks ---
    # Each top-level para is a game-object-view-aio game-para-aio-with-content
    para_blocks = soup.select(".game-object-view-aio.game-para-aio-with-content")
    if not para_blocks:
        # Fallback: look for any game-object-view-container
        para_blocks = soup.select("#main-game-view .game-object-view-container")

    # Track seen question DOM IDs / indices to prevent duplicates from nested HTML
    seen_question_keys: set[str] = set()

    for s_idx, para in enumerate(para_blocks):
        container = para.select_one(".game-object-view-container")
        if container is None:
            container = para
        section = _parse_section_block(container, section_index=s_idx)

        # Deduplicate: remove questions already seen in an earlier section
        unique_questions: list[ParsedQuestion] = []
        for q in section.questions:
            key = q.source_dom_id or f"idx-{q.order_index}"
            if key not in seen_question_keys:
                seen_question_keys.add(key)
                unique_questions.append(q)
        section.questions = unique_questions

        if section.questions:
            exam.sections.append(section)

    if not exam.sections:
        raise ValueError(
            "No exam content found in the provided HTML. "
            "Make sure this is a NN24H exam page with completed/reviewed results."
        )

    return exam
