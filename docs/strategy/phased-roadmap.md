# HUCXSTER Phased Build Strategy

**Status:** Proposed by Advisory Chair, 2026-10-22 · **Requires:** Founder approval (see §6)

## 1. Executive recommendation
Build the marketplace first, prove liquidity in one area, then layer creators, then ads.
Each phase opens only when the previous phase's gate is met with real user behavior.
Build the *data foundations* for ads now (typed feed envelope, category taxonomy, consented
first-party events) — but no ad features until Phase II's gate.

```
Phase 0  Foundation ─► Phase I-A Closed alpha (QA team) ─► Phase I-B Local beta (1 area)
                                                                  │ Liquidity gate
                                                                  ▼
                    Phase II Creators & communities + Sponsored-listing test
                                                                  │ Monetization gate
                                                                  ▼
                    Phase III FairXchange ad network ──► Expansion (new areas, gated per area)
```

**Change from the brief:** the Founder placed the ad network in Phase II. Recommendation: put the
first, simplest ad product — **sponsored listings / seller boosts** — in Phase II as a test, and the
full FairXchange network (local-business native video, campaign tools, auction) in Phase III.
Sponsored listings use inventory and trust we already have; a full ad network needs audience scale
that doesn't exist until liquidity does.

## 2. Phases

### Phase 0 — Foundation (now)
Founder decisions D-01–D-08; repo scaffold; CI; schema v1; auth. Briefs 01–03.
**Exit:** `pnpm lint/typecheck/test` and DB tests green in CI; phone sign-in works on a device.

### Phase I-A — Closed alpha (internal QA buyer/seller team)
The core loop only:

| In | Out (later) |
|---|---|
| Phone sign-up, 18+ gate, profile with coarse home area | Follows, likes, comments, creator profiles |
| Record/upload short listing video; AI **draft** (title, category, tags, condition notes) | AI price guidance, negotiation, buyer "Real Talk" |
| Price, condition, category, publish, edit, mark reserved/sold, delete | Payments, escrow, shipping (never) |
| Local feed (radius ≤ 100 mi, recency), listing detail, save | Ranking models, Explore/Trending, search ranking |
| Item-linked messaging, safety notices, safe-exchange spot suggestions | Voice/video calls |
| Report, block, admin moderation console, audit log | Automated video moderation at scale |
| Events + liquidity scorecard in admin | Desktop/macOS apps (ui 3, 7, 12) |

**QA test protocol:** testers act as real buyers/sellers with real items in one area; scripted
abuse tests (scam messages, prohibited listings, prompt-injection text in videos, rate-limit abuse).
**Exit gate:** core loop works end-to-end on iOS + Android; zero open Critical/High findings;
all Phase I events flowing; trust-safety-reviewer pass on auth, location, messaging.

### Phase I-B — Local beta (one launch area)
Invite-only real sellers in one dense area (Founder picks — see D-06). Recruit supply in person:
resellers/flippers, furniture, bikes, sneakers, tools, baby gear — categories where video beats
photos and local pickup is natural. No paid acquisition until organic loop shows signal.
**Liquidity gate (thresholds set by Founder after 4 weeks of baseline, not invented here):**
% listings with a buyer thread within 7 days · median time to first message · self-reported sale
rate · repeat sellers/buyers · reports per 100 listings — sustained for N consecutive weeks.

### Phase II — Creators, communities & first monetization test
Creator profiles and follows; creator-led local commerce (shop tours, curated lists — ui 5 and
ui 11 concepts, limited to tagging **real local listings** with the lister's consent); interest
communities; Explore/ranking v1; App Attest / Play Integrity; Buyer deal-check (opt-in, factual);
AI price ranges only if ADR-0005 comps source is approved.
**Monetization test:** seller boosts / sponsored listings, labeled "Sponsored", frequency-capped,
priced as an experiment. Decide on payments/escrow here (D-09).
**Monetization gate:** sponsored items don't degrade liquidity metrics or trust (reports, hides);
measured willingness-to-pay from sellers.

### Phase III — FairXchange ad network
Local-business native video ads in the typed feed slot; self-serve campaign builder (budget,
area, category context, schedule); pacing and frequency caps; reporting; billing; brand safety;
"why am I seeing this". Contextual + in-session intent targeting only ("looking at bikes → bike
shop ad"). Sequence: managed (sales-assisted) campaigns → self-serve → evaluate external demand
only if it can meet the guardrails. Requires counsel on FTC ad/endorsement disclosure and state
privacy laws before launch.

### Expansion (runs per area, any phase after I-B)
New area opens only when the current area holds the liquidity gate and seed supply is recruited
in the new area. Never launch a new area with an empty feed.

## 3. Executive Board Review (simulated advisory lenses, not the real individuals' views)

| Seat | Primary concern | Recommendation | Key risk | Validating metric |
|---|---|---|---|---|
| 01 Marketplace trust & liquidity | Attention without transactions | Measure threads and completed sales, not views; safety in meetups from day one | Empty feed in beta kills buyers | % listings with a thread in 7 days |
| 02 Video discovery | Capture friction | Listing from camera to published in under a minute, AI fills the form | Video upload failures on weak networks | Draft-started → published rate |
| 03 Community & culture | Generic brand | Launch through 2–3 real local subcultures (bikes, sneakers, vintage) | Apple-clean UI reads as "another shop app" | Seller referrals per active seller |
| 04 Agentic AI | Over-trusting model output | Drafts only; prices off until comps exist; injection evals | AI misdescribes items → disputes | AI draft acceptance & edit rate; eval pass rate |
| 05 Network effects | Premature expansion | One area, density first; ads after liquidity | Pressure to expand for investor optics | Liquidity gate held N weeks |
| 06 Execution & capital | Scope and burn | Phase I-A in the smallest scope above; no desktop apps, no ads | Building the influencer/ad vision first | Weeks to alpha; cost per active listing |

**Unresolved disagreements (Founder decides):**
- **Payments (D-09):** Seat 01 wants in-app payment/escrow early for trust; Seat 06 says it adds
  regulatory and build cost before demand is proven. Chair: no payments in Phase I; revisit in II
  with dispute data.
- **Visual identity (D-03):** Seat 03 says the HIG-clean mockups risk a generic brand; Seat 02
  wants familiar, low-friction UI. Chair: HIG for structure/accessibility, plus a distinctive brand
  layer (type, color, motion, voice) — choose one direction, not both.
- **Ad timing:** Founder brief says Phase II; Seat 05 says after density. Chair: §1 split.

## 4. Screens to design next (replace H3/H4 gaps)
Record/upload listing · AI draft review & edit · Local feed (video, price, distance bucket, area) ·
Listing detail · Item-linked thread with safety notice · Meetup spot picker · Report/block ·
Sign-up/phone OTP/area · My listings · Admin moderation queue.

## 5. Risks & dependencies
Supply cold start (mitigation: in-person seller recruiting) · video cost per listing (track from
week 1) · physical meetup safety (curated spots, reporting) · prohibited/stolen goods (review queue)
· App Store review of marketplace + UGC apps (moderation, report/block, EULA required) · counsel for
terms, privacy policy, prohibited items, age policy, retention · vendor accounts (Supabase, Mux,
Anthropic, SMS provider, Apple/Google developer).

## 6. Founder decisions required
See `docs/decisions/open-decisions.md`. Blocking Brief 01: D-01, D-02. Blocking public beta: D-05,
D-06, D-07, D-08.
