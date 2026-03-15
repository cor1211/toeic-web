/**
 * Review Page — Show exam results with explanations, notes, bookmarks.
 * Two modes:
 *  1. /review/:examId/:attemptId — review a submitted attempt
 *  2. /review/:examId — browse exam content (answer key view)
 */

async function renderReviewPage({ id, attemptId }) {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="page-enter" style="text-align:center;padding:60px"><div class="spinner" style="width:32px;height:32px;border-width:3px"></div><p style="margin-top:16px">Đang tải kết quả...</p></div>`;

    try {
        const exam = await api.getExam(parseInt(id));
        let attempt = null;
        if (attemptId) {
            attempt = await api.getAttempt(parseInt(attemptId));
        }

        // Flatten questions
        const allQuestions = [];
        for (const sec of exam.sections) {
            for (const q of sec.questions) {
                q._sectionTitle = sec.title;
                allQuestions.push(q);
            }
        }

        // Build answer lookup
        const answerMap = {};
        if (attempt) {
            for (const a of attempt.answers) {
                answerMap[a.question_id] = a;
            }
        }

        const totalQ = allQuestions.length;
        const correctCount = attempt ? attempt.correct_count : 0;
        const incorrectCount = attempt ? attempt.incorrect_count : 0;
        const unansweredCount = attempt ? totalQ - correctCount - incorrectCount : 0;
        const pct = attempt ? attempt.raw_score : 0;
        const circumference = 2 * Math.PI * 46;
        const dashOffset = circumference * (1 - pct / 100);

        content.innerHTML = `
            <div class="page-enter">
                <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px">
                    <button class="btn btn-ghost btn-sm" onclick="router.navigate('/')">← Về thư viện</button>
                    <h2 style="font-size:18px;font-weight:700">${escapeHtml(exam.title)}</h2>
                </div>

                ${attempt ? `
                    <div class="review-score-card glass-card">
                        <div class="score-circle">
                            <svg viewBox="0 0 100 100">
                                <circle class="bg" cx="50" cy="50" r="46"/>
                                <circle class="progress" cx="50" cy="50" r="46"
                                    stroke-dasharray="${circumference}"
                                    stroke-dashoffset="${dashOffset}"/>
                            </svg>
                            <div class="score-value">
                                <span class="number" style="color:var(--correct)">${pct}%</span>
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
                ` : ''}

                ${exam.audio_local_path ? `
                    <div class="audio-player-bar" style="margin-bottom:20px">
                        <span style="font-size:13px;color:var(--text-muted);white-space:nowrap">🔊 Audio:</span>
                        <audio controls preload="auto" style="flex:1;height:36px">
                            <source src="${resolveMediaUrl(exam.audio_local_path)}" type="audio/mpeg">
                        </audio>
                    </div>
                ` : ''}

                <div class="review-filters" id="review-filters">
                    <button class="filter-btn active" data-filter="all" onclick="filterReview('all')">
                        Tất cả <span class="filter-count">${totalQ}</span>
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
                    ${allQuestions.map(q => {
            const a = answerMap[q.id];
            let status = 'unanswered';
            if (a) {
                status = a.is_correct ? 'correct' : (a.selected_choice_key ? 'incorrect' : 'unanswered');
            }
            if (!attempt) status = 'view';

            return `
                            <div class="review-question glass-card" data-status="${status}" data-qid="${q.id}" data-bookmarked="${q.is_bookmarked}">
                                <div class="review-q-header">
                                    <div class="question-number" style="width:32px;height:32px;font-size:13px">${q.order_index}</div>
                                    ${attempt ? `<span class="review-status-badge ${status}">
                                        ${status === 'correct' ? '✓ Đúng' : status === 'incorrect' ? '✕ Sai' : '○ Bỏ qua'}
                                    </span>` : ''}
                                    <span style="font-size:12px;color:var(--text-muted);margin-left:auto">${escapeHtml(q._sectionTitle || '')}</span>
                                    <button class="btn-icon bookmark-btn ${q.is_bookmarked ? 'active' : ''}"
                                        onclick="toggleReviewBookmark(${q.id}, this)" title="Bookmark">
                                        ${q.is_bookmarked ? '★' : '☆'}
                                    </button>
                                </div>

                                ${q.image_url ? `
                                    <div class="question-image" style="text-align:left">
                                        <img src="${resolveMediaUrl(q.image_local_path || q.image_url)}"
                                             alt="Q${q.order_index}" style="max-height:300px"
                                             onclick="openLightbox(this.src)" loading="lazy">
                                    </div>
                                ` : ''}

                                ${q.prompt_html && q.prompt_html !== '&nbsp;' ? `
                                    <div class="question-prompt">${q.prompt_html}</div>
                                ` : ''}

                                <div class="choices-list">
                                    ${q.choices.map(c => {
                let cls = '';
                if (c.is_correct) cls = 'correct';
                else if (a && a.selected_choice_key === c.choice_key && !a.is_correct) cls = 'incorrect';
                return `
                                            <div class="choice-item ${cls}">
                                                <div class="choice-key">${c.choice_key}</div>
                                                <div class="choice-text">${escapeHtml(c.content_html)}</div>
                                                ${c.is_correct ? '<span style="margin-left:auto;color:var(--correct);font-size:12px">✓</span>' : ''}
                                                ${a && a.selected_choice_key === c.choice_key && !a.is_correct ? '<span style="margin-left:auto;color:var(--incorrect);font-size:12px">✕ Bạn chọn</span>' : ''}
                                            </div>
                                        `;
            }).join('')}
                                </div>

                                ${q.explanation_html ? `
                                    <div>
                                        <button class="explanation-toggle" onclick="toggleExplanation(this)">
                                            📖 Xem giải thích
                                        </button>
                                        <div class="explanation-box hidden">
                                            ${q.explanation_html}
                                        </div>
                                    </div>
                                ` : ''}

                                <div class="note-editor">
                                    <textarea placeholder="Ghi chú của bạn cho câu này..."
                                        data-qid="${q.id}"
                                        onblur="saveReviewNote(${q.id}, this.value)">${q.note_content || ''}</textarea>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="page-enter empty-state"><p style="color:var(--incorrect)">Lỗi: ${err.message}</p><button class="btn btn-ghost" onclick="router.navigate('/')">← Về thư viện</button></div>`;
    }
}

function toggleExplanation(btn) {
    const box = btn.nextElementSibling;
    box.classList.toggle('hidden');
    btn.textContent = box.classList.contains('hidden') ? '📖 Xem giải thích' : '📖 Ẩn giải thích';
}

function filterReview(filter) {
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.filter === filter);
    });
    document.querySelectorAll('.review-question').forEach(q => {
        const status = q.dataset.status;
        const bm = q.dataset.bookmarked === 'true';
        let show = false;
        switch (filter) {
            case 'all': show = true; break;
            case 'correct': show = status === 'correct'; break;
            case 'incorrect': show = status === 'incorrect'; break;
            case 'unanswered': show = status === 'unanswered'; break;
            case 'bookmarked': show = bm; break;
        }
        q.style.display = show ? '' : 'none';
    });
}

async function toggleReviewBookmark(questionId, btn) {
    try {
        const result = await api.toggleBookmark(questionId);
        btn.classList.toggle('active', result.is_bookmarked);
        btn.textContent = result.is_bookmarked ? '★' : '☆';
        const card = btn.closest('.review-question');
        if (card) card.dataset.bookmarked = result.is_bookmarked;
    } catch (err) {
        showToast('Lỗi bookmark: ' + err.message, 'error');
    }
}

let noteDebounceTimers = {};
async function saveReviewNote(questionId, content) {
    clearTimeout(noteDebounceTimers[questionId]);
    noteDebounceTimers[questionId] = setTimeout(async () => {
        try {
            await api.saveNote(questionId, content);
        } catch { /* silently fail */ }
    }, 1000);
}
