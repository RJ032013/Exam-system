// Main JavaScript file for Exam System

document.addEventListener('DOMContentLoaded', function() {
    // Auto-hide alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 150);
        }, 5000);
    });

    // Confirm form submissions
    const confirmForms = document.querySelectorAll('[data-confirm]');
    confirmForms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!confirm(this.dataset.confirm)) {
                e.preventDefault();
            }
        });
    });

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Autosave grading on admin report detail
    (function() {
        const answerBlocks = document.querySelectorAll('[data-answer-block]');
        if (!answerBlocks.length) return;
        const totalScoreEl = document.getElementById('submission-total-score');
        const submissionId = totalScoreEl ? totalScoreEl.getAttribute('data-submission-id') : null;
        if (!submissionId) return;

        function updateCorrectBadge(block, isCorrect) {
            const badge = block.querySelector('[data-answer-correct]');
            if (!badge) return;
            badge.textContent = isCorrect ? 'Correct' : 'Wrong';
            badge.classList.toggle('bg-success', !!isCorrect);
            badge.classList.toggle('bg-danger', !isCorrect);
        }

        function debounce(fn, ms) {
            let t;
            return function(...args) {
                clearTimeout(t);
                t = setTimeout(() => fn.apply(this, args), ms);
            };
        }

        async function sendUpdate(index, payload, block) {
            try {
                const res = await fetch(`/admin/exam-reports/${submissionId}/answers/${index}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data && data.ok) {
                    if (typeof data.score === 'number' && totalScoreEl) {
                        totalScoreEl.textContent = data.score;
                    }
                    if ('isCorrect' in data) updateCorrectBadge(block, data.isCorrect);
                } else {
                    // no-op UI
                }
            } catch (e) {
                // no-op UI
            }
        }

        answerBlocks.forEach(block => {
            const idx = block.getAttribute('data-answer-index');
            const scoreInput = block.querySelector('[data-autosave-score]');

            if (scoreInput) {
                const debounced = debounce(() => {
                    const val = scoreInput.value;
                    if (val === '' || val === null) return;
                    sendUpdate(idx, { manualScore: val }, block);
                }, 400);
                scoreInput.addEventListener('input', debounced);
                scoreInput.addEventListener('change', () => sendUpdate(idx, { manualScore: scoreInput.value }, block));
            }
        });
    })();
});

// Utility functions
function showLoading(element) {
    element.disabled = true;
    element.innerHTML = '<span class="loading"></span> Loading...';
}

function hideLoading(element, originalText) {
    element.disabled = false;
    element.innerHTML = originalText;
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}