/**
 * Attempt Page — take an exam with audio shortcuts, timer, and autosave.
 */

let attemptState = {
    exam: null,
    attempt: null,
    questions: [],
    currentIndex: 0,
    answers: {},
    timer: null,
    elapsedSeconds: 0,
    autoSaveTimer: null,
};

async function renderAttemptPage({ id }) {
    resetAttemptState();
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="page-enter" style="text-align:center;padding:60px"><div class="spinner" style="width:32px;height:32px;border-width:3px"></div><p style="margin-top:16px">Đang tải đề thi...</p></div>`;

    try {
        const exam = await api.getExam(parseInt(id, 10));
        attemptState.exam = exam;
        attemptState.questions = flattenAttemptQuestions(exam);
        attemptState.attempt = await api.createAttempt(exam.id);

        renderAttemptUI();
        startAttemptTimer();
        startAutoSave();
        registerAttemptShortcuts();
        setActivePageCleanup(resetAttemptState);
    } catch (err) {
        content.innerHTML = `<div class="page-enter empty-state"><p style="color:var(--incorrect)">Lỗi: ${err.message}</p><button class="btn btn-ghost" onclick="router.navigate('/')">← Về thư viện</button></div>`;
    }
}

function flattenAttemptQuestions(exam) {
    const questions = [];
    exam.sections.forEach((section) => {
        section.questions.forEach((question) => {
            question._sectionTitle = section.title;
            question._sectionInstructions = section.instructions_html;
            question._part = section.part;
            questions.push(question);
        });
    });
    return questions;
}

function renderAttemptUI() {
    const { exam, questions } = attemptState;
    const content = document.getElementById('page-content');

    content.innerHTML = `
        <div class="page-enter">
            <div style="margin-bottom:16px">
                <button class="btn btn-ghost btn-sm" onclick="exitAttempt()">← Về thư viện</button>
                <span style="margin-left:12px;font-weight:600">${escapeHtml(exam.title)}</span>
            </div>
            <div class="attempt-layout">
                <div class="attempt-main">
                    ${renderAttemptAudioBar(exam.audio_local_path)}
                    <div class="question-container glass-card" id="question-display"></div>
                </div>
                <div class="attempt-sidebar">
                    <div class="sidebar-section glass-card">
                        <div class="sidebar-title">⏱ Thời gian</div>
                        <div class="timer-display" id="timer-display">00:00</div>
                        <button class="btn btn-primary" style="width:100%" onclick="submitAttempt()">
                            Nộp bài
                        </button>
                    </div>
                    <div class="sidebar-section glass-card">
                        <div class="sidebar-title">📋 Câu hỏi</div>
                        <div class="question-grid" id="question-grid">
                            ${questions.map((question, index) => `
                                <button class="q-nav-btn${index === 0 ? ' current' : ''}"
                                    data-index="${index}" onclick="goToQuestion(${index})">${question.order_index}</button>
                            `).join('')}
                        </div>
                        <div class="nav-legend">
                            <span class="legend-item"><span class="legend-dot current"></span> Đang xem</span>
                            <span class="legend-item"><span class="legend-dot answered"></span> Đã trả lời</span>
                            <span class="legend-item"><span class="legend-dot flagged"></span> Đánh dấu</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    renderCurrentQuestion();
}

function renderAttemptAudioBar(audioPath) {
    if (!audioPath) return '';
    return `
        <div class="audio-player-bar">
            <span style="font-size:13px;color:var(--text-muted);white-space:nowrap">🔊 Audio:</span>
            <audio id="exam-audio" controls preload="auto" style="flex:1;height:36px">
                <source src="${resolveMediaUrl(audioPath)}" type="audio/mpeg">
            </audio>
            <div class="audio-shortcut-hint">Space: phát/tạm dừng • ←/→: tua 5s • Alt + ←/→: đổi câu</div>
        </div>
    `;
}

function renderCurrentQuestion() {
    const { questions, currentIndex, answers } = attemptState;
    const question = questions[currentIndex];
    const display = document.getElementById('question-display');
    const answer = answers[question.id] || {};

    display.innerHTML = `
        <div class="question-header">
            <div style="display:flex;align-items:center;gap:12px">
                <div class="question-number">${question.order_index}</div>
                <span style="font-size:13px;color:var(--text-muted)">${escapeHtml(question._sectionTitle || '')}</span>
            </div>
            <div class="question-actions">
                <button class="btn-icon bookmark-btn ${answer.flagged ? 'active' : ''}"
                    onclick="toggleFlag(${question.id})" title="Đánh dấu câu hỏi">
                    ${answer.flagged ? '🚩' : '🏳'}
                </button>
            </div>
        </div>
        ${question.image_url ? renderAttemptQuestionImage(question) : ''}
        ${question.prompt_html && question.prompt_html !== '&nbsp;' ? `
            <div class="question-prompt">${question.prompt_html}</div>
        ` : ''}
        <div class="choices-list">
            ${question.choices.map((choice) => `
                <div class="choice-item ${answer.selected === choice.choice_key ? 'selected' : ''}"
                     onclick="selectChoice(${question.id}, '${choice.choice_key}')">
                    <div class="choice-key">${choice.choice_key}</div>
                    <div class="choice-text">${escapeHtml(choice.content_html)}</div>
                </div>
            `).join('')}
        </div>
        <div class="question-nav">
            <button class="btn btn-ghost" onclick="prevQuestion()" ${currentIndex === 0 ? 'disabled style="opacity:0.3"' : ''}>
                ← Câu trước
            </button>
            <span style="font-size:13px;color:var(--text-muted)">
                ${currentIndex + 1} / ${questions.length}
            </span>
            <button class="btn btn-ghost" onclick="nextQuestion()" ${currentIndex === questions.length - 1 ? 'disabled style="opacity:0.3"' : ''}>
                Câu sau →
            </button>
        </div>
    `;
}

function renderAttemptQuestionImage(question) {
    return `
        <div class="question-image">
            <img src="${resolveMediaUrl(question.image_local_path || question.image_url)}"
                 alt="Question ${question.order_index}"
                 onclick="openLightbox(this.src)"
                 loading="lazy">
        </div>
    `;
}

function registerAttemptShortcuts() {
    registerGlobalAudioShortcuts({
        getAudio: () => document.getElementById('exam-audio'),
        onPrevQuestion: prevQuestion,
        onNextQuestion: nextQuestion,
        onUnhandled: handleAttemptSelectionShortcuts,
    });
}

function handleAttemptSelectionShortcuts(event) {
    if (isEditableTarget(event.target)) return;
    switch (event.key) {
        case '1':
        case 'a':
        case 'A':
            selectChoiceByIndex(0);
            break;
        case '2':
        case 'b':
        case 'B':
            selectChoiceByIndex(1);
            break;
        case '3':
        case 'c':
        case 'C':
            selectChoiceByIndex(2);
            break;
        case '4':
        case 'd':
        case 'D':
            selectChoiceByIndex(3);
            break;
        case 'f':
        case 'F':
            toggleFlag(attemptState.questions[attemptState.currentIndex].id);
            break;
    }
}

function selectChoice(questionId, choiceKey) {
    attemptState.answers[questionId] = attemptState.answers[questionId] || {};
    attemptState.answers[questionId].selected = choiceKey;
    renderCurrentQuestion();
    updateQuestionGrid();
}

function toggleFlag(questionId) {
    attemptState.answers[questionId] = attemptState.answers[questionId] || {};
    attemptState.answers[questionId].flagged = !attemptState.answers[questionId].flagged;
    renderCurrentQuestion();
    updateQuestionGrid();
}

function selectChoiceByIndex(index) {
    const question = attemptState.questions[attemptState.currentIndex];
    if (!question.choices[index]) return;
    selectChoice(question.id, question.choices[index].choice_key);
}

function goToQuestion(index) {
    attemptState.currentIndex = index;
    renderCurrentQuestion();
    updateQuestionGrid();
}

function prevQuestion() {
    if (attemptState.currentIndex > 0) goToQuestion(attemptState.currentIndex - 1);
}

function nextQuestion() {
    if (attemptState.currentIndex < attemptState.questions.length - 1) {
        goToQuestion(attemptState.currentIndex + 1);
    }
}

function updateQuestionGrid() {
    const { questions, currentIndex, answers } = attemptState;
    document.querySelectorAll('.q-nav-btn').forEach((button, index) => {
        const answer = answers[questions[index].id];
        button.className = 'q-nav-btn';
        if (index === currentIndex) button.classList.add('current');
        if (answer?.selected) button.classList.add('answered');
        if (answer?.flagged) button.classList.add('flagged');
    });
}

function startAttemptTimer() {
    clearInterval(attemptState.timer);
    attemptState.timer = setInterval(() => {
        attemptState.elapsedSeconds += 1;
        const mins = String(Math.floor(attemptState.elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(attemptState.elapsedSeconds % 60).padStart(2, '0');
        const timerEl = document.getElementById('timer-display');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function startAutoSave() {
    clearInterval(attemptState.autoSaveTimer);
    attemptState.autoSaveTimer = setInterval(async () => {
        if (!attemptState.attempt) return;
        const answersPayload = buildAnswersPayload();
        if (answersPayload.length === 0) return;
        try {
            await api.saveProgress(attemptState.attempt.id, answersPayload, attemptState.elapsedSeconds);
        } catch {
            // Ignore transient autosave failures.
        }
    }, 30000);
}

function buildAnswersPayload() {
    return Object.entries(attemptState.answers)
        .filter(([, answer]) => answer.selected || answer.flagged)
        .map(([questionId, answer]) => ({
            question_id: parseInt(questionId, 10),
            selected_choice_key: answer.selected || null,
            flagged: Boolean(answer.flagged),
            elapsed_seconds: 0,
        }));
}

async function submitAttempt() {
    const unanswered = attemptState.questions.filter((question) => !attemptState.answers[question.id]?.selected).length;
    if (unanswered > 0 && !confirm(`Bạn còn ${unanswered} câu chưa trả lời. Nộp bài?`)) return;

    try {
        const payload = buildAnswersPayload();
        const examId = attemptState.exam.id;
        const attemptId = attemptState.attempt.id;
        await api.submitAttempt(attemptState.attempt.id, payload, attemptState.elapsedSeconds);
        resetAttemptState();
        showToast('Đã nộp bài thành công!', 'success');
        router.navigate(`/review/${examId}/${attemptId}`);
    } catch (err) {
        showToast(`Lỗi nộp bài: ${err.message}`, 'error');
    }
}

function exitAttempt() {
    resetAttemptState();
    router.navigate('/');
}

function resetAttemptState() {
    clearInterval(attemptState.timer);
    clearInterval(attemptState.autoSaveTimer);
    cleanupGlobalAudioShortcuts();
    attemptState = {
        exam: null,
        attempt: null,
        questions: [],
        currentIndex: 0,
        answers: {},
        timer: null,
        elapsedSeconds: 0,
        autoSaveTimer: null,
    };
}
