# ADR-0009: Storefront information architecture (top header + categories, no app sidebar)
**Status:** Accepted (Founder, sprint grooming 2026-10-24). Details marked *(proposed)* need
Founder confirmation before they ship. **Amends:** ADR-0007 layout section; supersedes the
"sidebar + toolbar" shell built in Brief 01.

## Context
The Brief 01 shell (persistent left sidebar: Feed, Search, Sell, Messages, Saved, My Listings,
Profile, plus a toolbar) works but reads as an empty app. In the Brief 01 review the Founder
compared it with Amazon, eBay, Apple, and Facebook Marketplace when signed out. The direction:
- First-time visitors must see a **full, vibrant storefront**, even with no data.
- Navigation runs along the **top**: no app sidebar, and no duplicate search.
- **Categories drive discovery.**
- Every interaction needs an account, so there's no "continue as guest."

## Decision
1. **Global header** (every page):
   - Hx mark + "Hucxter", which links home.
   - Location chip ("Near Aubrey 75009 · Change").
   - One search field.
   - **+ Sell** primary button, Messages icon, and an account control. Guests see **Sign in**;
     members see an avatar menu.
2. **Category bar** under the header:
   - "All Categories" opens a mega menu with departments on the left and subcategory columns on the
     right (reference: `brief-1__ui.0002`).
   - Then the top-level categories and **More**.
   - On category and product pages, a **subcategory row** appears under the primary row.
3. **The left app sidebar is removed.**
   - Search lives only in the header.
   - Sell, Messages, Saved, My Listings, Profile, and Settings move into the **account menu**
     (Sell and Messages also stay as header buttons).
   - The only left rail in the product is the **filter panel** on category index and search
     results pages.
4. **Home = Feed = "All."** `/` is the storefront: a hero, category cards, local rails, and house
   promos. Clicking the logo returns here.
5. **Category index** (`/c/[category]` and `/c/[category]/[subcategory]`):
   - Hero banner.
   - Left filter panel. Common filters plus category-specific ones from the taxonomy.
   - Results grid of listing cards, sortable.
   - A designed empty state when there are no results.
6. **Product page template** (`/l/[listingId]`):
   - Vertical video (TikTok-style) beside an eBay/Amazon-style detail column: price, condition,
     distance bucket, area, attributes, seller summary, status.
   - A primary one-tap **"Is this still available?"** message, as on Facebook Marketplace.
   - Status: **Available**, **Pending: someone's on the way**, or **Sold**.
7. **Big footer** on every page: categories, Sell on Hucxter, Safety & meetup tips, Help, About,
   Terms, Privacy, Contact.
8. **Guest access:** guests can browse the home, category, product, and search pages. Every action
   routes to **Sign in / Create account** and then returns to where the guest was. Those actions are
   messaging, Is-this-available, save, sell, report, viewing your own areas, and following.
9. **Never empty, never fake:**
   - Editorial content may be placeholder art: heroes, category cards, house promos, and labeled
     ad-slot placeholders.
   - **Listings may never be fabricated.** Demo listings exist only in local and QA environments,
     carry a visible "Demo" label, and are blocked from production by an environment check.

## Why
- **Liquidity and trust.** A storefront that looks alive gets first visitors to explore. Fake
  inventory that turns out not to exist destroys trust and breaks the governance rule against
  manufacturing marketplace activity.
- **Familiarity.** Top-nav, category-led commerce is what the target audience already uses.
- **Simpler navigation.** One search, one account menu, and a filter rail where it means something.

## Consequences
- The shell, nav tests, and screenshots from Brief 01 are replaced in Brief 02.
- The design-system skill's layout section is rewritten to match this ADR.
- Category taxonomy becomes data: DB table + seed, with attributes driving filters
  (`docs/specs/category-taxonomy.md`).
- Guest location uses approximate, visible, editable IP-based location (geo skill update).

## Alternatives considered
- **Keep the sidebar:** it read as empty and duplicated search.
- **Hidden hamburger sidebar:** it hides key destinations on a desktop screen with plenty of room.
- **Guest mode with messaging:** rejected because anonymous contact enables scams.
