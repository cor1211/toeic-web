/**
 * Review Page — result review, notes, bookmarks, audio shortcuts, and flashcard capture.
 */

let reviewState = {
    exam: null,
    attempt: null,
    questions: [],
    answerMap: {},
    selectionContext: null,
    cleanupSelection: null,
};

let noteDebounceTimers = {};

async function renderReviewPage({ id, attemptId }) {
    resetReviewState();
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="page-enter" style="text-align:center;padding:60px"><div class="spinner" style="width:32px;height:32px;border-width:3px"></div><p style="margin-top:16px">Đang tải kết quả...</p></div>`;

    try {
        reviewState.exam = await api.getExam(parseInt(id, 10));
        reviewState.attempt = attemptId ? await api.getAttempt(parseInt(attemptId, 10)) : null;
        reviewState.questions = flattenReviewQuestions(reviewState.exam);
        reviewState.answerMap = buildAnswerMap(reviewState.attempt);

        renderReviewUI();
        registerReviewPageBindings();
        setActivePageCleanup(resetReviewState);
    } catch (err) {
        content.innerHTML = `<div class="page-enter empty-state"><p style="color:var(--incorrect)">Lỗi: ${err.message}</p><button class="btn btn-ghost" onclick="router.navigate('/')">← Về thư viện</button></div>`;
    }
}

function flattenReviewQuestions(exam) {
    const questions = [];
    exam.sections.forEach((section) => {
        section.questions.forEach((question) => {
            question._sectionTitle = section.title;
            question._part = section.part;
            questions.push(question);
        });
    });
    return questions;
}

function buildAnswerMap(attempt) {
    const answerMap = {};
    if (!attempt) return answerMap;
    attempt.answers.forEach((answer) => {
        answerMap[answer.question_id] = answer;
    });
    return answerMap;
}

function renderReviewUI() {
    const content = document.getElementById('page-content');
    const { exam, attempt, questions, answerMap } = reviewState;
    const totalQuestions = questions.length;
    const correctCount = attempt ? attempt.correct_count : 0;
    const incorrectCount = attempt ? attempt.incorrect_count : 0;
    const unansweredCount = attempt ? totalQuestions - correctCount - incorrectCount : 0;
    const score = attempt ? attempt.raw_score : 0;
    const circumference = 2 * Math.PI * 46;
    const dashOffset = circumference * (1 - score / 100);

    content.innerHTML = `
        <div class="page-enter">
            <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px">
                <button class="btn btn-ghost btn-sm" onclick="router.navigate('/')">← Về thư viện</button>
                <h2 style="font-size:18px;font-weight:700">${escapeHtml(exam.title)}</h2>
            </div>
            ${attempt ? renderReviewScoreCard(score, correctCount, incorrectCount, unansweredCount, circumference, dashOffset) : ''}
            ${renderReviewAudioBar(exam.audio_local_path)}
            <div class="review-filters" id="review-filters">
                <button class="filter-btn active" data-filter="all" onclick="filterReview('all')">
                    Tất cả <span class="filter-count">${totalQuestions}</span>
                </button>
                ${attempt ? `
                    <button class="filter-btn" data-filter="correct" onclick="filterReview('correct')">
                        ✓ Đúng <span class="filter-count">${correctCount}</span>
                    </button>
                    <button class="filter-btn" data-filter="incorrect" onclick="filterReview('incorrect')">
                        ✕ Sai <span class="filter-count">${incorrectCount}</span>
                    </button>
                    <button class="filter-btn" data-filter="unanswered" onclick="filterReview('unanswered')">
                        ○ Bỏ qua <span class="filter-count">${unansweredCount}</span>
                    </button>
                ` : ''}
                <button class="filter-btn" data-filter="bookmarked" onclick="filterReview('bookmarked')">
                    ★ Bookmark
                </button>
            </div>
            <div id="review-questions">
                ${questions.map((question) => renderReviewQuestionCard(question, answerMap[question.id], attempt)).join('')}
            </div>
            <button id="selection-flashcard-btn" class="selection-flashcard-btn hidden" type="button" onclick="openSelectedReviewFlashcard()">
                + Thêm flashcard
            </button>
        </div>
    `;
}

function renderReviewScoreCard(score, correctCount, incorrectCount, unansweredCount, circumference, dashOffset) {
    return `
        <div class="review-score-card glass-card">
            <div class="score-circle">
                <svg viewBox="0 0 100 100">
                    <circle class="bg" cx="50" cy="50" r="46"/>
                    <circle class="progress" cx="50" cy="50" r="46"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${dashOffset}"/>
                </svg>
                <div class="score-value">
                    <span class="number" style="color:var(--correct)">${score}%</span>
                    <span class="label">Điểm</span>
                </div>
            </div>
            <div class="score-details">
                <div class="score-stat">
                    <div class="stat-value" style="color:var(--correct)">${correctCount}</div>
                    <div class="stat-label">Đúng</div>
                </div>
                <div class="score-stat">
                    <div class="stat-value" style="color:var(--incorrect)">${incorrectCount}</div>
                    <div class="stat-label">Sai</div>
                </div>
                <div class="score-stat">
                    <div class="stat-value" style="color:var(--unanswered)">${unansweredCount}</div>
                    <div class="stat-label">Bỏ qua</div>
                </div>
            </div>
        </div>
    `;
}

function renderReviewAudioBar(audioPath) {
    if (!audioPath) return '';
    return `
        <div class="audio-player-bar" style="margin-bottom:20px">
            <span style="font-size:13px;color:var(--text-muted);white-space:nowrap">🔊 Audio:</span>
            <audio id="review-audio" controls preload="auto" style="flex:1;height:36px">
                <source src="${resolveMediaUrl(audioPath)}" type="audio/mpeg">
            </audio>
            <div class="audio-shortcut-hint">Space: phát/tạm dừng • ←/→: tua 5s</div>
        </div>
    `;
}

function renderReviewQuestionCard(question, answer, attempt) {
    const status = resolveReviewStatus(answer, attempt);
    return `
        <div class="review-question glass-card" data-status="${status}" data-qid="${question.id}" data-bookmarked="${question.is_bookmarked}" data-part="${question._part ?? ''}">
            <div class="review-q-header">
                <div class="question-number" style="width:32px;height:32px;font-size:13px">${question.order_index}</div>
                ${attempt ? `<span class="review-status-badge ${status}">
                    ${status === 'correct' ? '✓ Đúng' : status === 'incorrect' ? '✕ Sai' : '○ Bỏ qua'}
                </span>` : ''}
                <span style="font-size:12px;color:var(--text-muted);margin-left:auto">${escapeHtml(question._sectionTitle || '')}</span>
                <button class="btn-icon bookmark-btn ${question.is_bookmarked ? 'active' : ''}"
                    onclick="toggleReviewBookmark(${question.id}, this)" title="Bookmark">
                    ${question.is_bookmarked ? '★' : '☆'}
                </button>
            </div>
            ${question.image_url ? renderReviewQuestionImage(question) : ''}
            ${question.prompt_html && question.prompt_html !== '&nbsp;' ? `
                <div class="question-prompt">${question.prompt_html}</div>
            ` : ''}
            <div class="choices-list">
                ${question.choices.map((choice) => renderReviewChoice(choice, answer)).join('')}
            </div>
            ${question.explanation_html ? renderExplanationSection(question) : ''}
            ${renderNoteSection(question)}
        </div>
    `;
}

function resolveReviewStatus(answer, attempt) {
    if (!attempt) return 'view';
    if (!answer) return 'unanswered';
    if (answer.is_correct) return 'correct';
    return answer.selected_choice_key ? 'incorrect' : 'unanswered';
}

function renderReviewQuestionImage(question) {
    return `
        <div class="question-image" style="text-align:left">
            <img src="${resolveMediaUrl(question.image_local_path || question.image_url)}"
                 alt="Q${question.order_index}" style="max-height:300px"
                 onclick="openLightbox(this.src)" loading="lazy">
        </div>
    `;
}

function renderReviewChoice(choice, answer) {
    let className = '';
    if (choice.is_correct) className = 'correct';
    if (answer && answer.selected_choice_key === choice.choice_key && !answer.is_correct) {
        className = 'incorrect';
    }

    return `
        <div class="choice-item ${className}">
            <div class="choice-key">${choice.choice_key}</div>
            <div class="choice-text">${escapeHtml(choice.content_html)}</div>
            ${choice.is_correct ? '<span style="margin-left:auto;color:var(--correct);font-size:12px">✓</span>' : ''}
            ${answer && answer.selected_choice_key === choice.choice_key && !answer.is_correct ? '<span style="margin-left:auto;color:var(--incorrect);font-size:12px">✕ Bạn chọn</span>' : ''}
        </div>
    `;
}

function renderExplanationSection(question) {
    return `
        <div class="review-section-actions">
            <button class="explanation-toggle" onclick="toggleExplanation(this)">
                📖 Xem giải thích
            </button>
            <button class="btn btn-ghost btn-sm" onclick="openExplanationFlashcard(${question.id})">
                + Flashcard
            </button>
        </div>
        <div class="explanation-box hidden">
            ${question.explanation_html}
        </div>
    `;
}

function renderNoteSection(question) {
    return `
        <div class="note-editor">
            <div class="review-section-actions">
                <span class="review-section-label">Ghi chú cá nhân</span>
                <button class="btn btn-ghost btn-sm" onclick="openNoteFlashcard(${question.id}, this)">
                    + Flashcard
                </button>
            </div>
            <textarea placeholder="Ghi chú của bạn cho câu này..."
                data-qid="${question.id}"
                onblur="saveReviewNote(${question.id}, this.value)">${question.note_content || ''}</textarea>
        </div>
    `;
}

function registerReviewPageBindings() {
    registerGlobalAudioShortcuts({
        getAudio: () => document.getElementById('review-audio'),
    });

    const selectionHandler = () => {
        updateReviewSelectionButton();
    };
    document.addEventListener('selectionchange', selectionHandler);
    document.addEventListener('mouseup', selectionHandler);
    document.addEventListener('keyup', selectionHandler);

    reviewState.cleanupSelection = () => {
        document.removeEventListener('selectionchange', selectionHandler);
        document.removeEventListener('mouseup', selectionHandler);
        document.removeEventListener('keyup', selectionHandler);
    };
}

function toggleExplanation(button) {
    const box = button.parentElement.nextElementSibling;
    box.classList.toggle('hidden');
    button.textContent = box.classList.contains('hidden') ? '📖 Xem giải thích' : '📖 Ẩn giải thích';
}

function filterReview(filter) {
    document.querySelectorAll('.filter-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.filter === filter);
    });

    document.querySelectorAll('.review-question').forEach((card) => {
        const status = card.dataset.status;
        const bookmarked = card.dataset.bookmarked === 'true';
        let visible = false;
        switch (filter) {
            case 'all':
                visible = true;
                break;
            case 'correct':
                visible = status === 'correct';
                break;
            case 'incorrect':
                visible = status === 'incorrect';
                break;
            case 'unanswered':
                visible = status === 'unanswered';
                break;
            case 'bookmarked':
                visible = bookmarked;
                break;
        }
        card.style.display = visible ? '' : 'none';
    });
}

async function toggleReviewBookmark(questionId, button) {
    try {
        const result = await api.toggleBookmark(questionId);
        button.classList.toggle('active', result.is_bookmarked);
        button.textContent = result.is_bookmarked ? '★' : '☆';
        const card = button.closest('.review-question');
        if (card) card.dataset.bookmarked = result.is_bookmarked;
    } catch (err) {
        showToast(`Lỗi bookmark: ${err.message}`, 'error');
    }
}

async function saveReviewNote(questionId, content) {
    clearTimeout(noteDebounceTimers[questionId]);
    noteDebounceTimers[questionId] = setTimeout(async () => {
        try {
            await api.saveNote(questionId, content);
        } catch {
            // Keep note UX non-blocking.
        }
    }, 1000);
}

function updateReviewSelectionButton() {
    const button = document.getElementById('selection-flashcard-btn');
    if (!button) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        hideReviewSelectionButton();
        return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    const sourceElement = findReviewSourceElement(range.commonAncestorContainer);
    if (!selectedText || !sourceElement) {
        hideReviewSelectionButton();
        return;
    }

    const questionCard = sourceElement.closest('.review-question');
    if (!questionCard) {
        hideReviewSelectionButton();
        return;
    }

    reviewState.selectionContext = {
        selectedText,
        contextHtml: sourceElement.innerHTML,
        sourceType: resolveSelectionSourceType(sourceElement),
        examId: reviewState.exam.id,
        questionId: parseInt(questionCard.dataset.qid, 10),
        part: questionCard.dataset.part ? parseInt(questionCard.dataset.part, 10) : null,
    };

    const rect = range.getBoundingClientRect();
    button.style.top = `${window.scrollY + rect.top - 44}px`;
    button.style.left = `${window.scrollX + rect.left}px`;
    button.classList.remove('hidden');
}

function findReviewSourceElement(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element || !element.closest) return null;
    return element.closest('.question-prompt, .choice-item, .explanation-box');
}

function resolveSelectionSourceType(element) {
    if (element.classList.contains('question-prompt')) return 'question_prompt';
    if (element.classList.contains('choice-item')) return 'choice';
    if (element.classList.contains('explanation-box')) return 'explanation';
    return 'manual';
}

function hideReviewSelectionButton() {
    const button = document.getElementById('selection-flashcard-btn');
    if (!button) return;
    button.classList.add('hidden');
    reviewState.selectionContext = null;
}

function openSelectedReviewFlashcard() {
    if (!reviewState.selectionContext) return;
    const selectionContext = reviewState.selectionContext;
    openFlashcardModal({
        mode: 'selection',
        title: 'Tạo flashcard từ đoạn bôi đen',
        submitLabel: 'Lưu từ selection',
        term: selectionContext.selectedText,
        example: selectionContext.selectedText,
        sourceType: selectionContext.sourceType,
        examId: selectionContext.examId,
        questionId: selectionContext.questionId,
        part: selectionContext.part,
        contextHtml: selectionContext.contextHtml,
        onSaved: async () => {
            hideReviewSelectionButton();
            window.getSelection()?.removeAllRanges();
        },
    });
}

function openExplanationFlashcard(questionId) {
    const question = findReviewQuestion(questionId);
    if (!question) return;
    openFlashcardModal({
        mode: 'create',
        title: 'Tạo flashcard từ giải thích',
        sourceType: 'explanation',
        examId: reviewState.exam.id,
        questionId,
        part: question._part,
        contextHtml: question.explanation_html,
        example: stripHtml(question.explanation_html),
    });
}

function openNoteFlashcard(questionId, button) {
    const question = findReviewQuestion(questionId);
    const textarea = button.closest('.note-editor').querySelector('textarea');
    const selectedText = extractTextareaSelection(textarea);
    if (!question || !textarea) return;

    openFlashcardModal({
        mode: selectedText ? 'selection' : 'create',
        title: 'Tạo flashcard từ ghi chú',
        submitLabel: selectedText ? 'Lưu từ ghi chú' : 'Lưu flashcard',
        term: selectedText || '',
        example: selectedText ? selectedText : textarea.value.trim(),
        sourceType: 'note',
        examId: reviewState.exam.id,
        questionId,
        part: question._part,
        contextHtml: textarea.value,
    });
}

function extractTextareaSelection(textarea) {
    if (!textarea || typeof textarea.selectionStart !== 'number') return '';
    const selection = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim();
    return selection;
}

function findReviewQuestion(questionId) {
    return reviewState.questions.find((question) => question.id === questionId) || null;
}

function stripHtml(html) {
    const container = document.createElement('div');
    container.innerHTML = html || '';
    return container.textContent.trim();
}

function resetReviewState() {
    if (typeof reviewState.cleanupSelection === 'function') {
        reviewState.cleanupSelection();
    }
    Object.values(noteDebounceTimers).forEach((timer) => clearTimeout(timer));
    noteDebounceTimers = {};
    cleanupGlobalAudioShortcuts();
    hideReviewSelectionButton();
    reviewState = {
        exam: null,
        attempt: null,
        questions: [],
        answerMap: {},
        selectionContext: null,
        cleanupSelection: null,
    };
}
