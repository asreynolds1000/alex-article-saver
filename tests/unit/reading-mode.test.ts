import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DOM elements
function createMockDOM() {
  document.body.innerHTML = `
    <html data-theme="light">
    <div id="reading-pane" class="reading-pane">
      <div id="reading-mode-controls" class="reading-mode-controls hidden">
        <button id="close-reading-mode-btn"></button>
        <button id="reading-mode-theme-btn">
          <svg class="sun-icon"></svg>
          <svg class="moon-icon hidden"></svg>
        </button>
        <div class="font-size-toggle">
          <button class="font-size-btn" data-size="small">A</button>
          <button class="font-size-btn active" data-size="medium">A</button>
          <button class="font-size-btn" data-size="large">A</button>
        </div>
        <div class="width-toggle">
          <button class="width-btn" data-width="narrow"></button>
          <button class="width-btn active" data-width="medium"></button>
          <button class="width-btn" data-width="wide"></button>
        </div>
      </div>
    </div>
    <button id="reading-mode-btn"></button>
    </html>
  `;
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Import functions after mocking
import {
  toggleReadingMode,
  enterReadingMode,
  exitReadingMode,
  setFontSize,
  setColumnWidth,
  toggleReadingTheme,
  isReadingModeActive,
  initReadingMode,
} from '../../web/ui/reading-pane.js';

describe('Reading Mode', () => {
  beforeEach(() => {
    createMockDOM();
    localStorageMock.clear();
    // Reset reading mode state by exiting if active
    if (isReadingModeActive()) {
      exitReadingMode();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toggleReadingMode', () => {
    it('should add reading-mode class when toggled on', () => {
      const pane = document.getElementById('reading-pane');
      expect(pane?.classList.contains('reading-mode')).toBe(false);

      toggleReadingMode();

      expect(pane?.classList.contains('reading-mode')).toBe(true);
    });

    it('should remove reading-mode class when toggled off', () => {
      toggleReadingMode(); // Enter
      const pane = document.getElementById('reading-pane');
      expect(pane?.classList.contains('reading-mode')).toBe(true);

      toggleReadingMode(); // Exit

      expect(pane?.classList.contains('reading-mode')).toBe(false);
    });

    it('should show reading-mode-controls when entering', () => {
      const controls = document.getElementById('reading-mode-controls');
      expect(controls?.classList.contains('hidden')).toBe(true);

      toggleReadingMode();

      expect(controls?.classList.contains('hidden')).toBe(false);
    });

    it('should hide reading-mode-controls when exiting', () => {
      toggleReadingMode(); // Enter
      const controls = document.getElementById('reading-mode-controls');
      expect(controls?.classList.contains('hidden')).toBe(false);

      toggleReadingMode(); // Exit

      expect(controls?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('setFontSize', () => {
    beforeEach(() => {
      enterReadingMode();
    });

    afterEach(() => {
      exitReadingMode();
    });

    it('should set data-font-size attribute to small', () => {
      setFontSize('small');
      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-font-size')).toBe('small');
    });

    it('should set data-font-size attribute to medium', () => {
      setFontSize('medium');
      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-font-size')).toBe('medium');
    });

    it('should set data-font-size attribute to large', () => {
      setFontSize('large');
      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-font-size')).toBe('large');
    });

    it('should save font size to localStorage', () => {
      setFontSize('large');
      expect(localStorageMock.getItem('stash-reading-font-size')).toBe('large');
    });

    it('should update active class on font size buttons', () => {
      setFontSize('large');

      const smallBtn = document.querySelector('.font-size-btn[data-size="small"]');
      const mediumBtn = document.querySelector('.font-size-btn[data-size="medium"]');
      const largeBtn = document.querySelector('.font-size-btn[data-size="large"]');

      expect(smallBtn?.classList.contains('active')).toBe(false);
      expect(mediumBtn?.classList.contains('active')).toBe(false);
      expect(largeBtn?.classList.contains('active')).toBe(true);
    });

    it('should default to medium for invalid size', () => {
      // @ts-expect-error Testing invalid input
      setFontSize('invalid');
      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-font-size')).toBe('medium');
    });
  });

  describe('setColumnWidth', () => {
    beforeEach(() => {
      enterReadingMode();
    });

    afterEach(() => {
      exitReadingMode();
    });

    it('should set data-width attribute to narrow', () => {
      setColumnWidth('narrow');
      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-width')).toBe('narrow');
    });

    it('should set data-width attribute to medium', () => {
      setColumnWidth('medium');
      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-width')).toBe('medium');
    });

    it('should set data-width attribute to wide', () => {
      setColumnWidth('wide');
      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-width')).toBe('wide');
    });

    it('should save width to localStorage', () => {
      setColumnWidth('wide');
      expect(localStorageMock.getItem('stash-reading-width')).toBe('wide');
    });

    it('should update active class on width buttons', () => {
      setColumnWidth('wide');

      const narrowBtn = document.querySelector('.width-btn[data-width="narrow"]');
      const mediumBtn = document.querySelector('.width-btn[data-width="medium"]');
      const wideBtn = document.querySelector('.width-btn[data-width="wide"]');

      expect(narrowBtn?.classList.contains('active')).toBe(false);
      expect(mediumBtn?.classList.contains('active')).toBe(false);
      expect(wideBtn?.classList.contains('active')).toBe(true);
    });

    it('should default to medium for invalid width', () => {
      // @ts-expect-error Testing invalid input
      setColumnWidth('invalid');
      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-width')).toBe('medium');
    });
  });

  describe('toggleReadingTheme', () => {
    beforeEach(() => {
      enterReadingMode();
    });

    afterEach(() => {
      exitReadingMode();
    });

    it('should set dark theme when app is in light mode', () => {
      document.documentElement.setAttribute('data-theme', 'light');

      toggleReadingTheme();

      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-reading-theme')).toBe('dark');
    });

    it('should set light theme when app is in dark mode', () => {
      document.documentElement.setAttribute('data-theme', 'dark');

      toggleReadingTheme();

      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-reading-theme')).toBe('light');
    });

    it('should clear theme override when toggled again', () => {
      document.documentElement.setAttribute('data-theme', 'light');

      toggleReadingTheme(); // Set to dark
      toggleReadingTheme(); // Clear override

      const pane = document.getElementById('reading-pane');
      expect(pane?.hasAttribute('data-reading-theme')).toBe(false);
    });
  });

  describe('isReadingModeActive', () => {
    it('should return false initially', () => {
      expect(isReadingModeActive()).toBe(false);
    });

    it('should return true after entering reading mode', () => {
      enterReadingMode();
      expect(isReadingModeActive()).toBe(true);
    });

    it('should return false after exiting reading mode', () => {
      enterReadingMode();
      exitReadingMode();
      expect(isReadingModeActive()).toBe(false);
    });
  });

  describe('enterReadingMode', () => {
    it('should restore saved font size from localStorage', () => {
      localStorageMock.setItem('stash-reading-font-size', 'large');

      enterReadingMode();

      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-font-size')).toBe('large');
    });

    it('should restore saved width from localStorage', () => {
      localStorageMock.setItem('stash-reading-width', 'wide');

      enterReadingMode();

      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-width')).toBe('wide');
    });

    it('should default to medium if no saved preference', () => {
      enterReadingMode();

      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-font-size')).toBe('medium');
      expect(pane?.getAttribute('data-width')).toBe('medium');
    });

    it('should reset theme override on enter', () => {
      enterReadingMode();

      const pane = document.getElementById('reading-pane');
      expect(pane?.hasAttribute('data-reading-theme')).toBe(false);
    });
  });

  describe('exitReadingMode', () => {
    it('should remove data-font-size attribute', () => {
      enterReadingMode();
      setFontSize('large');

      exitReadingMode();

      const pane = document.getElementById('reading-pane');
      expect(pane?.hasAttribute('data-font-size')).toBe(false);
    });

    it('should remove data-width attribute', () => {
      enterReadingMode();
      setColumnWidth('wide');

      exitReadingMode();

      const pane = document.getElementById('reading-pane');
      expect(pane?.hasAttribute('data-width')).toBe(false);
    });

    it('should remove data-reading-theme attribute', () => {
      enterReadingMode();
      toggleReadingTheme();

      exitReadingMode();

      const pane = document.getElementById('reading-pane');
      expect(pane?.hasAttribute('data-reading-theme')).toBe(false);
    });
  });

  describe('initReadingMode', () => {
    it('should bind click handler to reading mode button', () => {
      initReadingMode();

      const btn = document.getElementById('reading-mode-btn');
      btn?.click();

      expect(isReadingModeActive()).toBe(true);
    });

    it('should bind click handler to close button', () => {
      enterReadingMode();
      initReadingMode();

      const closeBtn = document.getElementById('close-reading-mode-btn');
      closeBtn?.click();

      expect(isReadingModeActive()).toBe(false);
    });

    it('should bind click handlers to font size buttons', () => {
      enterReadingMode();
      initReadingMode();

      const largeBtn = document.querySelector('.font-size-btn[data-size="large"]') as HTMLButtonElement;
      largeBtn?.click();

      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-font-size')).toBe('large');
    });

    it('should bind click handlers to width buttons', () => {
      enterReadingMode();
      initReadingMode();

      const wideBtn = document.querySelector('.width-btn[data-width="wide"]') as HTMLButtonElement;
      wideBtn?.click();

      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-width')).toBe('wide');
    });

    it('should bind click handler to theme toggle button', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      enterReadingMode();
      initReadingMode();

      const themeBtn = document.getElementById('reading-mode-theme-btn');
      themeBtn?.click();

      const pane = document.getElementById('reading-pane');
      expect(pane?.getAttribute('data-reading-theme')).toBe('dark');
    });
  });
});
