/**
 * App Entry Point — router setup, global utilities, shared shortcuts, and modal handling.
 */

let activePageCleanup = null;
let activeAudioShortcutCleanup = null;
let flashcardModalState = buildDefaultFlashcardModalState();

function buildDefaultFlashcardModalState() {
    return {
        mode: 'create',
        flashcardId: null,
        sourceType: 'manual',
        examId: null,
        questionId: null,
        part: null,
        contextHtml: '',
        onSaved: null,
    };
}

function setActivePageCleanup(cleanup) {
    activePageCleanup = typeof cleanup === 'function' ? cleanup : null;
}

function clearActivePageBindings() {
    if (typeof activePageCleanup === 'function') {
        activePageCleanup();
    }
    activePageCleanup = null;
    cleanupGlobalAudioShortcuts();
}

window.clearActivePageBindings = clearActivePageBindings;

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function resolveMediaUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return path.startsWith('/') ? path : `/${path}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function openLightbox(src) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-img').src = src;
    lb.classList.remove('hidden');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
}

function closeImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
    document.getElementById('import-form').reset();
    clearFile('html');
    clearFile('audio');
    document.getElementById('import-html-pasted').value = '';
    switchImportTab('file');
}

function switchImportTab(tab) {
    const fileZone = document.getElementById('html-drop-zone');
    const pasteZone = document.getElementById('html-paste-zone');
    const tabs = document.querySelectorAll('.import-tab');

    tabs.forEach((item) => item.classList.toggle('active', item.dataset.tab === tab));
    fileZone.classList.toggle('hidden', tab !== 'file');
    pasteZone.classList.toggle('hidden', tab === 'file');
}

function clearFile(type) {
    const zoneId = type === 'html' ? 'html-drop-zone' : 'audio-drop-zone';
    const zone = document.getElementById(zoneId);
    const input = zone.querySelector('input[type="file"]');
    input.value = '';
    zone.querySelector('.drop-zone-content').classList.remove('hidden');
    zone.querySelector('.drop-zone-file').classList.add('hidden');
}

function parseTagInput(value) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function isEditableTarget(target) {
    if (!target) return false;
    const tagName = target.tagName ? target.tagName.toUpperCase() : '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return true;
    if (target.isContentEditable) return true;
    return Boolean(target.closest && target.closest('[contenteditable="true"]'));
}

function cleanupGlobalAudioShortcuts() {
    if (typeof activeAudioShortcutCleanup === 'function') {
        activeAudioShortcutCleanup();
    }
    activeAudioShortcutCleanup = null;
}

function toggleAudioPlayback(audio) {
    if (!audio) return;
    if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
        return;
    }
    audio.pause();
}

function seekAudioBy(audio, deltaSeconds) {
    if (!audio || Number.isNaN(audio.duration)) return;
    const nextTime = Math.min(
        Math.max(audio.currentTime + deltaSeconds, 0),
        Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + deltaSeconds,
    );
    audio.currentTime = nextTime;
}

function registerGlobalAudioShortcuts(options = {}) {
    cleanupGlobalAudioShortcuts();

    const handler = (event) => {
        if (isEditableTarget(event.target)) return;

        const audio = typeof options.getAudio === 'function' ? options.getAudio() : null;
        const hasAudio = Boolean(audio);

        if (hasAudio && (event.code === 'Space' || event.key === ' ')) {
            event.preventDefault();
            toggleAudioPlayback(audio);
            return;
        }

        if (hasAudio && !event.altKey && event.key === 'ArrowLeft') {
            event.preventDefault();
            seekAudioBy(audio, -5);
            return;
        }

        if (hasAudio && !event.altKey && event.key === 'ArrowRight') {
            event.preventDefault();
            seekAudioBy(audio, 5);
            return;
        }

        if (typeof options.onPrevQuestion === 'function' && event.key === 'ArrowLeft') {
            if (!hasAudio || event.altKey) {
                event.preventDefault();
                options.onPrevQuestion();
                return;
            }
        }

        if (typeof options.onNextQuestion === 'function' && event.key === 'ArrowRight') {
            if (!hasAudio || event.altKey) {
                event.preventDefault();
                options.onNextQuestion();
                return;
            }
        }

        if (typeof options.onUnhandled === 'function') {
            options.onUnhandled(event, { hasAudio });
        }
    };

    document.addEventListener('keydown', handler);
    activeAudioShortcutCleanup = () => {
        document.removeEventListener('keydown', handler);
    };
    return activeAudioShortcutCleanup;
}

function openFlashcardModal(config = {}) {
    const modal = document.getElementById('flashcard-modal');
    const title = document.getElementById('flashcard-modal-title');
    const submitText = document.getElementById('flashcard-submit-text');
    const meta = document.getElementById('flashcard-modal-meta');
    const termInput = document.getElementById('flashcard-term');
    const meaningInput = document.getElementById('flashcard-meaning');
    const exampleInput = document.getElementById('flashcard-example');
    const deckInput = document.getElementById('flashcard-deck');
    const tagsInput = document.getElementById('flashcard-tags');

    flashcardModalState = {
        ...buildDefaultFlashcardModalState(),
        ...config,
    };

    title.textContent = config.title || 'Thêm flashcard';
    submitText.textContent = config.submitLabel || (config.mode === 'update' ? 'Lưu thay đổi' : 'Lưu flashcard');
    meta.textContent = config.meta || buildFlashcardMetaText(config);

    termInput.value = config.term || '';
    meaningInput.value = config.meaning || '';
    exampleInput.value = config.example || '';
    deckInput.value = config.deckName || 'Default';
    tagsInput.value = Array.isArray(config.tags) ? config.tags.join(', ') : (config.tags || '');

    modal.classList.remove('hidden');
    termInput.focus();
    termInput.select();
}

function buildFlashcardMetaText(config) {
    const bits = [];
    if (config.sourceType) bits.push(`Nguồn: ${config.sourceType}`);
    if (config.part) bits.push(`Part ${config.part}`);
    if (config.questionId) bits.push(`Q${config.questionId}`);
    return bits.join(' • ');
}

function closeFlashcardModal() {
    document.getElementById('flashcard-modal').classList.add('hidden');
    document.getElementById('flashcard-form').reset();
    flashcardModalState = buildDefaultFlashcardModalState();
}

async function handleFlashcardFormSubmit(event) {
    event.preventDefault();

    const submitButton = document.getElementById('flashcard-submit-btn');
    submitButton.disabled = true;

    try {
        const payload = buildFlashcardPayloadFromForm();
        let flashcard = null;
        const onSaved = flashcardModalState.onSaved;

        if (flashcardModalState.mode === 'update') {
            flashcard = await api.updateFlashcard(flashcardModalState.flashcardId, payload);
        } else if (flashcardModalState.mode === 'selection') {
            flashcard = await api.createFlashcardFromSelection({
                selected_text: payload.term,
                context_html: flashcardModalState.contextHtml || '',
                source_type: flashcardModalState.sourceType || 'manual',
                exam_id: flashcardModalState.examId,
                question_id: flashcardModalState.questionId,
                part: flashcardModalState.part,
                deck_name: payload.deck_name,
                tags: payload.tags,
                meaning: payload.meaning,
                example: payload.example,
            });
        } else {
            flashcard = await api.createFlashcard({
                ...payload,
                source_type: flashcardModalState.sourceType || 'manual',
                exam_id: flashcardModalState.examId,
                question_id: flashcardModalState.questionId,
                part: flashcardModalState.part,
            });
        }

        closeFlashcardModal();
        showToast(`Đã lưu flashcard: ${flashcard.term}`, 'success');
        if (typeof onSaved === 'function') {
            await onSaved(flashcard);
        }
    } catch (err) {
        showToast(`Lỗi flashcard: ${err.message}`, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

function buildFlashcardPayloadFromForm() {
    return {
        term: document.getElementById('flashcard-term').value.trim(),
        meaning: document.getElementById('flashcard-meaning').value.trim(),
        example: document.getElementById('flashcard-example').value.trim(),
        deck_name: document.getElementById('flashcard-deck').value.trim() || 'Default',
        tags: parseTagInput(document.getElementById('flashcard-tags').value),
    };
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeLightbox();
    closeImportModal();
    closeFlashcardModal();
});

['html-drop-zone', 'audio-drop-zone'].forEach((zoneId) => {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.classList.remove('drag-over');
        const input = zone.querySelector('input[type="file"]');
        input.files = event.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
    });

    const input = zone.querySelector('input[type="file"]');
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        zone.querySelector('.drop-zone-content').classList.add('hidden');
        const fileDisplay = zone.querySelector('.drop-zone-file');
        fileDisplay.classList.remove('hidden');
        fileDisplay.querySelector('.file-name').textContent = file.name;
    });
});

document.getElementById('import-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const htmlInput = document.getElementById('import-html');
    const audioInput = document.getElementById('import-audio');
    const tagsInput = document.getElementById('import-tags');
    const submitBtn = document.getElementById('import-submit-btn');

    submitBtn.querySelector('.btn-text').classList.add('hidden');
    submitBtn.querySelector('.btn-loading').classList.remove('hidden');
    submitBtn.disabled = true;

    try {
        const htmlFile = htmlInput.files[0];
        const htmlContent = document.getElementById('import-html-pasted').value;

        if (!htmlFile && !htmlContent.trim()) {
            showToast('Vui lòng chọn file HTML hoặc dán nội dung', 'error');
            return;
        }

        const result = await api.importExam(
            htmlFile || null,
            htmlContent,
            audioInput.files[0] || null,
            tagsInput.value,
        );
        showToast(`Đã import: ${result.title} (${result.question_count} câu, ${result.images_downloaded} ảnh)`, 'success');
        closeImportModal();
        if (router.currentPage === '/') {
            loadExamList();
        }
    } catch (err) {
        showToast(`Lỗi import: ${err.message}`, 'error');
    } finally {
        submitBtn.querySelector('.btn-text').classList.remove('hidden');
        submitBtn.querySelector('.btn-loading').classList.add('hidden');
        submitBtn.disabled = false;
    }
});

document.getElementById('flashcard-form').addEventListener('submit', handleFlashcardFormSubmit);

router.on('/', renderLibraryPage);
router.on('/attempt/:id', renderAttemptPage);
router.on('/review/:id', renderReviewPage);
router.on('/review/:id/:attemptId', renderReviewPage);
router.on('/flashcards', renderFlashcardsPage);
router.start();
