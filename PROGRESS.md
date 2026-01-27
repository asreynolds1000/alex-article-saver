# Stash Improvement Progress

This file tracks the progress of the comprehensive improvement plan for Stash.

## Current Session: January 27, 2025

### Phase 4: Code Quality (In Progress)

#### Step 1: Foundation Modules ✅
- [x] Created `web/lib/state.js` - Centralized state management
- [x] Created `web/lib/utils.js` - Utility functions (escapeHtml, renderMarkdown, formatTime, getTimeAgo, showToast, getAIConfig)
- [x] Updated `web/index.html` to use `<script type="module">` for app.js
- [x] Added `jsdom` dependency for browser environment in tests
- [x] Created `tests/unit/utils.test.ts` - 22 unit tests (all passing)
- [x] Updated `vitest.config.ts` to use jsdom environment

#### Step 2: Supabase Service ✅
- [x] Created `web/services/supabase.js` - Database CRUD operations (~20 functions)

#### Step 3: Audio Service ✅
- [x] Created `web/services/audio.js` - Audio playback methods

#### Step 4: Kindle Service ✅
- [x] Created `web/services/kindle.js` - Kindle import functionality

#### Step 5: Modals UI ✅
- [x] Created `web/ui/modals.js` - All modal show/hide/reset methods

#### Step 6: Reading Pane UI ✅
- [x] Created `web/ui/reading-pane.js` - Reading pane display and interactions

#### Step 7: AI Service ✅
- [x] Created `web/services/ai.js` - Claude and OpenAI API integration

#### Step 8: AI Jobs Service ✅
- [x] Created `web/services/ai-jobs.js` - Background job tracking

#### Step 9: Renders UI ✅
- [x] Created `web/ui/renders.js` - Pure HTML generation functions

#### Step 10: App.js Refactoring (In Progress)
- [x] Added ES6 module imports to app.js
- [x] Set up proxy getters/setters for centralized state
- [x] Delegated utility methods (escapeHtml, renderMarkdown, formatTime, getTimeAgo, showToast, getAIConfig)
- [x] Delegated AI jobs methods (createAIJob, updateAIJob, updateAIJobsUI, renderAIJobsList)
- [ ] Wire up remaining service delegations

**Current test status:** 33 tests passing (11 kindle-parser + 22 utils)
**app.js line count:** 4,848 lines (down from 4,911)

---

## Last Session: January 21, 2025

### Completed

#### Phase 1: Security Fixes ✅
- [x] Updated `.gitignore` to exclude config files with credentials
- [x] Created `extension/config.example.js` template
- [x] Created `web/config.example.js` template
- [x] Added JWT authentication to `save-page` Edge Function
- [x] Added JWT authentication to `save-kindle` Edge Function
- [x] Added JWT authentication to `send-digest` Edge Function
- [x] Added single-user mode fallback (via `SINGLE_USER_ID` env var) for bookmarklet/iOS shortcut
- [x] Restricted CORS to allowed origins in all Edge Functions
- [x] Created `supabase/migrations/001_email_allowlist.sql` for server-side email restrictions
- [x] Updated `SETUP.md` with new configuration steps
- [x] Updated `CLAUDE.md` with security patterns

#### Phase 2: Testing Infrastructure ✅
- [x] Created `package.json` with test dependencies
- [x] Created `playwright.config.ts` for E2E tests
- [x] Created `vitest.config.ts` for unit tests
- [x] Created `tsconfig.json` for TypeScript support
- [x] Created `.eslintrc.cjs` with rules for browser/extension/TypeScript
- [x] Created `.github/workflows/ci.yml` for automated CI
- [x] Wrote `tests/e2e/app.spec.ts` - 5 E2E tests (app loading, auth, theme, PWA)
- [x] Wrote `tests/unit/kindle-parser.test.ts` - 11 unit tests (all passing)
- [x] Extracted `web/utils/kindle-parser.js` as reusable module
- [x] Created `tests/fixtures/my-clippings-sample.txt` test fixture

### Manual Steps Required Before Deploying

These steps must be done manually and haven't been completed yet:

1. **Rotate Supabase anon key** - The old key is in git history
   - Go to Supabase Dashboard > Settings > API > Regenerate anon key
   - Update your local `extension/config.js` and `web/config.js` with new key

2. **Set SINGLE_USER_ID env var** - Required for bookmarklet/iOS shortcut to work
   - Go to Supabase Dashboard > Project Settings > Edge Functions
   - Add secret: `SINGLE_USER_ID` = your user UUID

3. **Deploy updated Edge Functions**
   ```bash
   supabase login
   supabase link --project-ref <your-project-id>
   supabase functions deploy save-page
   supabase functions deploy save-kindle
   supabase functions deploy send-digest
   ```

4. **(Optional) Run email allowlist migration**
   - Run contents of `supabase/migrations/001_email_allowlist.sql` in SQL Editor
   - Then add allowed emails: `INSERT INTO allowed_emails (email) VALUES ('your@email.com');`

---

## Remaining Work

### Phase 3: Type Safety (15-20 hours)
- [ ] Create `/jsconfig.json` for JS type checking
- [ ] Create `/types/index.d.ts` with core interfaces (Save, Tag, Folder, etc.)
- [ ] Add JSDoc annotations to `extension/supabase.js`
- [ ] Add JSDoc annotations to `extension/background.js`
- [ ] Add JSDoc annotations to key methods in `web/app.js`
- [ ] Remove `any` types from Edge Functions

### Phase 4: Code Quality (6-8 hours)
- [ ] Set up proper ESLint for stricter checking
- [ ] Modularize `web/app.js` (4,911 lines) into:
  - `web/services/supabase.js`
  - `web/services/kindle.js`
  - `web/services/audio.js`
  - `web/ui/modals.js`
  - `web/ui/reading-pane.js`
- [ ] Accessibility audit of `web/index.html`
- [ ] Add ARIA labels to modals
- [ ] Test keyboard navigation

### Phase 5: Documentation (2-3 hours)
- [ ] Update `CLAUDE.md` with final patterns
- [ ] Update `SETUP.md` with any new steps
- [ ] Create `CONTRIBUTING.md` if needed
- [ ] Remove this `PROGRESS.md` file when complete

---

## Quick Reference

### Test Commands
```bash
npm install              # Install dependencies (run once)
npm test                 # Run unit tests
npm run test:e2e         # Run E2E tests
npm run lint             # Run ESLint
npm run dev              # Start local server
```

### Current Test Status
- Unit tests: 33 passing (kindle-parser: 11, utils: 22)
- E2E tests: 5 tests (need config files to run)
- Lint: 0 errors, ~40 warnings (mostly console.log statements)

### Key Files Modified
- `supabase/functions/save-page/index.ts` - Added JWT auth + CORS
- `supabase/functions/save-kindle/index.ts` - Added JWT auth + CORS
- `supabase/functions/send-digest/index.ts` - Added JWT auth + CORS
- `.gitignore` - Added config files, test artifacts
- `SETUP.md` - Added security configuration steps
- `CLAUDE.md` - Added security patterns, test commands

### New Files Created
- `extension/config.example.js`
- `web/config.example.js`
- `web/utils/kindle-parser.js`
- `web/lib/state.js` - Centralized state management
- `web/lib/utils.js` - Utility functions
- `web/services/supabase.js` - Database operations
- `web/services/audio.js` - Audio playback
- `web/services/kindle.js` - Kindle import
- `web/services/ai.js` - Claude/OpenAI API
- `web/services/ai-jobs.js` - Background job tracking
- `web/ui/modals.js` - Modal lifecycle
- `web/ui/reading-pane.js` - Reading pane UI
- `web/ui/renders.js` - HTML rendering utilities
- `supabase/migrations/001_email_allowlist.sql`
- `package.json`
- `playwright.config.ts`
- `vitest.config.ts`
- `tsconfig.json`
- `.eslintrc.cjs`
- `.github/workflows/ci.yml`
- `tests/e2e/app.spec.ts`
- `tests/unit/kindle-parser.test.ts`
- `tests/unit/utils.test.ts`
- `tests/fixtures/my-clippings-sample.txt`

---

## Full Plan Reference

See `~/.claude/plans/serene-sprouting-castle.md` for the complete implementation plan.
