---
agent: architecture-reviewer
type: open-question
id: data-shape-divergence-at-graphviz-boundary
schema-version: 1
date-raised: 2026-04-25
status: open
resolved-date: null
resolution: null
---

# Engine/UI data-shape divergence at the GraphViz boundary

## Question

With edge consolidation introduced in iter 8, the engine stores transitions keyed by `(from, symbol) → Set<destinations>` while the visual edge model is keyed by `(from, to)` with a `symbols: ReadonlyArray<string|null>` field. The regroup happens inline in `automatonToDot` (and inverse in `parseEdgeLabel`), both inside `src/ui-state/utils.ts`.

Is that the right home for this translation? Or should `src/ui-state/` grow a dedicated module that owns the engine→visual data-shape conversion explicitly (e.g., `src/ui-state/visualModel.ts`)?

## Why it matters

The current placement keeps the conversion at the GraphViz boundary, which works because GraphViz is the consumer that needs the consolidated shape. But if the codebase ever needs the consolidated shape elsewhere (drag-drop overlays, conversion features like NFA→DFA, SVG export without GraphViz round-trip), the regroup logic will either be duplicated or extracted under pressure. Extracting it now while the requirements are simple is cheap; extracting later under load is expensive.

## What's known so far

- The current placement is structurally correct (typed → opaque → typed funnel, single owner).
- Edge consolidation is currently the only engine→visual divergence. If a second appears, that's a stronger signal to extract.
- The conversion is currently small (~30 lines) — extraction would be premature if no second consumer materializes.

## What would resolve it

Defer to project owner. The right time to revisit:

- When a second engine→visual divergence appears (e.g., a layout that wants different grouping than GraphViz's input).
- When iteration 11 (edge routing) or a future NFA→DFA conversion feature lands and needs the consolidated shape outside the GraphViz boundary.
- When `src/ui-state/utils.ts` grows past ~600 lines and natural splitting points emerge.

Until any of those, the current placement is fine. Mark resolved if and when a structural reason to extract materializes.
