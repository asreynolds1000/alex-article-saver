module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'prefer-const': 'warn',
    'no-var': 'error',
  },
  overrides: [
    // Chrome extension files
    {
      files: ['extension/**/*.js'],
      env: {
        webextensions: true,
      },
      globals: {
        chrome: 'readonly',
        CONFIG: 'readonly',
        SupabaseClient: 'readonly',
        importScripts: 'readonly',
        Readability: 'readonly',
      },
    },
    // Web app files
    {
      files: ['web/**/*.js'],
      globals: {
        CONFIG: 'readonly',
        supabase: 'readonly',
        marked: 'readonly',
        initSqlJs: 'readonly',
      },
      rules: {
        // Allow empty catch blocks in existing code
        'no-empty': ['error', { allowEmptyCatch: true }],
      },
    },
    // TypeScript test files
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
    // Config files
    {
      files: ['*.config.ts', '*.config.js', '.eslintrc.cjs'],
      env: {
        node: true,
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '**/Readability.js', // Third-party library
    'extension/Readability.js',
    'playwright-report/',
    'test-results/',
    'coverage/',
  ],
};
