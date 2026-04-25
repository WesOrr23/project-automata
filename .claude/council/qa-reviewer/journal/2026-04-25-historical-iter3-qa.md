---
agent: qa-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: ebdb064..2cf5e42
duration-ms: 105876
schema-version: 1
---

# Iter 2→3 historical QA review

## Diff received

Range covers four functional commits: dagre install, dagre Phase 1 (auto-layout), Phase 2 (self-loops), Phase 3 (curved bidirectional), then a complete pivot to GraphViz WASM in `2cf5e42`. The pivot replaced 381 lines of `utils.ts` and rewrote `AutomatonCanvas` + `TransitionEdge`.

## My assessment

Historical observation. Coverage shape: one test file (200 lines) added; engine/hook coverage unchanged; UI added ~393 lines of production code with one `computeLayout`-only entry-point test. The math-helper gap was born here.

## Tests added

One file: `src/ui-state/utils.test.ts` (200 lines, 11 cases). Born sync at `3fd2faa` (dagre), migrated to `async/await` at `2cf5e42` (GraphViz). Two cases added at the pivot: SVG path-data shape and bounding-box presence. Otherwise the test surface is unchanged across the dagre→GraphViz swap because both phases tested only `computeLayout`'s output shape.

## Origin of the math-helper gap

`parseEdgePos`, `controlPointsToSvgPath`, `flipY`, `transformPoint`, `buildTransformedPath`, `computeArrowheadAngle`, `parseGraphvizJson`, `automatonToDot` — all born in `2cf5e42`, all module-private, all never tested directly. The `known-coverage-gaps.md` entry for these helpers is original — the gap was born with the helpers, not introduced by removal.

`parseEdgeLabel` is NOT present at `2cf5e42`. It appears in a later iteration. The current `known-coverage-gaps.md` listing groups it with the iter-3 helpers, which is anachronistic. **Correction queued for the gap doc.**

## Architectural barrier to closing the gap

Helpers are file-private. To unit-test them, they need to be exported (or extracted to a sibling module like `src/ui-state/graphvizParse.ts`). This is a one-line change per helper but it's a real reason the gap persisted — the author plausibly chose integration tests because the seam wasn't surfaced.

## Async surface

`computeLayout` became `Promise<AutomatonUI>` at the pivot. Vitest absorbs async naturally; the migration was a mechanical `async`/`await` sprinkle. Failure paths (WASM load failure, malformed JSON, malformed pos string) have zero coverage. Happy-path async is covered; sad-path async is not.

## What I'd flag if this were a live review

- Export `parseEdgePos`, `controlPointsToSvgPath`, `flipY`, `automatonToDot`, `parseGraphvizJson` and add direct unit tests. These are the highest-value missing tests in the codebase: pure functions, deterministic, rich edge cases, brittle external-format boundary.
- Add at least one negative-path test (malformed pos string → graceful handling or explicit throw).
- AutomatonCanvas and TransitionEdge were rewritten this iteration and remained untested. The components-untested gap deepened here.

## Memory updates produced

- This journal entry.
- `known-coverage-gaps.md` updated: corrected the `parseEdgeLabel` anachronism, added export-barrier note as architectural precondition to closing the gap.
- `test-coverage-map.md` updated: appended provenance line for the math helpers.

## Outcome

Historical observation complete. The gap origin is at `2cf5e42`; the architectural barrier (private helpers) explains why it persisted. Recommended fix path is structural (export helpers) followed by direct unit tests.
