# Accounts runbook (Brief 03 · 3B, 3C.2)

**Who:** Founder and QA leads. **Covers:** testing sign-up locally, granting the first admin,
managing QA invites, the auth settings a cloud project needs in 3E, and (§7) handles, profile
moderation, manual account removal and profile photos. Nothing here touches a
remote project until 3E, and then only with the Founder running each step.

---

## 1. How sign-up works (D-34, ADR-0010 as amended)
1. **Continue with email** (a 6-digit code) or **Continue with Google**.
2. `/welcome`: phone number and SMS code, then "I'm 18 or older.", then home ZIP, then display name.
3. Back to the page the person started from (`next`), with the action they wanted.

A member is **verified** when all four are true: email confirmed, phone verified, 18+ attested,
home ZIP set. Until then every gated page and action sends them to `/welcome`.

---

## 2. Local testing
Start the stack as in `start-hucxter-locally.md` (`supabase start && supabase db reset`).

| What | Where |
|---|---|
| Email codes | Mailpit at <http://127.0.0.1:54324>. Every email the local stack sends lands there, so no real email leaves your Mac |
| SMS codes | No SMS is sent locally. The fictional numbers in `supabase/config.toml` `[auth.sms.test_otp]` (`+1 503 555 0100` to `+1 503 555 0139`) always accept code **`123456`** |
| Turnstile | Off locally (`CAPTCHA_PROVIDER=none`). To try the widget, use Cloudflare's **test** keys (below), never real keys |
| Google | Not testable locally without a real Google client. It's on the manual QA list (§6) |

`apps/web/.env.local` needs `SUPABASE_SECRET_KEY` for account deletion. Copy the **Secret** key
that `supabase status` prints for the local stack. Never paste a cloud key into a local file.

Cloudflare Turnstile test keys (work on any hostname, including localhost; they accept only the
dummy token `XXXX.DUMMY.TOKEN.XXXX`):

| | Site key | Secret key |
|---|---|---|
| Always passes | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Always fails | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |

Source: <https://developers.cloudflare.com/turnstile/troubleshooting/testing/> (checked 2026-11-05).

---

## 3. Grant the first admin (SQL only, never through the UI)
Roles live in `public.app_roles` (`user`, `moderator`, `admin`). The API can't write them. In the
Supabase SQL editor for the right project (local Studio at <http://127.0.0.1:54323>, or the QA
project in 3E), after the person has signed up:

```sql
insert into public.app_roles (user_id, role, granted_by)
select id, 'admin', null
from auth.users
where lower(email) = lower('person@example.com')
on conflict do nothing;

-- Confirm (prints the user id and role only):
select user_id, role, granted_at from public.app_roles where role = 'admin';
```

**Good:** one row. `/admin` now loads for that person and still returns 404 for everyone else.
To revoke: `delete from public.app_roles where user_id = '<uuid>' and role = 'admin';`

---

## 4. QA invites (closed test)
With `INVITE_ONLY=true` (the default when `APP_ENV=qa`), only invited emails can finish sign-up.
Everyone else sees "Hucxter is in a closed test. Ask the team for an invite." Matching ignores case.

```sql
-- Invite
insert into public.qa_invites (email, note) values ('tester@example.com', 'QA team')
on conflict do nothing;

-- Remove an invite (doesn't delete an existing account; delete that from Settings or Studio)
delete from public.qa_invites where lower(email) = lower('tester@example.com');

-- Count (no addresses printed)
select count(*) from public.qa_invites;
```

**Two switches, keep them aligned.** The app checks `INVITE_ONLY` at onboarding. On the QA project
the Supabase **before-user-created hook** (`public.hook_before_user_created`) also blocks uninvited
emails before an account exists, for both email and Google. Locally the hook is off, so the e2e
tests can run with invites on and off. If you turn `INVITE_ONLY` off in QA, turn the hook off too.

---

## 5. Cloud auth settings for 3E (QA project)
Set these in the QA project's dashboard when 3E runs. Values marked *proposal* are the Chair's
defaults and need Founder sign-off.

| Setting | Value |
|---|---|
| Site URL | the QA origin (`https://qa.hucxter.app`, D-40) |
| Redirect allowlist | `https://qa.hucxter.app/auth/callback**` only |
| Email provider | on; **Confirm email on**; OTP length **6**; OTP expiry **600 s** *(proposal)* |
| Email templates | "Confirm signup" **and** "Magic link" both use the code template in `supabase/templates/` (`{{ .Token }}` only, no link). Both must be changed: new users get the first, returning users the second |
| Phone provider | **Twilio Verify** (D-08); phone sign-ups **off** (phone is only added to an existing account); **Confirm phone ON**. With it off, Supabase applies a phone change with no code at all (checked in the Auth source, `internal/api/user.go`) |
| Twilio Verify | Geo permissions: **United States only**. Turn on **Fraud Guard** (SMS pumping protection). Rate limits per number in Verify as well |
| Google provider | on, client ID and secret from the Google Cloud **Web** client; scopes are Supabase's defaults (email, profile) plus `openid` |
| Captcha | **Required:** Turnstile on; secret = the QA site's Turnstile secret. The app relies on it for email-code sends (it refunds a send that Supabase rejects with `captcha_failed`). The app needs the same site's `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (the server checks phone-code sends itself, because Supabase doesn't captcha-check `PUT /user`) |
| Before-user-created hook | on, Postgres function `public.hook_before_user_created` |
| Custom SMTP | the D-39 provider; sender on the sending domain with SPF, DKIM, DMARC |
| Rate limits *(proposal)* | emails sent 30/h · SMS sent 30/h (the project-wide backstop) · sign-ups and sign-ins, token verifications and token refreshes: **high** (e.g. 1000 per 5 min per IP). Every call comes from the app server, so Supabase's per-IP limits count all members as one IP: low values would let one person block sign-in for everyone. Guessing is stopped by the app's code-check limits below |

**App-level limits** (in `apps/web/src/server/auth/otp-limits.ts`, the same in every environment):

| Limit | Value |
|---|---|
| Phone-code sends per account per hour | 5 |
| Phone-code sends per number per hour | 3 |
| Distinct phone numbers per account per day | 3 |
| Phone-code checks per account per hour | 10 |

Over a phone limit, people see "Too many codes requested. Try again in N minutes." (sends) or "Too
many tries. Try again in N minutes." (checks). Counters store a keyed hash of the number, never
the number itself. They outlive account deletion, so deleting and re-creating an account doesn't
reset the per-number limits. To clear a member's limits, delete their rows from
`public.otp_send_attempts` with the service role.

**Email codes (Brief 03C.1 §3.0).** The 3B rule (10 wrong codes per address per hour, then a
one-hour lock) let anyone who knew an address lock its owner out. Email-code checks are now bound
to the browser that asked for the code, and wrong codes never start a timed lock:

| Limit (`EMAIL_CODE_LIMITS`) | Value | When exceeded |
|---|---|---|
| Checks per code, from the browser that asked for it | 5 | "That code has expired or was replaced. Send a new code." |
| Wrong checks per address per hour, all browsers (ceiling) | 15 | Every outstanding code for the address is invalidated; a fresh code works at once. Written to `audit_log` as `auth.email_code_ceiling` (hash prefix only) |
| Sends per browser per hour | 3 | Neutral "We sent a code if…" answer, nothing sent |
| Sends per address per hour (shared pool) | 6 | Overflow: one send per 10 minutes, 3 checks each (Turnstile is required on every send outside local) |
| Known-device sends per hour | 3 | Own allowance outside the pool, for a browser that signed in to this address before (`hx_kd`, 180 days) |
| Wrong checks per address per rolling 24 h, new devices (daily cap, 3C.1b) | 30 | **Trickle mode** for the rest of the 24 h: new devices get one code per hour for the address, 2 checks each (Turnstile still required outside local). The code step adds "For your security, new devices can request one code per hour for this address for now…". Known devices and Google aren't affected. One `audit_log` alert per episode: `auth.email_code_daily_cap` (hash prefix only) |

- **Cookies:** `hx_ec` (the code-requesting browser, 1 h, SameSite=Strict) and `hx_kd` (known device, 180 days, SameSite=Lax), both httpOnly, 32 random bytes. The database stores only a keyed hash of each, bound to the address hash, in `email_code_sessions` and `email_known_devices`.
- **Guessing bound per address per hour:** every check needs a send, so wrong checks ≤ 6 × 5 + 6 × 3 = **48**, P ≤ 48 / 10⁶ = **4.8 × 10⁻⁵** (about 1 in 20,800; ≤ 1.2 × 10⁻³ if sustained for a day, with up to 12 bot checks an hour). Known-device sends need a cookie that only a past sign-in sets.
- **30-day bound (Brief 03C.1b H2):** split 30 days into 30 back-to-back 24 h windows. In each,
  new-device sessions allow at most 30 wrong checks before trickle mode, and trickle allows at
  most 24 codes × 2 checks = 48. That's ≤ 78 a day and ≤ 2,340 in 30 days, so by the union bound
  over 6-digit codes, P ≤ 2,340 / 10⁶ ≈ **0.23%** (before 3C.1b: 48 × 24 × 30 = 34,560, ≈ 3.46%).
- **Trickle residual risk:** during an episode, an attacker who takes the address's one trickle
  code each hour leaves the owner without a new-device code until the episode ends. Known devices
  and Google sign-in still work.
- **Residual risk:** on a brand-new device, an attacker who keeps requesting codes can use up the pool and keep replacing the owner's newest code, so the owner may wait up to 10 minutes for an overflow slot. A known device, or Google sign-in with the same address, isn't affected.
- **To clear an address's state:** with the service role, delete its rows from `email_code_sessions` (cascades to `email_code_checks`), `email_code_ceilings` and `email_code_lockdowns`.
- **To end trickle mode for an address (staff, after confirming the owner):** the alert's reason
  holds the first 16 hex characters of the address hash. In the SQL editor:

  ```sql
  begin;
  delete from public.email_code_lockdowns where left(email_hash, 16) = '<hash prefix>';
  delete from public.email_code_sessions where left(email_hash, 16) = '<hash prefix>'; -- and their checks
  insert into public.audit_log (actor_id, action, target_type, reason)
  values ('<staff user id>', 'auth.email_code_daily_cap_cleared', 'email_code', 'address hash <hash prefix>');
  commit;
  ```

  Open alerts: `select created_at, reason from public.audit_log where action = 'auth.email_code_daily_cap' order by created_at desc;`

**Known gap (D-47: accepted by the Founder on PR #9 for the closed QA only; a Supabase Send SMS hook
must close it before the Phase I-B public beta):** a signed-in member can call Supabase Auth's
`PUT /auth/v1/user` with their own session and the publishable key, changing their phone without
going through the app. That skips the app's Turnstile check, these limits and the US-only number
rules. Until a Supabase "Send SMS" hook enforces them at the source, the **Twilio Verify US-only
geo permissions, Fraud Guard and per-number limits, and the project SMS cap are mandatory**, not
optional.

The same applies to **`POST /auth/v1/verify`**: anyone with the project URL and the publishable key
can check email codes directly, from their own IP, outside the app's code-check limits, at
Supabase's per-IP token-verification rate. So for Phase I the **publishable key stays server-only**
(it has no `NEXT_PUBLIC_` form today); rotate it if it leaks. Before Phase IV/V clients ship the
key, forward the real client IP to Supabase Auth (if the hosted project supports it) or move code
checks behind a Supabase auth hook.

---

## 6. Manual QA (can't run in CI)
1. **Google sign-in** on the QA URL: new account → `/welcome`; returning account → straight back to
   `next`; cancel at Google's consent screen → the sign-in page with "Google sign-in didn't
   finish. Try again."; an uninvited Google account → the closed-test screen.
2. **One account per person across methods.** Sign up with an email code, finish onboarding, sign
   out, then Continue with Google using the **same address**. Expected: the same Hucxter account
   (same display name and phone, no second onboarding). Supabase links identities with the same
   verified email automatically; it doesn't link to an unverified email, and it removes other
   unconfirmed identities when it links. Source:
   <https://supabase.com/docs/guides/auth/auth-identity-linking> (checked 2026-11-05).
3. **Real SMS** through Twilio Verify on a US mobile; a non-US number is refused before sending.
4. **Turnstile** on the QA hostname: the widget shows, and email and phone codes still send.
5. **The real on-screen keyboard** on an iPhone (Safari) and an Android phone (Chrome) on each
   `/welcome` step: the input and the Continue button stay visible, the tab bar hides.
6. **Delete account** on a phone: you're signed out on every device.

---

## 7. Profiles, handles and moderation (3C.2)

### Handles
- Every member gets an `@handle` when their display name is set: lowercase letters, numbers, `.`
  and `_`, 3–24 characters, not all digits, no leading/trailing `.` or `..`. Generated from the
  display name (`handle_generate`), with digits added on a collision. Reserved words and the
  substrings `hucxter`, `admin`, `support`, `official` are refused (contracts `handle.ts` and SQL
  `handle_is_reserved`; a unit test keeps the two lists equal).
- Members can change their handle **once every 30 days** in Settings → Edit profile (the first
  change after the generated one is allowed straight away). The old handle is **held for 30 days**
  in `handle_holds`, so nobody else can take it. `/u/<old handle>` returns 404; there are no
  redirects.
- Holds with `user_id` null (from a staff reset or an account deletion) block everyone, including
  the former owner. To release a hold early (Founder decision only):
  ```sql
  delete from public.handle_holds where handle = '<handle>';
  ```
- Availability checks (`handle_status`) are limited to 60 per 10 minutes per member
  (`action_limit_config` row `handle_check`); the UI then shows "Try again shortly".

### Profile reports in `/admin`
Members report a profile from its page (Report profile). Staff see it under **Open reports** with
the photo, name, `@handle` (linked) and bio. Every action needs a reason, closes the report and
writes `audit_log`:

| Action | Effect | `audit_log.action` |
|---|---|---|
| Dismiss report | Nothing changes | `report.dismissed` (target: the report) |
| Remove photo | `avatar_path` cleared, the file deleted (a `storage_delete_avatar` job retries if Storage fails); initials show | `profile.photo_removed` |
| Clear bio | `bio` set to `''` | `profile.bio_cleared` |
| Require new name & handle | Name → "Hucxter member", handle → generated, old handle held 30 days (`user_id` null). The member is unverified until they choose both on `/welcome`, so every gated page and action sends them there. | `profile.name_reset` |

There is no suspension or ban in Phase I. To see what staff did to a member:
```sql
select created_at, actor_id, action, reason from public.audit_log
where target_id = '<user id>' order by created_at;
```

### Remove an account manually (SQL only, Founder decision)
Use the QA project's SQL editor (never production). This does what self-service deletion does:
listings hidden, Mux and photo deletion jobs queued, handle held for 30 days, profile, roles and
listings removed with the auth user. Checked locally on 2026-11-07.
```sql
begin;
select public.account_delete_prepare('<user id>');
insert into public.audit_log (actor_id, action, target_type, target_id, reason)
values ('<your user id>', 'account.removed_by_staff', 'user', '<user id>', '<reason>');
delete from auth.users where id = '<user id>';
commit;
```
The jobs run on the next jobs cron tick (`docs/runbooks/video.md`).

### Display-name and bio rules on existing rows
Names (25 characters, blocked terms) and bios are checked by CHECKs on `profiles`:
`profiles_display_name_rules`, and from the trust-safety hardening `profiles_display_name_folded`,
`profiles_bio_folded` (blocked terms are also caught behind look-alike letters, fullwidth forms
and invisible characters, which are refused outright) and `profiles_handle_has_name`. Each
migration validates its CHECK only when no existing row breaks it; otherwise it stays `NOT VALID`
(new writes are checked, old rows aren't) and the migration prints counts only. Local counts on
2026-11-07: 0 (all validated). Before 3E, run on the QA project:
```sql
select conname, convalidated from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname in ('profiles_display_name_rules', 'profiles_display_name_folded',
                  'profiles_bio_folded', 'profiles_handle_has_name');
select
  count(*) filter (where char_length(display_name) > 25) as over_25,
  count(*) filter (where public.text_fold(display_name) ~ '(hucxter|admin|support|official)'
                     and name_reset_required_at is null) as blocked_name,
  count(*) filter (where public.text_fold(bio) ~ '(hucxter|admin|support|official)') as blocked_bio
from public.profiles where display_name is not null;
```
While a row breaks a `NOT VALID` CHECK, **every** update to it fails: the member's own profile,
ZIP or photo changes, and staff **Remove photo** and **Clear bio**. Only **Require new name &
handle** works on a bad name; clear a bad bio with SQL. When all counts are 0, validate each one:
`alter table public.profiles validate constraint <name>;`

### Profile photos
- Settings → Edit profile → Change photo. JPEG, PNG or WebP up to 5 MB; the server re-encodes it
  with sharp to a 512×512 WebP and drops all metadata (EXIF incl. GPS, XMP, IPTC, ICC). Stored as
  `<uuid>.webp` in the public `avatars` bucket (service role writes only), cached for 1 day.
- `AVATAR_UPLOADS=off` hides upload and removal, makes `/api/profile/avatar` return 404 and shows
  initials everywhere (stored photos are ignored). Use it if sharp fails on Vercel (3E check).
- Manual QA in 3E: upload a photo from an iPhone (Safari converts HEIC to JPEG) and an Android
  phone on the QA URL; check the photo shows on the profile, the seller card and the menu.
