# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stash is a self-hosted read-it-later app (Pocket replacement) with Chrome extension, web app, and cross-device sync. All data is stored in the user's own Supabase database.

**Tech stack:** Vanilla JS (no framework), Supabase (PostgreSQL + REST API), static hosting

## Architecture

```
stash/
├── extension/       # Chrome extension (Manifest V3)
│   ├── background.js    # Service worker: context menus, page/highlight saving
│   ├── content.js       # Injected script: article extraction, toast notifications
│   ├── popup.*          # Extension popup UI
│   ├── supabase.js      # Minimal Supabase REST client for extension
│   ├── Readability.js   # Mozilla Readability for article extraction
│   └── config.js        # Supabase credentials + USER_ID (gitignored)
│
├── web/             # Web app (PWA) - ES6 modules
│   ├── app.js           # Main app class with module imports
│   ├── config.js        # Supabase credentials + USER_ID (gitignored)
│   ├── index.html       # SPA with <script type="module">
│   ├── sw.js            # Service worker for offline support
│   │
│   ├── lib/             # Core modules
│   │   ├── state.js         # Centralized app state
│   │   └── utils.js         # Shared utilities (escapeHtml, showToast, etc.)
│   │
│   ├── services/        # Business logic modules
│   │   ├── supabase.js      # Database CRUD operations
│   │   ├── audio.js         # Audio playback
│   │   ├── kindle.js        # Kindle import
│   │   ├── ai.js            # Claude/OpenAI API calls
│   │   └── ai-jobs.js       # Background job tracking
│   │
│   ├── ui/              # UI modules
│   │   ├── modals.js        # Modal lifecycle (show/hide/reset)
│   │   ├── reading-pane.js  # Reading pane display
│   │   └── renders.js       # HTML rendering utilities
│   │
│   └── utils/           # Standalone utilities
│       └── kindle-parser.js # Kindle clippings parser
│
├── supabase/        # Database & serverless functions
│   ├── schema.sql       # Tables: saves, tags, folders, save_tags, user_preferences
│   ├── migrations/      # SQL migrations
│   └── functions/
│       ├── save-page/       # Server-side article extraction (Deno)
│       ├── save-kindle/     # Batch Kindle highlight import
│       └── send-digest/     # Weekly email digest (Resend)
│
├── tts/             # Text-to-speech generator (Python)
│   └── tts.py           # Edge TTS daemon, uploads to Supabase Storage
│
├── bookmarklet/     # Universal save bookmarklet
└── ios-shortcut/    # iOS Shortcut instructions for Safari
```

## Deployment

- **GitHub**: `asreynolds1000/alex-article-saver`
- **Vercel**: Project "stash" → https://stash.alexreynolds.com
- **Deploy**: Push to GitHub (auto-deploys) or `cd web && vercel --prod`

**Always check deployment status after pushing:**
```bash
# Check GitHub CI
gh run list --limit 1

# Check Vercel deployment via GitHub API
gh api repos/asreynolds1000/alex-article-saver/deployments --jq '.[0] | "\(.environment) - \(.created_at)"'
gh api repos/asreynolds1000/alex-article-saver/deployments/\(ID)/statuses --jq '.[0] | "\(.state) - \(.description)"'
```

## Configuration

Config files are gitignored. Copy from templates:
```bash
cp extension/config.example.js extension/config.js
cp web/config.example.js web/config.js
```

Both config files require:
- `SUPABASE_URL` - Project URL from Supabase dashboard
- `SUPABASE_ANON_KEY` - Anon/public key
- `USER_ID` - UUID from Supabase Auth > Users (single-user mode)

**Email allowlist**: Client-side in `web/app.js` (`this.allowedEmails`), server-side via `allowed_emails` table (see `supabase/migrations/001_email_allowlist.sql`).

## Database Schema

Main tables in `supabase/schema.sql`:
- **saves** - Articles, highlights (with `highlight` field), Kindle imports. Has FTS via `fts` tsvector column.
- **folders** - User-created folders
- **tags** / **save_tags** - Tagging system (many-to-many)
- **user_preferences** - Digest email settings

All tables use RLS policies keyed on `auth.uid() = user_id`.

## Development Commands

**Setup:**
```bash
npm install                    # Install dependencies
npx playwright install         # Install browser binaries for E2E tests
```

**Run web app locally:**
```bash
npm run dev                    # or: cd web && python3 -m http.server 3000
```

**Load Chrome extension:**
1. Go to `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → select `extension/` folder

**Testing:**
```bash
npm test                       # Run unit tests (Vitest)
npm run test:watch             # Run unit tests in watch mode
npm run test:e2e               # Run E2E tests (Playwright)
npm run test:e2e:headed        # Run E2E tests with browser visible
npm run lint                   # Run ESLint
npm run lint:fix               # Auto-fix lint issues
```

**Deploy Edge Functions:**
```bash
supabase login
supabase link --project-ref <project-id>
supabase functions deploy save-page
supabase functions deploy save-kindle
supabase functions deploy send-digest
```

**Run TTS generator:**
```bash
pip install edge-tts requests
python tts/tts.py --once    # Single run
python tts/tts.py           # Daemon mode (checks every 2 min)
```

## Key Patterns

- **Single-user mode**: Hardcoded `USER_ID` in config files bypasses auth flow. Remove `USER_ID` and enable Supabase Auth for multi-user.
- **Extension saves**: Uses client-side Readability extraction, falls back to injecting content script if not loaded.
- **Full-text search**: PostgreSQL `to_tsvector` with weighted fields (title=A, excerpt/highlight=B, content=C). Query via `search_saves(query, user_id)` RPC.
- **Kindle deduplication**: `save-kindle` function checks existing highlights by `highlight|||title` key before insert.
- **Theme**: `data-theme` attribute on `<html>`, persisted in localStorage as `stash-theme`.
- **ES6 modules + inline handlers**: Since `<script type="module">` scopes variables, `app.js` must expose the app globally with `window.app = app` for inline `onclick="app.method()"` handlers to work.
- **Centralized state**: All modules import from `lib/state.js`. The `StashApp` class uses proxy getters/setters for backwards compatibility (`get supabase() { return appState.supabase; }`).
- **AI tier-based model selection**: Users pick capability tiers (Fast/Balanced/Quality), not specific models. Models are dynamically resolved at request time from cached API responses. Cache auto-refreshes on app init.

## AI Model Tiers

The AI settings use a tier-based system that dynamically resolves to the best available model:

| Tier | Claude | OpenAI | Use Case |
|------|--------|--------|----------|
| **Fast** | Haiku | GPT-4o Mini | Quick responses, lower cost |
| **Balanced** | Sonnet | GPT-4o | Best balance (recommended) |
| **Quality** | Opus | o1 | Best results, slower |

**How it works:**
1. On app init, if API keys exist, models are fetched and cached in localStorage
2. At request time, `resolveModelForTier()` picks the best matching model from cache
3. Models are scored by version/date (newer = better)
4. Falls back to hardcoded defaults if no cache exists

**Key files:**
- `web/lib/utils.js` - `AI_TIERS`, `resolveModelForTier()`, `scoreModel()`
- `web/app.js` - `refreshModelCacheInBackground()`, tier UI handlers

## Edge Function Security

All Edge Functions implement:
- **JWT authentication**: Extract `user_id` from JWT token, not request body
- **CORS restrictions**: Only allow requests from known origins (Vercel app, localhost, Chrome extensions)
- **Single-user fallback**: If `SINGLE_USER_ID` env var is set and request `user_id` matches, allow without JWT (for bookmarklet/iOS shortcut)

The `verifyAuth()` helper validates either:
1. JWT token via Supabase Auth (preferred, multi-user mode)
2. `user_id` matching `SINGLE_USER_ID` env var (single-user mode for bookmarklets)

**Environment variables for Edge Functions:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` - Set automatically
- `SINGLE_USER_ID` - Set manually for single-user mode (your user UUID)
- `RESEND_API_KEY` - For weekly digest emails

## Project Status

**Completed improvements (Jan 2025):**
- Phase 1: Security fixes (credential protection, JWT auth, CORS restrictions, email allowlist)
- Phase 2: Testing infrastructure (Vitest, Playwright, ESLint, GitHub Actions CI)
- Phase 4: Modular architecture (10 new modules extracted from app.js)

**Remaining planned work:**
- Phase 3: Type safety (JSDoc annotations, type definitions)
- Phase 4 (cont.): Wire remaining app.js methods to modules
- Phase 5: Documentation updates, accessibility audit

**To resume work:** See `PROGRESS.md` for detailed status and next steps.

## Quick Reference

Project-specific values to remember across sessions.

| Item | Value |
|------|-------|
| **GitHub Repo** | `asreynolds1000/alex-article-saver` |
| **Vercel Project** | `stash` (prj_xs9ANWsiSQRXfNSLMed8hLYVQ7DP) |
| **Live URL** | https://stash.alexreynolds.com |
| **Supabase Project** | (check dashboard for project-ref) |
