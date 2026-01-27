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

  it('should return default claude config when nothing is set', () => {
    const config = getAIConfig();
    expect(config.provider).toBe('claude');
    expect(config.hasKey).toBe(false);
    expect(config.model).toBe('claude-sonnet-4-20250514');
  });

  it('should return claude config when claude provider is set', () => {
    localStorage.setItem('stash-ai-provider', 'claude');
    localStorage.setItem('stash-claude-api-key', 'sk-ant-test');
    localStorage.setItem('stash-claude-model', 'claude-3-opus-20240229');

    const config = getAIConfig();
    expect(config.provider).toBe('claude');
    expect(config.apiKey).toBe('sk-ant-test');
    expect(config.hasKey).toBe(true);
    expect(config.model).toBe('claude-3-opus-20240229');
  });

  it('should return openai config when openai provider is set', () => {
    localStorage.setItem('stash-ai-provider', 'openai');
    localStorage.setItem('stash-openai-api-key', 'sk-test');
    localStorage.setItem('stash-openai-model', 'gpt-4');

    const config = getAIConfig();
    expect(config.provider).toBe('openai');
    expect(config.apiKey).toBe('sk-test');
    expect(config.hasKey).toBe(true);
    expect(config.model).toBe('gpt-4');
  });

  it('should use default model when none is set for openai', () => {
    localStorage.setItem('stash-ai-provider', 'openai');
    localStorage.setItem('stash-openai-api-key', 'sk-test');

    const config = getAIConfig();
    expect(config.model).toBe('gpt-4o-mini');
  });
});
