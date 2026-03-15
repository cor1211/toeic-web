/**
 * Library Page — Exam listing and import functionality.
 */
function renderLibraryPage() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
        <div class="page-enter">
            <div class="library-header">
                <h1>📚 Thư viện đề thi</h1>
                <button class="btn btn-primary" onclick="openImportModal()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Import đề thi
                </button>
            </div>
            <div id="exam-list" class="exam-grid">
                <div class="empty-state">
                    <div class="spinner" style="width:32px;height:32px;border-width:3px"></div>
                    <p style="margin-top:16px">Đang tải...</p>
                </div>
            </div>
        </div>
    `;
    loadExamList();
}

async function loadExamList() {
    const container = document.getElementById('exam-list');
    try {
        const exams = await api.listExams();
        if (exams.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1">
                    <div class="empty-state-icon">📝</div>
                    <h3>Chưa có đề thi nào</h3>
                    <p>Import đề thi đầu tiên từ file HTML bài thi NN24H để bắt đầu luyện tập.</p>
                    <button class="btn btn-primary" onclick="openImportModal()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Import đề thi
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = exams.map(exam => `
            <div class="exam-card glass-card" onclick="router.navigate('/attempt/${exam.id}')">
                <div class="exam-card-title">${escapeHtml(exam.title)}</div>
                <div class="exam-card-meta">
                    <span class="exam-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        ${exam.question_count} câu
                    </span>
                    <span class="exam-meta-item">
                        ${exam.has_audio ? '🔊 Có audio' : '🔇 Chưa có audio'}
                    </span>
                    <span class="exam-meta-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        ${new Date(exam.created_at).toLocaleDateString('vi-VN')}
                    </span>
                </div>
                ${exam.tags ? `
                    <div class="exam-card-tags">
                        ${exam.tags.split(',').map(t => `<span class="tag">${escapeHtml(t.trim())}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="exam-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); router.navigate('/attempt/${exam.id}')">
                        ▶ Làm bài
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); router.navigate('/review/${exam.id}')">
                        📊 Xem đề
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deleteExam(${exam.id})" style="margin-left:auto; color: var(--incorrect)">
                        🗑
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p style="color:var(--incorrect)">Lỗi: ${err.message}</p></div>`;
    }
}

async function deleteExam(examId) {
    if (!confirm('Bạn có chắc muốn xóa đề thi này?')) return;
    try {
        await api.deleteExam(examId);
        showToast('Đã xóa đề thi', 'success');
        loadExamList();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

function openImportModal() {
    document.getElementById('import-modal').classList.remove('hidden');
}
function closeImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
    document.getElementById('import-form').reset();
    // Reset drop zone visuals
    document.querySelectorAll('.drop-zone-file').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.drop-zone-content').forEach(el => el.classList.remove('hidden'));
}
