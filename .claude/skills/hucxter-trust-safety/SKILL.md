---
name: hucxter-trust-safety
description: Authentication, bot resistance, rate limits, messaging safety, reporting/blocking, prohibited items, meetup safety, and moderation for HUCXTER. Use when touching sign-up/login, sessions, messaging, reports, blocks, admin tools, or anything abuse-related.
---

# Trust & safety (replaces "zero-bot security")

"Zero bots" is not achievable or provable. The goal is **layered bot resistance** and fast
detection/removal. Do not use "zero-bot" in product copy.

## Identity & access (Phase I, ADR-0010 as amended by D-34)
- **Sign up / sign in** with one of: **email one-time code** (6 digits, no passwords, no
  magic-link-only flow) or **Google** (Supabase built-in provider, PKCE, scopes
  `openid email profile` only). No Facebook, TikTok, or Apple login in Phase I. Supabase links
  identities with the same verified email into one user automatically.
- **Onboarding gate** (`/welcome`, resumable): confirmed email → **phone verified by SMS code**
  (`updateUser({ phone })` + `verifyOtp({ type: 'phone_change' })`; one account per phone; a
  number in use gets a neutral error) → **18+ attestation** (`age_attested_at`, no date of birth) →
  **home ZIP** → display name. **Verified = all four** of email, phone, 18+, home ZIP.
- **One gate:** `requireVerifiedMember()` (`apps/web/src/server/auth/gate.ts`) protects every gated
  page and action and sends unverified members to `/welcome?next=…`. It checks the session with
  the Auth server (`getUser()`), so revoked sessions and deleted users fail closed.
- **QA invite gate:** with `INVITE_ONLY=true` (default for `APP_ENV=qa`), only emails in
  `qa_invites` finish sign-up; the Supabase `before_user_created` hook enforces the same list in QA.
- **No guest interactions.** Every gated action routes to sign-in with a safe, same-origin `next`
  path (reject absolute URLs, `//`, backslashes, encoded variants; never `/welcome` or `/auth/*`).
- **OTP abuse limits** (Postgres-backed, `apps/web/src/server/auth/otp-limits.ts`): phone-code
  sends per user and per number per hour, distinct numbers per account per day, email-code sends
  per address per hour, on top of Supabase's own limits. US (+1) numbers only. The email step is
  enumeration-neutral: same copy and timing whether or not the address has an account.
- OAuth: PKCE and the state parameter; minimal scopes; store only provider user ID, display name,
  and email; never post on the user's behalf; honor provider data-deletion requests.
- Phone line-type check (block VoIP/disposable where the provider supports it) — provider is an
  open decision; build behind an interface `PhoneRiskProvider` with a no-op default.
- Sessions: Supabase SSR auth with **httpOnly, Secure, SameSite=Lax** cookies scoped to the app
  origin. No tokens in `localStorage`. Refresh rotation on. Sign-out revokes server-side. Show
  active sessions under account settings, with "sign out everywhere."
- Roles: `user`, `moderator`, `admin` in the `app_roles` table; `/admin` routes check the role
  server-side on every request (middleware alone is not enough).
- Bot resistance on the web: Cloudflare Turnstile (D-08) behind `CAPTCHA_PROVIDER`
  (`turnstile` | `none`; `none` is refused when `APP_ENV=production`). Email-code sends use
  Supabase's captcha support (`captchaToken`). Supabase does **not** captcha-check phone changes
  (`PUT /user`), so the server verifies the Turnstile token itself before sending a phone code.
  Device attestation comes with the Phase IV desktop app and Phase V iOS app.
- **Service-role key** (`SUPABASE_SECRET_KEY`) is read only in `apps/web/src/server/admin-db.ts`
  and used only for account deletion, audit writes, abuse counters, and (later) webhooks, jobs and
  admin actions. A unit test fails if any other module reads it.
- Emails and phone numbers never appear in logs, analytics, error messages, or test snapshots. Show
  fixed copy mapped from Supabase `error.code`; never show or log `error.message`.

## Web security baseline (Phase I)
- **CSRF:** cookie-authenticated mutations must verify the `Origin` header against `APP_ORIGIN`
  (server actions do this by default; route handlers must do it explicitly). No state change on GET.
- **Headers:** strict Content-Security-Policy with nonces (allow only Mux, Supabase, and the
  challenge provider), `frame-ancestors 'none'`, HSTS, `Referrer-Policy: strict-origin-when-cross-origin`,
  and a `Permissions-Policy` that denies camera, microphone, and geolocation except on pages that
  need them.
- **XSS:** never `dangerouslySetInnerHTML` user content. Listing text and messages render as text;
  links in messages are not auto-linked in Phase I.
- **Uploads** go straight to Mux, never through our origin.

## Rate limits (Postgres-backed in Phase I; config values, Founder-approved)
New-account limits are stricter for the first N days: listings/day, new conversations/day,
messages/minute. Exceeding returns 429 with a retry-after; repeated hits flag the account.

## Messaging
- Threads are always tied to one listing; one thread per (listing, buyer).
- Before a thread opens: caller is authenticated, phone-verified, not blocked by/blocking seller,
  under rate limits. (This is the draft's "verification layer before chat".)
- Server-side scam heuristics on messages (off-platform payment requests, gift cards, wire,
  "pay deposit", external links/phone numbers in first message, shipping requests). Phase I action:
  show the recipient an inline safety notice; do not silently drop messages. Log a signal.
- Message bodies are never logged or sent to analytics.

## Account deletion & UGC basics (Phase I, built now so the iOS app inherits them)
Users can delete their account from settings. Deletion removes or anonymizes profile, listings,
media (Mux delete job), and messages per the retention policy (D-07), and revokes all sessions.
Content filtering, reporting with timely responses, blocking, and a published support contact are
all Phase I features. They are good marketplace practice now and are required by Apple's App Review
Guidelines (1.2, 5.1.1(v)) for the Phase V iOS app.

## Reports, blocks, moderation
- Report reasons enum: prohibited item, scam, harassment, stolen goods suspicion, counterfeit,
  unsafe meetup, minor safety, other. Reports create `moderation_cases`.
- Block is immediate and bidirectional in all queries (feed, search, threads, profiles).
- Admin console: queue, case detail, actions (remove listing, warn, suspend, ban), every action
  written to `audit_log` with actor, reason, timestamp.

## Prohibited items
Maintain `prohibited_categories` + keyword list (weapons, drugs, alcohol/tobacco, recalled goods,
animals, adult content, counterfeit, etc. — final list is a Founder + counsel decision). Checked at
publish on title/description/AI draft; matches go to review, not live.

## Meetups
Suggest public, curated "safe exchange spots" (e.g., police station exchange zones) per area from a
seeded table. Never auto-share either party's location. In-app safety tips before first meetup.

## Minors
Phase I testers are adults. Age gate (18+) at sign-up; the age policy for public launch is an open
Founder + counsel decision.
