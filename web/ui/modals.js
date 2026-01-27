// Modals UI module for Stash app
// Handles modal lifecycle (show/hide/reset) for all modals

import { appState, setPendingKindleImport } from '../lib/state.js';
import { getAIConfig } from '../lib/utils.js';

// ==================== Generic Modal Helpers ====================

/**
 * Show a modal by ID
 * @param {string} modalId - Modal element ID
 */
export function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

/**
 * Hide a modal by ID
 * @param {string} modalId - Modal element ID
 */
export function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

// ==================== Kindle Import Modal ====================

export function showKindleImportModal() {
  showModal('kindle-import-modal');
  resetKindleImportModal();
}

export function hideKindleImportModal() {
  hideModal('kindle-import-modal');
  resetKindleImportModal();
}

export function resetKindleImportModal() {
  setPendingKindleImport(null);

  const fileInput = document.getElementById('kindle-file-input');
  const preview = document.getElementById('kindle-import-preview');
  const footer = document.getElementById('kindle-import-footer');
  const dropzone = document.getElementById('kindle-dropzone');

  if (fileInput) fileInput.value = '';
  if (preview) preview.classList.add('hidden');
  if (footer) footer.classList.add('hidden');
  if (dropzone) dropzone.classList.remove('success', 'processing');
}

// ==================== Digest Modal ====================

export function showDigestModal() {
  showModal('digest-modal');
  // Note: loadDigestPreferences() should be called by the app after showing
}

export function hideDigestModal() {
  hideModal('digest-modal');
  const status = document.getElementById('digest-status');
  if (status) status.classList.add('hidden');
}

export function updateDigestOptionsState() {
  const enabled = document.getElementById('digest-enabled')?.checked;
  const options = document.getElementById('digest-options');
  const schedule = document.getElementById('digest-schedule-group');

  if (enabled) {
    options?.classList.remove('disabled');
    schedule?.classList.remove('disabled');
  } else {
    options?.classList.add('disabled');
    schedule?.classList.add('disabled');
  }
}

// ==================== AI Settings Modal ====================

export function showAISettingsModal() {
  showModal('ai-settings-modal');
  // Note: loadAISettings() should be called by the app after showing
}

export function hideAISettingsModal() {
  hideModal('ai-settings-modal');
  const status = document.getElementById('ai-settings-status');
  if (status) status.classList.add('hidden');
}

export function updateAIProviderFields() {
  const provider = document.getElementById('ai-provider')?.value || 'claude';
  const claudeGroup = document.getElementById('claude-config-group');
  const openaiGroup = document.getElementById('openai-config-group');

  if (provider === 'claude') {
    claudeGroup?.classList.remove('hidden');
    openaiGroup?.classList.add('hidden');
  } else {
    claudeGroup?.classList.add('hidden');
    openaiGroup?.classList.remove('hidden');
  }
}

// ==================== Book Modal ====================

export function showBookModal() {
  showModal('book-modal');
  resetBookModal();

  // Set default year to current year
  const yearInput = document.getElementById('book-year');
  if (yearInput) yearInput.value = new Date().getFullYear();
}

export function hideBookModal() {
  hideModal('book-modal');
  resetBookModal();
}

export function resetBookModal() {
  const fields = [
    'book-search',
    'book-title',
    'book-author',
    'book-year',
    'book-date',
    'book-notes',
    'book-google-id',
    'book-cover-url',
    'book-categories',
    'book-page-count',
    'book-published-date',
  ];

  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const elementsToHide = [
    'book-search-results',
    'book-selected-preview',
    'book-fetched-info',
    'book-status',
  ];

  elementsToHide.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const searchResults = document.getElementById('book-search-results');
  if (searchResults) searchResults.innerHTML = '';
}

// ==================== Podcast Modal ====================

// Store pending podcast file in module scope
let pendingPodcastFile = null;

export function showPodcastModal() {
  showModal('podcast-modal');
  resetPodcastModal();
  updatePrettifyHint();
}

export function hidePodcastModal() {
  hideModal('podcast-modal');
  resetPodcastModal();
}

export function resetPodcastModal() {
  const fields = [
    'podcast-show-name',
    'podcast-episode-title',
    'podcast-episode-date',
    'podcast-transcript',
  ];

  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const fileInput = document.getElementById('podcast-file-input');
  if (fileInput) fileInput.value = '';

  const fileName = document.getElementById('podcast-file-name');
  if (fileName) fileName.classList.add('hidden');

  const status = document.getElementById('podcast-status');
  if (status) status.classList.add('hidden');

  const prettify = document.getElementById('podcast-prettify');
  if (prettify) prettify.checked = true;

  const dropzone = document.getElementById('podcast-dropzone');
  if (dropzone) dropzone.classList.remove('success');

  pendingPodcastFile = null;

  // Reset tabs
  document
    .querySelectorAll('.podcast-tab')
    .forEach((t) => t.classList.remove('active'));
  document
    .querySelector('.podcast-tab[data-tab="paste"]')
    ?.classList.add('active');

  const pasteTab = document.getElementById('paste-tab');
  const uploadTab = document.getElementById('upload-tab');
  if (pasteTab) pasteTab.classList.remove('hidden');
  if (uploadTab) uploadTab.classList.add('hidden');
}

export function updatePrettifyHint() {
  const hint = document.getElementById('prettify-hint');
  if (!hint) return;

  const config = getAIConfig();
  if (config.hasKey) {
    hint.textContent = `Using ${config.provider === 'claude' ? 'Claude' : 'OpenAI'} for processing`;
    hint.style.color = 'var(--success)';
  } else {
    hint.textContent = 'Requires API key in AI Settings';
    hint.style.color = 'var(--text-muted)';
  }
}

export function setPendingPodcastFile(file) {
  pendingPodcastFile = file;
}

export function getPendingPodcastFile() {
  return pendingPodcastFile;
}

export function clearPendingPodcastFile() {
  pendingPodcastFile = null;
}

// ==================== Apple Podcasts Modal ====================

export function showApplePodcastsModal() {
  showModal('apple-podcasts-modal');
  resetApplePodcastsModal();
}

export function hideApplePodcastsModal() {
  hideModal('apple-podcasts-modal');
  resetApplePodcastsModal();
}

export function resetApplePodcastsModal() {
  // Reset to dropzone view
  const dropzoneContainer = document.getElementById(
    'apple-podcasts-dropzone-container'
  );
  const preview = document.getElementById('apple-podcasts-preview');
  const footer = document.getElementById('apple-podcasts-footer');
  const processing = document.getElementById('apple-podcasts-processing');
  const dropzone = document.getElementById('apple-podcasts-dropzone');
  const status = document.getElementById('apple-podcasts-status');
  const aiCheckbox = document.getElementById('apple-podcasts-ai-cleanup');

  if (dropzoneContainer) dropzoneContainer.classList.remove('hidden');
  if (preview) preview.classList.add('hidden');
  if (footer) footer.classList.add('hidden');
  if (processing) processing.classList.add('hidden');
  if (dropzone) dropzone.classList.remove('success', 'processing');
  if (status) status.classList.add('hidden');
  if (aiCheckbox) aiCheckbox.checked = false;

  // Clear list
  const list = document.getElementById('apple-podcasts-list');
  if (list) list.innerHTML = '';

  // Reset preview panel
  const transcriptView = document.getElementById(
    'apple-podcasts-transcript-view'
  );
  const placeholder = document.querySelector(
    '.apple-podcasts-preview-placeholder'
  );
  if (transcriptView) transcriptView.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');

  // Update AI hint
  updateApplePodcastsAIHint();
}

export function updateApplePodcastsAIHint() {
  const hint = document.getElementById('apple-podcasts-ai-hint');
  if (!hint) return;

  const config = getAIConfig();
  if (config.hasKey) {
    hint.textContent = `Using ${config.provider === 'claude' ? 'Claude' : 'OpenAI'}`;
    hint.style.color = 'var(--success)';
  } else {
    hint.textContent = 'Requires API key in AI Settings';
    hint.style.color = 'var(--text-muted)';
  }
}

// ==================== AI Jobs Modal ====================

export function showAIJobsModal() {
  showModal('ai-jobs-modal');
  // Note: renderAIJobsList() should be called by the app after showing
}

export function hideAIJobsModal() {
  hideModal('ai-jobs-modal');
}

// ==================== Bind Modal Close Events ====================

/**
 * Bind close events for all modals (overlay click, close button)
 * @param {Object} callbacks - Object with modal name as key and hide function as value
 */
export function bindModalCloseEvents(callbacks) {
  // Kindle modal
  bindModalClose('kindle-import-modal', callbacks.kindle || hideKindleImportModal);

  // Digest modal
  bindModalClose('digest-modal', callbacks.digest || hideDigestModal);

  // AI Settings modal
  bindModalClose('ai-settings-modal', callbacks.aiSettings || hideAISettingsModal);

  // Podcast modal
  bindModalClose('podcast-modal', callbacks.podcast || hidePodcastModal);

  // Book modal
  bindModalClose('book-modal', callbacks.book || hideBookModal);

  // Apple Podcasts modal
  bindModalClose('apple-podcasts-modal', callbacks.applePodcasts || hideApplePodcastsModal);

  // AI Jobs modal
  bindModalClose('ai-jobs-modal', callbacks.aiJobs || hideAIJobsModal);
}

function bindModalClose(modalId, hideCallback) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Overlay click
  const overlay = modal.querySelector('.modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', hideCallback);
  }

  // Close button
  const closeBtn = modal.querySelector('.modal-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideCallback);
  }
}
