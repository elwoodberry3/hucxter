# Founder Decisions

## Open

| ID | Decision | Chair recommendation | Blocks |
|---|---|---|---|
| D-23 | Approve category taxonomy v1 (`docs/specs/category-taxonomy.md`): 14 departments, filters, header order | Approve; it's data, so it's cheap to adjust later | Brief 02 |
| D-24 | Motor vehicles (cars, trucks, motorcycles, boats) in Phase I? | **No** for I-A/I-B. Parts & accessories only. Vehicles bring title fraud, odometer, and lien issues and a different scam profile; revisit after the liquidity gate | Brief 02 seed |
| D-25 | Confirm sign-up methods: email one-time code + Facebook + TikTok, with **phone SMS verification required** before any action (ADR-0010) | Approve | Brief 03 |
| D-26 | TikTok fallback if Supabase's custom OAuth provider can't handle TikTok's `client_key` / no-email flow | Time-boxed spike in Brief 03. If it fails, ship email + Facebook for I-A and add TikTok via a small token proxy right after | Brief 03 |
| D-27 | "Pending: someone's on the way": hours before the app asks the seller to confirm Sold or Available | Configurable; start with the end of the same day and tune with QA data | Brief 07 |
| D-28 | Placeholder hero and category art source | In-repo SVG/CSS illustrations now; Founder-supplied licensed photos later. No hotlinked stock | Brief 02 |
| D-29 | Guests can view full listing pages (actions gated) vs. sign-in required to open a listing | Guests can view. Better discovery, sharing, and search indexing; every *action* still needs a verified account | Brief 02 |
| D-30 | Home-page in-feed slot shows "Promoted by Hucxter" house promos in Phase I (reserves the FairXchange ad slot) | Approve; never a fake third-party ad | Brief 02 |
| D-17 | **Phone-to-desktop upload handoff.** Sellers usually film on a phone. Should the desktop Sell page show a QR code that opens a single-purpose, upload-only web page on the seller's phone, with the video landing in the desktop draft? It runs in the phone's browser, not a native app | Yes. It removes the file-transfer step that will most likely sink listing completion, and costs about one brief | Brief 05 |
| D-18 | **Message notifications outside the open tab.** Options: Chrome web push (works while Chrome runs), email (requires collecting an email address), SMS (per-message cost) | Web push plus an optional email, with SMS reserved for safety-critical events | Brief 07 |
| D-19 | Browser support beyond Chrome for public beta (Edge, Safari, Firefox on desktop) | Chrome only for I-A; before I-B, smoke-test Edge and Safari (the main desktop browsers outside Chrome) | Phase I-B |
| D-20 | Redirects: `hucxter.com` and `hucxster.app` → `hucxter.app` (301) | Yes. Configure at the DNS/edge level | Public beta |
| D-21 | Vector (SVG) master of the Hx mark | Provide when available, for sharper favicons and the Phase IV app | Nice to have |
| D-05 | Maximum video length and size; default discovery radius | Measure with QA testers; start short | Brief 05 |
| D-06 | Phase I-B launch area | One dense area the team can reach in person | Phase I-B |
| D-07 | Prohibited items list, terms, privacy policy, age policy, data retention | Counsel review. **Now also blocks Facebook/TikTok app review**, which needs live Terms + Privacy URLs on hucxter.app | Brief 03 (social login), public beta |
| D-08 | SMS provider for phone verification (e.g., Twilio, MessageBird, Vonage; check Supabase's supported list), bot-challenge provider, analytics approach (ADR-0006) | Pick on cost and VoIP detection | Brief 03 |
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
| D-33 | Sign-up must offer **email, Facebook, and TikTok** | 2026-10-24 | ADR-0010 |
