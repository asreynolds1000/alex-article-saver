# Stash Improvement Progress

## Status: Mostly Complete

### Completed Phases

#### Phase 1: Security Fixes ✅
- Config files gitignored, templates created
- JWT authentication added to all Edge Functions
- CORS restrictions added
- Single-user mode fallback for bookmarklet/iOS shortcut

#### Phase 2: Testing Infrastructure ✅
- Vitest for unit tests (36 passing)
- Playwright for E2E tests (7 passing, 2 skipped)
- ESLint configured
- GitHub Actions CI (passing)

#### Phase 4: Code Modularization ✅
Created 10 ES6 modules:
- `web/lib/state.js` - Centralized state
- `web/lib/utils.js` - Utility functions
- `web/services/supabase.js` - Database operations
- `web/services/audio.js` - Audio playback
- `web/services/kindle.js` - Kindle import
- `web/services/ai.js` - Claude/OpenAI API
- `web/services/ai-jobs.js` - Background jobs
- `web/ui/modals.js` - Modal lifecycle (including bulk import)
- `web/ui/reading-pane.js` - Reading pane (with tag display, enrich state)
- `web/ui/renders.js` - HTML rendering (including bulk import book items)

#### Recent Features (Jan 2026) ✅
- Bulk book import with AI parsing and Google Books matching
- Auto-enrich on import (Fast tier)
- AI enrich button shows "Enriching..." state with spinner
- Reading pane displays tags for saves
- Tag filtering, favorites, dual dates, unified settings, stats view

#### Deployment ✅
- GitHub: `asreynolds1000/alex-article-saver`
- Vercel: Auto-deploys on push to main
- Live at: https://stash.alexreynolds.com

---

## Manual Steps Required

**You must complete these manually:**

1. **Rotate Supabase anon key** - Old key is in git history
2. **Set SINGLE_USER_ID env var** - Required for bookmarklet/iOS shortcut
3. **Deploy updated Edge Functions** - Apply JWT auth changes

See project CLAUDE.md for detailed instructions.

---

## Optional / Future Work

### Phase 3: Type Safety (Not Started)
- JSDoc annotations for key functions
- TypeScript definitions for core interfaces
- Skip unless actively developing

### Phase 4: Remaining Items (Low Priority)
- Further app.js delegation (works as-is)
- Accessibility audit

### Phase 5: Documentation
- Delete this file when manual steps are complete

---

## Quick Reference

```bash
npm test           # Unit tests
npm run test:e2e   # E2E tests
npm run lint       # Linting
npm run dev        # Local server
```
