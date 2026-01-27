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
│   └── config.js        # Supabase credentials + USER_ID
│
├── web/             # Web app (PWA)
│   ├── app.js           # Main app class: auth, CRUD, search, Kindle import
│   ├── config.js        # Supabase credentials + USER_ID
│   ├── index.html       # SPA with sidebar navigation
│   └── sw.js            # Service worker for offline support
│
├── supabase/        # Database & serverless functions
│   ├── schema.sql       # Tables: saves, tags, folders, save_tags, user_preferences
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

**Remaining planned work:**
- Phase 3: Type safety (JSDoc annotations, type definitions)
- Phase 4: Code quality (modularize app.js, accessibility audit)
- Phase 5: Documentation updates

**To resume work:** See `PROGRESS.md` for detailed status and next steps.
**Full plan:** `~/.claude/plans/serene-sprouting-castle.md`
