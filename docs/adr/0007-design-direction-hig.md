# ADR-0007: Apple HIG as the platform design baseline
**Status:** Accepted (Founder, D-03) · **Date:** 2026-10-23

## Context
The superseded draft CLAUDE.md required a neubrutalist style (hard 3–4 px borders, offset black
shadows, neon). The concept mockups follow Apple's Human Interface Guidelines. One direction had to
win so Claude Code and the investor materials don't diverge.

## Decision
The entire Hucxter platform and ecosystem uses Apple's Human Interface Guidelines as its structural
baseline: navigation, layout, typography, accessibility, and interaction patterns. Brand identity is
expressed through the Hx mark, color tokens, motion, and voice. Rules live in
`.claude/skills/hucxter-design-system/`.

## Consequences
- Familiar, low-friction UI for buyers and sellers; accessibility comes largely for free.
- Phase I–III are desktop web (ADR-0008), so the relevant HIG patterns are the macOS ones: sidebar,
  toolbar, sheets, popovers, keyboard-first interaction, rendered in Chrome on both Mac and
  Windows. Apple-only assets (SF fonts, SF Symbols) aren't shipped on the web or on Windows.
- When native iOS starts (Phase V), the iOS HIG applies to that app.
- Risk carried forward from the board review (Seat 03): a clean HIG app can feel generic. Mitigate
  through brand color, voice, the Hx mark, and community — not by breaking conventions.

## Alternatives rejected
Neubrutalism (distinctive, but fights platform conventions and accessibility); a generic web UI kit
look (fast to build, but no coherent system to carry into the desktop and iOS apps).
