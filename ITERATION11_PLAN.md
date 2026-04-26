# Iteration 11 — Major Change Proposals (Plan)

> **Note:** Written retrospectively. Iter-11 ran from the close-out of the iter-9+10 code-review debate, which produced two artifacts: a list of 16 minor fixes (already absorbed) and a "Major Changes Proposed" backlog of architectural improvements. Iter-11 implemented seven of the eight proposals; one (AutomatonLike consolidation, Proposal #1) was deferred for personal review and shipped in iter-12.

## Context

The iter-9+10 council debate (architect ⇆ adversary, mediated by typescript-reviewer and qa-reviewer) flagged eight structural improvements that were too disruptive to land mid-iteration. They were collected into a "Major Change Proposals" doc and prioritized:

| # | Proposal | Disposition |
|---|---|---|
| 1 | Consolidate `AutomatonLike` shadow type and engine preview logic | **Deferred** to iter-12 (user wanted personal review) |
| 2 | Engine `Result<T>` for fallible operations (replace thrown errors) | iter-11 |
| 3 | Decompose `App.tsx` (extract layout, sim glue, undo/redo shortcut hooks) | iter-11 |
| 4 | Stack-based keyboard scope (`useKeyboardScope`) | iter-11 |
| 5 | Cap simulation history (memory bound) | iter-11 |
| 6 | `useUndoableAutomaton` flags refactor (canUndo/canRedo into state) | iter-11 |
| 7 | Split `index.css` into per-feature stylesheets | iter-11 |
| 8 | Enable `exactOptionalPropertyTypes` in tsconfig | iter-11 |

Plus a transverse goal: bring **component-level test coverage** up to match engine coverage, since RTL tests for the canvas, popovers, and the transition creator were thin.

## Goals

1. Land all seven non-deferred proposals on `iteration-11`, each as its own commit so any can be reverted independently.
2. Keep the existing 212-test suite green throughout. Add tests for new code (Result branches, popover RTL, etc.) so the post-iter-11 suite is meaningfully larger.
3. No user-visible behavior change. This is plumbing.

## Non-goals

- AutomatonLike (Proposal #1) — explicitly deferred.
- Any new product feature.
- Any new visual polish (that's iter-12's lane).

## Phase order

1. **Result<T> + EngineError types** (foundation; the rest can layer on)
2. Migrate engine APIs (`automaton.ts`, `simulator.ts`) to return `Result<T>`
3. Migrate consumers (`useSimulation`, App callsites) to handle `Result`
4. Add `useKeyboardScope` and migrate the three global keydown listeners
5. Decompose App.tsx — extract `useUndoRedoShortcuts`, `useAutomatonLayout`, `useAutomatonSimulationGlue`
6. `useUndoableAutomaton` — move `canUndo`/`canRedo` into useState (was derived per-render)
7. Cap simulation history at 1000 steps
8. Migrate `StatePickerPopover` keydown to `useKeyboardScope`
9. Tighten notification optional fields (omit-only)
10. Enable `exactOptionalPropertyTypes`; fix all resulting type errors
11. Split `index.css` into `tokens.css`, `animations.css`, `canvas.css`, `tool-menu.css`, `popover.css`, `simulation.css`, `notifications.css`
12. Add RTL tests: AutomatonCanvas, StateActionsPopover, TransitionCreator
13. Add unit tests for `automatonToDot` parse helpers
14. Add reducer tests for `computePreview` DFA-conflict branches

## Success criteria

- All `Result<T>` callsites in App.tsx + hooks handle both ok/err paths explicitly.
- No `try`/`catch` around engine calls in App or hooks (Result-based instead).
- App.tsx line count drops meaningfully (target: ~25% reduction).
- `tsc --noEmit` clean with `exactOptionalPropertyTypes: true`.
- Test count grows from 212 → 280+.

## Risks

- **`exactOptionalPropertyTypes` cascade.** Likely many small type fixes needed — could balloon. Mitigation: tighten optional fields surgically (omit-only patterns) rather than reaching for `?? undefined` everywhere.
- **App.tsx hook extraction order matters.** If we extract sim glue before layout, layout can't observe sim state cleanly. Mitigation: extract layout first (read-only on automaton), then undo/redo (no shared state), then sim glue last.

## Out of scope / future

- AutomatonLike consolidation → iter-12.
- Useful test patterns to extract into a `test-utils` module → iter-13+ if duplication shows up.
