/**
 * Flashcards Page — filter, manage, and study due flashcards with accessible 3D flip UX.
 */

let flashcardsState = {
    allCards: [],
    cards: [],
    dueCards: [],
    studyCards: [],
    studyIndex: 0,
    studyRevealed: false,
    focusStudyCardAfterRender: true,
};

async function renderFlashcardsPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="page-enter">
            <div class="library-header">
                <h1>🗂 Flashcards</h1>
                <button class="btn btn-primary" onclick="openNewFlashcardModal()">
                    + Flashcard mới
                </button>
            </div>
            <div class="flashcard-dashboard">
                <div class="flashcard-filters glass-card" id="flashcard-filters-panel"></div>
                <div class="flashcard-study glass-card" id="flashcard-study-panel"></div>
            </div>
            <div class="glass-card flashcard-list-panel">
                <div class="flashcard-list-header">
                    <div>
                        <h2>Danh sách flashcard</h2>
                        <p id="flashcard-list-summary">Đang tải...</p>
                    </div>
                </div>
                <div id="flashcard-list"></div>
            </div>
        </div>
    `;

    try {
        await refreshFlashcardsData();
    } catch (err) {
        content.innerHTML = `
            <div class="page-enter empty-state">
                <p style="color:var(--incorrect)">Lỗi flashcards: ${escapeHtml(err.message)}</p>
            </div>
        `;
    }

    setActivePageCleanup(() => {});
}

async function refreshFlashcardsData() {
    const filters = getFlashcardFiltersFromUI();
    const previousCardId = flashcardsState.studyCards[flashcardsState.studyIndex]?.id || null;
    const [allCards, cards, dueCards] = await Promise.all([
        api.listFlashcards(),
        api.listFlashcards(filters),
        api.listDueFlashcards(50),
    ]);

    flashcardsState.allCards = allCards;
    flashcardsState.cards = cards;
    flashcardsState.dueCards = dueCards;
    flashcardsState.studyCards = buildStudyQueue(dueCards, filters);
    syncStudyPosition(previousCardId);

    renderFlashcardFilters(filters);
    renderFlashcardStudyPanel(filters);
    renderFlashcardList();
}

function getFlashcardFiltersFromUI() {
    return {
        search: document.getElementById('flashcard-search')?.value.trim() || '',
        deck: document.getElementById('flashcard-deck-filter')?.value || '',
        tag: document.getElementById('flashcard-tag-filter')?.value || '',
        part: document.getElementById('flashcard-part-filter')?.value || '',
        due_only: document.getElementById('flashcard-due-only')?.checked || false,
    };
}

function buildStudyQueue(dueCards, filters) {
    return dueCards.filter((card) => matchesFlashcardFilters(card, filters));
}

function matchesFlashcardFilters(card, filters) {
    const search = (filters.search || '').toLowerCase();
    const deck = (filters.deck || '').toLowerCase();
    const tag = (filters.tag || '').toLowerCase();
    const part = filters.part ? String(filters.part) : '';
    const haystack = [card.term, card.meaning, card.example].join(' ').toLowerCase();
    const tags = (card.tags || []).map((item) => item.toLowerCase());

    if (search && !haystack.includes(search)) return false;
    if (deck && (card.deck_name || '').toLowerCase() !== deck) return false;
    if (tag && !tags.includes(tag)) return false;
    if (part && String(card.part || '') !== part) return false;
    return true;
}

function syncStudyPosition(previousCardId) {
    if (flashcardsState.studyCards.length === 0) {
        flashcardsState.studyIndex = 0;
        flashcardsState.studyRevealed = false;
        return;
    }

    if (previousCardId) {
        const nextIndex = flashcardsState.studyCards.findIndex((card) => card.id === previousCardId);
        if (nextIndex >= 0) {
            flashcardsState.studyIndex = nextIndex;
            return;
        }
    }

    flashcardsState.studyIndex = Math.min(
        flashcardsState.studyIndex,
        Math.max(flashcardsState.studyCards.length - 1, 0),
    );
    flashcardsState.studyRevealed = false;
}

function renderFlashcardFilters(filters = getFlashcardFiltersFromUI()) {
    const deckOptions = uniqueSortedValues(flashcardsState.allCards.map((card) => card.deck_name));
    const tagOptions = uniqueSortedValues(flashcardsState.allCards.flatMap((card) => card.tags || []));
    const partOptions = uniqueSortedValues(
        flashcardsState.allCards
            .map((card) => card.part)
            .filter((part) => part !== null && part !== undefined)
            .map((part) => String(part)),
    );

    document.getElementById('flashcard-filters-panel').innerHTML = `
        <div class="flashcard-panel-header">
            <h2>Bộ lọc học nhanh</h2>
            <button class="btn btn-ghost btn-sm" onclick="clearFlashcardFilters()">Xoá lọc</button>
        </div>
        <div class="flashcard-filter-grid">
            <input id="flashcard-search" class="form-input" placeholder="Tìm term, meaning, example"
                value="${escapeHtml(filters.search)}" oninput="refreshFlashcardsData()">
            <select id="flashcard-deck-filter" class="form-input" onchange="refreshFlashcardsData()">
                <option value="">Tất cả deck</option>
                ${deckOptions.map((deck) => `<option value="${escapeHtml(deck)}" ${filters.deck === deck ? 'selected' : ''}>${escapeHtml(deck)}</option>`).join('')}
            </select>
            <select id="flashcard-tag-filter" class="form-input" onchange="refreshFlashcardsData()">
                <option value="">Tất cả tag</option>
                ${tagOptions.map((tag) => `<option value="${escapeHtml(tag)}" ${filters.tag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
            </select>
            <select id="flashcard-part-filter" class="form-input" onchange="refreshFlashcardsData()">
                <option value="">Tất cả Part</option>
                ${partOptions.map((part) => `<option value="${part}" ${filters.part === part ? 'selected' : ''}>Part ${part}</option>`).join('')}
            </select>
        </div>
        <label class="flashcard-due-toggle">
            <input id="flashcard-due-only" type="checkbox" ${filters.due_only ? 'checked' : ''} onchange="refreshFlashcardsData()">
            Chỉ hiện flashcard đến hạn trong danh sách
        </label>
    `;
}

function renderFlashcardStudyPanel(filters) {
    const panel = document.getElementById('flashcard-study-panel');
    const dueCount = flashcardsState.studyCards.length;
    const currentCard = flashcardsState.studyCards[flashcardsState.studyIndex] || null;
    const progress = dueCount > 0 ? Math.round(((flashcardsState.studyIndex + 1) / dueCount) * 100) : 0;

    if (!currentCard) {
        panel.innerHTML = renderEmptyStudyPanel(filters);
        return;
    }

    panel.innerHTML = `
        <div class="flashcard-panel-header">
            <div>
                <h2>Ôn tập đến hạn</h2>
                <p class="flashcard-panel-subtitle">Queue học đang áp dụng deck/tag/part/search hiện tại.</p>
            </div>
            <span class="flashcard-summary-pill">${dueCount} thẻ</span>
        </div>
        <div class="study-progress-row">
            <span class="study-progress-text">Thẻ ${flashcardsState.studyIndex + 1} / ${dueCount}</span>
            <span class="study-progress-text">${progress}%</span>
        </div>
        <div class="study-progress-bar" aria-hidden="true">
            <span style="width:${progress}%"></span>
        </div>
        <button id="study-card-toggle" type="button"
            class="study-card-shell ${flashcardsState.studyRevealed ? 'revealed' : ''}"
            aria-pressed="${flashcardsState.studyRevealed}"
            aria-label="${flashcardsState.studyRevealed ? 'Lật về mặt trước flashcard' : 'Lật sang mặt sau flashcard'}"
            onclick="toggleStudyCardReveal()">
            <span class="study-card-scene">
                <span class="study-card-face study-card-front">
                    <span class="study-card-face-meta">Mặt trước</span>
                    <span class="study-card-term">${escapeHtml(currentCard.term)}</span>
                    <span class="study-card-hint">Click, Enter hoặc Space để lật thẻ</span>
                </span>
                <span class="study-card-face study-card-back">
                    <span class="study-card-face-meta">Mặt sau</span>
                    <span class="study-card-back-block">
                        <strong>Meaning</strong>
                        <span>${escapeHtml(currentCard.meaning || 'Chưa có')}</span>
                    </span>
                    <span class="study-card-back-block">
                        <strong>Example</strong>
                        <span>${escapeHtml(currentCard.example || 'Chưa có')}</span>
                    </span>
                    <span class="study-card-back-block">
                        <strong>Tags</strong>
                        <span>${renderCompactTags(currentCard.tags)}</span>
                    </span>
                    <span class="study-card-back-block">
                        <strong>Nguồn</strong>
                        <span>${escapeHtml(buildFlashcardSourceText(currentCard))}</span>
                    </span>
                </span>
            </span>
        </button>
        <div class="study-actions">
            <button class="btn btn-ghost btn-sm study-rating-btn" ${flashcardsState.studyRevealed ? '' : 'disabled'} onclick="rateCurrentFlashcard('again')">Again</button>
            <button class="btn btn-ghost btn-sm study-rating-btn" ${flashcardsState.studyRevealed ? '' : 'disabled'} onclick="rateCurrentFlashcard('hard')">Hard</button>
            <button class="btn btn-primary btn-sm study-rating-btn" ${flashcardsState.studyRevealed ? '' : 'disabled'} onclick="rateCurrentFlashcard('good')">Good</button>
            <button class="btn btn-primary btn-sm study-rating-btn" ${flashcardsState.studyRevealed ? '' : 'disabled'} onclick="rateCurrentFlashcard('easy')">Easy</button>
        </div>
    `;

    if (flashcardsState.focusStudyCardAfterRender) {
        flashcardsState.focusStudyCardAfterRender = false;
        requestAnimationFrame(() => {
            document.getElementById('study-card-toggle')?.focus();
        });
    }
}

function renderEmptyStudyPanel(filters) {
    const filterActive = Boolean(filters.search || filters.deck || filters.tag || filters.part);
    const message = filterActive
        ? 'Không có thẻ đến hạn phù hợp với bộ lọc hiện tại.'
        : 'Hiện chưa có flashcard nào đến hạn.';

    return `
        <div class="flashcard-panel-header">
            <div>
                <h2>Ôn tập đến hạn</h2>
                <p class="flashcard-panel-subtitle">Session học sẽ cập nhật theo bộ lọc hiện tại.</p>
            </div>
            <span class="flashcard-summary-pill">0 thẻ</span>
        </div>
        <div class="empty-state flashcard-empty-state">
            <div class="empty-state-icon">🎉</div>
            <p>${message}</p>
        </div>
    `;
}

function renderCompactTags(tags) {
    if (!tags || tags.length === 0) return 'Chưa gắn tag';
    return tags.map((tag) => `#${escapeHtml(tag)}`).join(' • ');
}

function renderFlashcardList() {
    const list = document.getElementById('flashcard-list');
    const summary = document.getElementById('flashcard-list-summary');
    summary.textContent = `${flashcardsState.cards.length} flashcard • ${flashcardsState.studyCards.length} thẻ đang khớp queue học`;

    if (flashcardsState.cards.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding:24px 0">
                <div class="empty-state-icon">📝</div>
                <p>Chưa có flashcard phù hợp với bộ lọc hiện tại.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = flashcardsState.cards.map((card) => `
        <div class="flashcard-row">
            <div class="flashcard-row-main">
                <div class="flashcard-row-header">
                    <h3>${escapeHtml(card.term)}</h3>
                    <span class="flashcard-summary-pill">${escapeHtml(card.deck_name)}</span>
                </div>
                <p><strong>Meaning:</strong> ${escapeHtml(card.meaning || 'Chưa có')}</p>
                <p><strong>Example:</strong> ${escapeHtml(card.example || 'Chưa có')}</p>
                <p><strong>Nguồn:</strong> ${escapeHtml(buildFlashcardSourceText(card))}</p>
                <div class="flashcard-meta-tags">
                    ${(card.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
                <p class="flashcard-next-review">Ôn tiếp: ${formatFlashcardDate(card.next_review_at)}</p>
            </div>
            <div class="flashcard-row-actions">
                <button class="btn btn-ghost btn-sm" onclick="editFlashcard(${card.id})">Sửa</button>
                <button class="btn btn-ghost btn-sm" onclick="deleteFlashcardCard(${card.id})" style="color:var(--incorrect)">Xoá</button>
            </div>
        </div>
    `).join('');
}

function uniqueSortedValues(items) {
    return [...new Set(items.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function clearFlashcardFilters() {
    const search = document.getElementById('flashcard-search');
    const deck = document.getElementById('flashcard-deck-filter');
    const tag = document.getElementById('flashcard-tag-filter');
    const part = document.getElementById('flashcard-part-filter');
    const dueOnly = document.getElementById('flashcard-due-only');
    if (search) search.value = '';
    if (deck) deck.value = '';
    if (tag) tag.value = '';
    if (part) part.value = '';
    if (dueOnly) dueOnly.checked = false;
    flashcardsState.focusStudyCardAfterRender = true;
    refreshFlashcardsData();
}

function openNewFlashcardModal() {
    openFlashcardModal({
        mode: 'create',
        title: 'Flashcard mới',
        sourceType: 'manual',
        onSaved: async () => {
            flashcardsState.focusStudyCardAfterRender = true;
            await refreshFlashcardsData();
        },
    });
}

function editFlashcard(flashcardId) {
    const card = flashcardsState.allCards.find((item) => item.id === flashcardId);
    if (!card) return;
    openFlashcardModal({
        mode: 'update',
        flashcardId,
        title: 'Chỉnh sửa flashcard',
        submitLabel: 'Lưu thay đổi',
        term: card.term,
        meaning: card.meaning,
        example: card.example,
        deckName: card.deck_name,
        tags: card.tags,
        onSaved: refreshFlashcardsData,
    });
}

async function deleteFlashcardCard(flashcardId) {
    if (!confirm('Bạn có chắc muốn xoá flashcard này?')) return;
    try {
        await api.deleteFlashcard(flashcardId);
        showToast('Đã xoá flashcard', 'success');
        flashcardsState.focusStudyCardAfterRender = true;
        await refreshFlashcardsData();
    } catch (err) {
        showToast(`Lỗi xoá flashcard: ${err.message}`, 'error');
    }
}

function toggleStudyCardReveal() {
    if (flashcardsState.studyCards.length === 0) return;
    flashcardsState.studyRevealed = !flashcardsState.studyRevealed;
    flashcardsState.focusStudyCardAfterRender = true;
    renderFlashcardStudyPanel(getFlashcardFiltersFromUI());
}

async function rateCurrentFlashcard(result) {
    const currentCard = flashcardsState.studyCards[flashcardsState.studyIndex];
    if (!currentCard || !flashcardsState.studyRevealed) return;

    try {
        await api.reviewFlashcard(currentCard.id, result);
        showToast(`Đã cập nhật: ${currentCard.term}`, 'success');
        flashcardsState.studyRevealed = false;
        flashcardsState.focusStudyCardAfterRender = true;
        await refreshFlashcardsData();
    } catch (err) {
        showToast(`Lỗi review flashcard: ${err.message}`, 'error');
    }
}

function buildFlashcardSourceText(card) {
    const parts = [card.source_type || card.sourceType || 'manual'];
    if (card.part) parts.push(`Part ${card.part}`);
    if (card.question_id) parts.push(`Q${card.question_id}`);
    return parts.join(' • ');
}

function formatFlashcardDate(value) {
    return new Date(value).toLocaleString('vi-VN');
}
