/**
 * Flashcards Page — filter, manage, and review due flashcards.
 */

let flashcardsState = {
    allCards: [],
    cards: [],
    dueCards: [],
    studyIndex: 0,
    studyRevealed: false,
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

    await refreshFlashcardsData();
    setActivePageCleanup(() => {});
}

async function refreshFlashcardsData() {
    const filters = getFlashcardFiltersFromUI();
    flashcardsState.allCards = await api.listFlashcards();
    flashcardsState.cards = await api.listFlashcards(filters);
    flashcardsState.dueCards = await api.listDueFlashcards(50);
    flashcardsState.studyIndex = Math.min(flashcardsState.studyIndex, Math.max(flashcardsState.dueCards.length - 1, 0));
    flashcardsState.studyRevealed = false;
    renderFlashcardFilters();
    renderFlashcardStudyPanel();
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

function renderFlashcardFilters() {
    const deckOptions = uniqueSortedValues(flashcardsState.allCards.map((card) => card.deck_name));
    const tagOptions = uniqueSortedValues(flashcardsState.allCards.flatMap((card) => card.tags || []));
    const partOptions = uniqueSortedValues(
        flashcardsState.allCards
            .map((card) => card.part)
            .filter((part) => part !== null && part !== undefined)
            .map((part) => String(part)),
    );
    const filters = getFlashcardFiltersFromUI();

    document.getElementById('flashcard-filters-panel').innerHTML = `
        <div class="flashcard-panel-header">
            <h2>Bộ lọc</h2>
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
            Chỉ hiện flashcard đến hạn
        </label>
    `;
}

function renderFlashcardStudyPanel() {
    const panel = document.getElementById('flashcard-study-panel');
    const dueCount = flashcardsState.dueCards.length;
    const currentCard = flashcardsState.dueCards[flashcardsState.studyIndex] || null;

    if (!currentCard) {
        panel.innerHTML = `
            <div class="flashcard-panel-header">
                <h2>Ôn tập hôm nay</h2>
                <span class="flashcard-summary-pill">0 đến hạn</span>
            </div>
            <div class="empty-state" style="padding:12px 0">
                <div class="empty-state-icon">🎉</div>
                <p>Hiện chưa có flashcard nào đến hạn.</p>
            </div>
        `;
        return;
    }

    panel.innerHTML = `
        <div class="flashcard-panel-header">
            <h2>Ôn tập hôm nay</h2>
            <span class="flashcard-summary-pill">${dueCount} đến hạn</span>
        </div>
        <div class="study-progress">${flashcardsState.studyIndex + 1} / ${dueCount}</div>
        <div class="study-card ${flashcardsState.studyRevealed ? 'revealed' : ''}">
            <div class="study-card-label">Mặt trước</div>
            <div class="study-card-term">${escapeHtml(currentCard.term)}</div>
            ${flashcardsState.studyRevealed ? `
                <div class="study-card-back">
                    <div class="study-card-label">Mặt sau</div>
                    <p><strong>Meaning:</strong> ${escapeHtml(currentCard.meaning || 'Chưa có')}</p>
                    <p><strong>Example:</strong> ${escapeHtml(currentCard.example || 'Chưa có')}</p>
                    <p><strong>Nguồn:</strong> ${escapeHtml(buildFlashcardSourceText(currentCard))}</p>
                </div>
            ` : ''}
        </div>
        <div class="study-actions">
            ${flashcardsState.studyRevealed ? `
                <button class="btn btn-ghost btn-sm" onclick="rateCurrentFlashcard('again')">Again</button>
                <button class="btn btn-ghost btn-sm" onclick="rateCurrentFlashcard('hard')">Hard</button>
                <button class="btn btn-primary btn-sm" onclick="rateCurrentFlashcard('good')">Good</button>
                <button class="btn btn-primary btn-sm" onclick="rateCurrentFlashcard('easy')">Easy</button>
            ` : `
                <button class="btn btn-primary" onclick="revealCurrentStudyCard()">Lật thẻ</button>
            `}
        </div>
    `;
}

function renderFlashcardList() {
    const list = document.getElementById('flashcard-list');
    const summary = document.getElementById('flashcard-list-summary');
    summary.textContent = `${flashcardsState.cards.length} flashcard • ${flashcardsState.dueCards.length} đến hạn`;

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
    refreshFlashcardsData();
}

function openNewFlashcardModal() {
    openFlashcardModal({
        mode: 'create',
        title: 'Flashcard mới',
        sourceType: 'manual',
        onSaved: refreshFlashcardsData,
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
        await refreshFlashcardsData();
    } catch (err) {
        showToast(`Lỗi xoá flashcard: ${err.message}`, 'error');
    }
}

function revealCurrentStudyCard() {
    flashcardsState.studyRevealed = true;
    renderFlashcardStudyPanel();
}

async function rateCurrentFlashcard(result) {
    const currentCard = flashcardsState.dueCards[flashcardsState.studyIndex];
    if (!currentCard) return;

    try {
        await api.reviewFlashcard(currentCard.id, result);
        showToast(`Đã cập nhật: ${currentCard.term}`, 'success');
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
