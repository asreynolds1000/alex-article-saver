import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test directory for unit tests
    include: ['tests/unit/**/*.{test,spec}.{js,ts}'],

    // Environment - jsdom for browser APIs (document, localStorage)
    environment: 'jsdom',

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['web/**/*.js', 'extension/**/*.js'],
      exclude: [
        'web/Readability.js', // Third-party library
        '**/*.config.*',
        '**/config.js',
      ],
    },

    // Global test utilities
    globals: true,
  },
});
