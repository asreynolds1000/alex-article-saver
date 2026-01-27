// Rendering utilities for Stash app
// Pure HTML generation functions without event binding

import { escapeHtml } from '../lib/utils.js';

/**
 * Render a save card HTML
 * @param {Object} save - Save object
 * @returns {string} HTML string
 */
export function renderSaveCard(save) {
  const isHighlight = !!save.highlight;
  const date = new Date(save.created_at).toLocaleDateString();

  if (isHighlight) {
    return `
      <div class="save-card highlight" data-id="${save.id}">
        <div class="save-card-content">
          <div class="save-card-site">${escapeHtml(save.site_name || '')}</div>
          <div class="save-card-highlight">"${escapeHtml(save.highlight)}"</div>
          <div class="save-card-title">${escapeHtml(save.title || 'Untitled')}</div>
          <div class="save-card-meta">
            <span class="save-card-date">${date}</span>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="save-card" data-id="${save.id}">
      ${save.image_url ? `<img class="save-card-image" src="${save.image_url}" alt="" onerror="this.style.display='none'">` : ''}
      <div class="save-card-content">
        <div class="save-card-site">${escapeHtml(save.site_name || '')}</div>
        <div class="save-card-title">${escapeHtml(save.title || 'Untitled')}</div>
        <div class="save-card-excerpt">${escapeHtml(save.excerpt || '')}</div>
        <div class="save-card-meta">
          <span class="save-card-date">${date}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a book card HTML
 * @param {Object} book - Book save object
 * @returns {string} HTML string
 */
export function renderBookCard(book) {
  const author = book.author || book.site_name || 'Unknown Author';
  let yearRead = '';
  try {
    const content = JSON.parse(book.content);
    yearRead = content.metadata?.yearRead || '';
  } catch (e) {
    // Ignore parsing errors
  }

  return `
    <div class="book-card" data-id="${book.id}">
      ${
        book.image_url
          ? `<img class="book-card-cover" src="${book.image_url}" alt="${escapeHtml(book.title)}">`
          : `<div class="book-card-cover-placeholder">📚</div>`
      }
      <div class="book-card-content">
        <div class="book-card-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</div>
        <div class="book-card-author">${escapeHtml(author)}</div>
        ${yearRead ? `<span class="book-card-year">${yearRead}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render a breakdown bar for insights
 * @param {string} label - Bar label
 * @param {number} count - Item count
 * @param {number} total - Total items
 * @param {string} type - CSS class for styling
 * @returns {string} HTML string
 */
export function renderBreakdownBar(label, count, total, type) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <div class="breakdown-item">
      <span class="breakdown-label">${label}</span>
      <div class="breakdown-bar-container">
        <div class="breakdown-bar ${type}" style="width: ${percentage}%"></div>
      </div>
      <span class="breakdown-value">${count}</span>
    </div>
  `;
}

/**
 * Render activity timeline for last 12 weeks
 * @param {Array} saves - Array of save objects
 * @returns {string} HTML string
 */
export function renderTimeline(saves) {
  // Group saves by week for the last 12 weeks
  const weeks = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now - (i * 7 + 7) * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
    const count = saves.filter((s) => {
      const date = new Date(s.created_at);
      return date >= weekStart && date < weekEnd;
    }).length;
    weeks.push(count);
  }

  const maxCount = Math.max(...weeks, 1);

  return weeks
    .map((count) => {
      const height = Math.max(4, (count / maxCount) * 100);
      return `<div class="timeline-bar" style="height: ${height}%" title="${count} items"></div>`;
    })
    .join('');
}

/**
 * Get the date range string for the current week
 * @returns {string} Formatted date range
 */
export function getWeekDateRange() {
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const options = { month: 'short', day: 'numeric' };
  return `${weekAgo.toLocaleDateString('en-US', options)} - ${now.toLocaleDateString('en-US', options)}`;
}

/**
 * Calculate insight statistics from saves
 * @param {Array} saves - Array of save objects
 * @returns {Object} Statistics object
 */
export function calculateInsightStats(saves) {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  return {
    totalItems: saves.length,
    thisWeek: saves.filter((s) => new Date(s.created_at) >= weekAgo).length,
    thisMonth: saves.filter((s) => new Date(s.created_at) >= monthAgo).length,
    articles: saves.filter(
      (s) =>
        !s.highlight && s.content_type !== 'podcast' && s.content_type !== 'book'
    ).length,
    books: saves.filter((s) => s.content_type === 'book').length,
    podcasts: saves.filter((s) => s.content_type === 'podcast').length,
    highlights: saves.filter((s) => !!s.highlight).length,
  };
}

/**
 * Extract common topics from saves
 * @param {Array} saves - Array of save objects
 * @returns {string} HTML string with topic tags
 */
export function extractTopics(saves) {
  // Stop words to exclude
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
    'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'any', 's', 't', 'don', 'now', 'your', 'new', 'one', 'first', 'get',
    'like', 'make', 'know', 'back', 'time', 'year', 'good', 'also', 'people',
    'way', 'think', 'see', 'come', 'want', 'look', 'use', 'find', 'give',
    'tell', 'work', 'life', 'day', 'even', 'still', 'say',
  ]);

  const wordCounts = {};

  saves.forEach((save) => {
    const text = `${save.title || ''} ${save.excerpt || ''}`.toLowerCase();
    const words = text.match(/\b[a-z]{4,}\b/g) || [];

    words.forEach((word) => {
      if (!stopWords.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
  });

  // Get top 15 words
  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (topWords.length === 0) {
    return '<p style="color: var(--text-muted); text-align: center;">Add more content to see topic patterns</p>';
  }

  const maxCount = topWords[0][1];

  return topWords
    .map(([word, count]) => {
      const size =
        count === maxCount ? 'large' : count >= maxCount * 0.5 ? 'medium' : '';
      return `<span class="word-cloud-item ${size}">${word}</span>`;
    })
    .join('');
}

/**
 * Render a tag element
 * @param {Object} tag - Tag object with id and name
 * @returns {string} HTML string
 */
export function renderTag(tag) {
  return `<span class="tag" data-id="${tag.id}">${escapeHtml(tag.name)}</span>`;
}

/**
 * Render tags list HTML
 * @param {Array} tags - Array of tag objects
 * @returns {string} HTML string
 */
export function renderTagsList(tags) {
  return tags.map((tag) => renderTag(tag)).join('');
}

/**
 * Render a folder element
 * @param {Object} folder - Folder object with id, name, color
 * @returns {string} HTML string
 */
export function renderFolder(folder) {
  return `
    <a href="#" class="nav-item" data-folder="${folder.id}">
      <span style="color: ${folder.color}">📁</span>
      ${escapeHtml(folder.name)}
    </a>
  `;
}

/**
 * Render folders list HTML
 * @param {Array} folders - Array of folder objects
 * @returns {string} HTML string
 */
export function renderFoldersList(folders) {
  return folders.map((folder) => renderFolder(folder)).join('');
}

/**
 * Render a Kindle book card
 * @param {Object} book - Book object with title, author, highlights
 * @returns {string} HTML string
 */
export function renderKindleBookCard(book) {
  return `
    <div class="kindle-book-card" data-title="${escapeHtml(book.title || '')}">
      <div class="kindle-book-header">
        <div class="kindle-book-icon">📖</div>
        <div class="kindle-book-info">
          <h3 class="kindle-book-title">${escapeHtml(book.title || 'Unknown Book')}</h3>
          ${book.author ? `<p class="kindle-book-author">${escapeHtml(book.author)}</p>` : ''}
        </div>
        <span class="kindle-book-count">${book.highlights.length}</span>
      </div>
      <div class="kindle-highlights-preview">
        ${book.highlights
          .slice(0, 3)
          .map(
            (h) => `
          <div class="kindle-highlight-snippet" data-id="${h.id}">
            "${escapeHtml(h.highlight?.substring(0, 150) || '')}${h.highlight?.length > 150 ? '...' : ''}"
          </div>
        `
          )
          .join('')}
        ${
          book.highlights.length > 3
            ? `
          <div class="kindle-more-highlights">+${book.highlights.length - 3} more highlights</div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

/**
 * Render a Kindle highlight card
 * @param {Object} highlight - Highlight object
 * @returns {string} HTML string
 */
export function renderKindleHighlightCard(highlight) {
  return `
    <div class="kindle-highlight-card" data-id="${highlight.id}">
      <div class="kindle-highlight-text">"${escapeHtml(highlight.highlight || '')}"</div>
      <div class="kindle-highlight-meta">
        ${new Date(highlight.created_at).toLocaleDateString()}
      </div>
    </div>
  `;
}

/**
 * Render a podcast show card
 * @param {Object} show - Show object with name and episodes
 * @returns {string} HTML string
 */
export function renderPodcastShowCard(show) {
  return `
    <div class="podcast-show-card" data-show="${escapeHtml(show.name)}">
      <div class="podcast-show-header">
        <div class="podcast-show-icon">🎙️</div>
        <div class="podcast-show-info">
          <h3 class="podcast-show-title">${escapeHtml(show.name)}</h3>
        </div>
        <span class="podcast-show-count">${show.episodes.length}</span>
      </div>
      <div class="podcast-episodes-preview">
        ${show.episodes
          .slice(0, 3)
          .map(
            (ep) => `
          <div class="podcast-episode-snippet" data-id="${ep.id}">
            ${escapeHtml(ep.title || 'Untitled Episode')}
          </div>
        `
          )
          .join('')}
        ${
          show.episodes.length > 3
            ? `
          <div class="podcast-more-episodes">+${show.episodes.length - 3} more episodes</div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

/**
 * Render a podcast episode card
 * @param {Object} episode - Episode object
 * @returns {string} HTML string
 */
export function renderPodcastEpisodeCard(episode) {
  return `
    <div class="kindle-highlight-card podcast-episode-card" data-id="${episode.id}" style="border-left-color: var(--primary);">
      <div class="kindle-highlight-text" style="font-style: normal; font-weight: 600;">
        ${escapeHtml(episode.title || 'Untitled Episode')}
      </div>
      <div style="margin-top: 8px; font-size: 14px; color: var(--text-secondary);">
        ${escapeHtml(episode.excerpt || '')}
      </div>
      ${
        episode.podcast_metadata?.key_points
          ? `
        <div class="podcast-key-points" style="margin-top: 12px;">
          <h4>Key Points</h4>
          <ul>
            ${episode.podcast_metadata.key_points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }
      <div class="kindle-highlight-meta">
        ${new Date(episode.created_at).toLocaleDateString()}
      </div>
    </div>
  `;
}

/**
 * Render the rediscovery card for weekly review
 * @param {Object} save - Save object
 * @returns {string} HTML string
 */
export function renderRediscoveryCard(save) {
  const date = new Date(save.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return `
    <h4>Rediscover</h4>
    <div class="rediscovery-card" data-id="${save.id}">
      <div class="rediscovery-meta">Saved ${date}</div>
      <div class="rediscovery-title">${escapeHtml(save.title || 'Untitled')}</div>
      ${save.highlight ? `<div class="rediscovery-highlight">"${escapeHtml(save.highlight)}"</div>` : ''}
      <div class="rediscovery-source">${escapeHtml(save.site_name || '')}</div>
    </div>
  `;
}

/**
 * Render Apple Podcasts item for import preview
 * @param {Object} podcast - Podcast object from Apple Podcasts export
 * @param {number} index - Index in the list
 * @returns {string} HTML string
 */
export function renderApplePodcastItem(podcast, index) {
  const dateStr = podcast.publishedAt
    ? new Date(podcast.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return `
    <div class="apple-podcast-item ${podcast.selected ? 'selected' : ''}" data-index="${index}">
      <input type="checkbox" ${podcast.selected ? 'checked' : ''}>
      <div class="apple-podcast-item-info">
        <div class="apple-podcast-item-title">${escapeHtml(podcast.title)}</div>
        <div class="apple-podcast-item-show">${escapeHtml(podcast.showName)}${dateStr ? ` · ${dateStr}` : ''}</div>
        <div class="apple-podcast-item-meta">${Math.round(podcast.content.length / 1000)}k characters</div>
      </div>
    </div>
  `;
}

/**
 * Render import book item for Kindle import preview
 * @param {Object} book - Book object with title, author, count
 * @returns {string} HTML string
 */
export function renderImportBookItem(book) {
  return `
    <div class="import-book-item">
      <div>
        <div class="import-book-title">${escapeHtml(book.title)}</div>
        ${book.author ? `<div class="import-book-author">${escapeHtml(book.author)}</div>` : ''}
      </div>
      <span class="import-book-count">${book.count}</span>
    </div>
  `;
}

/**
 * Render a bulk import book item with Google Books matches
 * @param {Object} book - Parsed book with title, author, yearRead
 * @param {number} index - Index in the list
 * @param {Array} matches - Google Books matches for this book
 * @param {Object} warnings - Warning flags (existing, duplicateYears)
 * @returns {string} HTML string
 */
export function renderBulkImportBook(book, index, matches = [], warnings = {}) {
  const isSelected = book.selected !== false;
  const selectedMatchId = book.selectedMatchId || (matches[0]?.id || 'no-match');

  // Warning badges
  let warningBadges = '';
  if (warnings.existing) {
    warningBadges += `<span class="bulk-import-warning existing">Already in library</span>`;
  }
  if (warnings.duplicateYears && warnings.duplicateYears.length > 0) {
    warningBadges += `<span class="bulk-import-warning duplicate">Also listed for: ${warnings.duplicateYears.join(', ')}</span>`;
  }

  // Match options
  let matchOptionsHtml = '';
  if (matches.length > 0) {
    matchOptionsHtml = matches.slice(0, 3).map((match, matchIdx) => {
      const info = match.volumeInfo || {};
      const thumbnail = info.imageLinks?.thumbnail?.replace('http:', 'https:') || '';
      const authors = info.authors?.join(', ') || 'Unknown Author';
      const year = info.publishedDate?.split('-')[0] || '';
      const isMatchSelected = selectedMatchId === match.id;

      return `
        <label class="bulk-import-match-option ${isMatchSelected ? 'selected' : ''}" data-match-id="${match.id}">
          <input type="radio" name="match-${index}" value="${match.id}" ${isMatchSelected ? 'checked' : ''}>
          ${thumbnail
            ? `<img class="bulk-import-match-cover" src="${thumbnail}" alt="">`
            : `<div class="bulk-import-match-cover-placeholder">📚</div>`
          }
          <div class="bulk-import-match-info">
            <div class="bulk-import-match-title">${escapeHtml(info.title || book.title)}</div>
            <div class="bulk-import-match-author">${escapeHtml(authors)}</div>
            ${year ? `<div class="bulk-import-match-year">${year}</div>` : ''}
          </div>
        </label>
      `;
    }).join('');
  }

  // Add "skip / no match" option
  const isNoMatch = selectedMatchId === 'no-match' || matches.length === 0;
  matchOptionsHtml += `
    <label class="bulk-import-match-option no-match ${isNoMatch && matches.length > 0 ? 'selected' : ''}" data-match-id="no-match">
      <input type="radio" name="match-${index}" value="no-match" ${isNoMatch && matches.length > 0 ? 'checked' : ''}>
      <div class="bulk-import-match-cover-placeholder">⏭️</div>
      <div class="bulk-import-match-info">
        <div class="bulk-import-match-title">${matches.length === 0 ? 'No matches found' : 'Skip - add without metadata'}</div>
      </div>
    </label>
  `;

  return `
    <div class="bulk-import-book-item ${isSelected ? 'selected' : ''} ${warnings.existing || warnings.duplicateYears ? 'has-warning' : ''}" data-index="${index}">
      <div class="bulk-import-book-header">
        <input type="checkbox" ${isSelected ? 'checked' : ''} title="Include this book">
        <div class="bulk-import-book-parsed">
          <div class="bulk-import-book-title">${escapeHtml(book.title)}</div>
          ${book.author ? `<div class="bulk-import-book-author">${escapeHtml(book.author)}</div>` : ''}
          ${book.yearRead ? `<div class="bulk-import-book-year">Year read: ${book.yearRead}</div>` : ''}
          ${warningBadges}
        </div>
      </div>
      <div class="bulk-import-matches">
        <div class="bulk-import-matches-label">${matches.length > 0 ? 'Select a match:' : 'Google Books matches:'}</div>
        <div class="bulk-import-match-options">
          ${matchOptionsHtml}
        </div>
      </div>
    </div>
  `;
}
