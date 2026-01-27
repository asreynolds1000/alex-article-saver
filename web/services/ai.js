// AI service for Stash app
// Handles Claude and OpenAI API calls

import { getAIConfig } from '../lib/utils.js';

/**
 * Call Claude API and parse JSON response
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - Claude API key
 * @param {string} model - Model to use
 * @param {number} maxTokens - Max tokens (default 8000)
 * @returns {Promise<{content: string, keyPoints: string[]|null}>}
 */
export async function callClaudeAPI(prompt, apiKey, model, maxTokens = 8000) {
  const result = await callClaudeAPIRaw(prompt, apiKey, model, maxTokens);

  // Parse JSON from response
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return { content: result, keyPoints: null };
}

/**
 * Call Claude API and return raw text response
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - Claude API key
 * @param {string} model - Model to use
 * @param {number} maxTokens - Max tokens (default 8000)
 * @returns {Promise<string>}
 */
export async function callClaudeAPIRaw(prompt, apiKey, model, maxTokens = 8000) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Call OpenAI API and parse JSON response
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - Model to use
 * @param {number} maxTokens - Max tokens (default 8000)
 * @returns {Promise<{content: string, keyPoints: string[]|null}>}
 */
export async function callOpenAIAPI(prompt, apiKey, model, maxTokens = 8000) {
  const result = await callOpenAIAPIRaw(prompt, apiKey, model, maxTokens);

  // Parse JSON from response
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return { content: result, keyPoints: null };
}

/**
 * Call OpenAI API and return raw text response
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - Model to use
 * @param {number} maxTokens - Max tokens (default 8000)
 * @returns {Promise<string>}
 */
export async function callOpenAIAPIRaw(prompt, apiKey, model, maxTokens = 8000) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4.1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call the configured AI provider
 * @param {string} prompt - The prompt to send
 * @param {Object} config - AI config from getAIConfig()
 * @param {number} maxTokens - Max tokens (default 8000)
 * @returns {Promise<{content: string, keyPoints: string[]|null}>}
 */
export async function callAI(prompt, config = null, maxTokens = 8000) {
  const aiConfig = config || getAIConfig();

  if (!aiConfig.hasKey) {
    throw new Error('No API key configured. Please add your API key in AI Settings.');
  }

  if (aiConfig.provider === 'claude') {
    return callClaudeAPI(prompt, aiConfig.apiKey, aiConfig.model, maxTokens);
  } else {
    return callOpenAIAPI(prompt, aiConfig.apiKey, aiConfig.model, maxTokens);
  }
}

/**
 * Call the configured AI provider and return raw text
 * @param {string} prompt - The prompt to send
 * @param {Object} config - AI config from getAIConfig()
 * @param {number} maxTokens - Max tokens (default 8000)
 * @returns {Promise<string>}
 */
export async function callAIRaw(prompt, config = null, maxTokens = 8000) {
  const aiConfig = config || getAIConfig();

  if (!aiConfig.hasKey) {
    throw new Error('No API key configured. Please add your API key in AI Settings.');
  }

  if (aiConfig.provider === 'claude') {
    return callClaudeAPIRaw(prompt, aiConfig.apiKey, aiConfig.model, maxTokens);
  } else {
    return callOpenAIAPIRaw(prompt, aiConfig.apiKey, aiConfig.model, maxTokens);
  }
}

/**
 * Fetch available Claude models
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Array>} Array of model objects
 */
export async function fetchClaudeModels(apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const models = data.data || [];

  // Filter for chat models and sort
  return models
    .filter((m) => m.type === 'model' && m.id.includes('claude'))
    .sort((a, b) => {
      // Prefer newer models
      if (a.id.includes('sonnet-4') && !b.id.includes('sonnet-4')) return -1;
      if (!a.id.includes('sonnet-4') && b.id.includes('sonnet-4')) return 1;
      if (a.id.includes('3-7') && !b.id.includes('3-7')) return -1;
      if (!a.id.includes('3-7') && b.id.includes('3-7')) return 1;
      return a.id.localeCompare(b.id);
    });
}

/**
 * Fetch available OpenAI models
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Array>} Array of model objects
 */
export async function fetchOpenAIModels(apiKey) {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const models = data.data || [];

  // Filter for chat models
  return models
    .filter((m) => m.id.includes('gpt') && !m.id.includes('instruct'))
    .sort((a, b) => {
      // Prefer GPT-4 over GPT-3.5
      if (a.id.includes('gpt-4') && !b.id.includes('gpt-4')) return -1;
      if (!a.id.includes('gpt-4') && b.id.includes('gpt-4')) return 1;
      return a.id.localeCompare(b.id);
    });
}

/**
 * Format Claude model name for display
 * @param {string} modelId - Model ID
 * @returns {string} Formatted name
 */
export function formatClaudeModelName(modelId) {
  // claude-3-5-sonnet-20241022 -> Claude 3.5 Sonnet (Oct 2024)
  const parts = modelId.split('-');
  let name = '';

  if (parts.includes('claude')) {
    name = 'Claude';

    // Version
    if (parts.includes('3')) {
      const idx = parts.indexOf('3');
      if (parts[idx + 1] === '5') {
        name += ' 3.5';
      } else if (parts[idx + 1] === '7') {
        name += ' 3.7';
      } else {
        name += ' 3';
      }
    }

    // Model type
    if (modelId.includes('opus')) name += ' Opus';
    else if (modelId.includes('sonnet')) name += ' Sonnet';
    else if (modelId.includes('haiku')) name += ' Haiku';

    // Date
    const dateMatch = modelId.match(/(\d{4})(\d{2})(\d{2})/);
    if (dateMatch) {
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const month = months[parseInt(dateMatch[2]) - 1] || dateMatch[2];
      name += ` (${month} ${dateMatch[1]})`;
    }
  }

  return name || modelId;
}

/**
 * Format OpenAI model name for display
 * @param {string} modelId - Model ID
 * @returns {string} Formatted name
 */
export function formatOpenAIModelName(modelId) {
  // gpt-4-turbo-2024-04-09 -> GPT-4 Turbo (Apr 2024)
  let name = modelId.toUpperCase().replace(/-/g, ' ');

  // Handle common patterns
  if (modelId.includes('gpt-4o')) {
    name = 'GPT-4o';
    if (modelId.includes('mini')) name += ' Mini';
  } else if (modelId.includes('gpt-4-turbo')) {
    name = 'GPT-4 Turbo';
  } else if (modelId.includes('gpt-4')) {
    name = 'GPT-4';
  } else if (modelId.includes('gpt-3.5')) {
    name = 'GPT-3.5 Turbo';
  }

  // Date
  const dateMatch = modelId.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months[parseInt(dateMatch[2]) - 1] || dateMatch[2];
    name += ` (${month} ${dateMatch[1]})`;
  }

  return name;
}
