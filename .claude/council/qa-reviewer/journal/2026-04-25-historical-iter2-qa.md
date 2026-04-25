---
agent: qa-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: 14bb9e8..ebdb064
duration-ms: 126373
schema-version: 1
---

# Historical review: iter 1 → iter 2 (engine foundation → first UI)

## Diff received

End of iter 1 (engine + 87 tests, ~100% engine coverage) to end of iter 2 (first React/SVG layer: StateNode, TransitionEdge, StartStateArrow, AutomatonCanvas, plus ui-state/types). Two commits: `a7c3325` (UI types + StateNode + ITERATION2_PLAN.md) and `ebdb064` (rest of components + sample DFA wiring).

## My assessment

This is the commit range where the engine-vs-UI test-coverage inversion is born. Iter 1 shipped four engine modules each with a co-located test file (~1100 lines of tests for ~1100 lines of source). Iter 2 shipped five UI files (949 insertions) with zero tests.

The plan document `ITERATION2_PLAN.md` lists six tasks; none of them is testing. So the omission is **deliberate scope, not oversight** — but the deliberate scoping never got revisited and the debt compounds with every later iteration.

## What I checked

- Diff stat: 7 files, 949 insertions, no test files.
- File-by-file: every new component lacks a `.test.tsx` sibling. `src/ui-state/types.ts` has a pure function `createDefaultLabel` (trivially unit-testable, never tested).
- Engine code untouched: iter-1 test suite is unaffected, no test updates were warranted there.
- Specific behaviors that shipped untested: NFA-compatibility flatMap branch in `AutomatonCanvas` (called out in the commit message), missing-UI-data fall-throughs (`!fromState`, `!toState`, `startStateUI` null), trig helpers inline in `TransitionEdge` (edge-of-circle math, perpendicular label offset, arrowhead points).

## What I deliberately did not check

- Whether the trig in `TransitionEdge` is geometrically correct (architecture- or rendering-domain question, not QA).
- Whether the granular-prop pattern is the right component API (architecture-reviewer).
- Type-level correctness of `Map<number, StateUI>` etc. (typescript-reviewer).

## Memory updates produced

- This journal entry.
- Knowledge updates queued for `test-coverage-map.md` and `known-coverage-gaps.md` to record the historical provenance of the engine/UI testing inversion.

## Outcome

Historical observation, not a verdict. The cheap win that was missed: extract trig from `TransitionEdge` into `src/ui-state/geometry.ts` and unit-test it with the iter-1 pattern. That alone would have established the "UI also gets pure-function tests" precedent before RTL adoption became necessary.
