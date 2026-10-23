# Claude Code Kickoff — How to Initiate the Build

Phase I is a **desktop web app in Chrome** (ADR-0008). There's no mobile or native work in these briefs.

## Step 0 — Founder setup (you, about 1 hour, no Claude Code)
1. Founder decisions D-01–D-04 and D-12–D-16 are done (2026-10-23). Nothing else blocks Brief 01.
2. Merge this branch so `CLAUDE.md`, `.mcp.json`, `.claude/`, `docs/` and `assets/images/brand/`
   are on `main`.
3. Install: Node LTS, pnpm, Supabase CLI, Docker Desktop (for local Supabase), Claude Code, and
   current Google Chrome.
4. Create accounts (dev/test only for now): Supabase (one **dev** project), Mux (test environment),
   an Anthropic API key, and Vercel. Do **not** create production projects yet. Don't point
   hucxter.app at anything until Phase I-B.
5. In your shell profile (not the repo): `export SUPABASE_DEV_PROJECT_REF=<dev ref>`.
6. Open the repo in Claude Code: `claude`. Approve the `supabase-dev` MCP server when prompted.
   Run `/context` to confirm CLAUDE.md loaded, and check the `/` menu for the seven skills.

## How to run each brief
- One brief per fresh session (`/clear` between briefs).
- Start in plan mode (`Shift+Tab` until "plan mode on"), paste the brief, review the plan, then
  approve. Ask for test output as evidence.
- Before merging security-relevant briefs, say: "Use the trust-safety-reviewer subagent on this diff."
- Commit on a branch per brief and open a PR; you merge.

---

## Brief 01 — Repository foundation + web shell  *(paste into Claude Code)*

**Objective.** Create the monorepo skeleton, tooling, CI, local database, and an empty Hucxter
desktop web shell, so every later brief has lint, typecheck, and test gates and a reproducible local
environment. No product features.

**Existing context (verified 2026-10-23).** The repo contains only `README.md`, `.gitignore`,
`CLAUDE.md`, `.mcp.json`, `.claude/` (settings, 7 skills, 1 agent), `docs/`, and `assets/` (design
references, brand icons in `assets/images/brand/`, superseded drafts). There's no `package.json` and
no app code. Stack per ADR-0001 as amended by ADR-0008 (desktop web only). UI per ADR-0007 and the
`hucxter-design-system` skill.

**Scope.** May create: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, lint/format
config, `apps/web`, `packages/contracts`, `supabase/` (via `supabase init`),
`.github/workflows/ci.yml`, `.env.example` files, and the root `README.md`. Must not modify:
`assets/`, `docs/adr/`, `.claude/skills/`, `.gitignore` (appending is fine), or `CLAUDE.md` (except
the Commands section if a command name differs). Must not add Expo, React Native, Electron, Tauri,
or any mobile tooling.

**Functional requirements.**
1. `apps/web`: Next.js (current stable, App Router, TypeScript strict).
   - `GET /api/health` returns `{ status: "ok", version, commit }`.
   - App shell per the design-system skill: left sidebar (Feed, Search, Sell, Messages, Saved, My
     Listings, Profile) and a toolbar, each linking to a placeholder page. Placeholder `/admin`.
     Light and dark mode via the CSS tokens in the skill.
   - Metadata: title "Hucxter"; favicons, apple-touch icon, and `manifest.webmanifest` built from
     `assets/images/brand/web/` (copied into `public/`). Origin from `APP_ORIGIN`.
   - Below 1280×720, show the "works best on a desktop browser" notice.
2. `packages/contracts`: zod, with an exported `HealthResponse` schema used by `apps/web`.
3. `supabase/`: initialized. The first migration enables `postgis`; `supabase/tests/` has one pgTAP
   test asserting PostGIS is installed.

**Technical requirements.** ESLint + Prettier + `tsc --noEmit` per workspace. Vitest for unit tests.
Playwright (Chromium) for e2e at 1440×900 and 1280×800, with an axe accessibility check. Root
scripts: `dev`, `lint`, `typecheck`, `test`, `test:e2e`, `test:db`, `build`. `.env.example` lists
every variable with no real values. Baseline security headers in `next.config` (CSP with nonce,
HSTS, `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy) per the trust-safety skill.

**Security requirements.** No secrets in any committed file; nothing secret in `NEXT_PUBLIC_*`. The
health endpoint exposes no env values beyond version and commit. CI uses no production credentials.

**Implementation sequence.**
1. Inspect the repo and report findings.
2. Workspace and base TS/lint config.
3. `packages/contracts`.
4. Web app, health route, and unit test.
5. App shell, tokens, and icons, with Playwright smoke + axe tests.
6. Security headers, with a test asserting they're present.
7. `supabase init`, PostGIS migration, and pgTAP test.
8. CI workflow: install, lint, typecheck, unit, e2e (Chromium), then start the Supabase CLI and run
   DB tests.
9. README quickstart.

**Acceptance criteria.**
- From a clean clone, `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`
  passes.
- `supabase start && supabase db reset && supabase test db` passes.
- `pnpm dev` serves `/api/health` with a 200, and the shell renders in Chrome with the Hx favicon in
  light and dark mode.
- axe reports no serious or critical violations.
- The CI workflow file is valid.

**Validation.** Show the output of each command above, plus Playwright screenshots (1440×900 light
and dark, 1280×800). If you can't run something, say so explicitly. Don't claim it passed.

**Expected output.** Changed-file list, chosen versions with reasons, command outputs, screenshots,
open risks.

**Rollback.** Branch-only change; revert the PR. No remote resources are touched.

---

## Brief 02 — Schema v1 + geo  *(paste after Brief 01 merges)*

**Objective.** Create the Phase I data model with RLS, location privacy, and tests.
Load the skills `hucxter-db-migrations`, `hucxter-geo-radius`, and `hucxter-event-taxonomy`.

**Scope.** `supabase/migrations/`, `supabase/seed.sql`, `supabase/tests/`, `packages/contracts/`.
No API routes or UI.

**Functional requirements — tables.**
- `profiles` (user_id, display_name, home_postal_code, home_display_point, home_area_label,
  age_confirmed_at)
- `app_roles`
- `postal_areas` (ZIP → coarse centroid + area label; seed the Phase I-B region from US Census
  ZCTA data, which is public domain, and note the source and vintage in the migration)
- `categories` (seeded tree)
- `listings` (seller_id, title, description, price_cents, condition enum, category_id, status enum
  draft/active/reserved/sold/removed, precise_point, display_point, area_label, primary_media_id,
  deleted_at)
- `listing_media` (status enum per the video skill)
- `threads` (listing_id, buyer_id, seller_id; unique listing + buyer)
- `messages`
- `blocks`, `reports`, `moderation_cases`, `audit_log`
- `safe_exchange_spots` (seeded for the test area)
- `events`, `user_consents`, `ai_calls`, `rate_limit_counters`
- `notification_preferences` (channels per D-18; default web only)

Also add a function `feed_local(...)` that implements `reference/feed-query.sql`.

**Security requirements.** RLS enabled on every table, with select policies only for what browsers
may read. `precise_point` and phone fields are revoked from `anon` and `authenticated`. `feed_local`
is `security definer` with a fixed `search_path` and returns no precise coordinates. Messages and
threads are readable only by their two participants, which Realtime relies on.

**Acceptance criteria.** `supabase db reset` succeeds from zero. pgTAP tests cover:
- a listing at 99 mi is included and one at 101 mi is excluded
- the radius clamps at 160,934 m
- blocks exclude in both directions
- keyset pagination is stable
- `precise_point` isn't selectable by `authenticated`
- RLS denies cross-user reads of threads and messages
- a ZIP lookup returns a coarse point and label

**Validation / output / rollback.** Show the `supabase test db` output. Local only; rollback is
reverting the PR and running `supabase db reset`. Don't run `supabase db push`.

---

## Briefs 03–08 (condensed; the Chair will expand each into a full brief when its turn comes)

| # | Brief | Objective | Key acceptance |
|---|---|---|---|
| 03 | Auth, sessions & profiles | Phone OTP + bot challenge, SSR cookie sessions, CSRF origin checks, 18+ confirmation, ZIP area, roles, rate limits, sessions list, account deletion | Cookies httpOnly/Secure/SameSite; CSRF test rejects cross-origin POST; admin route denies non-admin; deleting an account removes data and revokes sessions |
| 04 | Video pipeline | Mux direct upload from the browser (resumable), signed webhook, state machine, Mux Player signed playback | Signature rejection + idempotency tests; non-owner can't attach media; a large-file upload resumes after a network drop |
| 05 | Sell flow + AI draft | Drag-and-drop upload (+ phone handoff if D-17 is approved) → AI draft → seller edits → publish; prohibited-item check | Injection and prohibited fixtures pass; nothing publishes without confirmation; keyboard-only completion works |
| 06 | Local feed + detail | Typed feed envelope, `feed_local`, video column + detail panel, keyboard shortcuts, save | Only `listing` items emitted; no coordinates in responses; muted autoplay; reduced-motion respected |
| 07 | Messaging & safety | Item-linked threads with Realtime, scam notices, block/report, safe spots, notifications per D-18 | Blocked users fully invisible; message text never logged; a notification fires when the tab is closed (if web push is chosen) |
| 08 | Admin + scorecard + alpha gate | Moderation queue, audit log, liquidity + desktop-fit scorecard, release checklist | trust-safety-reviewer: no blocking findings; all Phase I events flowing |

Phase I-A alpha begins when Brief 08's gate passes and the Founder approves release.
