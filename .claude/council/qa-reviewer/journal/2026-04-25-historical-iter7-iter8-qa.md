---
agent: qa-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: c6da931..30eace9
duration-ms: 155277
schema-version: 1
---

# Iter 7→8 historical QA review (NFA support)

## Diff received

~3346/-1040 across six functional commits (ε-closure + multi-state simulator, NFA validator + automaton primitives + reserved-ε, DOT edge consolidation, editor ε/comma/multi-dest support, multi-active simulation visuals + branch-death, cleanup). Engine, reducer, and canvas all touched.

## My assessment

Approved with concerns. Engine-side test coverage scaled with the engine changes. Reducer-side coverage scaled with the *peripheral* additions (parseSymbolInput, formatSymbolsForInput, isModified) but not with the central one (computePreview's now-NFA-aware conflict branches).

## What I checked

- New simulator tests: epsilonClosure (6 cases), NFA simulation (8 cases incl. start-ε-closure, parallel destinations, branch death dropping, dyingStateIds recorded on the death step, post-symbol ε-closure, multi-state trace).
- Validator: isRunnable-NFA flip from false→true documented in the test diff; NFA-mode tolerates ε + non-determinism without errors; DFA-mode flip surfaces them.
- Automaton primitives: addTransitionDestination/removeTransitionDestination with identity-preservation no-op assertion, ε-allowed-in-NFA, DFA-throws, source-not-exists, auto-drop-on-last-destination.
- creationReducer.ts grew 280→609 lines. Test file grew +241 lines. New tests: parseSymbolInput (7), formatSymbolsForInput (3), isModified (parametric + reorder-equals-original), editingExisting retention, multi-symbol loadExisting, Add/Delete/Modify label rewording.
- Verified `computePreview` is not imported by the test file.

## What I deliberately did not check

- Component-level tests for AutomatonCanvas's multi-active rendering or branch-death visuals (skipped per instructions; covered in prior journals).
- Architectural design of NFA primitives (defer to architecture-reviewer).
- Type-level correctness of the `currentState`→`currentStates` migration (defer to typescript-reviewer).

## Memory updates produced

- This journal entry.
- known-coverage-gaps.md: extended the computePreview entry to note iter-8 growth and the new isNFA-conditional branch.
- test-coverage-map.md: bumped engine layer to acknowledge NFA paths covered; bumped reducer-layer entry to note parser/format helpers tested while computePreview remains uncovered.

## Outcome

Historical observation. Engine coverage healthy; reducer central path (computePreview) still in gap list, now load-bearing for the iter-8 mode toggle. The reducer author *did* know how to test new code well (parseSymbolInput is exemplary) — `computePreview` was deliberately left at the integration boundary.
