---
agent: typescript-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: ebdb064..2cf5e42
duration-ms: 112025
schema-version: 1
---

# Iter 2 → Iter 3 historical review: GraphViz WASM layout boundary

## Diff received

End of iter 2 (sample DFA renders, no layout) → end of iter 3 (auto-layout: dagre attempt then GraphViz WASM pivot). New module `src/ui-state/utils.ts` (~381 lines, 7 commits collapsed) introducing DOT generation, GraphViz JSON parsing, B-spline → SVG path conversion, and an async `computeLayout`. `TransitionEdge` collapses from 311 lines / 3 render modes to ~75 / 1 because GraphViz pre-computes splines. `App.tsx` rewritten to `useState`/`useEffect` for async loading.

## My assessment

Approved with minor concerns (historical).

## What I checked

- `GraphvizNode` / `GraphvizEdge` / `GraphvizJson` are declared types, not `any`. Minimal — only the consumed fields. Good.
- The cast point at `JSON.parse` → `GraphvizJson` is at a true opaque boundary (WASM JSON output) per `cast-discipline.md`. The implicit assertion via object-literal assignment from `any` is structurally fine but lacks a shape predicate; a malformed `bb` becomes runtime `undefined.split` rather than a typed parse failure.
- `parseFloat(coords[0] ?? '0')` and `parts[i] ?? 0` patterns are *required* under `noUncheckedIndexedAccess` and are appropriate boundary defaults — not weak-type papering. Choice of silent-zero fallback is a runtime-correctness concern (malformed coords silently become origin); flagged for qa-reviewer.
- All new `!` assertions sit behind length/loop-bound guards (`points.length === 0` early return; loop `i + 2 <= points.length - 1`). Load-bearing on local invariants, matches the `removeState` precedent.
- No new `as`, `as unknown as`, `as any`, `@ts-ignore`, `@ts-expect-error`, `enum`, or new generics. Discipline preserved.
- `parseInt(node.name)` for edges (lines 375-376) lacks the `automaton.states.has(stateId)` guard the node loop has. `NaN` state-ids could land in `TransitionUI`. Recommend a `parseStateId(name): number | null` helper.
- `computeLayout` signature change to `Promise<AutomatonUI>` is absorbed cleanly: single callsite uses `useState<AutomatonUI | null>(null)` + `useEffect` + `.then(setAutomatonUI)`. The `null` sentinel is the right loading-state under `strictNullChecks`.
- The `Map<string, ...>` edge-grouping with `${from}->${to}` keys round-trips through `string.split('->')` and discards the `number` type. Functionally correct but type-flow isn't load-bearing; `Map<readonly [number, number], ...>` would be more honest.
- `parseEdgeLabel` / `joinSymbols` correctly handle `null`-as-ε at the boundary (`'ε'` ↔ `null`) without introducing a stringly-typed sentinel into the engine. Good placement.
- `tsconfig.json` unchanged — strict posture preserved.

## What I deliberately did not check

- Runtime correctness of silent-zero fallbacks on malformed coordinates (qa-reviewer).
- `.then` without `.catch` on the WASM load promise in `App.tsx` (qa-reviewer).
- Whether the GraphViz boundary belongs in `ui-state/` vs a dedicated `layout/` module (architecture-reviewer).

## Memory updates produced

- This journal entry.
- `cast-discipline.md` "Acceptable casts" section updated: explicit mention of the GraphViz JSON object-literal-from-`any` assertion at `parseGraphvizJson`, with a note that a `isGraphvizJson` predicate would tighten the seam without invalidating the boundary.

## Outcome

Approved historically with two upgrade-paths flagged: shape predicate at the JSON.parse seam, and `parseStateId` helper for edge endpoints. Neither is a regression; both are tightenings of an already-correct boundary.
