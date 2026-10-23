# Pitch Copy Review — Hook, Problem, Solution (2026-10-23)

Reviewed: `hook-problem-solution.v0-original.md`. Revised: `hook-problem-solution.md`.
This is a strategy and accuracy review, not legal advice. Have counsel review any investor
materials and any public comparative claims before use.

## Must fix before any investor sees it

| # | Original | Issue | Revision |
|---|---|---|---|
| 1 | "We've already combined Craigslist's localized utility with TikTok's engagement—and 10,000 users are already hooked." | No app or users exist yet; 10,000 is a goal. Stating a goal as achieved traction to investors is a material misstatement, and diligence will catch it in the first data-room request. | Status line states the real stage (closed alpha) and labels 10,000 as a goal. |
| 2 | "Zero-Bot Security … eliminates spam and ensures you are always talking to a real neighbor." | An absolute guarantee no platform can meet. It sets up a "they promised" story after the first scam report, and it contradicts the trust-safety design (layered defenses). | "Built for Trust": names the actual defenses. |
| 3 | "Infinite Trust" | Unprovable superlative; same issue as #2. | "Real Neighbors." |
| 4 | "Helping sellers price accurately and helping buyers negotiate fairly." | Pricing and negotiation are deferred (ADR-0005) until we have real local sales data. Presenting them as built is inaccurate. | Phase I AI is the listing draft; pricing and deal checks are labeled as roadmap. |
| 5 | "Facebook Marketplace … aggressive throttling, paid boost requirements, and endless bot accounts." | Names a competitor with claims we can't document. Boosting is optional, not a requirement. Publicly, this is comparative-claim risk; with investors, it costs credibility if questioned. | Unnamed "big social marketplaces," with claims limited to paid boosts, opaque algorithms, and fake accounts. Name competitors on a separate, sourced competitive slide. |
| 6 | "Platforms that demand shipping fees" | Facebook Marketplace supports local pickup, so "demand" is inaccurate. | "Push shipping and fees." |

## Strategy changes

| # | Change | Why |
|---|---|---|
| 7 | Lead Slide 3 with video listings and local-only discovery instead of "reseller influencers" | Influencer/creator features are Phase II. Phase I's wedge is video plus local, and it should be the first thing investors remember. Creators moved to "What's Next." |
| 8 | "Video-First" replaces "Social-First Utility" | More concrete, and it matches what's actually being built. |
| 9 | Added "What's Next" with the ad thesis in one line | Shows investors the monetization path (creators → honest local ads) without claiming it exists. |
| 10 | "No hidden platform cuts" → "No hidden fees" | Keeps the transparency promise without ruling out the Phase II sponsored listings and future fees. |
| 11 | Name standardized to **Hucxter** (D-01) | Original used HUCXSTER. |
| 12 | Kept: the Shift line, the Craigslist decay point, "Zero Shipping," "Purely Local" | Strong, true, differentiated. |

## Before presenting
- Fill [launch area] and [timeframe], or delete the goal sentence.
- "10-second video" assumes the D-05 length decision; adjust it to match.
- Replace the concept mockups with screenshots of the working app once Phase I-A runs (D-04).
- Add a problem-evidence slide: seller and buyer interviews from the QA team and beta area, plus
  sourced market-size figures. Don't use unsourced statistics.

## Update 2026-10-23: approved, and checked against the desktop-first decision
The Founder approved v1 (D-16). It needs no wording change for the desktop-first platform sequence
(ADR-0008): nothing in it promises a phone app. Keep it that way. Don't add "download the app" or
app-store language until Phase IV/V exists. If investors ask about mobile, the answer is the platform
sequence: prove the model on desktop web first, then a desktop app, then native iOS.
