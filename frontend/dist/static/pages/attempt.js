/**
 * Attempt Page — Take an exam with questions, choices, audio, timer, navigator.
 */

let attemptState = {
    exam: null,
    attempt: null,
    questions: [],       // flat list of all questions
    currentIndex: 0,
    answers: {},         // questionId -> { selected, flagged }
    timer: null,
    elapsedSeconds: 0,
    autoSaveTimer: null,
};

async function renderAttemptPage({ id }) {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="page-enter" style="text-align:center;padding:60px"><div class="spinner" style="width:32px;height:32px;border-width:3px"></div><p style="margin-top:16px">Đang tải đề thi...</p></div>`;

    try {
        const exam = await api.getExam(parseInt(id));
        attemptState.exam = exam;

        // Flatten questions from all sections
        attemptState.questions = [];
        for (const sec of exam.sections) {
            for (const q of sec.questions) {
                q._sectionTitle = sec.title;
                q._sectionInstructions = sec.instructions_html;
                attemptState.questions.push(q);
            }
        }
        attemptState.currentIndex = 0;
        attemptState.answers = {};
        attemptState.elapsedSeconds = 0;

        // Create attempt in backend
        const attempt = await api.createAttempt(exam.id);
        attemptState.attempt = attempt;

        renderAttemptUI();
        startTimer();
        startAutoSave();

        // Keyboard shortcuts
        document.addEventListener('keydown', handleAttemptKeyboard);
    } catch (err) {
        content.innerHTML = `<div class="page-enter empty-state"><p style="color:var(--incorrect)">Lỗi: ${err.message}</p><button class="btn btn-ghost" onclick="router.navigate('/')">← Về thư viện</button></div>`;
    }
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
                    ${exam.audio_local_path ? `
                        <div class="audio-player-bar">
                            <span style="font-size:13px;color:var(--text-muted);white-space:nowrap">🔊 Audio:</span>
                            <audio id="exam-audio" controls preload="auto" style="flex:1;height:36px">
                                <source src="${resolveMediaUrl(exam.audio_local_path)}" type="audio/mpeg">
                            </audio>
                        </div>
                    ` : ''}
                    <div class="question-container glass-card" id="question-display">
                        <!-- Rendered by renderCurrentQuestion -->
                    </div>
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
                            ${questions.map((q, i) => `
                                <button class="q-nav-btn${i === 0 ? ' current' : ''}"
                                    data-index="${i}" onclick="goToQuestion(${i})">${q.order_index}</button>
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

function renderCurrentQuestion() {
    const { questions, currentIndex, answers } = attemptState;
    const q = questions[currentIndex];
    const display = document.getElementById('question-display');
    const answer = answers[q.id] || {};

    display.innerHTML = `
        <div class="question-header">
            <div style="display:flex;align-items:center;gap:12px">
                <div class="question-number">${q.order_index}</div>
                <span style="font-size:13px;color:var(--text-muted)">${escapeHtml(q._sectionTitle || '')}</span>
            </div>
            <div class="question-actions">
                <button class="btn-icon bookmark-btn ${answer.flagged ? 'active' : ''}"
                    onclick="toggleFlag(${q.id})" title="Đánh dấu câu hỏi">
                    ${answer.flagged ? '🚩' : '🏳'}
                </button>
            </div>
        </div>

        ${q.image_url ? `
            <div class="question-image">
                <img src="${resolveMediaUrl(q.image_local_path || q.image_url)}"
                     alt="Question ${q.order_index}"
                     onclick="openLightbox(this.src)"
                     loading="lazy">
            </div>
        ` : ''}

        ${q.prompt_html && q.prompt_html !== '&nbsp;' ? `
            <div class="question-prompt">${q.prompt_html}</div>
        ` : ''}

        <div class="choices-list">
            ${q.choices.map(c => `
                <div class="choice-item ${answer.selected === c.choice_key ? 'selected' : ''}"
                     onclick="selectChoice(${q.id}, '${c.choice_key}')">
                    <div class="choice-key">${c.choice_key}</div>
                    <div class="choice-text">${escapeHtml(c.content_html)}</div>
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

function goToQuestion(index) {
    attemptState.currentIndex = index;
    renderCurrentQuestion();
    updateQuestionGrid();
}
function prevQuestion() { if (attemptState.currentIndex > 0) goToQuestion(attemptState.currentIndex - 1); }
function nextQuestion() { if (attemptState.currentIndex < attemptState.questions.length - 1) goToQuestion(attemptState.currentIndex + 1); }

function updateQuestionGrid() {
    const { questions, currentIndex, answers } = attemptState;
    document.querySelectorAll('.q-nav-btn').forEach((btn, i) => {
        const q = questions[i];
        const a = answers[q.id];
        btn.className = 'q-nav-btn';
        if (i === currentIndex) btn.classList.add('current');
        if (a?.selected) btn.classList.add('answered');
        if (a?.flagged) btn.classList.add('flagged');
    });
}

function handleAttemptKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key) {
        case 'ArrowLeft': prevQuestion(); break;
        case 'ArrowRight': nextQuestion(); break;
        case '1': case 'a': case 'A': selectChoiceByIndex(0); break;
        case '2': case 'b': case 'B': selectChoiceByIndex(1); break;
        case '3': case 'c': case 'C': selectChoiceByIndex(2); break;
        case '4': case 'd': case 'D': selectChoiceByIndex(3); break;
        case 'f': case 'F':
            const q = attemptState.questions[attemptState.currentIndex];
            toggleFlag(q.id);
            break;
    }
}

function selectChoiceByIndex(idx) {
    const q = attemptState.questions[attemptState.currentIndex];
    if (q.choices[idx]) selectChoice(q.id, q.choices[idx].choice_key);
}

// Timer
function startTimer() {
    clearInterval(attemptState.timer);
    attemptState.timer = setInterval(() => {
        attemptState.elapsedSeconds++;
        const mins = String(Math.floor(attemptState.elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(attemptState.elapsedSeconds % 60).padStart(2, '0');
        const timerEl = document.getElementById('timer-display');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

// Auto-save every 30 seconds
function startAutoSave() {
    clearInterval(attemptState.autoSaveTimer);
    attemptState.autoSaveTimer = setInterval(async () => {
        if (!attemptState.attempt) return;
        const answersPayload = buildAnswersPayload();
        if (answersPayload.length > 0) {
            try {
                await api.saveProgress(attemptState.attempt.id, answersPayload, attemptState.elapsedSeconds);
            } catch { /* silent fail on auto-save */ }
        }
    }, 30000);
}

function buildAnswersPayload() {
    return Object.entries(attemptState.answers)
        .filter(([_, a]) => a.selected || a.flagged)
        .map(([qId, a]) => ({
            question_id: parseInt(qId),
            selected_choice_key: a.selected || null,
            flagged: !!a.flagged,
            elapsed_seconds: 0,
        }));
}

async function submitAttempt() {
    const unanswered = attemptState.questions.filter(q => !attemptState.answers[q.id]?.selected).length;
    if (unanswered > 0 && !confirm(`Bạn còn ${unanswered} câu chưa trả lời. Nộp bài?`)) return;

    clearInterval(attemptState.timer);
    clearInterval(attemptState.autoSaveTimer);
    document.removeEventListener('keydown', handleAttemptKeyboard);

    try {
        const payload = buildAnswersPayload();
        await api.submitAttempt(attemptState.attempt.id, payload, attemptState.elapsedSeconds);
        showToast('Đã nộp bài thành công!', 'success');
        router.navigate(`/review/${attemptState.exam.id}/${attemptState.attempt.id}`);
    } catch (err) {
        showToast('Lỗi nộp bài: ' + err.message, 'error');
    }
}

function exitAttempt() {
    clearInterval(attemptState.timer);
    clearInterval(attemptState.autoSaveTimer);
    document.removeEventListener('keydown', handleAttemptKeyboard);
    router.navigate('/');
}
