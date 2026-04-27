---
agent: qa-reviewer
type: knowledge
topic: test-coverage-map
schema-version: 1
verified-as-of: 369cd14
last-updated: 2026-04-27
confidence: high
---

# Test Coverage Map

## Principle

Track what's tested vs not tested at module granularity. The original engine-vs-UI inversion (engine well-tested, UI essentially unverified) has narrowed considerably as of iter-19 — the iter-13 RTL backfill, iter-15/16/18 engine additions, and several individual hook tests have moved many UI/orchestration areas into the "covered" column. The remaining gaps are concentrated in iter-12+ net-new surfaces and in the original ToolMenu / canvas-internals cluster.

## Current state

### Engine layer (well-tested)

- `src/engine/automaton.test.ts` — exhaustive CRUD coverage of `addState`, `removeState`, `addTransition`, etc. Immutability assertions throughout.
- `src/engine/simulator.test.ts` — DFA + NFA simulation paths, ε-closure, branch death.
- `src/engine/validator.test.ts` — `isDFA`, completeness, orphan detection.
- `src/engine/__tests__/converter.test.ts` (iter-16) — NFA → DFA subset construction.
- `src/engine/__tests__/minimizer.test.ts` (iter-16) — Hopcroft minimization (counter-example assertions, not shape pinning).
- `src/engine/__tests__/operations.test.ts` (iter-18) — `complement of complement is the original` etc.
- `src/engine/__tests__/equivalence.test.ts` (iter-18) — equivalence checks via product construction.
- `src/engine/result.ts` is exercised transitively through the engine tests.

### Files layer (well-tested)

- `src/files/__tests__/format.test.ts` — round-trip serialize/parse + rejection paths for malformed inputs.
- `src/files/__tests__/recentsStore.test.ts` — eviction, in-place update, size cap, ID retrieval.
- `src/files/__tests__/fileAdapter.test.ts` — adapter mock template; this is the canonical pattern for testing the iter-15 `useFileSession` hook.

### Hook layer (mostly tested)

- `src/hooks/useSimulation.test.ts` — reducer transitions, step, autoStep, reset.
- `src/hooks/useUndoableAutomaton.test.ts` — cap behavior, clear, no-op short-circuit, redo invalidation, the iter-12 Snapshot.description field.
- `src/hooks/useUndoRedoShortcuts.test.ts` (iter-13) — the iter-17 `useFileShortcuts` should follow this template.
- `src/hooks/useKeyboardScope.test.ts` (iter-11) — stack ordering, capture vs transparent, text-input filter, latest-closure usage. The text-input + capturing-scope interaction (line 161) is exactly the test audit-002 F10 was asking for.
- `src/hooks/__tests__/useCanvasViewport.test.ts` — **partial; 2 tests broken** (test math doesn't match the iter-17 DISPLAY_FIT_PADDING split). New iter-17 surface (`centerToContent`, `isCentered`, `fitScale`) is not directly tested.
- `src/hooks/__tests__/useAutomatonLayout.test.ts` — covers the GraphViz integration.

**Missing**: `useDebugOverlay`, `useOnboarding`, `useFileSession`, `useFileShortcuts` — all iter-15/17 additions, all zero-coverage. See `known-coverage-gaps.md`.

### Reducer layer (covered)

- `src/components/transitionEditor/creationReducer.test.ts` — happy paths + the iter-13 backfill closed the previously-flagged `computePreview` conflict-detection branches.

### UI math helpers (covered)

- `src/ui-state/utils.ts` (still has integration coverage via `utils.test.ts`); the lower-level helpers were extracted to `src/ui-state/graphvizParse.ts` in iter-11 with `graphvizParse.test.ts` covering them. Iter-3 architectural-precondition gap closed.

### Components

The original "essentially uncovered" line is no longer accurate. iter-13 RTL backfill + iter-15/16/18 component additions populated this row substantially.

**Tested**:
- `src/notifications/NotificationContext.test.tsx` — notify/dismiss/rehighlight + auto-dismiss + highlight-window. **Iter-17 `pauseDismiss`/`resumeDismiss` are NOT covered** (see `known-coverage-gaps.md`).
- `src/components/__tests__/SimulationControls.test.tsx` — every test names a user-observable behavior (Play→Pause icon swap, disabled-when-finished, banner on accept/reject).
- `src/components/__tests__/StatePickerPopover.test.tsx`, `StateActionsPopover.test.tsx` (iter-13).
- `src/components/__tests__/UndoRedoControls.test.tsx`, `ZoomToolbar` cluster (iter-13). **`CanvasZoomControls.test.tsx` is broken** (3 runtime + 7 TS errors after iter-17 added required props).
- `src/components/__tests__/ComparePicker.test.tsx` (iter-18).
- `src/components/__tests__/CommandBar.test.tsx` — **9 of 19 broken** (assertions target deleted surfaces from iter-15/17 redesigns; not fixture-recoverable).

**Untested**:
- `AutomatonCanvas` — minimal coverage; new iter-17 lift-ref pattern (`onSvgRefChange`), inset-shift effect, debug-overlay shapes are unexercised.
- `MiniTransitionSVG` (since iter-7).
- `ToolMenu` and panel children (`AlphabetEditor`, `AlphabetReadOnly`, `ConfigPanel`, `EditPanel`, `StateEditor`).
- `InputPanel` (iter-17 batch-test trigger button), `BatchTestModal` (iter-17).
- `TransitionCreator` (since iter-7).
- `Onboarding` (iter-17, three dismissal paths).

### `src/lib/` (untested)

New top-level directory introduced in iter-17 for `imageExport.ts`. **Zero tests**. Centerpiece of the "share your work" feature; high-risk DOM manipulation. Architect's iter-12 close-out flagged the directory naming as a separate concern.

### App (uncovered)

- `App.tsx` still has no integration tests. The growth in iter-12 (~450 net lines) magnifies the leverage of a small number of well-chosen RTL-renders-App tests.

## What to look for in diffs

- New functions in well-tested modules: tests are expected in the same diff.
- Changes to UI components: flag the absence of component tests if the area is in the untested column.
- Changes to a tested component that reshape its public surface (props, aria-labels, popover structure): the test file likely needs to move with the surface. The CommandBar / CanvasZoomControls breakages would have been caught earlier if the test file had been touched in the same diff as the component.
- Changes to `pauseDismiss`/`resumeDismiss`, `useDebugOverlay`, `useOnboarding`, `useFileSession`, `useFileShortcuts`, `lib/imageExport.ts`, the iter-17 viewport additions: known gap; flag if not addressed.

## What's fine

- Pure refactors with no behavioral change: tests stay as they are.
- Doc, CSS, or comment-only changes: no test impact.
- Adding new modules with no callers yet: tests should arrive with the first caller.

## Historical provenance of the engine-vs-UI inversion

The inversion was born at `ebdb064` (iter 2 completion). Iter 1 (`14bb9e8`) shipped four engine modules with co-located test files. Iter 2 added `src/components/` and `src/ui-state/` with zero tests. The components on the original gap list (StateNode, TransitionEdge, StartStateArrow, AutomatonCanvas, ToolMenu hierarchy) were never test-guarded at introduction. The iter-13 RTL backfill closed roughly half by introducing component testing infrastructure; iter-15/16/18 each shipped tests with new engine modules.

The remaining inversion is now concentrated in iter-12+ net-new surfaces (where the writer didn't backfill) and the original ToolMenu cluster (which iter-12 reshaped substantially without adding tests).

## Provenance

Iteration-1 code review (2026-04-25) catalogued the original inversion. Updated 2026-04-27 after the combined iter-11 + iter-12 sweep at HEAD `369cd14`. Test file existence verified by listing `src/**/__tests__/` and `src/**/*.test.{ts,tsx}` files; pass/fail counts verified by running `npx vitest run`.
