// Utility functions for Stash app
// Pure functions with no state dependencies

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render markdown text to HTML using marked library
 * Falls back to escaped plain text if marked isn't available
 * @param {string} text - Markdown text to render
 * @returns {string} HTML string
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // Configure marked for safe rendering
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true, // Convert \n to <br>
      gfm: true, // GitHub Flavored Markdown
    });

    try {
      return marked.parse(text);
    } catch (e) {
      console.error('Markdown parse error:', e);
      // Fallback to escaped plain text
      return `<div style="white-space: pre-wrap;">${escapeHtml(text)}</div>`;
    }
  }

  // Fallback if marked isn't loaded
  return `<div style="white-space: pre-wrap;">${escapeHtml(text)}</div>`;
}

/**
 * Format seconds as a time string (m:ss)
 * @param {number} seconds - Seconds to format
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get a human-readable relative time string
 * @param {Date} date - Date to format
 * @returns {string} Relative time string (e.g., "5m ago", "2d ago")
 */
export function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {'success'|'error'|'info'} type - Toast type
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, type = 'success', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon =
    type === 'success'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
      : type === 'error'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Get AI configuration from localStorage
 * @returns {{provider: string, apiKey: string, hasKey: boolean, model: string}}
 */
export function getAIConfig() {
  const provider = localStorage.getItem('stash-ai-provider') || 'claude';
  const claudeKey = localStorage.getItem('stash-claude-api-key') || '';
  const openaiKey = localStorage.getItem('stash-openai-api-key') || '';
  // Fall back to reasonable defaults if no model is selected
  const claudeModel =
    localStorage.getItem('stash-claude-model') || 'claude-sonnet-4-20250514';
  const openaiModel =
    localStorage.getItem('stash-openai-model') || 'gpt-4o-mini';

  const model = provider === 'claude' ? claudeModel : openaiModel;

  return {
    provider,
    apiKey: provider === 'claude' ? claudeKey : openaiKey,
    hasKey: provider === 'claude' ? !!claudeKey : !!openaiKey,
    model:
      model || (provider === 'claude' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini'),
  };
}
