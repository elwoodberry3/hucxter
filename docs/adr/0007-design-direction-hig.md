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
- Android follows the same structure but must keep platform behaviors (back navigation, insets,
  TalkBack). Apple-only assets (SF fonts, SF Symbols) aren't shipped on Android or web.
- Risk carried forward from the board review (Seat 03): a clean HIG app can feel generic. Mitigate
  through brand color, voice, the Hx mark, and community — not by breaking conventions.

## Alternatives rejected
Neubrutalism (distinctive, but fights platform conventions and accessibility); Material Design on
Android plus HIG on iOS (two design systems to maintain for a small team).
