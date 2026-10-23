# ADR-0005: AI price guidance deferred
**Status:** Proposed · **Date:** 2026-10-22

## Context
The product spec promises fair-market price ranges with confidence intervals from a 5-second video
using local comps. We have no comparable-sales data, and a model cannot establish condition or value
from a short video.

## Decision
Phase I ships the AI **draft listing** assistant only (title, category, tags, condition notes,
observed attributes) — seller confirms everything. No price suggestion.

## Path to enabling
1. Collect our own completed-sale data (self-reported sold price) per category/area.
2. Evaluate licensed comps sources (terms must allow display and model use).
3. Ship a range only with: data source shown, sample size, date range, "estimate" labeling, evals.
Requires Founder approval and counsel check on pricing claims.
