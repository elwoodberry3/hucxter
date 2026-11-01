# Brief 03 — QA Release 1: mobile web, accounts, selling, and the QA deployment

**From:** Advisory Board Chair · **Date:** 2026-10-31 · **Repo state verified:** `main` @ `dbfe59a`
(Brief 02 merged via PR #7, 2026-10-30)
**Supersedes** the Brief 03–06 rows in `docs/kickoff/claude-code-kickoff.md` for this release.
**How to run:** this brief is too large for one session. Work **one milestone per session**, in
order (3A → 3B → 3C → 3D → 3E). At the end of each milestone, open a PR, report, and **stop**. The
Founder merges, then starts a fresh session with: *"Continue Brief 03, Milestone 3X. Read
`docs/kickoff/brief-03.md` first."* Start every session in plan mode.

---

## 0. Decisions this brief implements (Founder, 2026-10-31)

| ID | Decision | Status |
|---|---|---|
| D-34 | Sign-up is **email one-time code or Google**, then required **phone SMS verification**, **18+ attestation**, and **home ZIP**. Facebook and TikTok are removed. Supersedes D-25, D-26, D-33 | Decided |
| D-35 | Phase I-B launch area: **Portland–Vancouver metro**. Coverage = 30 mi from ZIP 97205 (radius is the Chair's proposal; it's data, so it's easy to change) | Area decided; radius proposed |
| D-36 | Any valid US ZIP can be set by anyone, any time. Default for guests with no other signal is the launch area (97205), not Texas | Decided |
| D-37 | **Mobile web is a first-class Phase I surface** to the standard in `docs/standards/mobile-experience-standard.md`, adapted by §2 below. Amends ADR-0007, ADR-0008, ADR-0009 | Decided |
| D-41 | The next QA build is hosted on Vercel for the QA team (invite-only) | Decided |

Open items with Chair defaults (build with the default unless the Founder has said otherwise):
D-38 styling stays **CSS Modules + CSS custom-property tokens** (no Tailwind migration) · D-08 SMS =
**Twilio Verify** via Supabase, bot challenge = **Cloudflare Turnstile** · D-39 transactional email
= a custom SMTP provider chosen by the Founder · D-40 QA URL = `qa.hucxter.app` on a Vercel **Pro**
team · D-05 video limits `MEDIA_MAX_SECONDS=60`, `MEDIA_MAX_BYTES=524288000` · default radius 25 mi.
If a D-38/D-39/D-40 answer changes, stop and ask before building on it.

## 1. Objective
Ship **QA Release 1** to a hosted URL so the internal QA team can, on their own phones and
computers: create a verified account, set a home ZIP anywhere in the US, post a real item with a
real video, manage its status, and discover listings in a mobile-quality video feed and storefront.
Messaging, AI drafts, payments, and creators are **not** in this release.

Why: posting supply is the first half of the liquidity loop, and the QA team needs a real URL on
real devices to test it. Mobile web also removes the biggest desktop-first risk recorded in
ADR-0008 (sellers film on phones): a phone browser can record and upload directly.

## 2. How the Mobile Experience Standard applies to Hucxter (read before any UI work)
The standard is adopted **except** where it conflicts with the zero-shipping, no-payments Phase I
product. These rules win over the standard's text:
- **No** cart, Buy Now, bids, offers, shipping, taxes, returns, checkout, or payments (D-09). The
  standard's "transaction" step means: see price, condition, status, pickup area, seller, then
  **"Is this still available?"** (disabled in this release, labelled "Messaging arrives in the
  next QA build") and Save/Share/Report.
- "Dynamic scarcity" means **real** status only (Available / Pending: someone's on the way / Sold).
  No countdowns, "X people viewing," or invented urgency.
- "Reviews where genuine": none exist; show none.
- Styling: keep CSS Modules + tokens (D-38). Meet §9's intent (tokens, variants, no one-off values,
  documented states) without Tailwind.
- Bottom navigation is a **mobile** pattern. Desktop keeps the ADR-0009 storefront header.
- Apple HIG remains the baseline (ADR-0007): iOS HIG patterns at phone widths (tab bar, sheets,
  44 pt targets), macOS patterns at desktop widths.

## 3. Existing context (verified on `main` @ dbfe59a; re-verify before changing anything)
- `apps/web`: Next.js 16.4.2, React 19.3, CSS Modules, per-request nonce CSP in `src/proxy.ts`,
  env schema in `src/lib/env.ts` (`APP_ENV` local|qa|production, `VERCEL`, `DEFAULT_AREA_ZIP`).
- Storefront per ADR-0009: `components/store/*` (header, category bar, mega menu, footer,
  location chip), home, `/c/[dept]`, `/c/[dept]/[sub]`, `/search`, `/l/[id]` (404s), product
  template at `/dev/templates/listing`, sign-in sheet with email/Facebook/TikTok buttons marked
  "Available in the next release", gated routes via `lib/auth-gate.ts` and `lib/next-path.ts`.
- `components/store/store-shell.tsx` shows "Hucxter works best on a desktop browser" below
  1280×720 (`layout.module.css` `.desktopNotice`). CLAUDE.md and `hucxter-design-system` say
  "no mobile layouts in Phase I". Both change in 3A.
- Supabase via `@supabase/supabase-js` with the publishable key, server-side reads only. No
  `@supabase/ssr`, no auth, no user tables yet.
- `postal_areas`: Census 2020 ZCTA, **North Texas only** (~300 ZIPs), labels = largest-overlap
  Census place, points rounded; `postal_area_lookup`, `postal_area_nearest` (fixed 40 km).
  Categories and postal areas load **only from `supabase/seed.sql`**, so a cloud database gets
  neither (Brief 02 handoff item 3).
- `viewer-location.ts`: cookie → Vercel IP ZIP → `DEFAULT_AREA_ZIP` (currently 75009).
- Playwright: Chromium only, 1440×900 and 1280×800. CI starts local Supabase without Mailpit.
- `.claude/settings.json` asks before `pnpm add`, `supabase link`, `supabase db push`, `git push`,
  `vercel *`. Keep it that way.

## 4. Scope (whole release)
**May modify:** `apps/web/**`, `packages/contracts/**`, `supabase/**` (new migrations only; never
edit an applied migration), `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md` (Repository state,
Commands, Stack, Design direction, and the viewport rule in Code conventions), `.claude/skills/*`
where this brief says so, `docs/adr/` (new ADR-0011, status amendments on 0008/0009/0010),
`docs/decisions/open-decisions.md`, `docs/strategy/phased-roadmap.md` (Phase I-A sign-up line and
I-B launch area only), `docs/specs/storefront-ia.md` (sign-in methods and a mobile section),
`docs/runbooks/`, `docs/standards/`, `docs/kickoff/`.
**Must not:** add Facebook/TikTok/Apple login, messaging, AI drafts or the Anthropic SDK, payments,
shipping, ads, creator features, a native or Expo app, Tailwind, Redis, or any analytics vendor;
connect to or modify a remote Supabase project or Vercel project except in 3E with the Founder's
in-session approval; read or print any `.env*` file or secret.

## 5. Global requirements (apply to every milestone)
**Security.** Single write path through `apps/web` server code validated with `packages/contracts`;
RLS on every table. Cookie-authenticated mutations check `Origin` against `APP_ORIGIN`. Sessions
via `@supabase/ssr` with httpOnly, Secure (non-local), SameSite=Lax cookies; no tokens in
`localStorage`. The service-role key is used only in `src/server/admin-db.ts` (`server-only`), and
only by webhooks, jobs, account deletion, and admin actions; add a test or lint rule that fails if
any other module imports it. No secret in any `NEXT_PUBLIC_*` variable. No precise coordinates in
any response. No user content rendered as HTML. Message bodies don't exist yet; phone numbers and
emails are never logged or sent to analytics.
**Accessibility.** WCAG 2.2 AA; axe zero serious/critical in light and dark at desktop and mobile
widths; every gesture has a button/keyboard alternative; sheets trap focus, close on Esc/back, and
return focus; respect `prefers-reduced-motion`; no pinch-zoom lock.
**Honesty.** No fabricated listings, counts, ratings, or scale claims. Demo data exists only in
local seed, labelled "Demo", and never in migrations.
**Evidence.** Show the command and output for every claim. If something can't run here (physical
devices, real SMS, Google consent, Vercel), say so and list it as a manual QA step.
**Commits.** One commit per numbered step. Branch per milestone: `brief-03a-mobile`,
`brief-03b-accounts`, `brief-03c-sell`, `brief-03d-discover`, `brief-03e-qa-deploy`.
**Dependencies.** Ask before each `pnpm add`; state why, the version, and that it passes the
supply-chain minimum-release-age check. Expected: `@supabase/ssr`, `@mux/mux-node`,
`@mux/mux-player-react`, `@mux/mux-uploader-react` (or `@mux/upchunk`). Verify current APIs in
official docs and record what you verified in the PR.
**Before each PR:** run the `trust-safety-reviewer` subagent on the diff; fix Critical/High; list
Medium/Low.

---

## Milestone 3A — Decisions, mobile foundation, nationwide ZIPs, Portland default
**Branch** `brief-03a-mobile`. No auth, no listings.

**Functional requirements**
1. **Docs first.**
   - Commit this brief as `docs/kickoff/brief-03.md` and the Founder's standard as
     `docs/standards/mobile-experience-standard.md` (the Founder will place the file in the repo
     root or paste it; ask if it's missing).
   - Write **ADR-0011 "Mobile web is a first-class Phase I surface"** (D-37): what changes, §2's
     adaptation rules, and consequences (D-17 is largely solved by in-browser camera capture;
     D-18 still needs a decision; Phase IV/V order unchanged).
   - Amend ADR-0008/0009 status lines to point at ADR-0011. Amend ADR-0010 (D-34: email + Google;
     Facebook/TikTok removed; the Sign in with Apple note for Phase V still stands).
   - Update `open-decisions.md` (move D-25/D-26/D-33 to superseded; add D-34–D-41), the roadmap
     I-A sign-up line and I-B launch area, `storefront-ia.md` sign-in methods, CLAUDE.md, and the
     `hucxter-design-system` skill (remove "no mobile layouts" and the 1280 notice; add the mobile
     rules below; touch targets ≥ 44×44 CSS px).
2. **Responsive shell, mobile-first** (content-based breakpoints in `rem`, not device names):
   - Remove the "best on a desktop browser" notice.
   - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
     via Next.js `viewport` export; never `maximum-scale`/`user-scalable=no`.
   - **Phone widths:** compact sticky header (Hx mark, location chip, search field or search
     button that opens a full-screen search), horizontally scrollable category chips, and a
     **bottom tab bar**: Home · Discover · Sell · Inbox · Account. Safe-area insets on the tab bar,
     sticky action bars, and sheets. Hide the tab bar while the on-screen keyboard is up if it
     would cover inputs.
   - Mega menu becomes a full-screen "All categories" sheet with department → subcategory drill-in.
   - Filter panel becomes a bottom-sheet **FilterDrawer** with Apply/Clear; URL state unchanged.
   - Footer collapses to accordions.
   - Product template: video on top (9:16, height capped so price is visible without scrolling),
     detail below, **sticky bottom action bar** (primary action + Save/Share).
   - **Desktop widths:** keep ADR-0009 exactly; add **Discover** to the header.
   - Use `100dvh`/`100svh`, never bare `100vh`, for full-height surfaces.
3. **Reusable primitives** (CSS Modules + tokens): `BottomSheet` (peek/expanded, drag handle with
   a button alternative, focus trap, scroll containment, closes via Esc, back, and close button),
   `TabBar`, `FilterDrawer`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`. Add semantic
   elevation tokens (`--z-header`, `--z-tabbar`, `--z-sheet`, `--z-dialog`, `--z-toast`); no raw
   z-index values in components. Back-button closes a sheet by pushing a history entry when the
   sheet opens.
4. **Nationwide ZIPs (D-36).** New migration (do not edit the Brief 02 one) that loads **every**
   2020 Census ZCTA using the same sources and labelling method as Brief 02 (largest-overlap
   Census place, else "<County> County"; point rounded to 3 decimals). Load it as a **data
   migration**, not `seed.sql`, so cloud databases get it. Do the same for `categories` (move the
   seed into an idempotent data migration; keep `seed.sql` for local-only demo data). Record
   source URLs, vintage, download date, and row count in the migration header. Keep
   `postal_area_nearest`'s fixed 40 km rule.
   - A ZIP that isn't a ZCTA (PO-box-only and some business ZIPs) is rejected with: "We couldn't
     find that ZIP. Try the ZIP where you live or pick up items."
5. **Launch area (D-35).** Table `service_areas` (slug, name, center_zip, radius_mi, is_launch,
   is_active), seeded by data migration with `portland-vancouver`, "Portland–Vancouver", 97205,
   30 mi, launch. Function `in_launch_area(zip)` (server-side; never returns points).
   - When the viewer's ZIP is outside every launch area, show a dismissible, non-blocking notice:
     "Hucxter is starting in Portland–Vancouver. You can still browse and post here." No feature is
     blocked by location.
6. **Default location.** Order: confirmed cookie → (from 3B) member home ZIP → Vercel IP ZIP →
   `DEFAULT_AREA_ZIP`. Change `.env.example` and the local default to `97205`. The guess stays
   labelled ("Near Portland 97205?").

**Tests**
- Playwright projects: `desktop-1440`, `desktop-1280` (Chromium), `mobile-chromium` (Pixel 7
  device profile), `mobile-webkit` (iPhone 15 profile). Install WebKit in CI.
- Overflow test: no horizontal scroll on home, category, search, product template, sign-in at
  320, 360, 375, 390, 414, 430 CSS px.
- Tab bar, all-categories sheet, FilterDrawer (URL round-trip), sheet back-button dismissal, focus
  return, 44×44 target size check on primary controls, reduced-motion.
- axe on all pages at desktop and mobile, light and dark.
- pgTAP: ZCTA count matches the source file; 97205, 98660 (Vancouver WA), 10001, 99501, 96813
  resolve; a non-ZCTA ZIP doesn't; `in_launch_area` true for 97205/98660, false for 75009; no
  function returns a point to anon/authenticated.

**Acceptance:** every Brief 02 test still passes (update only tests whose behavior this milestone
intentionally changes, and list them); screenshots at 1440 and 390 (light/dark) for home, category
with FilterDrawer open, all-categories sheet, product template.

---

## Milestone 3B — Accounts and verification (D-34)
**Branch** `brief-03b-accounts`. Load `hucxter-trust-safety` first.

**Functional requirements**
1. **Sign-in sheet/pages:** "Continue with Google" and "Continue with email" only. Email = 6-digit
   one-time code (no passwords, no magic-link-only flow). Google = Supabase built-in provider with
   PKCE, scopes `openid email profile` only.
2. **Onboarding gate** (`/welcome`, resumable, required before any action):
   1. Email confirmed (automatic for both methods).
   2. **Phone:** enter US mobile number → SMS code → verify (Supabase `updateUser({ phone })` +
      `verifyOtp({ type: 'phone_change' })`). One account per phone; a number already in use shows
      a neutral error that doesn't reveal the other account.
   3. **18+ attestation** checkbox with the copy "I'm 18 or older." Store `age_attested_at`; no
      date of birth.
   4. **Home ZIP:** "What's your home ZIP?" prefilled from the current location chip; any valid US
      ZIP. Saved to the profile and becomes the member default.
   5. Display name (first name or nickname; 2–40 chars; no URLs/phone numbers/emails).
   - Then return to the safe `next` path and complete the intended action.
3. **Verified = all four** (`email_confirmed`, `phone_verified`, `age_attested`, `home_zip`). One
   server helper `requireVerifiedMember()` used by every gated route and action; unverified members
   are sent to `/welcome?next=…`.
4. **QA invite gate:** when `INVITE_ONLY=true`, only emails in `qa_invites` (case-insensitive,
   admin-managed) can finish sign-up; others see "Hucxter is in a closed test. Ask the team for an
   invite." Enforced server-side at onboarding (and in a Supabase before-user-created hook if
   available; verify in docs). Default `true` for `APP_ENV=qa`.
5. **Account menu / settings:** profile (display name, home ZIP), phone (change requires a new
   code), sign out, **sign out everywhere** (`scope: 'global'`), active sessions list (device and
   created time only; no IP shown), **delete account** (typed confirmation; revokes sessions;
   deletes profile now, and listings/media once 3C exists; written to `audit_log`).
6. **Location for members:** the chip changes the browsing ZIP for this browser (cookie); Settings
   changes the home ZIP. Both accept any valid US ZIP.
7. **Roles:** `app_roles` (user/moderator/admin). `/admin` checks the role server-side on every
   request. The first admin is granted by SQL in the runbook, never via the UI.
8. **Bot resistance:** Turnstile on email-code send and phone-code send through Supabase's captcha
   support, behind `CAPTCHA_PROVIDER` (`turnstile` | `none`; `none` forbidden when
   `APP_ENV=production`). Supabase OTP rate limits configured in `supabase/config.toml` for local;
   document the cloud values for 3E.

**Data:** `profiles` (id = auth user id, display_name, home_zip → postal_areas, age_attested_at,
created_at, updated_at, deleted_at), `app_roles`, `qa_invites`, `audit_log` (actor, action,
target, reason, created_at; append-only). RLS: members read/update their own profile through
server code; nobody can write roles via the API.

**Local/CI:** enable phone auth in `config.toml` with `[auth.sms.test_otp]` fixed codes for test
numbers; start Mailpit in CI so e2e can read email codes. Google can't be e2e-tested here: unit-test
the callback route (state, PKCE, safe `next`, error paths) and list Google as manual QA.

**Tests:** email sign-up → phone → 18+ → ZIP → returns to `next` and completes the action;
unverified member blocked from every gated route and action; invite gate on/off; duplicate phone;
open-redirect suite (absolute, `//host`, encoded, backslash) still passes; CSRF origin check on
every new mutation; sign out everywhere invalidates another context's session; account deletion
revokes sessions and blocks sign-in with the old session; 320–430 px layout of every onboarding
step with the keyboard open (WebKit); phone input uses `type="tel"`,
`autocomplete="tel"`, code input `inputmode="numeric" autocomplete="one-time-code"`.

---

## Milestone 3C — Listings, video upload, and selling
**Branch** `brief-03c-sell`. Load `hucxter-db-migrations`, `hucxter-geo-radius`,
`hucxter-video-pipeline`, `hucxter-event-taxonomy`.

**Functional requirements**
1. **Sell flow** (`/sell`, verified members only), mobile-first, one screen per step with a
   progress indicator and a draft that survives reload:
   1. **Video:** "Record a video" (`<input type="file" accept="video/*" capture="environment">` on
      phones) or "Choose a video" (file picker; drag-and-drop on desktop). Client-side checks for
      type (`video/mp4`, `video/quicktime`, `video/webm`), size, and duration against
      `MEDIA_MAX_BYTES`/`MEDIA_MAX_SECONDS`, with plain-language errors.
   2. Upload directly to Mux (resumable, chunked) with progress, pause/retry, and a
      leave-page warning. Our server never receives the file.
   3. **Details:** title (≤ 80), category → subcategory (from `categories`), condition, price in
      whole dollars or **Free** (Free Stuff forces $0), category attributes validated against the
      category's schema, description (≤ 2,000, plain text), pickup ZIP (defaults to home ZIP; any
      valid US ZIP).
   4. **Review & publish:** preview card + listing page, safety reminder ("Meet in a public place"),
      Publish. Publish is allowed only when media is `ready`; while processing, offer "Publish when
      ready" (auto-publishes on the `ready` webhook) or save as draft.
2. **Prohibited-item check** at publish: a config keyword list (weapons/ammunition, drugs,
   alcohol/tobacco/vapes, live animals, adult content, recalled items, counterfeit) applied to
   title + description. A match sets `review_state='needs_review'`: visible only to the owner
   ("We're reviewing this listing") and admins. Final list is D-07; keep it in one config file.
3. **My listings** (`/listings`): drafts, processing, live, in review, sold. Actions: edit (title,
   price, description, attributes, condition, category), mark **Pending: someone's on the way**,
   **They didn't show** (→ Available), mark **Sold**, delete (soft delete + Mux delete job). Every
   status change is time-stamped in `listing_status_history`.
4. **Wire real data** into home rails ("New near {area}", "Free stuff near you", featured
   departments), category index, search (title/description, simple Postgres full-text), and
   `/l/[id]`. Empty states remain when there's nothing nearby. Listing cards and the product page
   show poster, price/Free, title, condition, **distance bucket**, area label, status badge.
5. **Report** on `/l/[id]` (reason enum from the trust-safety skill + optional note) → `reports`.
   **Admin:** `/admin` lists open reports and `needs_review` listings; actions approve, remove
   listing (revokes playback), dismiss report; every action in `audit_log`.
6. **Events** (first-party, no vendor): server-side `track()` writes to an `events` table with no
   PII: `sell_started`, `upload_started`, `upload_completed`, `upload_failed` (reason code),
   `listing_published`, `listing_status_changed`, `listing_viewed`, `report_submitted`,
   `sign_up_completed`, `phone_verified`. These power the draft-to-publish and upload-failure
   metrics in the roadmap.

**Data (new migrations):** `listings` (seller_id, category_id, title, description, price_cents,
condition, attributes jsonb, status, review_state, pickup_zip, `precise_point` and `display_point`
per `reference/schema.sql`, area_label, published_at, created_at, updated_at, deleted_at,
removed_at), `listing_media` (owner_id, listing_id, mux upload/asset/playback ids server-only,
status awaiting_upload|processing|ready|errored|removed, duration, created_at), `mux_webhook_events`
(event id unique), `listing_status_history`, `reports`, `events`, `jobs` (ADR-0004 Postgres queue).
**Location rule for this release:** we collect only a pickup ZIP. Set `precise_point` to that ZIP's
area point (no finer location is collected or stored), then snap `display_point` as the skill
says. Discovery uses `feed_local`-style security-definer functions copied from
`reference/feed-query.sql` that return distance buckets, never points.
**Mux:** signed playback only; CORS origin = `APP_ORIGIN`; webhook signature verified before
parsing; idempotent; illegal state transitions rejected; no master access or original downloads
(phone videos carry GPS metadata). Duration/size re-checked on `ready`; over-limit assets rejected
and deleted. Update the CSP for exactly the Mux hosts needed (player, images, stream, upload) and
disable player analytics beacons unless the Founder approves them; record the final CSP diff.
**Provider seam:** a `VideoProvider` interface with the Mux implementation and an in-memory fake
for local tests and CI. The fake must throw at startup when `APP_ENV` is `qa` or `production`.
**Jobs:** Mux asset deletion and the 24-hour orphan sweep run from `jobs` via a protected
`/api/cron/*` route (`CRON_SECRET` bearer check), scheduled by Vercel Cron in 3E.
**Rate limits** (Postgres-backed, config values): listings created per day, uploads per hour, and
reports per day per account; stricter for accounts younger than 7 days. 429 with Retry-After.
**Account deletion** now also deletes listings and enqueues media deletion.

**Tests:** pgTAP for the geo-skill suite (99 mi in, 101 mi out, clamp at 100, no point columns in
outputs, keyset pagination stable), RLS (non-owner can't edit/see drafts or `needs_review`;
anon sees only live, approved, non-deleted listings), status transitions. Unit: attribute
validation per category, prohibited-word matcher, webhook signature rejection and idempotent
replay, non-owner can't attach media, playback token denied for `removed`/`errored`. E2E (fake
provider): sell flow end to end on desktop and both mobile projects, draft survives reload,
"Publish when ready", edit, Pending → They didn't show → Available, Sold, delete, report, admin
remove, listing appears on home rail/category/search for a viewer within radius and not for one
outside it.

---

## Milestone 3D — Discover: the vertical video feed
**Branch** `brief-03d-discover`. This is Gate 2 of the standard, adapted.

**Functional requirements**
1. `/discover` (tab bar on phones, header on desktop): full-height vertical feed of live listings
   within the viewer's radius, newest first, keyset-paginated, rendered through the typed feed
   envelope. URL holds the current item (`/discover?l=<id>`), so reload and share restore it.
2. **Playback:** muted autoplay only when the browser permits; explicit sound toggle (remembered
   for the session); captions control shown when a track exists; only the visible item plays;
   pause off-screen and when the tab is hidden; at most 2 players mounted with a source, preload
   only the next item; poster always shown first; blocked-autoplay, buffering, error/retry, and
   poor-network states.
3. **Navigation:** swipe/scroll-snap on touch; ↑/↓ and J/K on keyboard; visible Previous/Next
   buttons. No scroll-jacking on desktop.
4. **Overlay (scrim for contrast):** price/Free, title, distance bucket, area, status, and actions
   Details · Save (gated; disabled with "Saving arrives in the next QA build" if saves aren't built)
   · Share (Web Share API with copy-link fallback) · Report.
5. **Details sheet:** opens as a `BottomSheet` over the paused video (peek: price, condition,
   pickup area, seller display name and "Phone verified" badge; expanded: attributes,
   description). "View full listing" goes to `/l/[id]`. **Back from the listing page returns to
   the same item with the feed position intact.** Back from the sheet closes the sheet.
6. **Empty state:** "No videos near {area} yet." with "Sell something" and "Widen your radius".
7. Respect `prefers-reduced-motion` (no animated transitions; still allow playback by tap).

**Tests:** e2e on all four projects with the fake provider and local demo seed: open item → sheet
→ full listing → back returns to the same item and sheet state; keyboard-only path; only one
`<video>` playing at a time; no audio element playing off-screen; hidden-tab pause; reload restores
`?l=`; empty state; axe with sheet open. Record a short trace or video of the flow as a CI artifact.

---

## Milestone 3E — QA deployment on Vercel
**Branch** `brief-03e-qa-deploy`. Claude Code prepares everything; **the Founder runs or
approves every remote step in-session** (`supabase link`, `supabase db push`, `vercel *`,
`git push`). Never run `supabase db reset --linked`.

1. **Runbook** `docs/runbooks/deploy-qa.md`: step-by-step, with what "good" looks like, for:
   - Supabase **QA** project (separate from dev; region near the Vercel function region; note the
     free plan's inactivity pausing): link, `db push`, confirm data migrations loaded (row counts
     for `postal_areas`, `categories`, `service_areas`), auth settings (site URL, redirect
     allowlist for the QA origin only, email OTP length 6, OTP expiry, rate limits, captcha
     secret, phone provider = Twilio Verify, Google provider client ID/secret, custom SMTP),
     first admin grant SQL, adding `qa_invites`.
   - Google Cloud OAuth client (Web), consent screen in **Testing** with QA testers listed,
     authorized redirect URI = the Supabase callback.
   - Twilio Verify service; Turnstile site (QA hostname only); SMTP provider + DNS (SPF, DKIM,
     DMARC) for the sending domain.
   - Mux **QA environment** (signing key, webhook to `https://<qa-origin>/api/webhooks/mux`, CORS).
   - Vercel project: root `apps/web`, pnpm, Node from `.nvmrc`, environment variables for the
     Production environment of the QA project (`APP_ENV=qa`, `APP_ORIGIN`, Supabase URL +
     publishable key, service-role key, Mux keys/secrets, `CRON_SECRET`, `INVITE_ONLY=true`,
     `CAPTCHA_PROVIDER=turnstile` + keys, `DEFAULT_AREA_ZIP=97205`, media limits), custom domain
     `qa.hucxter.app` (D-40), Vercel Cron for `/api/cron/*`, function region.
   - Rollback (below) and how to rotate every secret.
2. **App changes for hosted QA:**
   - `APP_ENV=qa` adds `X-Robots-Tag: noindex, nofollow` and a disallow-all `robots.txt`.
   - A small "QA build · <short commit>" badge in the footer and account menu.
   - `/api/health` reports `appEnv` and DB reachability (no secrets, no row counts).
   - Env schema: every new variable validated in `env.ts`; startup fails closed on missing or
     invalid values in `qa`/`production`; `.env.example` lists all of them with no real values.
   - Demo seed and `/dev/*` routes: available in `qa` only if the Founder says so; default **off**
     in `qa` so QA sees only real data.
3. **Post-deploy smoke script** `pnpm smoke:qa` (Playwright against `QA_BASE_URL`, read-only,
   no sign-up): health 200 with `appEnv=qa`, home renders at 390 and 1440, noindex header present,
   CSP header present with no violations on home, `/dev/templates/listing` returns 404, a gated
   route redirects to sign-in, unknown category 404.
4. **Performance baseline** (no new targets invented): run Lighthouse (mobile and desktop presets)
   against QA for home, a category, a listing, and `/discover`; record LCP, CLS, TBT, and transfer
   sizes in `docs/qa/perf-baseline-2026-11.md` beside the standard's targets (LCP ≤ 2.5 s, INP ≤
   200 ms, CLS ≤ 0.10 at p75). Field INP needs real use; mark it as pending.
5. **QA test plan** `docs/qa/qa-release-1-test-plan.md`: device/browser matrix from the standard
   §14 (iOS Safari, Android Chrome, desktop Chrome/Safari/Edge/Firefox; one midrange Android, one
   older iPhone), scripted flows (sign-up both ways, phone, ZIP outside Oregon, post with phone
   camera, post from desktop, status changes, report, admin removal, delete account, discover →
   sheet → listing → back), abuse scripts (prohibited words, rate limits, duplicate phone,
   open-redirect URLs, XSS strings in titles), and how to file findings with severity.

**Rollback:** Vercel "Instant Rollback" to the previous deployment for app regressions. Database
migrations are forward-only; each migration header documents its manual undo. QA data is test
data, but don't delete it without the Founder. If a secret leaks: rotate at the provider, update
Vercel env, redeploy.

---

## 6. Expected output (every milestone)
PR (not merged) containing: what changed and why, changed-file list, decisions taken under this
brief's defaults, commands with output (lint, typecheck, unit, DB, e2e per project), screenshots
(1440 and 390, light and dark) for each new or changed screen, `trust-safety-reviewer` findings and
fixes, verified external API facts with links and dates, open risks, manual QA steps that couldn't
run here, and rollback. Update CLAUDE.md "Repository state" and the README.

## 7. Release Definition of Done (after 3E)
- From a clean clone: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`
  and `supabase db reset && supabase test db` pass; CI green on `main` with all four Playwright
  projects.
- On the QA URL, a tester on an iPhone in Safari and one on Android Chrome can each: sign up (email
  and Google), verify a phone, attest 18+, set a home ZIP (one in Portland, one in Texas), record and
  publish a listing, see it in Discover and on the storefront from another account within radius,
  mark it Pending → Available → Sold, report another listing, and delete their account.
- An uninvited email can't complete sign-up. Unverified accounts can't act. No page is indexed.
- `pnpm smoke:qa` passes against the QA URL; the performance baseline is recorded.
- No open Critical or High findings. The Founder approves the QA release.
