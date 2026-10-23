# Founder Decisions

## Open

| ID | Decision | Chair recommendation | Blocks |
|---|---|---|---|
| D-13 | iOS bundle ID / Android application ID (permanent once published to the stores) | `com.hucxter.app`: reverse-DNS of hucxter.com, a domain you hold, and it matches the brand | Brief 01 (app config) |
| D-14 | Brand/domain spelling mismatch: brand **Hucxter**, primary domain **hucxster.app** | Register `hucxter.app` if it's available and make it primary, keeping hucxster.app as a redirect. Otherwise accept the mismatch knowingly. Include both spellings in the trademark search | Public beta, marketing |
| D-15 | Full-bleed app icon master (1024 px or larger, square, no transparency, no pre-rounded corners) | Export from the Hx source file | Store submission |
| D-16 | Approve revised pitch copy (`docs/pitch/hook-problem-solution.md`) | Approve. The original makes claims that aren't true yet | Investor use |
| D-05 | Maximum video length and size; default discovery radius | Measure with QA testers; start short | Brief 05 |
| D-06 | Phase I-B launch area | One dense area the team can reach in person | Phase I-B |
| D-07 | Prohibited items list, terms, privacy policy, age policy, data retention | Counsel review | Public beta |
| D-08 | SMS/phone-risk provider; analytics approach (ADR-0006) | Pick on cost and VoIP detection | Brief 03 |
| D-09 | In-app payments/escrow | Not in Phase I; revisit in Phase II with dispute data | Phase II |
| D-10 | Ad network placement (brief said Phase II) | Sponsored listings in Phase II, FairXchange in Phase III | Phase II plan |
| D-11 | Phase I-B liquidity gate thresholds, set after 4 weeks of baseline | — | Phase II |

## Decided

| ID | Decision | Date | Record |
|---|---|---|---|
| D-01 | Name is **Hucxter** (code: `hucxter`). Domain `hucxster.app`; `hucxter.com` redirects permanently to it. App icon is the **Hx** mark | 2026-10-23 | CLAUDE.md § Brand |
| D-02 | Phase I stack approved: Supabase + Next.js API/admin + Expo + Mux + Anthropic | 2026-10-23 | ADR-0001 Accepted |
| D-03 | Apple HIG is the structural baseline for the whole platform and ecosystem | 2026-10-23 | ADR-0007; `hucxter-design-system` skill |
| D-04 | Concept mockups are reference only. Final mockups come from the working MVP and are produced for investors once Phase I proves out | 2026-10-23 | CLAUDE.md; roadmap §4 |
| D-12 | Hook/Problem/Solution copy received and reviewed; revision proposed (see D-16) | 2026-10-23 | `docs/pitch/` |
