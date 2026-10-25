# ADR-0010: Sign-up and verification methods
**Status:** Proposed (Founder requirement 2026-10-24: email, Facebook, TikTok). Confirm D-25,
D-26, and D-08 before Brief 03. **Amends:** the "phone OTP sign-in" assumption in earlier briefs.

## Context
- The Founder requires sign-up with **email, Facebook, or TikTok**, plus identity due diligence:
  "email and SMS and possibly a credit card."
- There is no guest interaction. Every message, listing, and report is tied to a verified person.

## Decision (two layers)
**Layer 1: create the account (choose one).**

| Method | How (Supabase Auth) | Verified 2026-10-24 |
|---|---|---|
| **Email** | Passwordless email one-time code (no password to leak or reset) | Built into Supabase Auth |
| **Facebook** | Built-in `facebook` provider, scopes `public_profile` + `email` | Built-in. Meta app needs Privacy Policy + Terms URLs, app review for `email`, and Live mode before the public can use it |
| **TikTok** | **Custom OAuth2 provider** (`custom:tiktok`), with `email_optional` | Not a built-in Supabase provider. TikTok Login Kit's scopes return open ID, avatar, and display name, **no email**. TikTok uses `client_key` rather than the standard `client_id`, so it may need a small token proxy. Requires TikTok app review. **Spike first.** |

**Layer 2: verify the person (required before any action).**
1. **Email confirmed.** Automatic for email sign-up. Facebook usually supplies a verified email.
   TikTok users must add and confirm an email.
2. **Phone verified by SMS one-time code.** Required before messaging, saving, or selling. One
   active account per phone number. Needs an SMS provider (D-08).
3. **18+ confirmation** and **home ZIP**.
4. **Card or ID verification:** deferred to Phase II with payments (D-09). Note as a future trust
   badge, not a sign-up gate.

Accounts are **linked by verified email**, so a person who signs up with email and later uses
Facebook lands in the same account. A TikTok identity links once the user confirms an email.

## Why
- Email gives everyone a no-third-party option.
- Facebook and TikTok cut sign-up friction for the 21–35 audience.
- Phone verification is the real anti-bot and anti-duplicate control, whichever way someone signs
  up. This is the "verified neighbor" promise without claiming "zero bots."

## Risks
- **TikTok integration may not work with Supabase's custom provider as-is** (`client_key`, a
  nested user-info response, no email). Brief 03 starts with a time-boxed spike. If it fails,
  options are a token proxy, deferring TikTok to after I-A, or a different auth broker (D-26).
- **Third-party app reviews** (Meta, TikTok) need live Terms/Privacy pages on hucxter.app and can
  take days. Start them early (D-07).
- **Facebook and TikTok data rules:** store only what's needed (provider ID, display name, avatar,
  email). Never post on the user's behalf. Honor provider data-deletion requests.
- **Phase V (iOS):** Apple's App Review Guidelines require Sign in with Apple when an app offers
  third-party social login. Plan for it then.

## Alternatives considered
- **Phone-only sign-in** (the earlier plan): simplest, but the Founder wants email and social options.
- **Passwords:** more support burden and credential-stuffing risk than email one-time codes.
- **A separate auth vendor** (Auth0, Clerk): adds another vendor and cost. Revisit only if the
  TikTok spike fails.
