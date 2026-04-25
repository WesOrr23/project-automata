---
agent: architecture-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: ebdb064..2cf5e42
duration-ms: 157546
schema-version: 1
---

# Historical review: iteration 3 (auto-layout, dagre→GraphViz pivot)

## Diff received

Five commits taking layout from manual coordinates to GraphViz-WASM-computed splines. Phase 1 (3fd2faa) introduced dagre + `src/ui-state/utils.ts` + `constants.ts`. Phases 2–3 (7a8ce63, ff5047b) hand-rolled self-loops and bidirectional curves inside `TransitionEdge`. Final commit (2cf5e42) replaced dagre with `@hpcc-js/wasm-graphviz`, made `computeLayout` async, and collapsed `TransitionEdge` from 311 lines to 75 by moving all edge geometry into pre-computed `TransitionUI` fields.

## My assessment

Approved in retrospect with two architectural reservations.

**Approved**: the boundary placement is correct. Only `src/ui-state/utils.ts` imports the layout dependency; the engine never sees it; `AutomatonCanvas` is still the sole import-both-types component; `TransitionEdge` became purely declarative. The `Automaton → DOT → JSON → AutomatonUI` funnel is a clean instance of "opaque text becomes typed data at exactly one place."

**Reservation 1 — silent failure in the parser.** `parseEdgePos`, `parseGraphvizJson`, and the coordinate-extraction helpers all use `?? 0` / `parseFloat(... ?? '0')` defaults. A truncated or malformed GraphViz response silently renders edges at the origin. Only `controlPointsToSvgPath` console.warns on shape mismatch. The boundary is structurally clean but isn't loud enough when its assumptions break.

**Reservation 2 — `computeLayout` going async rippled through the UI**. WASM init forced `Promise<AutomatonUI>`. The caller now needs effect-driven layout. Acceptable cost for the simplification it bought, but the iter-2 "pure sync layout" model is gone.

## What I checked

- Import-direction: engine has no `@hpcc-js`/`dagre` import. Clean.
- Type leakage: `AutomatonCanvas` still the only file importing both `Automaton` and `AutomatonUI`. Granular-prop convention held.
- `TransitionEdge` simplification: confirmed 75-line declarative renderer at 2cf5e42.
- Parse boundary: `GraphvizNode`/`GraphvizEdge`/`GraphvizJson` typed at the seam (utils.ts:280–305).
- Whether iter-3 introduced the math helpers cited in qa-reviewer's `known-coverage-gaps.md`: confirmed. `parseEdgePos`, `controlPointsToSvgPath`, `flipY` all born at 2cf5e42 in `utils.ts`. The structural choice — helpers as private module functions, reachable only through one async export — is what creates the testing gap, and that choice was set here.

## What I deliberately did not check

- Visual correctness of GraphViz output (out of scope).
- Test coverage adequacy — that's qa-reviewer's `known-coverage-gaps.md` already.
- Whether `@hpcc-js/wasm-graphviz` is the right library vs alternatives (writer's judgment).
- The dagre intermediate code's geometry math correctness (deleted before iteration end).

## Memory updates produced

- This journal entry.
- `knowledge/external-dependency-boundary.md` (CREATE) — captures the funnel pattern (typed → opaque → typed at exactly one module) and the silent-failure caution.

## Outcome

Iter-3 is the project's first real test of "what happens when we adopt an external dependency for a non-trivial UI concern." It passed structurally — the boundary is in the right place. The dagre→GraphViz pivot demonstrates healthy architectural reasoning: when the dependency could subsume an in-house concern (edge geometry), the in-house code was deleted rather than kept. That instinct is worth preserving.
