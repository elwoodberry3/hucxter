---
name: hucxter-trust-safety
description: Authentication, bot resistance, rate limits, messaging safety, reporting/blocking, prohibited items, meetup safety, and moderation for HUCXTER. Use when touching sign-up/login, sessions, messaging, reports, blocks, admin tools, or anything abuse-related.
---

# Trust & safety (replaces "zero-bot security")

"Zero bots" is not achievable or provable. The goal is **layered bot resistance** and fast
detection/removal. Do not use "zero-bot" in product copy.

## Identity & access (Phase I)
- Supabase Auth phone OTP. OTP send/verify rate-limited per phone, per device, per IP.
- Phone line-type check (block VoIP/disposable where the provider supports it) — provider is an
  open decision; build behind an interface `PhoneRiskProvider` with a no-op default.
- Session tokens in secure storage (Expo SecureStore). Refresh rotation on. Sign-out revokes.
- Roles: `user`, `moderator`, `admin` in `app_roles` table; admin routes check role server-side.
- Mobile app attestation (App Attest / Play Integrity) is Phase II; leave a hook in the auth flow.

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

## App Store requirements (Phase I, not optional)
App Review Guideline 1.2 requires UGC apps to filter objectionable content, offer reporting with
timely responses, let users block abusive users, and publish contact information. Guideline
5.1.1(v) requires in-app account deletion when the app supports account creation. Deletion
removes or anonymizes profile, listings, media (Mux delete job), and messages per the retention
policy (D-07), and revokes sessions.

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
