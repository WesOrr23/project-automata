---
agent: qa-reviewer
type: knowledge
topic: test-coverage-map
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Test Coverage Map

## Principle

Track what's tested vs not tested at module granularity. The coverage shape of this codebase is *inverted from the typical guidance*: engine is well-tested, UI is essentially unverified. Most regressions will hide in the UI layer.

## Current state

### Engine layer (well-tested)

- `src/engine/automaton.test.ts` (~415 lines) — exhaustive CRUD coverage of `addState`, `removeState`, `addTransition`, etc., including immutability assertions.
- `src/engine/simulator.test.ts` (~567 lines) — DFA + NFA simulation paths, ε-closure, branch death.
- `src/engine/validator.test.ts` (~390 lines) — `isDFA`, completeness checks, orphan detection.

### Hook layer (well-tested)

- `src/hooks/useSimulation.test.ts` (~557 lines) — exercises the reducer transitions directly. Step, autoStep, reset paths covered.
- `src/hooks/useUndoableAutomaton.test.ts` (~274 lines) — cap behavior, clear, no-op short-circuit, redo invalidation.

### Reducer layer (partial)

- `src/components/transitionEditor/creationReducer.test.ts` (~375 lines) — happy paths covered. Conflict-detection branches in `computePreview` (lines 416-444 and 519-541 of the source) are NOT exercised. The most complex branches in the file are the least tested.

### UI math helpers (untested)

- `src/ui-state/utils.ts` has `parseEdgePos`, `controlPointsToSvgPath`, `parseEdgeLabel`, `flipY`. The `utils.test.ts` (~234 lines) covers `computeLayout` integration but not these lower-level helpers.

### Components (essentially uncovered)

- `src/notifications/NotificationContext.test.tsx` (~174 lines) — only React rendering test in the codebase.
- All other components: zero tests. AutomatonCanvas, StateNode, TransitionEdge, the tool menu hierarchy, both popovers, transition creator — none.

### App (uncovered)

- `App.tsx` has no integration tests. The 754-line orchestrator that wires everything together has no end-to-end test asserting basic flows.

## What to look for in diffs

- New functions in well-tested modules: tests are expected to be added in the same diff.
- Changes to UI components: flag the absence of component tests (RTL is the agreed direction but not yet adopted).
- Changes to the math helpers in `ui-state/utils.ts`: these are unit-testable and should be covered when touched.
- Changes to `computePreview` conflict-detection branches: known gap; flag if not addressed.
- Changes to engine functions that have existing tests: expect test updates to match.

## What's fine

- Pure refactors with no behavioral change: tests stay as they are; flag any test churn that suggests the refactor isn't pure.
- Doc, CSS, or comment-only changes: no test impact.
- Adding new modules with no callers yet: tests should arrive with the first caller, not in isolation.

## Historical provenance of the engine-vs-UI inversion

The inversion was born at `ebdb064` (iter 2 completion). Iter 1 (`14bb9e8`) shipped four engine modules with co-located test files. Iter 2 added `src/components/` and `src/ui-state/` with zero tests, including the pure function `createDefaultLabel` that fits the engine's own unit-test pattern. The components on `known-coverage-gaps.md` (StateNode, TransitionEdge, StartStateArrow, AutomatonCanvas) have been untested since they were introduced — they are not regressions from a tested state.

`ITERATION2_PLAN.md` lists six tasks; none of them is "write tests for the new components." The omission was deliberate scope, not oversight, but it was never scheduled for catch-up either.

## Provenance

Iteration-1 code review (2026-04-25) catalogued the engine-vs-UI coverage inversion and the `computePreview` gap. Test file line counts verified at commit `52bdb8e`. Historical provenance added during the iter 1→2 retrospective review (2026-04-25).
