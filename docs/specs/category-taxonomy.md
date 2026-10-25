# Category Taxonomy v1 (Phase I)

**Status:** Proposed (Chair, 2026-10-24) for Founder approval (D-23, D-24).

**Basis:**
- The Founder's direction to "mimic Facebook Marketplace's category set."
- The department/subcategory structure of reference image `brief-1__ui.0002` (Electronics →
  Computers / Phones / Gaming / Audio & Video).
- Adjusted for a no-shipping, peer-to-peer, Phase I marketplace.

Hucxter's own names and structure are used; nothing is copied verbatim. Category names are generic
retail terms.

## Rules
- The taxonomy is **data, not code**: a `categories` table with `id`, `slug`, `parent_id`,
  `name`, `sort`, `is_active`, `hero_key`, and `attributes` (JSON). It's seeded from this file.
- The header category bar, mega menu, footer, filters, AI category suggestions, and future
  contextual ads (FairXchange) all read the same rows.
- Slugs are stable once released. Rename the display name, never the slug.
- Two levels in Phase I: department → subcategory. A third level only by ADR.
- **Out of Phase I:**
  - Property rentals and real estate: housing-law exposure.
  - Jobs and services: employment-law and scam exposure.
  - Live animals: prohibited.
  - Motor vehicles: see D-24. Parts and accessories are in.
  - Anything on the prohibited list (D-07).

## Common filters (every category)

| Filter | Values |
|---|---|
| Price | min / max (whole dollars), plus a **Free** toggle |
| Distance | 1, 5, 10, 25, 50, 100 mi (capped at the 100-mile radius) |
| Condition | New · Like new · Good · Fair · For parts |
| Posted | Last 24 h · 7 days · 30 days · Any |
| Status | Available only (default) · Include pending |
| Sort | Newest · Nearest · Price low→high · Price high→low |

## Departments, subcategories, and extra filters

| # | Department (slug) | Subcategories | Category-specific filters |
|---|---|---|---|
| 1 | Electronics (`electronics`) | Computers & Laptops · Phones & Tablets · Gaming · TV & Home Theater · Audio & Headphones · Cameras & Drones · Smart Home & Wearables · Accessories | Brand · Storage (phones/computers) · Screen size (TV, computers) · Platform (gaming) |
| 2 | Home & Living (`home`) | Furniture · Home Decor · Kitchen & Dining · Appliances · Bedding & Bath · Lighting · Storage & Organization | Material · Color · Room · Dimensions present (Y/N) |
| 3 | Garden & Outdoor (`garden-outdoor`) | Patio Furniture · Grills & Outdoor Cooking · Plants & Planters · Lawn & Garden Tools · Outdoor Decor | Power source (gas/electric/battery/manual) |
| 4 | Fashion (`fashion`) | Women's Clothing · Men's Clothing · Kids' Clothing · Shoes & Sneakers · Bags & Accessories · Jewelry & Watches | Size · Brand · Gender/fit · Color |
| 5 | Baby & Kids (`baby-kids`) | Baby Gear · Strollers & Car Seats · Nursery Furniture · Toys · Kids' Books | Age range |
| 6 | Sports & Outdoors (`sports-outdoors`) | Bikes · Fitness Equipment · Camping & Hiking · Team Sports · Water Sports · Golf · Hunting & Fishing gear (no firearms or ammunition) | Bike size / type · Brand |
| 7 | Tools & Home Improvement (`tools`) | Power Tools · Hand Tools · Building Materials · Outdoor Power Equipment · Plumbing & Electrical | Power source · Brand |
| 8 | Hobbies & Collectibles (`hobbies`) | Collectibles · Trading Cards · Art · Crafts & Sewing · Models & RC · Books, Movies & Music | Graded (cards) · Format (media) |
| 9 | Musical Instruments (`music`) | Guitars & Basses · Keyboards & Pianos · Drums & Percussion · DJ & Pro Audio · Band & Orchestra | Brand · Instrument type |
| 10 | Auto Parts & Accessories (`auto-parts`) | Wheels & Tires · Parts · Electronics & Audio · Tools & Garage · Motorcycle Gear | Fits make/model (free text) |
| 11 | Pet Supplies (`pet-supplies`) | Dogs · Cats · Fish & Aquariums · Small Animals · Birds. **Supplies only; no live animals** | Pet type |
| 12 | Office & Business (`office`) | Office Furniture · Office Electronics · Supplies · Restaurant & Retail Equipment | — |
| 13 | Free Stuff (`free`) | Furniture · Household · Kids · Other | Price fixed at $0 |
| 14 | Garage Sale & Misc (`misc`) | Bundles & Lots · Everything Else | — |

**Header category bar (in order):** All Categories ▾ · Electronics · Home & Living · Fashion ·
Sports & Outdoors · Tools · Baby & Kids · Free Stuff · More ▾. The mega menu lists all 14.

**Free Stuff is deliberate.** Free items move fast locally and seed both supply and buyer habits.

## Hero keys (placeholder art in Phase I)
Every department has a `hero_key`. Phase I uses **placeholder hero art**: in-repo SVG/CSS
illustrations or Founder-supplied, licensed images. Never hotlinked stock images; the CSP blocks
them anyway. Seasonal heroes (e.g., "Holiday finds near you") are content entries with start and end
dates, not code.

## Attribute schema (per category `attributes` JSON)
```json
{ "filters": [
  { "key": "brand", "label": "Brand", "type": "text" },
  { "key": "storage_gb", "label": "Storage", "type": "enum", "options": [64,128,256,512,1024] }
]}
```
Listing attributes are validated against their category's schema with zod
(`packages/contracts/taxonomy.ts`).
