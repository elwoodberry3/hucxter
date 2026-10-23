# Hucxter Phased Build Strategy

**Status:** Proposed by Advisory Chair 2026-10-22 · updated 2026-10-23 with D-01–D-04, D-12–D-16,
and the desktop-first platform sequence (ADR-0008) · **Requires:** Founder approval of open items (§7)

## 1. Executive recommendation
Build the marketplace first as a **desktop web app in Chrome**, prove liquidity in one area, then add
creators, then ads. Ship a downloadable desktop app after the ad network, and native iOS only once
the model is proven on desktop. Each phase opens only when the previous phase's gate is met by real
user behavior. Build the data foundations for ads now (typed feed envelope, category taxonomy,
consented first-party events), but no ad features until Phase II's gate.

```
                         ┌──────────── Desktop web (Chrome) ────────────┐
Phase 0 Foundation ─► I-A Closed alpha ─► I-B Local beta ─► II Creators + sponsored test ─► III FairXchange ads
                                          (liquidity gate)   (monetization gate)                │
                                                                                                 ▼
                                             IV Downloadable desktop app (Chromium) ─► V Native iOS (com.hucxter.app)
Expansion to new areas runs per area, after I-B, whenever the current area holds the liquidity gate.
```

**Ad placement (D-10, still open):** the Founder brief placed the ad network in Phase II.
Recommendation: put **sponsored listings / seller boosts** in Phase II as a test, and the full
FairXchange network in Phase III. A full ad network needs an audience that only exists once there's
liquidity.

## 2. Phases

### Phase 0 — Foundation (now)
Repo scaffold, CI, schema v1, auth, and the web app shell in Chrome. Briefs 01–03.
**Exit:** lint, typecheck, unit, DB, and Playwright tests green in CI; phone-OTP sign-in works in
desktop Chrome on a deployed preview URL.

### Phase I-A — Closed alpha (internal QA buyer/seller team, desktop Chrome)
The core loop only:

| In | Out (later) |
|---|---|
| Phone sign-up, 18+ gate, profile with coarse home area (ZIP) | Follows, likes, comments, creator profiles |
| Upload short listing video (drag-and-drop/file picker); AI **draft** (title, category, tags, condition notes) | AI price guidance, negotiation, buyer "Real Talk" |
| Price, condition, category, publish, edit, mark reserved/sold, delete | Payments, escrow, shipping (never) |
| Local feed (radius ≤ 100 mi, recency) with keyboard navigation, listing detail, save | Ranking models, Explore/Trending, search ranking |
| Item-linked messaging (live), safety notices, safe-exchange spot suggestions, message notifications (D-18) | Voice/video calls |
| Report, block, admin moderation console, audit log | Automated video moderation at scale |
| Account deletion; published support contact; sessions list with "sign out everywhere" | |
| Events + liquidity scorecard + desktop-risk metrics in admin | Mobile layouts, desktop app, native apps |

**QA test protocol:** testers act as real buyers and sellers with real items in one area, using
desktop Chrome on both Mac and Windows. Scripted abuse tests cover scam messages, prohibited
listings, prompt-injection text in videos, rate-limit abuse, and CSRF/XSS probes.
**Exit gate:** core loop works end-to-end in desktop Chrome; zero open Critical/High findings; all
Phase I events flowing; trust-safety-reviewer pass on auth, sessions, location, messaging.

### Phase I-B — Local beta (one launch area, desktop web)
Invite-only real sellers in one dense area (D-06). Recruit supply in person: resellers/flippers,
furniture, bikes, sneakers, tools, baby gear. These are categories where video beats photos and
local pickup is natural. Resellers and flippers often work from a computer already, which suits a
desktop-first launch. No paid acquisition until the organic loop shows signal.
**Liquidity gate (thresholds set by Founder after 4 weeks of baseline, not invented here):**
% of listings with a buyer thread within 7 days · median time to first message · self-reported sale
rate · repeat sellers/buyers · reports per 100 listings, sustained for N consecutive weeks.
**Desktop-fit check (ADR-0008):** draft-to-published rate, upload failure rate, time to first seller
reply, share of messages unread after 24 h. If these are poor, revisit D-17/D-18 before Phase II.

### Phase II — Creators, communities & first monetization test (desktop web)
Creator profiles and follows; creator-led local commerce (shop tours and curated lists from the
mockup 5 and 11 concepts, limited to tagging **real local listings** with the lister's consent);
interest communities; Explore/ranking v1; buyer deal-check (opt-in, factual); AI price ranges only if
the ADR-0005 comps source is approved.
**Monetization test:** seller boosts / sponsored listings, labeled "Sponsored," frequency-capped,
priced as an experiment. Decide on payments/escrow here (D-09).
**Monetization gate:** sponsored items don't degrade liquidity or trust metrics (reports, hides);
seller willingness to pay is measured.

### Phase III — FairXchange ad network (desktop web)
Local-business native video ads in the typed feed slot; self-serve campaign builder (budget, area,
category context, schedule); pacing and frequency caps; reporting; billing; brand safety; "why am I
seeing this." Contextual and in-session intent targeting only ("looking at bikes → bike shop ad").
Sequence: managed (sales-assisted) campaigns → self-serve → external demand only if it meets the
guardrails. Counsel must review FTC ad/endorsement disclosure and state privacy laws before launch.

### Phase IV — Downloadable desktop app (Chromium)
An installable Mac/Windows app, built the way Postman ships, that wraps the same web app.
- Adds native notifications, a menu-bar/tray presence (mockup 3), launch at login, and an
  onboarding wizard (mockups 7, 12).
- Electron vs. Tauri goes in a future ADR (bundle size, security model, auto-update, code signing).
- Needs code signing and notarization (Apple Developer ID, Windows certificate), an auto-update
  channel, and device attestation hooks.
**Entry gate:** Phase III running; web app stable; demand for the app shown by user requests or
notification gaps.

### Phase V — Native iOS app (`com.hucxter.app`)
Begins once the model, users, and videos are proven on desktop. Uses the iOS HIG, in-app camera
capture, push notifications, App Attest, and App Store requirements (UGC 1.2 and account deletion
5.1.1(v) already exist from Phase I). Reuses the API and `packages/contracts`. Technology choice
(SwiftUI vs. cross-platform) goes in a future ADR.

### Expansion (runs per area, any time after I-B)
A new area opens only when the current area holds the liquidity gate and seed supply has been
recruited in the new area. Never launch a new area with an empty feed.

## 3. Executive Board Review — desktop-first platform decision (2026-10-23)
*Simulated advisory lenses, not the real individuals' views.* The Founder has decided the platform
sequence (ADR-0008). This review covers risks and mitigations, not whether to do it.

| Seat | Primary concern | Recommendation | Key risk | Validating metric |
|---|---|---|---|---|
| 01 Marketplace trust & liquidity | Buyers and sellers coordinate meetups on the go | Reliable message notifications away from the desk (D-18) | Missed messages → no-shows → no repeat trades | Share of messages unread after 24 h; meetup confirm rate |
| 02 Video discovery | Sellers film on phones, so desktop adds a transfer step | Phone-to-desktop handoff in the browser (D-17); fast drag-and-drop upload | Listings abandoned between filming and posting | Draft-started → published rate; time to list |
| 03 Community & culture | 21–35 audience watches short video on phones | Lead with resellers/flippers who already work at a computer; desktop is a fine home for "shop tours" | The feed feels like a website, not a scroll habit | Weekly returning viewers; sessions per buyer |
| 04 Agentic AI | Unchanged | Drafts only; injection evals | — | Draft acceptance and edit rate |
| 05 Network effects | Desktop limits reach in the beta area | Measure reach before expanding; don't count signups as liquidity | Low density → empty feed | Liquidity gate |
| 06 Execution & capital | Scope | **Supports** desktop-first: one codebase, no app-store review, fastest iteration, and the QA team works on desktop | Pressure to build iOS early | Weeks to alpha; cost per active listing |

**Chair synthesis:** desktop-first is the right execution call for Phase I-A, since the QA team, the
admin console, and fast iteration all favor it. The real risks are seller capture friction and
missed messages. Both can be reduced without a native app: a browser-based phone handoff for
uploads (D-17) and an out-of-browser notification channel (D-18). Measure the desktop-fit metrics
in I-B before deciding anything further.

**Other unresolved disagreements:**
- **Payments (D-09):** Seat 01 wants payments/escrow early for trust; Seat 06 says it adds
  regulatory and build cost before demand is proven. Chair: no payments in Phase I; revisit in II.
- **Ad timing (D-10):** see §1.

## 4. Phase I screens to build (D-04: built directly in the MVP, HIG desktop baseline)
App shell (sidebar + toolbar) · Sign-up / phone OTP / ZIP area · Local feed (video column + detail
panel) · Listing detail page · Sell: upload → AI draft review → publish · My listings · Messages
(thread list + item-linked thread with safety notice) · Meetup spot picker · Report/block sheets ·
Account settings (sessions, notifications, delete account) · Admin moderation console.

The concept mockups in `assets/images/ui/` guide layout and tone only. Investor visuals will be
captured from the working MVP after Phase I-A, using seeded demo data that's labeled as demo.

## 5. Risks & dependencies
- Supply cold start: recruit sellers in person.
- Seller capture friction on desktop: D-17.
- Missed messages on desktop: D-18.
- Video cost per listing: track from week 1.
- Physical meetup safety: curated spots and reporting.
- Prohibited or stolen goods: review queue.
- Counsel needed for terms, privacy policy, prohibited items, age policy, and retention.
- Vendor accounts: Supabase, Mux, Anthropic, SMS provider, bot-challenge provider, Vercel.
- Phase IV/V needs: Apple Developer account, Windows code-signing certificate.

## 6. Domains & brand
Primary domain **hucxter.app** (D-14). Recommended: `hucxter.com` and `hucxster.app` 301-redirect to
it. The Hx icon master and web icon set are in `assets/images/brand/` (D-15).

## 7. Founder decisions required
See `docs/decisions/open-decisions.md`. Nothing blocks Brief 01. D-17 and D-18 should be decided
before Brief 05/07. Blocking public beta: D-05, D-06, D-07, D-08.
