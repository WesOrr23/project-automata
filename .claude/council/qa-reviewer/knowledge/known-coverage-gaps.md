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

- Lines 416-444: single-symbol DFA modify with conflict detection.
- Lines 519-541: general-case DFA conflict on add or structural-modify.

The test file `creationReducer.test.ts` (~375 lines) covers happy paths but walks past the conflict branches. These are the most complex paths in the file.

### `ui-state/utils.ts` math helpers

- `parseEdgePos` — parses GraphViz edge position strings into control points.
- `controlPointsToSvgPath` — converts control points to SVG `path d` strings.
- `parseEdgeLabel` — parses comma-separated symbol lists (and the empty-label edge case fixed in iteration-1 review).
- `flipY` — coordinate transform for SVG.

`utils.test.ts` (~234 lines) covers `computeLayout` integration but not these lower-level helpers. They are the math-heavy parts most likely to subtly break.

### Components — across the board

Zero tests exist for any of these:

- `AutomatonCanvas` — the main rendering surface.
- `StateNode`, `TransitionEdge`, `StartStateArrow` — primitives.
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
