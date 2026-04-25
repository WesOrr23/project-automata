---
agent: architecture-reviewer
type: knowledge
topic: external-dependency-boundary
schema-version: 1
verified-as-of: 2cf5e42
last-updated: 2026-04-25
confidence: high
---

# External Dependency Boundary

## Principle

When the UI layer adopts an external dependency that produces opaque output (text, JSON, blob), the conversion `typed → opaque → typed` should happen inside exactly one module, with the typed-output stage taking the original typed input as a cross-reference. The rest of the UI never sees opaque output.

## Origin

Iteration 3 (commit `2cf5e42`). `src/ui-state/utils.ts` adopted GraphViz WASM. The module exposes one async function `computeLayout(automaton): Promise<AutomatonUI>`. Internally:

1. `automatonToDot(automaton)` — typed → DOT string
2. `graphviz.dot(dotString, 'json')` — opaque → opaque
3. `parseGraphvizJson(jsonString, automaton)` — opaque → typed (note: takes original automaton for cross-reference, e.g. to filter phantom nodes and validate state IDs)

No other UI module imports `@hpcc-js/wasm-graphviz`; no other module sees DOT or GraphViz JSON.

## Why it matters

- The opaque-data zone is geographically small. Bugs in that zone are localizable.
- Swapping the dependency (as iter-3 itself demonstrated, dagre→GraphViz) only touches one file.
- The cross-reference in step 3 — passing the typed input back into the parser — guards against the parser inventing entities the typed layer never had. It is the difference between "trust the library" and "use the library, then verify."

## What to look for in diffs

- A new component or hook importing the layout dependency directly: violation. Route through `computeLayout`.
- A parse function that doesn't take the typed source as a parameter: weaker than necessary; the cross-reference defense is what catches phantom outputs.
- Silent defaults at the parse seam (`?? 0`, `parseFloat(x ?? '0')`): structural correctness without operational loudness. Consider whether the parser should throw on shape violations instead. The iter-3 endpoint chose silence; a later iteration may want to revisit.
- A second adopter of the same library outside this module: ask whether the wrapper should be exported instead.

## What's fine

- The wrapper itself being long (the present `utils.ts` is ~480 lines). Concentrating the messy adapter code is the point.
- Async leakage when the library forces it (WASM init made `computeLayout` async; that's an unavoidable cost, not a violation).
- Internal helpers being private module functions — but note this creates a testing gap (qa-reviewer's `known-coverage-gaps.md` lists `parseEdgePos`, `controlPointsToSvgPath`, `flipY` for this reason).

## Provenance

`src/ui-state/utils.ts` at commit `2cf5e42`. Pivot history: dagre adoption at `3fd2faa`, replacement at `2cf5e42` demonstrated that this boundary makes dependency-swaps cheap.
