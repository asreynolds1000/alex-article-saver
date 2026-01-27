import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  escapeHtml,
  formatTime,
  getTimeAgo,
  getAIConfig,
} from '../../web/lib/utils.js';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;'
    );
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('should escape quotes', () => {
    expect(escapeHtml('"hello"')).toBe('"hello"');
  });

  it('should return empty string for null', () => {
    expect(escapeHtml(null as unknown as string)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(escapeHtml(undefined as unknown as string)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle plain text without modification', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('formatTime', () => {
  it('should format seconds as m:ss', () => {
    expect(formatTime(90)).toBe('1:30');
  });

  it('should format minutes over 60', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('should pad seconds with leading zero', () => {
    expect(formatTime(65)).toBe('1:05');
  });

  it('should handle zero seconds', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('should return 0:00 for NaN', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('should return 0:00 for null', () => {
    expect(formatTime(null as unknown as number)).toBe('0:00');
  });

  it('should return 0:00 for undefined', () => {
    expect(formatTime(undefined as unknown as number)).toBe('0:00');
  });
});

describe('getTimeAgo', () => {
  it('should return "just now" for very recent dates', () => {
    const now = new Date();
    expect(getTimeAgo(now)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(getTimeAgo(fiveMinutesAgo)).toBe('5m ago');
  });

  it('should return hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(getTimeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('should return days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(twoDaysAgo)).toBe('2d ago');
  });
});

describe('getAIConfig', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return default claude config with balanced tier when nothing is set', () => {
    const config = getAIConfig();
    expect(config.provider).toBe('claude');
    expect(config.hasKey).toBe(false);
    expect(config.tier).toBe('balanced');
    expect(config.model).toBe('claude-sonnet-4-20250514'); // balanced tier default
  });

  it('should return claude config with quality tier when set', () => {
    localStorage.setItem('stash-ai-provider', 'claude');
    localStorage.setItem('stash-claude-api-key', 'sk-ant-test');
    localStorage.setItem('stash-ai-tier', 'quality');

    const config = getAIConfig();
    expect(config.provider).toBe('claude');
    expect(config.apiKey).toBe('sk-ant-test');
    expect(config.hasKey).toBe(true);
    expect(config.tier).toBe('quality');
    expect(config.model).toBe('claude-opus-4-20250514'); // quality tier for claude
  });

  it('should return openai config with balanced tier when set', () => {
    localStorage.setItem('stash-ai-provider', 'openai');
    localStorage.setItem('stash-openai-api-key', 'sk-test');
    localStorage.setItem('stash-ai-tier', 'balanced');

    const config = getAIConfig();
    expect(config.provider).toBe('openai');
    expect(config.apiKey).toBe('sk-test');
    expect(config.hasKey).toBe(true);
    expect(config.tier).toBe('balanced');
    expect(config.model).toBe('gpt-4o'); // balanced tier for openai
  });

  it('should resolve fast tier model for openai', () => {
    localStorage.setItem('stash-ai-provider', 'openai');
    localStorage.setItem('stash-openai-api-key', 'sk-test');
    localStorage.setItem('stash-ai-tier', 'fast');

    const config = getAIConfig();
    expect(config.tier).toBe('fast');
    expect(config.model).toBe('gpt-4o-mini'); // fast tier for openai
  });

  it('should use cached models for dynamic resolution when available', () => {
    // Simulate cached models from API
    const cachedClaudeModels = [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
    ];
    localStorage.setItem('stash-claude-models-cache', JSON.stringify(cachedClaudeModels));
    localStorage.setItem('stash-ai-provider', 'claude');
    localStorage.setItem('stash-claude-api-key', 'sk-ant-test');
    localStorage.setItem('stash-ai-tier', 'balanced');

    const config = getAIConfig();
    // Should pick the best sonnet model from cache
    expect(config.model).toBe('claude-sonnet-4-20250514');
  });

  it('should pick newest model from cached models for a tier', () => {
    // Simulate cached models with multiple sonnet versions
    const cachedModels = [
      'claude-3-5-sonnet-20241022',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
    ];
    localStorage.setItem('stash-claude-models-cache', JSON.stringify(cachedModels));
    localStorage.setItem('stash-ai-provider', 'claude');
    localStorage.setItem('stash-claude-api-key', 'sk-ant-test');
    localStorage.setItem('stash-ai-tier', 'balanced');

    const config = getAIConfig();
    // Should pick sonnet-4 as it has highest score
    expect(config.model).toBe('claude-sonnet-4-20250514');
  });

  it('should fall back to default when no cached models match tier', () => {
    // Cache only haiku models, but request quality tier
    const cachedModels = ['claude-3-5-haiku-20241022'];
    localStorage.setItem('stash-claude-models-cache', JSON.stringify(cachedModels));
    localStorage.setItem('stash-ai-provider', 'claude');
    localStorage.setItem('stash-claude-api-key', 'sk-ant-test');
    localStorage.setItem('stash-ai-tier', 'quality');

    const config = getAIConfig();
    // Should fall back to default opus since no opus in cache
    expect(config.model).toBe('claude-opus-4-20250514');
  });
});
