/**
 * App Entry Point — initialize router, global utilities, import form handling.
 */

// --- Router setup ---
router.on('/', renderLibraryPage);
router.on('/attempt/:id', renderAttemptPage);
router.on('/review/:id', renderReviewPage);
router.on('/review/:id/:attemptId', renderReviewPage);
router.start();

// --- Global Utilities ---

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

// Close lightbox on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLightbox();
        closeImportModal();
    }
});

// --- Import Form Handling ---

// File drop zones
['html-drop-zone', 'audio-drop-zone'].forEach(zoneId => {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const input = zone.querySelector('input[type="file"]');
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
    });

    const input = zone.querySelector('input[type="file"]');
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (file) {
            zone.querySelector('.drop-zone-content').classList.add('hidden');
            const fileDiv = zone.querySelector('.drop-zone-file');
            fileDiv.classList.remove('hidden');
            fileDiv.querySelector('.file-name').textContent = file.name;
        }
    });
});

function clearFile(type) {
    const zoneId = type === 'html' ? 'html-drop-zone' : 'audio-drop-zone';
    const zone = document.getElementById(zoneId);
    const input = zone.querySelector('input[type="file"]');
    input.value = '';
    zone.querySelector('.drop-zone-content').classList.remove('hidden');
    zone.querySelector('.drop-zone-file').classList.add('hidden');
}

// Import form submission
document.getElementById('import-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const htmlInput = document.getElementById('import-html');
    const audioInput = document.getElementById('import-audio');
    const tagsInput = document.getElementById('import-tags');
    const submitBtn = document.getElementById('import-submit-btn');

    if (!htmlInput.files[0]) {
        showToast('Vui lòng chọn file HTML', 'error');
        return;
    }

    // Show loading state
    submitBtn.querySelector('.btn-text').classList.add('hidden');
    submitBtn.querySelector('.btn-loading').classList.remove('hidden');
    submitBtn.disabled = true;

    try {
        const result = await api.importExam(
            htmlInput.files[0],
            audioInput.files[0] || null,
            tagsInput.value,
        );
        showToast(`Đã import: ${result.title} (${result.question_count} câu, ${result.images_downloaded} ảnh)`, 'success');
        closeImportModal();
        if (router.currentPage === '/') {
            loadExamList();
        }
    } catch (err) {
        showToast('Lỗi import: ' + err.message, 'error');
    } finally {
        submitBtn.querySelector('.btn-text').classList.remove('hidden');
        submitBtn.querySelector('.btn-loading').classList.add('hidden');
        submitBtn.disabled = false;
    }
});
