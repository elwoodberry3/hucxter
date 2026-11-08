# Founder Decisions

## Open

| ID | Decision | Chair recommendation | Blocks |
|---|---|---|---|
| D-23 | Approve category taxonomy v1 (`docs/specs/category-taxonomy.md`): 14 departments, filters, header order | Approve; it's data, so it's cheap to adjust later | Brief 02 |
| D-24 | Motor vehicles (cars, trucks, motorcycles, boats) in Phase I? | **No** for I-A/I-B. Parts & accessories only. Vehicles bring title fraud, odometer, and lien issues and a different scam profile; revisit after the liquidity gate | Brief 02 seed |
| D-38 | Styling approach for the mobile standard (its §9 assumes Tailwind) | **Keep CSS Modules + CSS custom-property tokens** (no Tailwind migration); meet §9's intent with tokens and variants | Brief 03 |
| D-39 | Transactional email provider (custom SMTP for Supabase Auth) | Founder chooses a provider; SPF/DKIM/DMARC on the sending domain | Brief 03E |
| D-40 | QA URL and hosting plan | `qa.hucxter.app` on a Vercel **Pro** team | Brief 03E |
| D-45 | A struck-through earlier price shows only for a **real price drop on Hucxter** (live at that price ≥ 7 consecutive days, dropped within 30 days); never an MSRP or "compare at" price | Approve (Chair default) | Brief 03C.1 |
| D-46 | **No seller star ratings** until a transaction-confirmed review system exists. Seller cards show verified facts only | Approve (Chair default) | Brief 03C |
| D-27 | "Pending: someone's on the way": hours before the app asks the seller to confirm Sold or Available | Configurable; start with the end of the same day and tune with QA data | Brief 07 |
| D-28 | Placeholder hero and category art source | In-repo SVG/CSS illustrations now; Founder-supplied licensed photos later. No hotlinked stock | Brief 02 |
| D-29 | Guests can view full listing pages (actions gated) vs. sign-in required to open a listing | Guests can view. Better discovery, sharing, and search indexing; every *action* still needs a verified account | Brief 02 |
| D-30 | Home-page in-feed slot shows "Promoted by Hucxter" house promos in Phase I (reserves the FairXchange ad slot) | Approve; never a fake third-party ad | Brief 02 |
| D-17 | **Phone-to-desktop upload handoff.** Sellers usually film on a phone. Should the desktop Sell page show a QR code that opens a single-purpose, upload-only web page on the seller's phone, with the video landing in the desktop draft? It runs in the phone's browser, not a native app | Yes. It removes the file-transfer step that will most likely sink listing completion, and costs about one brief | Brief 05 |
| D-18 | **Message notifications outside the open tab.** Options: Chrome web push (works while Chrome runs), email (requires collecting an email address), SMS (per-message cost) | Web push plus an optional email, with SMS reserved for safety-critical events | Brief 07 |
| D-19 | Browser support beyond Chrome for public beta (Edge, Safari, Firefox on desktop) | Chrome only for I-A; before I-B, smoke-test Edge and Safari (the main desktop browsers outside Chrome) | Phase I-B |
| D-20 | Redirects: `hucxter.com` and `hucxster.app` → `hucxter.app` (301) | Yes. Configure at the DNS/edge level | Public beta |
| D-21 | Vector (SVG) master of the Hx mark | Provide when available, for sharper favicons and the Phase IV app | Nice to have |
| D-05 | Maximum video length and size; default discovery radius | Brief 03 defaults: `MEDIA_MAX_SECONDS=60`, `MEDIA_MAX_BYTES=524288000`, radius 25 mi; tune with QA data. Brief 03C keeps these limits (the mockup's 2:36 video is illustrative) | Brief 03C |
| D-07 | Prohibited items list, terms, privacy policy, age policy, data retention. Retention questions include: `audit_log.details` keeps previous display names and handles from staff name resets after the member deletes their account (Brief 03C.1b H9); how long? | Counsel review. **Now also blocks Facebook/TikTok app review**, which needs live Terms + Privacy URLs on hucxter.app | Brief 03 (social login), public beta |
| D-08 | SMS provider for phone verification (Brief 03 default: **Twilio Verify** via Supabase; bot challenge **Cloudflare Turnstile**) (e.g., Twilio, MessageBird, Vonage; check Supabase's supported list), bot-challenge provider, analytics approach (ADR-0006) | Pick on cost and VoIP detection | Brief 03 |
| D-09 | In-app payments/escrow | Not in Phase I; revisit in Phase II with dispute data | Phase II |
| D-10 | Ad network placement (brief said Phase II) | Sponsored listings in Phase II, FairXchange in Phase III | Phase II plan |
| D-11 | Phase I-B liquidity gate thresholds, set after 4 weeks of baseline | — | Phase II |

## Decided

| ID | Decision | Date | Record |
|---|---|---|---|
| D-01 | Name is **Hucxter** (code: `hucxter`). Mark: **Hx** | 2026-10-23 | CLAUDE.md § Brand |
| D-02 | Stack approved: Supabase + Next.js + Mux + Anthropic (Expo later removed by the desktop-first decision) | 2026-10-23 | ADR-0001 (amended) |
| D-03 | Apple HIG is the structural baseline for the whole platform and ecosystem | 2026-10-23 | ADR-0007; `hucxter-design-system` |
| D-04 | Concept mockups are reference only; final mockups come from the working MVP | 2026-10-23 | CLAUDE.md; roadmap §4 |
| D-12 | Hook/Problem/Solution copy reviewed and revised | 2026-10-23 | `docs/pitch/` |
| D-13 | iOS bundle ID will be `com.hucxter.app` when native iOS development begins (Phase V) | 2026-10-23 | ADR-0008 |
| D-14 | Primary domain is **hucxter.app** (resolves the brand/domain spelling mismatch) | 2026-10-23 | CLAUDE.md § Brand |
| D-15 | Full-bleed Hx icon master supplied; web icon set generated | 2026-10-23 | `assets/images/brand/` |
| D-16 | Revised pitch copy approved | 2026-10-23 | `docs/pitch/hook-problem-solution.md` |
| D-22 | **Platform sequence:** Phases I–III are desktop web (Chrome preferred) → Phase IV downloadable Chromium desktop app → Phase V native iOS | 2026-10-23 | ADR-0008 |
| D-31 | **Storefront IA:** top header + category bar + mega menu + big footer; no app sidebar; home = Feed = All; category index with filters; product page with "Is this still available?" and Available/Pending/Sold | 2026-10-24 | ADR-0009; `docs/specs/storefront-ia.md` |
| D-32 | **No guest interaction:** guests browse; every action requires a verified account (email + SMS, card verification possibly later) | 2026-10-24 | ADR-0009, ADR-0010 |
| D-34 | **Sign-up is email one-time code or Google**, then required phone SMS verification, 18+ attestation, and home ZIP. Facebook and TikTok removed. Supersedes D-25, D-26, D-33 | 2026-10-31 | ADR-0010 (amended); `docs/kickoff/brief-03.md` |
| D-35 | **Phase I-B launch area: Portland–Vancouver metro.** Coverage = 30 mi from ZIP 97205 (radius is the Chair's proposal; it's data in `service_areas`). Resolves D-06 | 2026-10-31 (radius proposed) | `service_areas` migration; roadmap |
| D-36 | Any valid US ZIP can be set by anyone, any time. Guest default with no other signal is the launch area (97205) | 2026-10-31 | `postal_areas` (all 2020 ZCTAs) |
| D-37 | **Mobile web is a first-class Phase I surface** per `docs/standards/mobile-experience-standard.md`, adapted for no shipping/payments | 2026-10-31 | ADR-0011 |
| D-41 | The next QA build is hosted on Vercel for the invite-only QA team | 2026-10-31 | Brief 03E |
| D-47 | The 3B direct-API phone-change gap (`PUT /auth/v1/user`, `POST /auth/v1/verify` outside the app's limits) is **accepted for the closed QA only**; a Supabase Send SMS hook closes it before the Phase I-B public beta | 2026-11-06 (accepted on PR #9) | `docs/runbooks/accounts.md` §5; `docs/kickoff/brief-03c.md` |
| D-42 | Members get a unique public **@handle** (profile URL `/u/[handle]`), auto-generated when onboarding completes, editable in settings at most once per 30 days; released handles are held for 30 days | 2026-11-07 (Founder, Brief 03C.2) | `docs/kickoff/brief-03c.md` §4.1; `docs/runbooks/accounts.md` |
| D-43 | Followers, following, likes, reposts, favorites, comments and public engagement counts are **deferred to Phase II** (creators). Phase I profiles show only real marketplace facts | 2026-11-07 (Founder, Brief 03C.2) | `docs/kickoff/brief-03c.md` §2 |
| D-44 | Profile photos: optional upload, re-encoded server-side to 512×512 WebP (all metadata stripped), stored in Supabase Storage; initials avatar by default. `AVATAR_UPLOADS=off` hides uploads | 2026-11-07 (Founder, Brief 03C.2) | `docs/kickoff/brief-03c.md` §4.5 |

## Superseded

| ID | Decision | Superseded by | Date |
|---|---|---|---|
| D-25 | Confirm sign-up methods: email one-time code + Facebook + TikTok, with **phone SMS verification required** before any action (ADR-0010) | D-34 | 2026-10-31 |
| D-26 | TikTok fallback if Supabase's custom OAuth provider can't handle TikTok's `client_key` / no-email flow | D-34 (TikTok removed) | 2026-10-31 |
| D-33 | Sign-up must offer **email, Facebook, and TikTok** | D-34 | 2026-10-31 |
| D-06 | Phase I-B launch area | D-35 (Portland–Vancouver) | 2026-10-31 |
