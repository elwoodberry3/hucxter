---
name: hucxter-design-system
description: Hucxter UI rules built on Apple's Human Interface Guidelines — navigation, layout, typography, color tokens, icons, motion, accessibility, and the Hx brand. Use before building or changing any screen, component, or style in apps/mobile or apps/web.
---

# Hucxter design system (ADR-0007, D-03)

Apple's Human Interface Guidelines (HIG) are the structural baseline for every Hucxter surface:
iOS, Android, web, and the admin console. When a rule below is silent, follow the HIG.
Check the current HIG at developer.apple.com/design/human-interface-guidelines when in doubt;
don't rely on memory for specifics.

## Structure
- **Mobile navigation:** bottom tab bar, max 5 tabs. Phase I tabs: Feed · Search · Sell (center,
  opens capture) · Messages · Profile. Tab labels are always visible. Push navigation inside tabs;
  sheets for short tasks (filters, report, meetup spot); full-screen modal for capture.
- **Feed:** full-screen vertical video, one item per page. Overlay shows price, title, distance
  bucket, area label, and save/message/share actions. Overlay text sits on a legibility scrim.
- **Web/admin:** sidebar + content layout (the mockups' desktop pattern). Admin is functional,
  dense, and keyboard-navigable; no marketing styling.
- **Android:** same layout and components, but platform behaviors must work — system back
  gesture/button, edge-to-edge insets, Android share sheet, TalkBack.
- **Screens with no Phase I scope** in the mockups (cart, "Add to Bag", orders, official stores,
  star ratings, desktop menu-bar app, creator studio) are not built. See `CLAUDE.md` / D-04.

## Typography
- System font stack: SF Pro on Apple platforms, the platform default on Android, system-ui on web.
  Don't bundle Apple fonts on Android or web — check Apple's font license before any such use.
- Use the semantic text styles (Large Title, Title 1–3, Headline, Body, Callout, Subheadline,
  Footnote, Caption 1–2). Support Dynamic Type / font scaling; layouts must reflow at the largest
  accessibility sizes. Minimum 11 pt.

## Color (provisional tokens — tune in code, keep the names)
Sampled from the Hx app icon and mockups. All UI uses semantic tokens, never raw hex in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand.mark` | `#545072` | `#545072` | Hx icon background only |
| `accent` | `#6457AF` | `#AA9CEC` | Primary buttons, selected tab, links |
| `accent.subtle` | `#EEEAFB` | `#2B2745` | Selected chips, soft fills |
| `bg.primary` | system background | system background | Screens |
| `bg.secondary` | system grouped background | system grouped background | Cards, lists |
| `label.primary/secondary/tertiary` | system labels | system labels | Text |
| `destructive` | system red | system red | Remove listing, block, delete account |
| `success` | system green | system green | "Sold", confirmations |

Contrast: text meets WCAG 2.x AA (4.5:1 body, 3:1 large text) in both modes — verify with a
contrast check whenever a token changes. Light and dark mode both required from day one.

## Icons
One icon set across iOS, Android, and web so the product looks the same everywhere. Use a
cross-platform, permissively licensed set (Lucide is the default suggestion; confirm the license in
the PR). SF Symbols' license is understood to limit use to Apple platforms — don't ship them on
Android or web unless Apple's current license terms say otherwise.

## Spacing, shape, depth
- 8 pt spacing grid (4 pt for tight internals). Standard margins 16 pt on phones.
- Corner radius: 12 pt cards, 10 pt buttons, continuous corners where the platform supports it.
- Depth via materials and subtle shadows only; no hard offset shadows, heavy borders, or neon
  (superseded neubrutalism draft).

## Interaction & accessibility (non-negotiable)
- Hit targets ≥ 44 × 44 pt. Every interactive element has an accessibility label and role;
  video items announce title, price, distance bucket, and area.
- Respect Reduce Motion (no autoplay transitions; crossfade instead), Reduce Transparency,
  Bold Text, and Low Data Mode (no feed autoplay on cellular in Low Data Mode).
- Feed video starts muted; captions/overlays never carry information that only audio carries.
- Destructive actions (remove listing, block, delete account) confirm with a clear, specific
  title, as in the mockups' "Remove listing?" dialog.
- Haptics: light impact on save, success on publish. Never as the only feedback.

## Voice
Plain, direct, friendly, local. Short labels ("Message seller", "Mark as sold"). Safety copy is calm
and specific, never alarmist. AI-generated text is labeled "AI draft — check before posting."

## Brand assets
- `assets/images/app-icon.png` is a pre-rounded 1080 px RGBA image with transparent corners.
  App stores need a full-bleed square master with no transparency and no rounded corners (the OS
  applies the mask). Ask the Founder for the full-bleed source; don't crop or recolor it yourself.

## Verification for UI changes
Screenshot each changed screen in light and dark mode and at the largest Dynamic Type size, and run
the platform accessibility inspector. Attach the screenshots to the PR.
