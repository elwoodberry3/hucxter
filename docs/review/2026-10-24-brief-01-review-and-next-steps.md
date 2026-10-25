# Brief 01 Review & Next Steps — 2026-10-24

**For:** Founder, leadership, Claude Code · **From:** Advisory Board Chair
**Inputs reviewed:**
- `main` @ e08266e (PR #2 merged; CI green on `main`).
- Localhost screenshot `brief-1__ui.0001`.
- Header/mega-menu reference `brief-1__ui.0002`.
- Taxonomy reference `search-ref-001`.
- Sprint grooming transcript (2026-10-24).
- New requirement: sign-up with email, Facebook, or TikTok.

## 1. Executive recommendation
Brief 01 met every acceptance criterion and gives us a solid, secure foundation. Its visible shell
(a left app sidebar) is replaced, not polished. The next build is **Brief 02: Storefront layout +
category taxonomy**:
- an Amazon/eBay-style header with categories and a mega menu
- a full home page that looks alive with zero listings and contains no fake ones
- category pages with filters
- the product-page template with "Is this still available?"
- a big footer
- sign-in gating

**Brief 03** then builds sign-up with **email, Facebook, and TikTok** plus required phone
verification. TikTok needs a short technical spike first.

## 2. What Brief 01 delivered (verified)
| Area | Result |
|---|---|
| Tests | Lint and typecheck clean; 12 unit tests, 66 end-to-end tests; DB tests pass; CI green on `main` |
| Accessibility | Zero serious or critical issues on every page, light and dark mode |
| Security | Strict per-request content-security policy, HSTS, frame blocking, validated config; independent review found nothing above Low (5 of 6 Lows fixed) |
| Engineering judgment | Refused to weaken security to make a component work; pinned a day-old Next.js release rather than bypass the supply-chain age check |

**Carry-forward items:**
- Pin CI actions to commit hashes and add Dependabot.
- Three lint plugins run on ESLint 10 outside their declared support.
- The Mux player will need content-security-policy work in Brief 05.
- HSTS covers all subdomains, so every `hucxter.app` subdomain must serve HTTPS before launch.

## 3. What the grooming session decided (now ADR-0009, D-31–D-33)
1. **Storefront, not app shell.**
   - Remove the sidebar and the duplicate search.
   - Top header: logo, location ("Near Aubrey 75009"), search, + Sell, Messages, account menu.
   - A category bar with an "All Categories" mega menu, and subcategory chips on deeper pages.
   - A big footer.
2. **Home = Feed = All.** It must feel full and vibrant even with no data, through hero banners,
   category cards, near-you rails, and house promos.
3. **Category index pages** with a hero, a filter rail (the only left rail in the product), and a
   results grid.
4. **Product page template:**
   - Vertical video plus an eBay-style detail column.
   - A one-tap "Is this still available?" message.
   - Status **Available / Pending: someone's on the way / Sold**. "They didn't show" returns the
     item to Available.
5. **No guest interaction.** Guests browse; every action requires an identified, verified person
   (email + SMS, possibly a card later).
6. **Categories modeled on Facebook Marketplace.** The proposed taxonomy is 14 departments with
   subcategories and per-category filters (`docs/specs/category-taxonomy.md`).

## 4. Advisory perspectives (simulated lenses, not real individuals' views)
- **Seat 01 (Trust & liquidity).**
  - "Never feel empty" is right for first impressions. **Fake listings are the line.**
  - QA and beta users who message a fake item lose trust in every real one, and the governance
    contract forbids manufacturing activity.
  - Fill the space with editorial content and invitation cards; demo listings only in local and
    QA, labeled.
- **Seat 02 (Discovery).**
  - Category-led browsing suits a thin inventory better than a single endless feed, because empty
    categories show an honest "be the first" message instead of a dead scroll.
  - The "Is this still available?" one-tap action is the strongest conversion pattern in local
    commerce. Make it the primary action.
- **Seat 03 (Community).**
  - Facebook and TikTok sign-in match the 21–35 audience.
  - Keep **Free Stuff** as a top-level category: it seeds habit and supply fast.
- **Seat 04 (Responsible AI and identity).** Sign-in method ≠ verification. Whichever door
  someone uses, **phone verification is the real anti-bot control** before messaging or selling.
- **Seat 06 (Execution).**
  - TikTok login is the riskiest piece: Supabase has no built-in TikTok provider and TikTok returns
    no email. Spike it; don't let it block the alpha.
  - Meta and TikTok app reviews need live Terms and Privacy pages, so start legal pages now.

**Unresolved:** motor vehicles. The Founder wants Facebook-style categories (which include
vehicles); the Chair recommends parts and accessories only until after the liquidity gate (D-24).

## 5. Sign-up design (ADR-0010, Proposed)
| Step | Email | Facebook | TikTok |
|---|---|---|---|
| Create account | One-time code by email (no passwords) | Supabase built-in provider | Supabase custom OAuth2 provider; may need a small token proxy (TikTok uses `client_key`) |
| Email | Confirmed by the code | Provided by Facebook (with `email` permission) | **Not provided**; user adds and confirms one |
| Phone (SMS code) | Required before any action | Required | Required |
| 18+ and home ZIP | Required | Required | Required |
| Outside approvals | — | Meta app review + Live mode; Privacy and Terms URLs | TikTok Login Kit review; Privacy and Terms URLs |

## 6. Next steps
**Founder (this week)**
1. Review and merge **PR #3** (these documents).
2. Decide D-23 (taxonomy), D-24 (vehicles), D-28 (art), D-29 (guests view listings), and D-30
   (house-promo slot). Defaults are in place if you agree with the Chair's recommendations.
3. Paste **Brief 02** into Claude Code (prompt below / in `docs/kickoff/claude-code-kickoff.md`).
4. **Start in parallel; these block Brief 03:**
   - Draft Terms of Service and Privacy Policy with counsel and publish them at
     hucxter.app/terms and /privacy (D-07).
   - Create a **Meta developer app** (Facebook Login) and a **TikTok developer app** (Login Kit),
     in development mode only.
   - Choose an **SMS provider** for phone verification (D-08).
   - Decide D-25 and D-26.

**Claude Code:** Brief 02 now; Brief 03 (accounts & verification) after the steps above.

**Chair:** review Brief 02's PR (screenshots, accessibility, redirect and cookie security), then
expand Brief 03.

## 7. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Placeholder content drifting into fake marketplace activity | High | Rule in CLAUDE.md + design skill; demo data blocked in production by test |
| TikTok login incompatible with Supabase custom provider | Medium | Spike first; fallback D-26 |
| Social-login app reviews delayed by missing legal pages | Medium | Start Terms/Privacy now |
| IP-based location wrong or felt as intrusive | Low | Shown as a guess, one click to change, ZIP-only storage |
| Taxonomy churn after launch | Low | Data-driven; stable slugs, renameable labels |

## 8. Definition of done for Brief 02
- No sidebar.
- A guest home page that looks complete with zero listings.
- All 14 departments navigable by mouse and keyboard, with filters in the URL.
- The product template visible only in local/QA.
- Every action routes to sign-in and back.
- Accessibility and content-security-policy tests pass.
- Independent security review with no blocking findings.
