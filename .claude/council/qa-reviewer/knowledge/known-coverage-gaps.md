---
agent: qa-reviewer
type: knowledge
topic: known-coverage-gaps
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Known Coverage Gaps

## Principle

Specific, named gaps in test coverage that have been catalogued. The auditor uses this list to detect when claimed-tested code is in fact in this list. Reviewers cite this when a diff touches a known-gap area without addressing the gap.

## Current state

### `computePreview` conflict-detection branches (`src/components/transitionEditor/creationReducer.ts`)

Branches identified by behavior, not line number (line ranges drift; see `_conventions.md` on symbol-relative citations):

- The single-symbol DFA modify branch with conflict detection (when `editingExisting` is set and the new symbol overlaps another transition out of the same source).
- The general-case DFA conflict branch on add or structural-modify (when adding or structurally changing a transition would produce two destinations for the same `(from, symbol)` in DFA mode).
- As of iter 8 (`30eace9`), both branches gained an `isNFA` short-circuit — NFA mode skips DFA-conflict detection entirely.

The test file `creationReducer.test.ts` (~375 lines at iter-8 head) covers happy paths plus the new helpers (`parseSymbolInput`, `formatSymbolsForInput`, `isModified`) but walks past the conflict branches. These are the most complex paths in the file and are now load-bearing for the iter-8 mode toggle.

### `ui-state/utils.ts` math helpers

Born in `2cf5e42` (iter 3 GraphViz pivot), untested since introduction:

- `parseEdgePos` — parses GraphViz edge position strings into control points.
- `controlPointsToSvgPath` — converts control points to SVG `path d` strings.
- `flipY` — coordinate transform for SVG.
- `automatonToDot`, `parseGraphvizJson`, `transformPoint`, `buildTransformedPath`, `computeArrowheadAngle` — same iteration, same gap.
- `parseEdgeLabel` — added in a **later** iteration (NOT iter 3); same gap, different birth commit. (Empty-label edge case was fixed in the iteration-1 code review.)

`utils.test.ts` (~234 lines) covers `computeLayout` integration but not these lower-level helpers. They are the math-heavy parts most likely to subtly break.

**Architectural precondition**: the helpers are module-private at `src/ui-state/utils.ts`. Closing the gap requires exporting them (or extracting to a sibling module like `src/ui-state/graphvizParse.ts`). Until then, tests can only reach them transitively through `computeLayout`.

### Components — across the board

Zero tests exist for any of these:

- `AutomatonCanvas` — the main rendering surface. Untested since introduction in `ebdb064` (iter 2). The NFA-compatibility flatMap branch and the three missing-UI-data fall-throughs were never test-guarded.
- `StateNode`, `TransitionEdge`, `StartStateArrow` — primitives. Untested since introduction in `ebdb064` (iter 2).
- `SimulationControls`, `InputPanel`, `UndoRedoControls`.
- `ToolMenu` and its panel children (`AlphabetEditor`, `ConfigPanel`, `EditPanel`, `StateEditor`).
- `TransitionCreator`, `MiniTransitionSVG`.
- `StateActionsPopover`, `StatePickerPopover`.

The only React rendering test in the codebase is `NotificationContext.test.tsx`.

### App-level integration

No integration tests exist for App-level flows like "click an edge, change a symbol, click Modify, see the canvas update."

## What to look for in diffs

- Diffs adding test coverage for items in this file: those items can be removed from the gap list when the new tests are merged. Update this file in the same iteration.
- Diffs that touch a gap area without adding tests: flag explicitly. The gap is documented; ignoring it is a deliberate choice that should be acknowledged.
- Diffs that introduce a new gap (new untested code in an under-tested area): flag and add to this list.

## What's fine

- This list growing slowly as the codebase grows. New code creates new gaps; that's expected.
- Coordinated fix-up iterations that close several gaps at once (e.g., a "RTL adoption" iteration).

## Provenance

Iteration-1 code review (2026-04-25). Gap items verified by reading the source and corresponding test files at commit `52bdb8e`.
