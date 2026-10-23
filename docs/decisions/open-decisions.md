# Founder Decisions

## Open

| ID | Decision | Chair recommendation | Blocks |
|---|---|---|---|
| D-17 | **Phone-to-desktop upload handoff.** Sellers usually film on a phone. Should the desktop Sell page show a QR code that opens a single-purpose, upload-only web page on the seller's phone, with the video landing in the desktop draft? It runs in the phone's browser, not a native app | Yes. It removes the file-transfer step that will most likely sink listing completion, and costs about one brief | Brief 05 |
| D-18 | **Message notifications outside the open tab.** Options: Chrome web push (works while Chrome runs), email (requires collecting an email address), SMS (per-message cost) | Web push plus an optional email, with SMS reserved for safety-critical events | Brief 07 |
| D-19 | Browser support beyond Chrome for public beta (Edge, Safari, Firefox on desktop) | Chrome only for I-A; before I-B, smoke-test Edge and Safari (the main desktop browsers outside Chrome) | Phase I-B |
| D-20 | Redirects: `hucxter.com` and `hucxster.app` → `hucxter.app` (301) | Yes. Configure at the DNS/edge level | Public beta |
| D-21 | Vector (SVG) master of the Hx mark | Provide when available, for sharper favicons and the Phase IV app | Nice to have |
| D-05 | Maximum video length and size; default discovery radius | Measure with QA testers; start short | Brief 05 |
| D-06 | Phase I-B launch area | One dense area the team can reach in person | Phase I-B |
| D-07 | Prohibited items list, terms, privacy policy, age policy, data retention | Counsel review | Public beta |
| D-08 | SMS/phone-risk provider, bot-challenge provider, analytics approach (ADR-0006) | Pick on cost and VoIP detection | Brief 03 |
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
