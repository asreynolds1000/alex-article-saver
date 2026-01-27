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
 * AI Model Tier definitions
 * Patterns for matching models to tiers, with fallback defaults
 */
export const AI_TIERS = {
  fast: {
    name: 'Fast',
    description: 'Quick responses, lower cost',
    claude: {
      patterns: ['haiku'],
      default: 'claude-3-5-haiku-20241022',
    },
    openai: {
      patterns: ['mini'],
      default: 'gpt-4o-mini',
    },
  },
  balanced: {
    name: 'Balanced',
    description: 'Best balance of speed and quality (recommended)',
    claude: {
      patterns: ['sonnet'],
      default: 'claude-sonnet-4-20250514',
    },
    openai: {
      patterns: ['gpt-4o', 'gpt-4.1', 'gpt-5'],
      exclude: ['mini', 'nano'],
      default: 'gpt-4o',
    },
  },
  quality: {
    name: 'Quality',
    description: 'Best results, slower and more expensive',
    claude: {
      patterns: ['opus'],
      default: 'claude-opus-4-20250514',
    },
    openai: {
      patterns: ['o1', 'o3'],
      exclude: ['mini'],
      default: 'o1',
    },
  },
};

/**
 * Score a model for sorting (higher = newer/better)
 * @param {string} modelId - Model ID
 * @param {string} provider - 'claude' or 'openai'
 * @returns {number} Score for sorting
 */
function scoreModel(modelId, provider) {
  const id = modelId.toLowerCase();

  if (provider === 'claude') {
    // Prefer newer versions: sonnet-4 > 3.7 > 3.5 > 3
    let score = 0;
    if (id.includes('opus')) score += 1000;
    else if (id.includes('sonnet')) score += 500;
    else if (id.includes('haiku')) score += 100;

    // Version scoring
    if (id.includes('sonnet-4') || id.includes('opus-4')) score += 400;
    else if (id.includes('3-7') || id.includes('3.7')) score += 300;
    else if (id.includes('3-5') || id.includes('3.5')) score += 200;
    else if (id.includes('3-') || id.includes('3.')) score += 100;

    // Date scoring (newer = better)
    const dateMatch = id.match(/(\d{8})/);
    if (dateMatch) {
      score += parseInt(dateMatch[1]) / 100000;
    }
    return score;
  }

  if (provider === 'openai') {
    let score = 0;
    // Reasoning models are premium
    if (id.startsWith('o3')) score += 2000;
    else if (id.startsWith('o1') && !id.includes('mini')) score += 1500;
    else if (id.startsWith('o1-mini')) score += 800;

    // GPT models
    if (id.includes('gpt-5') && !id.includes('mini')) score += 1400;
    else if (id.includes('gpt-5-mini')) score += 700;
    else if (id.includes('gpt-4.1') && !id.includes('mini')) score += 1200;
    else if (id.includes('gpt-4.1-mini')) score += 600;
    else if (id.includes('gpt-4o') && !id.includes('mini')) score += 1000;
    else if (id.includes('gpt-4o-mini')) score += 500;
    else if (id.includes('gpt-4-turbo')) score += 900;
    else if (id.includes('gpt-4')) score += 800;
    else if (id.includes('gpt-3.5')) score += 300;

    return score;
  }

  return 0;
}

/**
 * Check if a model matches a tier's patterns
 * @param {string} modelId - Model ID to check
 * @param {Object} tierConfig - Tier config with patterns and exclude
 * @returns {boolean} Whether model matches
 */
function modelMatchesTier(modelId, tierConfig) {
  const id = modelId.toLowerCase();

  // Check exclusions first
  if (tierConfig.exclude) {
    for (const exclude of tierConfig.exclude) {
      if (id.includes(exclude.toLowerCase())) {
        return false;
      }
    }
  }

  // Check patterns
  for (const pattern of tierConfig.patterns) {
    if (id.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve a tier to a specific model for a provider
 * Uses cached models if available, falls back to defaults
 * @param {string} provider - 'claude' or 'openai'
 * @param {string} tier - 'fast', 'balanced', or 'quality'
 * @returns {string} Model ID
 */
export function resolveModelForTier(provider, tier) {
  const tierConfig = AI_TIERS[tier] || AI_TIERS.balanced;
  const providerConfig = tierConfig[provider];

  if (!providerConfig) {
    return AI_TIERS.balanced[provider]?.default || '';
  }

  // Try to get cached models
  const cacheKey = `stash-${provider}-models-cache`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const models = JSON.parse(cached);
      // Filter models that match this tier
      const matching = models.filter((id) => modelMatchesTier(id, providerConfig));

      if (matching.length > 0) {
        // Sort by score (best first) and return the best one
        matching.sort((a, b) => scoreModel(b, provider) - scoreModel(a, provider));
        return matching[0];
      }
    } catch (e) {
      console.warn('Failed to parse cached models:', e);
    }
  }

  // Fall back to default
  return providerConfig.default;
}

/**
 * Get the display name for a resolved model
 * @param {string} provider - 'claude' or 'openai'
 * @param {string} tier - 'fast', 'balanced', or 'quality'
 * @returns {string} Human-readable model name
 */
export function getResolvedModelDisplayName(provider, tier) {
  const modelId = resolveModelForTier(provider, tier);
  return formatModelDisplayName(modelId, provider);
}

/**
 * Format a model ID into a human-readable name
 * @param {string} modelId - Model ID
 * @param {string} provider - 'claude' or 'openai'
 * @returns {string} Display name
 */
export function formatModelDisplayName(modelId, provider) {
  if (!modelId) return 'Unknown';

  if (provider === 'claude') {
    if (modelId.includes('opus-4') || modelId.includes('opus4'))
      return 'Claude Opus 4';
    if (modelId.includes('sonnet-4') || modelId.includes('sonnet4'))
      return 'Claude Sonnet 4';
    if (modelId.includes('3-7-sonnet') || modelId.includes('3.7-sonnet'))
      return 'Claude 3.7 Sonnet';
    if (modelId.includes('3-5-sonnet') || modelId.includes('3.5-sonnet'))
      return 'Claude 3.5 Sonnet';
    if (modelId.includes('3-5-haiku') || modelId.includes('3.5-haiku'))
      return 'Claude 3.5 Haiku';
    if (modelId.includes('opus')) return 'Claude Opus';
    if (modelId.includes('sonnet')) return 'Claude Sonnet';
    if (modelId.includes('haiku')) return 'Claude Haiku';
    return modelId;
  }

  if (provider === 'openai') {
    if (modelId === 'o1') return 'o1';
    if (modelId === 'o1-mini') return 'o1 Mini';
    if (modelId === 'o3') return 'o3';
    if (modelId === 'o3-mini') return 'o3 Mini';
    if (modelId === 'gpt-4o') return 'GPT-4o';
    if (modelId === 'gpt-4o-mini') return 'GPT-4o Mini';
    if (modelId.includes('gpt-5') && !modelId.includes('mini')) return 'GPT-5';
    if (modelId.includes('gpt-5-mini')) return 'GPT-5 Mini';
    if (modelId.includes('gpt-4.1') && !modelId.includes('mini')) return 'GPT-4.1';
    if (modelId.includes('gpt-4.1-mini')) return 'GPT-4.1 Mini';
    if (modelId.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
    if (modelId.includes('gpt-4')) return 'GPT-4';
    if (modelId.includes('gpt-3.5')) return 'GPT-3.5 Turbo';
    return modelId;
  }

  return modelId;
}

/**
 * Get display name for a tier
 * @param {string} tier - Tier ID
 * @returns {string} Display name
 */
export function getTierDisplayName(tier) {
  const tierConfig = AI_TIERS[tier];
  if (!tierConfig) return 'Balanced';
  return tierConfig.name;
}

/**
 * Get AI configuration from localStorage
 * @returns {{provider: string, apiKey: string, hasKey: boolean, model: string, tier: string}}
 */
export function getAIConfig() {
  const provider = localStorage.getItem('stash-ai-provider') || 'claude';
  const claudeKey = localStorage.getItem('stash-claude-api-key') || '';
  const openaiKey = localStorage.getItem('stash-openai-api-key') || '';
  const tier = localStorage.getItem('stash-ai-tier') || 'balanced';

  // Resolve tier to specific model at runtime
  const model = resolveModelForTier(provider, tier);

  return {
    provider,
    apiKey: provider === 'claude' ? claudeKey : openaiKey,
    hasKey: provider === 'claude' ? !!claudeKey : !!openaiKey,
    model,
    tier,
  };
}
