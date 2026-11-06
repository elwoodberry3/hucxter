# Brief 03 · Milestone 3C (amended): listings, selling, listing page, profiles

**From:** Advisory Board Chair · **Date:** 2026-11-06 · **Repo state verified:** `main` @ `4391dca`
(3B merged via PR #9). **Amends** the Milestone 3C section of `docs/kickoff/brief-03.md`; sections
0–5 of that brief (decisions, Mobile Standard adaptation, scope, global requirements) still apply.
Where this file and brief-03.md disagree, this file wins.

**Why amended:** the Founder reviewed four UI/UX mockups (profile empty, profile with videos +
member menu, settings/edit profile, listing page with seller chat). They are adopted as layout
direction with the changes in §2. The work is now **two milestones, one PR each**:

- **3C.1 — Listings and selling:** lockout fix, listings data, Mux upload, sell flow, the
  redesigned listing page, real data on the storefront, report + minimal admin.
- **3C.2 — Profiles, settings, saves:** handles, avatars, bios, public and owner profile pages,
  saves, the settings redesign, the member menu.

Do one milestone per session. Open the PR, report, stop. Start each session in plan mode.

---

## 1. Founder decisions recorded by this brief (add to `open-decisions.md`)

| ID | Decision | Status |
|---|---|---|
| D-42 | Members get a unique public **@handle** (profile URL `/u/[handle]`), auto-generated at onboarding completion, editable in settings | Chair default; Founder confirm |
| D-43 | **Followers, following, likes, reposts, favorites, comments and public engagement counts are deferred** to Phase II (creators). Phase I profiles show only real marketplace facts | Chair default; Founder confirm |
| D-44 | Profile photos: optional upload, re-encoded server-side (metadata stripped), stored in Supabase Storage; initials avatar by default | Chair default; Founder confirm |
| D-45 | A struck-through earlier price shows only for a **real price drop on Hucxter** (rule in §3.4); never an MSRP or "compare at" price | Chair default; Founder confirm |
| D-46 | **No seller star ratings** until a transaction-confirmed review system exists (future brief). Seller cards show verified facts only | Chair default; Founder confirm |
| D-05 | Video limits stay `MEDIA_MAX_SECONDS=60`, `MEDIA_MAX_BYTES=524288000` (the mockup's 2:36 video is illustrative) | Chair default; Founder confirm |
| D-47 | The 3B direct-API phone-change gap is **accepted for the closed QA only**; a Supabase Send SMS hook closes it before the Phase I-B public beta | Founder accepted on PR #9 (record it) |

If the Founder has changed any of these, stop and ask before building on it.

## 2. How the mockups are adapted (read before any UI work)

Adopt: the overall layouts, profile header + tabbed grid, settings two-pane layout, listing page
two-column layout with video stage and seller card, member menu with avatar and "View profile",
character counters, phone shown as verified and private, "Listed {time} in {area}".

Change or omit (CLAUDE.md honesty rules, D-09 no payments, D-43, D-46):

| Mockup element | Phase I treatment |
|---|---|
| Following / Followers / Likes counts; Reposts, Favorites, Liked tabs | Omit (D-43). Profile stats = real counts only: items listed, items sold, "Joined {Mon YYYY}", "Phone verified" |
| View counts on tiles (39M etc.) | Owner-only, real, from `listing_viewed` events ("123 views"). Never shown publicly |
| "Popular" sort | Omit. Sorts: Newest, Oldest, Price low–high, Price high–low |
| "Pinned" badge | Omit for now (follow-up) |
| Heart/comment/save/share rail with counts | Rail = **Save** (3C.2), **Share**, **Report**. No counts. No comments (messaging is private and per listing) |
| Seller star rating "Rated 4.5…" | Omit (D-46). Seller card: avatar, display name, @handle (3C.2), "Phone verified", "Joined Mon YYYY", items sold, link to profile |
| "$50 ~~$75~~" | Only under the D-45 rule |
| Inline chat on the listing page | Layout reserves the panel; messaging is the next brief. Show the "Is this still available?" button **disabled** with "Messaging arrives in the next QA build". Don't render an empty chat box or a fake thread |
| Title/price card overlaid on the video (desktop) | Desktop: no duplicate overlay; title and price live in the detail column. Phone: compact overlay is fine |
| Vehicles, an RV and a house in the sample grid | Not listable (D-24; no real estate category). Never use them in fixtures |
| "Pat Supplies" | Mockup typo; the category is "Pet Supplies" (no change needed in code) |
| "HUCXTER" wordmark | Keep the existing Hx mark + "Hucxter" casing (D-01) |
| Phone "+1 (503) 985-9742" in full | Mask by default: "+1 (503) •••-•742", with "Change number". Owner only |
| Display name counter 21/25 | Adopt **2–25** characters for new edits (§4.4) |

The mockups are concept references (D-04): don't copy pixel values, sample text, people's photos
or data. The built product and `hucxter-design-system` are the design source. Everything must work
at 320–430 px (phone layouts per ADR-0011) as well as 1280–1440 px.

---

## 3. Milestone 3C.1 — Listings and selling
**Branch** `brief-03c1-listings`. Load `hucxter-db-migrations`, `hucxter-geo-radius`,
`hucxter-video-pipeline`, `hucxter-event-taxonomy`, `hucxter-trust-safety`, `hucxter-design-system`.

### 3.0 First: fix before anything else
1. **Email-code lockout (from PR #9).** Today 10 wrong code checks per email address per hour lock
   that address, so anyone who knows a tester's email can lock them out. Redesign so that a person
   **without access to the inbox cannot block the person who has it**, while guessing stays bounded:
   e.g. count wrong checks per (email, browser) with a low limit, keep a higher per-email ceiling,
   and when the ceiling is hit, invalidate outstanding codes and require a fresh code (plus
   Turnstile when enabled) instead of a timed lockout. Propose the exact numbers in the plan, with
   the guessing probability per hour. Tests for both the attacker and the legitimate user.
2. Read the PR #9 follow-ups (L1–L5 and others). Fix the ones marked "before 3E" that 3C.1 touches;
   list the rest.
3. Record D-47 in `open-decisions.md` and the accounts runbook.

### 3.1 Data (new migrations only)
Per brief-03.md §3C "Data", plus:
- `listing_price_history` (listing_id, price_cents, effective_from) written on every price change.
- `listings.views` is **not** a column; owner view counts come from `events` (§3.6).
- `reports` targets: `listing` now; the enum/target type must also allow `profile` (used in 3C.2).
- Location: pickup ZIP only; `precise_point` = that ZIP's area point; `display_point` snapped per
  the geo skill. Discovery functions return distance buckets and area labels, never points.

### 3.2 Video (Mux)
Exactly as brief-03.md §3C "Mux" and "Provider seam" (signed playback, CORS = `APP_ORIGIN`,
signature-verified idempotent webhooks, no master access, `VideoProvider` with an in-memory fake that
throws in `qa`/`production`). Verify current Mux APIs and the Mux Player/Uploader packages in official
docs; ask before each `pnpm add`. CSP: add only the exact Mux hosts needed; record the diff. Disable
Mux Player analytics beacons unless the Founder approves them.

### 3.3 Sell flow (`/sell`, verified members)
As brief-03.md §3C item 1–2: record or choose video (phone camera capture), resumable direct upload
with progress, details (title ≤ 80, category → subcategory, condition, price or Free, category
attributes, description ≤ 2,000 plain text, pickup ZIP defaulting to home ZIP), review & publish
("Publish when ready" while processing), prohibited-keyword check → `needs_review`, draft survives
reload. Mobile-first, one step per screen.

### 3.4 Listing page `/l/[id]` (replaces the 404 and supersedes the `/dev` template layout)
**Desktop (≥ 64rem):** two columns.
- **Left — video stage:** dark stage with the 9:16 Mux Player centred (poster first; controls: play,
  scrub, time, speed, captions when a track exists, mute/volume, fullscreen). Muted autoplay only if
  allowed; never with sound. Action rail beside the player: Share (Web Share API, copy-link
  fallback), Report, and Save (disabled with "Saving arrives soon" until 3C.2). No counts.
- **Right — detail column:**
  1. Title (H1), price or "Free", status badge (Available / Pending: someone's on the way / Sold).
  2. **Price drop (D-45):** show the earlier price struck through, with "Price dropped" and accessible
     text "Was $75, now $50", only if (a) the current price is lower than a price this listing was
     live at on Hucxter for at least 7 consecutive days and (b) the drop happened in the last 30 days.
     Otherwise show only the current price. Unit-test the rule.
  3. "Listed {relative time} in {area label}, {state}" and the viewer's distance bucket.
  4. Attributes table: Condition first, then the category's attributes that the seller filled.
  5. Seller card: initials avatar (photo in 3C.2), display name, "Phone verified", "Joined Mon YYYY",
     items sold count. Links to the profile in 3C.2. **No ratings.**
  6. Description: plain text, line breaks preserved, no auto-linking, "Show more" after ~8 lines.
  7. Primary action: **"Is this still available?"** disabled with "Messaging arrives in the next QA
     build". Then the existing Meet safely panel.
- **Phone:** video on top (height-capped so price and the primary action show without scrolling, as
  in 3A), detail below, sticky action bar.
- **Owner viewing own listing:** primary area shows Edit, Mark pending / They didn't show, Mark sold,
  Delete, and owner-only stats (views); no "Is this still available?".
- **Not found / deleted / removed / `needs_review` for non-owners:** 404. Sold listings stay visible
  with the Sold badge and no primary action.
- Metadata: title, description excerpt, canonical URL, Open Graph image from the signed poster only
  if it can be served without exposing tokens; otherwise the Hx default image.

### 3.5 Storefront wiring
Home rails ("New near {area}", "Free stuff near you", featured departments), category index,
search (Postgres full-text on title + description), all through `feed_local`-style security-definer
functions copied from the geo skill's reference query: radius-bounded (≤ 100 mi), keyset-paginated,
distance buckets only. Empty states stay when nothing is nearby. Listing cards: poster, price/Free,
title, condition, distance bucket, area, status badge. Remove the `/dev/templates/listing` demo
route **or** keep it local-only; it must still 404 in `qa` and `production`.

### 3.6 My listings, report, admin, events
- `/listings` (owner management) as brief-03.md §3C item 3 (drafts, processing, live, in review,
  sold; edit, Pending → They didn't show → Available, Sold, delete). In 3C.2 this becomes the owner
  view of the profile; keep components reusable.
- Report flow and minimal `/admin` queue (approve, remove listing and revoke playback, dismiss),
  every action in `audit_log`.
- Events (first-party `events` table, no PII): `sell_started`, `upload_started`,
  `upload_completed`, `upload_failed` (reason code), `listing_published`, `listing_status_changed`,
  `listing_price_changed`, `listing_viewed` (deduplicated per viewer per listing per day; no IP
  stored), `report_submitted`.
- Rate limits (Postgres, config values): listings created/day, uploads/hour, reports/day per
  account; stricter for accounts younger than 7 days.
- Account deletion now also deletes listings and enqueues Mux deletion.

### 3.7 Tests
Everything in brief-03.md §3C "Tests", plus: lockout redesign (attacker can't block the inbox
owner; guessing bounded); price-drop rule cases (7-day minimum, 30-day window, price raise, Free);
listing page states (guest, member, owner, sold, removed → 404, needs_review → 404 for others);
no counts or ratings rendered; disabled message button; Mux Player only one playing; listing page at
320–430 px with price and primary action above the fold; axe light/dark desktop/mobile; CSP has no
violations with the player loaded.

---

## 4. Milestone 3C.2 — Profiles, settings, saves
**Branch** `brief-03c2-profiles`. Starts after 3C.1 is merged.

### 4.1 Handles (D-42)
- `profiles.handle`: unique case-insensitively, 3–24 chars, `[a-z0-9_.]`, no leading/trailing or
  double dots, not purely digits, reserved-word list (admin, hucxter, support, help, settings, sell,
  search, discover, messages, api, auth, welcome, etc.) and no names containing "hucxter", "admin",
  "support" or "official".
- Generated when onboarding completes (from the display name, plus digits if taken); existing local
  and QA members get one by data migration. Editable in settings at most once per 30 days. Old
  handles are not redirected and can't be reclaimed by someone else for 30 days.
- Shown as "@handle". `/profile` redirects to the viewer's own `/u/[handle]`.

### 4.2 Profile page `/u/[handle]`
- **Header (left column on desktop, stacked on phone):** avatar, display name, @handle, bio, "Phone
  verified", "Joined Mon YYYY", counts "{n} listed · {n} sold" (real; hide a zero sold count).
  Owner: "Edit profile" button. Others: Share profile, Report profile. Never show home ZIP or area.
- **Tabs:** *Listings* (public: Available and Pending; owner: filter chips All · Live · Pending ·
  Sold · Drafts · In review) · *Sold* (public history) · *Saved* (owner only). No other tabs (D-43).
- **Sort:** Newest, Oldest, Price low–high, Price high–low; state in the URL.
- **Grid:** 9:16 poster tiles with price, status badge; owner sees view counts. Keyset pagination.
- **Empty states:** owner "Post your first item" → `/sell`; public "No items yet".
- Unknown handle → 404. Deleted accounts → 404.

### 4.3 Saves
`saved_listings` (user_id, listing_id, created_at; PK both): private, own rows only. Save toggle on
listing cards, the listing page rail, and (3D) Discover; gated with `requireVerifiedMember`.
Saved tab lists live, non-removed listings only. No public save counts. Optimistic UI only with
server reconciliation and rollback on failure.

### 4.4 Settings redesign
- **Desktop:** two panes. Left nav: *Edit profile* and *Account*. **Phone:** list → detail pages
  with a back button.
- **Edit profile:** photo (Change / Remove), display name (2–25, counter), handle (with
  availability check and the 30-day rule), bio (0–150, counter, plain text, same no-URL/email/phone
  rules as display name, max 3 line breaks), home ZIP.
- **Account:** phone shown masked with "Change number" (existing flow), signed-in devices, sign out,
  sign out everywhere, delete account.
- Display name: tighten validation to 2–25 in contracts and in a new migration; add the CHECK as
  `NOT VALID` if any existing row is longer, and list such rows' count (not values) in the PR.

### 4.5 Profile photos (D-44)
- Upload through our server only (single write path): JPEG/PNG/WebP ≤ 5 MB, rejected otherwise with
  a plain error. The server decodes and re-encodes to a 512×512 WebP, which **drops all metadata
  (EXIF/GPS)**; store under a random UUID name in a Supabase Storage bucket `avatars` (public read;
  writes only via the service role from `admin-db.ts`). Delete the old file on replace, removal and
  account deletion. Rate-limit uploads per account per day.
- Expected dependency: `sharp` (ask first; confirm it runs on Vercel and in CI).
- CSP `img-src`: add only the exact Supabase Storage origin from config.
- CI: start Supabase Storage in the e2e job.
- Reporting a profile covers the photo, name, handle and bio.

### 4.6 Member menu
Avatar + display name (truncated with ellipsis; full name in the accessible label) + "View
profile", then Messages, Settings, Admin (staff only), Sign out. Phone Account tab → own profile.

### 4.7 Tests
Handle rules and collisions; reserved words; 30-day change rule; profile public vs owner views
(drafts/in review/Saved never visible to others; home ZIP never rendered); saves RLS and toggle
reconciliation; avatar: non-image rejected, oversize rejected, EXIF GPS absent from the stored file
(test with a fixture that has GPS tags), old file deleted on replace and account deletion; display
name 25 limit; settings at 320–430 px with keyboard simulated; axe; screenshots of profile (empty,
with listings, owner and public), settings panes, member menu, at 1440 and 390, light and dark.

---

## 5. Expected output, rollback
As brief-03.md §6 for each PR. Migrations are additive and forward-only, each with undo notes in
its header. Nothing remote is touched. Rollback = revert the PR, then `supabase db reset` locally.
