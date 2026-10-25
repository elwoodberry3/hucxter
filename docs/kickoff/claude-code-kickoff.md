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

## Brief 01 — Repository foundation + web shell  ✅ *Merged 2026-10-24 (PR #2)*

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

## Brief 02 — Storefront layout + category taxonomy  *(paste into Claude Code)*

**Objective.** Replace the Brief 01 sidebar shell with the Hucxter storefront the Founder approved
in grooming (ADR-0009): a full, vibrant, honest storefront that guests can browse with no data in
the system, and with every action gated behind sign-in. Add the category taxonomy as database data
that drives navigation and filters. No real authentication, listings, or video yet.

**Existing context (verified 2026-10-24 on `main` @ e08266e).**
- `apps/web` has a `(shell)` route group with a left sidebar (`components/sidebar-nav.tsx`,
  `nav-items.ts`, `app-shell.tsx`, `shell.module.css`) and placeholder pages.
- Also present: per-request nonce CSP in `src/proxy.ts`, an env check in `src/lib/env.ts`,
  Playwright e2e (shell, a11y, headers), and `packages/contracts` with `HealthResponse`.
- Supabase has one migration (PostGIS) and a pgTAP test.
- Read first: `CLAUDE.md`, ADR-0009, `docs/specs/storefront-ia.md`,
  `docs/specs/category-taxonomy.md`, and the skills `hucxter-design-system`, `hucxter-geo-radius`
  (guest location rule 7), `hucxter-event-taxonomy`, `hucxter-db-migrations`, and
  `hucxter-trust-safety` (open-redirect rule).

**Scope.**
- May modify: `apps/web/**`, `packages/contracts/**`, and `supabase/migrations|seed.sql|tests`.
- May append: `README.md` and CLAUDE.md's "Repository state" section.
- Must not modify: `assets/`, `docs/adr/`, `docs/specs/`, `.claude/`.
- Must not add: real auth providers, listings/media/messaging tables, ads, analytics vendors, or
  mobile tooling.

**Functional requirements.**
1. **Remove the app sidebar** and the duplicate search. Implement the global header, category bar,
   mega menu, account control (guest **Sign in**; the member menu is a stub until Brief 03), and
   big footer per `storefront-ia.md` §1, §2, and §6.
2. **Taxonomy as data:**
   - Migration creating `categories` (id, slug unique, parent_id, name, sort, is_active, hero_key,
     attributes jsonb, timestamps), with RLS on and public select of active rows only.
   - `seed.sql` loads the 14 departments and their subcategories from `category-taxonomy.md`.
     Motor vehicles are excluded (D-24 default).
   - `packages/contracts/taxonomy.ts` holds zod schemas for categories and the attribute-filter
     schema.
   - The app reads categories server-side and caches them; no hard-coded nav arrays.
3. **Home `/`**:
   - Hero carousel: max 3 house slides, no autoplay by default, pause control, reduced-motion
     safe.
   - Shop-by-category card grid (all departments).
   - "Near you" rails that render **designed invitation cards** when empty.
   - Promo strip.
   - One in-feed slot rendered via the typed feed envelope as a house promo labeled
     **"Promoted by Hucxter"** (D-30).
   - Art: in-repo SVG/CSS placeholders only (D-28).
4. **Category index** `/c/[dept]` and `/c/[dept]/[sub]`:
   - Subcategory chips, breadcrumb, hero banner.
   - Left filter panel: common filters + the department's attribute filters, with state in the
     URL query.
   - Sort select and results grid component.
   - Designed empty state (no listings exist yet).
   - Unknown slug returns 404.
5. **Search** `/search?q=` uses the same results layout and empty state, with the query echoed
   safely.
6. **Product page template:**
   - Build the `/l/[id]` layout per `storefront-ia.md` §5: video column, detail column, "Is this
     still available?", status badge (Available / Pending: someone's on the way / Sold), seller
     card, Meet safely panel.
   - `/l/[id]` returns 404 for now (no listings table).
   - Render the template at **`/dev/templates/listing`** with a typed demo fixture visibly labeled
     **"Demo"**. This route must 404 when `APP_ENV=production` (add `APP_ENV` to the env schema),
     with a test proving it.
7. **Guest location:**
   - Location chip + popover: ZIP entry with validation, radius select (1–100 mi), "Use my current
     location" (browser geolocation, user-initiated).
   - Default from Vercel IP headers when present, else `DEFAULT_AREA_ZIP`. Shown as "Near
     {City} {ZIP}?" until confirmed.
   - Stored in a first-party cookie (ZIP + radius only).
   - Add the `postal_areas` table plus seed data for the North Texas test region from US Census
     ZCTA data (public domain; note source and vintage). This is used to turn a ZIP into an area
     label.
8. **Sign-in gating (UI only):**
   - `/sign-in` and `/sign-up` pages, plus a **sign-in sheet** offering **Continue with email ·
     Continue with Facebook · Continue with TikTok**. The buttons are present but show "Available
     in the next release" until Brief 03, and are covered by tests.
   - Gated routes (`/sell`, `/messages`, `/saved`, `/listings`, `/profile`, `/settings`) redirect
     to `/sign-in?next=…`. Gated actions on pages open the sheet.
   - `next` must be a same-origin relative path; reject anything else.
9. **"Coming soon" page** for footer links to pages that don't exist yet. No dead 404 links in
   header, footer, or mega menu.

**Technical requirements.**
- Server Components by default. Client components only for mega menu, carousel, location popover,
  sign-in sheet, and filter panel interactions.
- Everything keyboard-operable per the design skill (mega menu arrow keys, Esc, focus return).
- CSP stays strict: no inline styles in production, images from `'self'` only.
- Typed feed envelope (`listing` | `creator_post` | `sponsored`) in `packages/contracts/feed.ts`;
  the home page renders through it.
- Analytics: add the `track()` contract and event types from the event skill (no vendor; log to
  console in dev, no-op in test). Emit `category_viewed`, `mega_menu_opened`, `hero_clicked`,
  `location_changed` (ZIP only), `filter_applied`, `sign_in_prompted`.
- Copy honesty: no inventory-size claims, no fake counts, ratings, or listings outside the
  `/dev` fixture.

**Security requirements.**
- No open redirects (unit-test `next` handling with absolute URLs, `//host`, encoded variants).
- The location cookie is ZIP + radius only: `SameSite=Lax`, `Secure` in production.
- IP-derived data is never logged or sent to analytics beyond the ZIP.
- `/dev/*` returns 404 in production.
- The `categories` and `postal_areas` RLS allows public read of active rows only, with no writes
  from anon or authenticated users.

**Implementation sequence (one commit each).**
1. Inspect the repo and report findings.
2. Taxonomy migration + seed + pgTAP tests + contracts.
3. `postal_areas` migration + seed + lookup function + tests.
4. Header, category bar, mega menu, account control, footer. Remove the sidebar.
5. Home page sections + feed envelope.
6. Category index + search layout + filter panel (URL state) + empty states.
7. Product template + `/dev/templates/listing` + production 404 test.
8. Location chip/popover + cookie + IP default.
9. Sign-in/sign-up pages + sheet + route gating + `next` validation.
10. Coming-soon page.
11. Update e2e (replace sidebar tests), a11y, and screenshots.
12. README + CLAUDE.md Repository state.

**Acceptance criteria.**
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` and
  `supabase db reset && supabase test db` pass.
- No sidebar anywhere.
- As a guest at 1440×900 the home page shows a hero, all 14 category cards, rails with invitation
  cards, the promo strip, the "Promoted by Hucxter" slot, and the full footer. Nothing looks broken
  or blank.
- Mega menu works by mouse and keyboard.
- Every category and subcategory URL renders with filters and an empty state.
- Filters round-trip through the URL.
- Every gated route and action leads to sign-in and back via `next`.
- `/dev/templates/listing` renders locally and 404s with `APP_ENV=production`.
- axe: zero serious or critical violations on home, a category, a subcategory, search, sign-in,
  coming-soon, and the template page, in light and dark mode.
- CSP violation test still passes.

**Validation.** Show every command's output. Provide Playwright screenshots (CI artifact): home
1440 light/dark, home 1280, mega menu open, category index, product template, sign-in sheet. If
something can't run, say so; never claim a pass without output.

**Expected output.** Branch `brief-02-storefront`. PR to `main` (don't merge) containing:
changed-file list, screenshots, test output, `trust-safety-reviewer` findings (redirects, cookies,
`/dev` gating, RLS), open risks, and follow-ups.

**Rollback.** Revert the PR. The migrations are additive (new tables only); locally, run
`supabase db reset`. Nothing remote is touched.

---

## Briefs 03–09 (resequenced 2026-10-24; the Chair expands each when its turn comes)

| # | Brief | Objective | Key acceptance |
|---|---|---|---|
| 03 | Accounts & verification (ADR-0010) | Email one-time code + Facebook + **TikTok spike** (D-26); required phone SMS verification, 18+, home ZIP; profiles, roles, sessions list, sign out everywhere, account deletion; Turnstile on sign-up and OTP | Unverified users can't act; `next` returns users to the action; open-redirect and CSRF tests; provider data minimal; account deletion revokes sessions |
| 04 | Marketplace schema + geo | Listings (status Available/Pending/Sold, attributes validated by category schema), media, threads, messages, blocks, reports, moderation, audit, events, consents; `feed_local`; wire home rails, category index, search, and `/l/[id]` to real data | Radius, privacy, block, and RLS pgTAP tests (the former Brief 02 criteria); no coordinates in responses |
| 05 | Video pipeline | Mux direct upload (resumable), signed webhooks, state machine, Mux Player with CSP updates | Signature and idempotency tests; non-owner can't attach media |
| 06 | Sell flow + AI draft | Upload (+ phone QR handoff if D-17 is approved) → AI draft → seller edits → publish; prohibited-item check | Injection and prohibited fixtures pass; nothing publishes without confirmation |
| 07 | Messaging & listing status | "Is this still available?" one-tap thread; live chat (Realtime); Pending/Sold flow with confirmation prompt (D-27); safety notices; notifications (D-18) | Blocked users invisible; message text never logged; status history recorded |
| 08 | Admin + scorecard | Moderation queue, audit log, liquidity + desktop-fit scorecard | Role-gated; every action audited |
| 09 | Alpha gate | Release checklist, trust-safety review, QA abuse script | No blocking findings; Founder approves Phase I-A |
