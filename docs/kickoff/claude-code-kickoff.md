# Claude Code Kickoff — How to Initiate the Build

## Step 0 — Founder setup (you, ~1 hour, no Claude Code)
1. Approve or amend **D-01** (name) and **D-02 / ADR-0001** (stack). Change ADR status to Accepted.
2. Merge this branch so `CLAUDE.md`, `.mcp.json`, `.claude/` and `docs/` are on `main`.
3. Install: Node LTS, pnpm, Supabase CLI, Docker Desktop (for local Supabase), Claude Code,
   Expo Go or a dev build on your phone.
4. Create accounts (dev/test only for now): Supabase (one **dev** project), Mux (test env),
   Anthropic API key, Vercel. Do **not** create production projects yet.
5. In your shell profile (not the repo): `export SUPABASE_DEV_PROJECT_REF=<dev ref>`.
6. Open the repo in Claude Code: `claude`. Approve the `supabase-dev` MCP server when prompted.
   Run `/context` to confirm CLAUDE.md loaded and `/skills` (or the `/` menu) to see the six skills.

## How to run each brief
- One brief per fresh session (`/clear` between briefs).
- Start in plan mode (`Shift+Tab` until "plan mode on"), paste the brief, review the plan, then
  approve. Ask for test output as evidence.
- Before merging security-relevant briefs: "Use the trust-safety-reviewer subagent on this diff."
- Commit on a branch per brief; open a PR; you merge.

---

## Brief 01 — Repository foundation  *(paste into Claude Code)*

**Objective.** Create the monorepo skeleton, tooling, CI, and local database so every later brief
has lint/typecheck/test gates and a reproducible local environment. No product features.

**Existing context (verified 2026-10-22).** Repo contains only `README.md`, `.gitignore`,
`CLAUDE.md`, `.mcp.json`, `.claude/` (settings, 6 skills, 1 agent), `docs/`, and `assets/`
(design images, superseded drafts). No `package.json`, no app code. Stack per ADR-0001 (Accepted).

**Scope.** May create: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, lint/format
config, `apps/web`, `apps/mobile`, `packages/contracts`, `supabase/` (via `supabase init`),
`.github/workflows/ci.yml`, `.env.example` files, root `README.md`. Must not modify: `assets/`,
`docs/adr/`, `.claude/skills/`, `.gitignore` (except appending), `CLAUDE.md` (except the Commands
section if a command name differs).

**Functional requirements.**
1. `apps/web`: Next.js (current stable, App Router, TypeScript strict). `GET /api/health` returns
   `{ status: "ok", version, commit }`. `/admin` placeholder page.
2. `apps/mobile`: Expo (current stable SDK, TypeScript, Expo Router). Home placeholder screen
   that calls `/api/health` via `EXPO_PUBLIC_API_URL` and shows the result.
3. `packages/contracts`: zod + exported `HealthResponse` schema used by both apps.
4. `supabase/`: initialized; first migration enables `postgis`; `supabase/tests/` with one pgTAP
   test asserting PostGIS is installed.

**Technical requirements.** Single pinned React version across workspaces (check Next.js and Expo
peer requirements; report what you chose and why). ESLint + Prettier + `tsc --noEmit` per workspace.
Vitest for unit tests. Root scripts: `dev`, `lint`, `typecheck`, `test`, `test:db`, `build`.
`.env.example` lists every variable with no real values.

**Security requirements.** No secrets in any committed file. Health endpoint exposes no env values
beyond version/commit. CI uses no production credentials.

**Implementation sequence.** (1) Inspect repo, report findings. (2) Workspace + base TS/lint config.
(3) contracts package. (4) web app + health route + test. (5) mobile app + health call.
(6) `supabase init`, PostGIS migration, pgTAP test. (7) CI workflow: install, lint, typecheck,
test, then start Supabase CLI and run DB tests. (8) README quickstart.

**Acceptance criteria.** From a clean clone: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`
pass; `supabase start && supabase db reset && supabase test db` pass; `pnpm --filter web dev` serves
`/api/health` 200; mobile app shows "ok" on a device/simulator; CI workflow file is valid.

**Validation.** Show the output of each command above. If you cannot run something (e.g., no
simulator), say so explicitly — do not claim it passed.

**Expected output.** Changed-file list, chosen versions with reasons, command outputs, open risks.

**Rollback.** Branch-only change; revert the PR. No remote resources touched.

---

## Brief 02 — Schema v1 + geo  *(paste after Brief 01 merges)*

**Objective.** Create the Phase I data model with RLS, location privacy, and tests.
Load skills `hucxster-db-migrations`, `hucxster-geo-radius`, `hucxster-event-taxonomy`.

**Scope.** `supabase/migrations/`, `supabase/seed.sql`, `supabase/tests/`, `packages/contracts/`.
No API routes or UI.

**Functional requirements — tables.** `profiles` (user_id, display_name, home_display_point,
home_area_label, age_confirmed_at), `app_roles`, `categories` (seeded tree), `listings` (seller_id,
title, description, price_cents, condition enum, category_id, status enum
draft/active/reserved/sold/removed, precise_point, display_point, area_label, primary_media_id,
deleted_at), `listing_media` (status enum per video skill), `threads` (listing_id, buyer_id, seller_id,
unique listing+buyer), `messages`, `blocks`, `reports`, `moderation_cases`, `audit_log`,
`safe_exchange_spots` (seeded for the test area), `events`, `user_consents`, `ai_calls`,
`rate_limit_counters`. Function `feed_local(...)` implementing `reference/feed-query.sql`.

**Security requirements.** RLS enabled on every table; select policies only for what clients may
read; `precise_point` and phone fields revoked from `anon`/`authenticated`; `feed_local` is
`security definer` with fixed `search_path` and returns no precise coordinates.

**Acceptance criteria.** `supabase db reset` succeeds from zero; pgTAP tests cover: 99 mi included,
101 mi excluded, radius clamp at 160,934 m, block exclusion both directions, keyset stability,
`precise_point` not selectable by `authenticated`, RLS denies cross-user reads of threads/messages.

**Validation / output / rollback.** Show `supabase test db` output. Local only; rollback = revert
PR and `supabase db reset`. Do not run `supabase db push`.

---

## Briefs 03–08 (condensed — Chair will expand each into a full brief when its turn comes)

| # | Brief | Objective | Key acceptance |
|---|---|---|---|
| 03 | Auth & profiles | Phone OTP sign-in, 18+ confirmation, profile + coarse area, roles, rate limits | Rate limits enforced; session in SecureStore; admin route denies non-admin |
| 04 | Video pipeline | Mux direct upload, signed webhook, state machine, signed playback | Signature rejection + idempotency tests; non-owner can't attach media |
| 05 | Listing creation + AI draft | Camera → upload → AI draft → seller edits → publish; prohibited-item check | Injection & prohibited fixtures pass; nothing publishes without confirm |
| 06 | Local feed + detail | Typed feed envelope, `feed_local`, bucketed distance, save | Only `listing` items emitted; no coordinates in responses |
| 07 | Messaging & safety | Item-linked threads, scam notices, block/report, safe spots | Blocked users fully invisible; message text never logged |
| 08 | Admin + scorecard + alpha gate | Moderation queue, audit log, liquidity scorecard, release checklist | trust-safety-reviewer: no blocking findings; all Phase I events flowing |

Phase I-A alpha begins when Brief 08's gate passes and the Founder approves release.
