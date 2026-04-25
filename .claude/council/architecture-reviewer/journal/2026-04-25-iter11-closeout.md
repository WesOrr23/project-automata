---
agent: architecture-reviewer
type: journal
iteration: 11
date: 2026-04-25
diff-hash: main..iteration-11
duration-ms: 205076
schema-version: 1
---

# Iteration-11 close-out review

## Diff received

18 commits (+4690/-2560 across 44 files) implementing seven of eight Major Change Proposals from the iter-1 code review: `Result<T>` + `EngineError` engine-layer error model, App.tsx decomposition into three new hooks (`useAutomatonLayout`, `useUndoRedoShortcuts`, `useAutomatonSimulationGlue`), `useKeyboardScope` stack-based key handler, sim history cap (1000), CSS split, undo internalization, `exactOptionalPropertyTypes` flag. `AutomatonLike` removal deliberately gated on user review.

## My assessment

APPROVED WITH CONCERNS. The conversions land cleanly. Engine/UI separation, immutability, no-op reference-equality, and the external-dependency boundary are all preserved. Two writer-level concerns:

1. `StatePickerPopover.tsx` still uses raw `document.addEventListener('keydown')`; migration to `useKeyboardScope` was partial (3 of 4 sites).
2. `notifications/types.ts` resolves `exactOptionalPropertyTypes` errors by widening optional fields to `T | undefined` — re-admits the behavior the flag was meant to police. Conditional-spread at callsites (used elsewhere in the diff) is the cleaner resolution.

Neither violates a documented principle; both are uniformity issues for the writer to clean up.

## What I checked

- Engine/UI separation: scanned `src/engine/` for React imports — none. Verified no `@hpcc-js` imports outside `src/ui-state/utils.ts`.
- `Result` type: confirmed `EngineError` is a string-literal union (not raw string), `errorMessage` is total via switch exhaustiveness, `ok`/`err` helpers preserve `Result<never>` widening pattern.
- Reference-equality no-op contract: checked `addTransitionDestination`, `setStartState`, `addAcceptState`, `removeAcceptState` — all return `ok(automaton)` (same reference) on no-op. `applyEdit` returns `previous` (same ref) on err.
- Hook scoping: `useAutomatonLayout` (debounced async + version-counter for stale-promise rejection) is the new sole owner of the GraphViz pipeline; `useAutomatonSimulationGlue` is two effects with a clean contract; `useUndoRedoShortcuts` is a thin adapter.
- Keyboard scope manager: stack semantics (capture vs transparent, text-input filter, latest-handler ref pattern) are sound. Found one un-migrated site (StatePickerPopover).
- `exactOptionalPropertyTypes`: split resolution — `creationReducer` uses tightening (conditional spread), `notifications/types` uses loosening (`T | undefined`). Flagged the inconsistency.
- `AutomatonLike`: confirmed untouched as expected.

## What I deliberately did not check

- Test coverage of the new Result paths (qa-reviewer's domain).
- Type-correctness nuance of `EngineError` narrowing at `applyEdit`'s closure-write site (typescript-reviewer's domain).
- CSS split organization beyond confirming no architectural concern.

## Memory updates produced

- This journal entry.
- Two new knowledge files: `result-type-error-model.md` and `keyboard-scope-stack.md`.
- `external-dependency-boundary.md` updated to clarify that exporting boundary-internal output-format helpers for testability is fine.

## Outcome

The iteration delivers on the iter-1 review's structural goals without introducing new cracks. The double-call dance is gone, the engine layer's error contract is honest and exhaustive, and App.tsx is meaningfully smaller. The two concerns are pattern-uniformity rough edges that show up when a large refactor touches many sites — clean-up scope, not redesign scope.
