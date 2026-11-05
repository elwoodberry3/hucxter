# Accounts runbook (Brief 03 · 3B)

**Who:** Founder and QA leads. **Covers:** testing sign-up locally, granting the first admin,
managing QA invites, and the auth settings a cloud project needs in 3E. Nothing here touches a
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
| Email-code sends per address per hour | 5 |
| Code checks (right or wrong) per email address per hour | 10 |
| Phone-code checks per account per hour | 10 |

Over the limit, people see "Too many codes requested. Try again in N minutes." (sends) or "Too
many tries. Try again in N minutes." (checks). Counters store a keyed hash of the email or number,
never the value itself. They outlive account deletion, so deleting and re-creating an account
doesn't reset the per-number limits. To clear a member's limits, delete their rows from
`public.otp_send_attempts` with the service role.

**Known gap (accepted risk, needs Founder sign-off):** a signed-in member can call Supabase Auth's
`PUT /auth/v1/user` with their own session and the publishable key, changing their phone without
going through the app. That skips the app's Turnstile check, these limits and the US-only number
rules. Until a Supabase "Send SMS" hook enforces them at the source, the **Twilio Verify US-only
geo permissions, Fraud Guard and per-number limits, and the project SMS cap are mandatory**, not
optional.

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
