/**
 * API Client — wraps all backend API calls.
 */
const API_BASE = '/api';

const api = {
    /**
     * Import an exam from HTML + optional audio file.
     * @param {File} htmlFile
     * @param {File|null} audioFile
     * @param {string} tags
     * @returns {Promise<Object>}
     */
    async importExam(htmlFile = null, htmlContent = '', audioFile = null, tags = '') {
        const form = new FormData();
        if (htmlFile) form.append('html_file', htmlFile);
        form.append('html_content_pasted', htmlContent);
        if (audioFile) form.append('audio_file', audioFile);
        form.append('tags', tags);
        const res = await fetch(`${API_BASE}/imports/exams`, { method: 'POST', body: form });
        if (!res.ok) throw new Error((await res.json()).detail || 'Import failed');
        return res.json();
    },

    /** List all exams. */
    async listExams() {
        const res = await fetch(`${API_BASE}/exams`);
        return res.json();
    },

    /** Get full exam detail. */
    async getExam(examId) {
        const res = await fetch(`${API_BASE}/exams/${examId}`);
        if (!res.ok) throw new Error('Exam not found');
        return res.json();
    },

    /** Delete an exam. */
    async deleteExam(examId) {
        const res = await fetch(`${API_BASE}/exams/${examId}`, { method: 'DELETE' });
        return res.json();
    },

    /** Create a new attempt. */
    async createAttempt(examId) {
        const res = await fetch(`${API_BASE}/attempts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exam_id: examId }),
        });
        return res.json();
    },

    /** Get attempt detail. */
    async getAttempt(attemptId) {
        const res = await fetch(`${API_BASE}/attempts/${attemptId}`);
        return res.json();
    },

    /** Auto-save answers during an attempt. */
    async saveProgress(attemptId, answers, elapsedSeconds = 0) {
        const res = await fetch(`${API_BASE}/attempts/${attemptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers, elapsed_seconds: elapsedSeconds }),
        });
        return res.json();
    },

    /** Submit and grade an attempt. */
    async submitAttempt(attemptId, answers = [], elapsedSeconds = 0) {
        const res = await fetch(`${API_BASE}/attempts/${attemptId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers, elapsed_seconds: elapsedSeconds }),
        });
        return res.json();
    },

    /** Save a study note for a question. */
    async saveNote(questionId, content) {
        const res = await fetch(`${API_BASE}/questions/${questionId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        return res.json();
    },

    /** Toggle bookmark for a question. */
    async toggleBookmark(questionId) {
        const res = await fetch(`${API_BASE}/questions/${questionId}/bookmark`, {
            method: 'POST',
        });
        return res.json();
    },
};
