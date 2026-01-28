// Reading Pane UI module for Stash app
// Handles the reading pane display and interactions

import { appState, setCurrentSave } from '../lib/state.js';
import { escapeHtml, renderMarkdown } from '../lib/utils.js';
import { stopAudio, initAudio } from '../services/audio.js';

// Track if AI enrichment is in progress
let enrichingInProgress = false;

// Track reading mode state
let readingModeActive = false;

/**
 * Open the reading pane with a save
 * @param {Object} save - The save object to display
 */
export function openReadingPane(save) {
  setCurrentSave(save);
  const pane = document.getElementById('reading-pane');

  // Stop any existing audio
  stopAudio();

  // Set title and meta
  const titleEl = document.getElementById('reading-title');
  const metaEl = document.getElementById('reading-meta');

  if (titleEl) titleEl.textContent = save.title || 'Untitled';
  if (metaEl) {
    metaEl.innerHTML = `
      ${save.site_name || ''} ${save.author ? `· ${save.author}` : ''} · ${new Date(save.created_at).toLocaleDateString()}
    `;
  }

  // Handle audio player visibility
  handleAudioVisibility(save);

  // Render content based on type
  const bodyEl = document.getElementById('reading-body');
  if (bodyEl) {
    if (save.highlight) {
      bodyEl.innerHTML = renderHighlightContent(save);
    } else if (save.content_type === 'podcast') {
      bodyEl.innerHTML = renderPodcastContent(save);
    } else if (save.content_type === 'book') {
      bodyEl.innerHTML = renderBookContent(save);
    } else {
      bodyEl.innerHTML = renderArticleContent(save);
    }
  }

  // Set original link
  const originalBtn = document.getElementById('open-original-btn');
  if (originalBtn) originalBtn.href = save.url || '#';

  // Update button states
  const archiveBtn = document.getElementById('archive-btn');
  const favoriteBtn = document.getElementById('favorite-btn');
  if (archiveBtn) archiveBtn.classList.toggle('active', save.is_archived);
  if (favoriteBtn) favoriteBtn.classList.toggle('active', save.is_favorite);

  // Load and display tags for this save
  loadSaveTags(save.id);

  // Show pane with animation
  if (pane) {
    pane.classList.remove('hidden');
    requestAnimationFrame(() => {
      pane.classList.add('open');
    });
  }
}

/**
 * Close the reading pane
 */
export function closeReadingPane() {
  const pane = document.getElementById('reading-pane');
  if (!pane) return;

  // Exit reading mode if active
  if (readingModeActive) {
    exitReadingMode();
  }

  pane.classList.remove('open');
  stopAudio();

  // Reset progress bar
  const progressFill = document.getElementById('reading-progress-fill');
  if (progressFill) progressFill.style.width = '0%';

  // Wait for animation before hiding
  setTimeout(() => {
    if (!pane.classList.contains('open')) {
      pane.classList.add('hidden');
    }
  }, 300);

  setCurrentSave(null);
}

/**
 * Update reading progress bar based on scroll position
 */
export function updateReadingProgress() {
  const readingContent = document.getElementById('reading-content');
  const progressFill = document.getElementById('reading-progress-fill');

  if (!readingContent || !progressFill) return;

  const scrollTop = readingContent.scrollTop;
  const scrollHeight = readingContent.scrollHeight - readingContent.clientHeight;

  if (scrollHeight > 0) {
    const progress = (scrollTop / scrollHeight) * 100;
    progressFill.style.width = `${Math.min(progress, 100)}%`;
  }
}

/**
 * Check if reading pane is open
 * @returns {boolean}
 */
export function isOpen() {
  const pane = document.getElementById('reading-pane');
  return pane && pane.classList.contains('open');
}

/**
 * Get current save being displayed
 * @returns {Object|null}
 */
export function getCurrentSave() {
  return appState.currentSave;
}

// ==================== Reading Mode ====================

/**
 * Toggle reading mode on/off
 */
export function toggleReadingMode() {
  if (readingModeActive) {
    exitReadingMode();
  } else {
    enterReadingMode();
  }
}

/**
 * Enter reading mode
 */
export function enterReadingMode() {
  const pane = document.getElementById('reading-pane');
  const controls = document.getElementById('reading-mode-controls');
  if (!pane) return;

  readingModeActive = true;
  pane.classList.add('reading-mode');

  // Show controls
  if (controls) {
    controls.classList.remove('hidden');
  }

  // Restore saved font size
  const savedSize = localStorage.getItem('stash-reading-font-size') || 'medium';
  setFontSize(savedSize);

  // Add escape key listener
  document.addEventListener('keydown', handleReadingModeEscape);
}

/**
 * Exit reading mode
 */
export function exitReadingMode() {
  const pane = document.getElementById('reading-pane');
  const controls = document.getElementById('reading-mode-controls');
  if (!pane) return;

  readingModeActive = false;
  pane.classList.remove('reading-mode');
  pane.removeAttribute('data-font-size');

  // Hide controls
  if (controls) {
    controls.classList.add('hidden');
  }

  // Remove escape key listener
  document.removeEventListener('keydown', handleReadingModeEscape);
}

/**
 * Set font size for reading mode
 * @param {string} size - 'small', 'medium', or 'large'
 */
export function setFontSize(size) {
  const pane = document.getElementById('reading-pane');
  if (!pane) return;

  // Validate size
  if (!['small', 'medium', 'large'].includes(size)) {
    size = 'medium';
  }

  // Set data attribute
  pane.setAttribute('data-font-size', size);

  // Update button states
  const buttons = document.querySelectorAll('.font-size-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });

  // Save preference
  localStorage.setItem('stash-reading-font-size', size);
}

/**
 * Check if reading mode is active
 * @returns {boolean}
 */
export function isReadingModeActive() {
  return readingModeActive;
}

/**
 * Initialize reading mode event listeners
 */
export function initReadingMode() {
  // Reading mode button
  const readingModeBtn = document.getElementById('reading-mode-btn');
  if (readingModeBtn) {
    readingModeBtn.addEventListener('click', toggleReadingMode);
  }

  // Close reading mode button
  const closeReadingModeBtn = document.getElementById('close-reading-mode-btn');
  if (closeReadingModeBtn) {
    closeReadingModeBtn.addEventListener('click', exitReadingMode);
  }

  // Font size buttons
  const fontSizeButtons = document.querySelectorAll('.font-size-btn');
  fontSizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setFontSize(btn.dataset.size);
    });
  });
}

/**
 * Handle escape key to exit reading mode
 */
function handleReadingModeEscape(e) {
  if (e.key === 'Escape' && readingModeActive) {
    exitReadingMode();
  }
}

// ==================== Private Helpers ====================

function handleAudioVisibility(save) {
  const audioPlayer = document.getElementById('audio-player');
  const audioGenerating = document.getElementById('audio-generating');

  if (!audioPlayer || !audioGenerating) return;

  // Check if audio generation is enabled in settings
  const audioEnabled = localStorage.getItem('stash-audio-enabled') === 'true';

  if (save.audio_url) {
    // Audio is ready - show player
    audioPlayer.classList.remove('hidden');
    audioGenerating.classList.add('hidden');
    initAudio(save.audio_url);
  } else if (save.content_type === 'podcast' || save.content_type === 'book') {
    // Podcasts and books don't need TTS audio
    audioPlayer.classList.add('hidden');
    audioGenerating.classList.add('hidden');
  } else if (audioEnabled && save.content && save.content.length > 100 && !save.highlight) {
    // Content exists but no audio yet - show generating indicator (only if audio enabled)
    audioPlayer.classList.add('hidden');
    audioGenerating.classList.remove('hidden');
  } else {
    // No audio applicable (highlights, short content, or audio disabled)
    audioPlayer.classList.add('hidden');
    audioGenerating.classList.add('hidden');
  }
}

function renderHighlightContent(save) {
  return `
    <blockquote style="font-style: italic; background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      "${escapeHtml(save.highlight)}"
    </blockquote>
    <p><a href="${save.url}" target="_blank" style="color: var(--primary);">View original →</a></p>
  `;
}

function renderPodcastContent(save) {
  const keyPoints = save.podcast_metadata?.key_points;
  const isProcessed = save.podcast_metadata?.processed;

  let html = '';

  // AI enrich button
  html += renderAIEnrichButton(isProcessed);

  // Key points
  if (keyPoints && keyPoints.length > 0) {
    html += `
      <div class="podcast-key-points" style="margin-bottom: 20px;">
        <h4>Key Points</h4>
        <ul>
          ${keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Transcript
  const content = save.content || save.excerpt || 'No content available.';
  html += renderMarkdown(content);

  return html;
}

function renderBookContent(save) {
  let html = '';
  let bookData = {};

  try {
    bookData = JSON.parse(save.content || '{}');
  } catch (e) {
    bookData = { description: save.content || save.excerpt || '' };
  }

  // AI enrich button
  const hasKeyPoints = save.ai_metadata?.key_points?.length > 0;
  html += renderAIEnrichButton(hasKeyPoints);

  // AI-generated key points
  if (save.ai_metadata?.key_points?.length > 0) {
    html += renderKeyPoints(save.ai_metadata.key_points);
  }

  // Book metadata
  const metadata = bookData.metadata || {};
  if (metadata.yearRead || metadata.pageCount || metadata.categories) {
    html += renderBookMetadata(metadata);
  }

  // User notes
  if (bookData.notes || metadata.userNotes) {
    const notes = bookData.notes || metadata.userNotes;
    html += `
      <div class="book-notes" style="margin-bottom: 24px; padding: 16px; background: rgba(99, 102, 241, 0.1); border-left: 3px solid var(--primary); border-radius: 0 var(--radius) var(--radius) 0;">
        <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: var(--primary);">Your Notes</h4>
        <p style="margin: 0; line-height: 1.6; color: var(--text);">${escapeHtml(notes)}</p>
      </div>
    `;
  }

  // Book description
  if (bookData.description) {
    html += `
      <div class="book-description">
        <h4 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--text);">About This Book</h4>
        <p style="margin: 0; line-height: 1.7; color: var(--text-secondary);">${escapeHtml(bookData.description)}</p>
      </div>
    `;
  }

  // Google Books link
  if (save.url) {
    html += `
      <p style="margin-top: 24px;"><a href="${save.url}" target="_blank" style="color: var(--primary);">View on Google Books →</a></p>
    `;
  }

  return html;
}

function renderArticleContent(save) {
  let html = '';

  // AI enrich button for articles with content
  if (save.content && save.content.length > 100) {
    const hasKeyPoints = save.ai_metadata?.key_points?.length > 0;
    html += renderAIEnrichButton(hasKeyPoints);

    // AI-generated key points
    if (save.ai_metadata?.key_points?.length > 0) {
      html += renderKeyPoints(save.ai_metadata.key_points);
    }
  }

  const content = save.content || save.excerpt || 'No content available.';
  html += renderMarkdown(content);

  return html;
}

function renderAIEnrichButton(hasExisting) {
  if (enrichingInProgress) {
    return `
      <button class="prettify-btn ai-enrich-btn" disabled>
        <div class="ai-enrich-spinner"></div>
        Enriching...
      </button>
    `;
  }
  return `
    <button class="prettify-btn ai-enrich-btn" onclick="app.aiEnrichContent()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      ${hasExisting ? 'Re-enrich with AI' : 'AI Enrich'}
    </button>
  `;
}

/**
 * Set the enriching in progress state and update the button
 * @param {boolean} inProgress - Whether enrichment is in progress
 */
export function setEnrichingInProgress(inProgress) {
  enrichingInProgress = inProgress;

  // Update the button in the reading pane
  const btn = document.querySelector('.ai-enrich-btn');
  if (btn) {
    if (inProgress) {
      btn.disabled = true;
      btn.innerHTML = `
        <div class="ai-enrich-spinner"></div>
        Enriching...
      `;
    } else {
      btn.disabled = false;
      const save = appState.currentSave;
      const hasExisting = save?.ai_metadata?.key_points?.length > 0;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        ${hasExisting ? 'Re-enrich with AI' : 'AI Enrich'}
      `;
    }
  }
}

/**
 * Load and display tags for a save in the reading pane
 * @param {string} saveId - The save ID
 */
async function loadSaveTags(saveId) {
  const container = document.getElementById('reading-tags-list');
  if (!container || !appState.supabase) return;

  try {
    const { data: saveTags, error } = await appState.supabase
      .from('save_tags')
      .select('tag_id, tags(id, name)')
      .eq('save_id', saveId);

    if (error) {
      console.error('Error loading save tags:', error);
      return;
    }

    if (!saveTags || saveTags.length === 0) {
      container.innerHTML = '<span class="no-tags">No tags</span>';
      return;
    }

    container.innerHTML = saveTags
      .map((st) => `<span class="tag" data-id="${st.tags.id}">${escapeHtml(st.tags.name)}</span>`)
      .join('');
  } catch (e) {
    console.error('Error loading save tags:', e);
  }
}

/**
 * Refresh tags display for the current save
 */
export function refreshSaveTags() {
  if (appState.currentSave) {
    loadSaveTags(appState.currentSave.id);
  }
}

function renderKeyPoints(points) {
  return `
    <div class="article-key-points" style="margin-bottom: 24px;">
      <h4 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--text);">Key Points</h4>
      <ul style="margin: 0; padding-left: 20px;">
        ${points.map((point) => `<li style="margin-bottom: 8px; line-height: 1.5;">${escapeHtml(point)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderBookMetadata(metadata) {
  return `
    <div class="book-metadata" style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; padding: 16px; background: var(--bg-secondary); border-radius: var(--radius);">
      ${
        metadata.yearRead
          ? `
        <div class="book-meta-item">
          <span style="font-size: 12px; color: var(--text-muted); display: block;">Year Read</span>
          <span style="font-size: 14px; font-weight: 600; color: var(--text);">${metadata.yearRead}</span>
        </div>
      `
          : ''
      }
      ${
        metadata.dateRead
          ? `
        <div class="book-meta-item">
          <span style="font-size: 12px; color: var(--text-muted); display: block;">Date Read</span>
          <span style="font-size: 14px; font-weight: 600; color: var(--text);">${new Date(metadata.dateRead).toLocaleDateString()}</span>
        </div>
      `
          : ''
      }
      ${
        metadata.pageCount
          ? `
        <div class="book-meta-item">
          <span style="font-size: 12px; color: var(--text-muted); display: block;">Pages</span>
          <span style="font-size: 14px; font-weight: 600; color: var(--text);">${metadata.pageCount}</span>
        </div>
      `
          : ''
      }
      ${
        metadata.categories
          ? `
        <div class="book-meta-item">
          <span style="font-size: 12px; color: var(--text-muted); display: block;">Category</span>
          <span style="font-size: 14px; font-weight: 600; color: var(--text);">${escapeHtml(metadata.categories)}</span>
        </div>
      `
          : ''
      }
      ${
        metadata.publishedDate
          ? `
        <div class="book-meta-item">
          <span style="font-size: 12px; color: var(--text-muted); display: block;">Published</span>
          <span style="font-size: 14px; font-weight: 600; color: var(--text);">${metadata.publishedDate.split('-')[0]}</span>
        </div>
      `
          : ''
      }
    </div>
  `;
}
