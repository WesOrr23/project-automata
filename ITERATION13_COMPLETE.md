# Iteration 13 — Audit Cleanup (Complete)

## What shipped

A bookkeeping iteration. No new features, no visual change. The point was to repay accumulated documentation + memory debt before iter-14 lands new work on a noisy foundation. Five threads:

1. **Council memory drift closed.** The AutomatonLike open-question was marked open since the iter-9+10 debate even though the fix shipped in iter-12. Now resolved with `resolution: approve-fix` pointing at commits `48cc177` and `5d496ee`. The architecture-reviewer's `engine-ui-separation.md` knowledge file was rewritten to remove the "one known crack" sentence and bumped to `verified-as-of: 5d496ee`. Two other knowledge files (`keyboard-scope-stack.md`, `result-type-error-model.md`) had `verified-as-of: iteration-11` markers — converted to commit hash `5cba947` per the auditor's flag (audit-002 P8).

2. **Iter-12 council journals filled in.** Audit-002 P5 noted that iter-12 was reviewed by only the architecture-reviewer; TS-reviewer and QA-reviewer journals were missing despite iter-12 changes touching their domains (`src/engine/preview.ts`, viewport hook, RTL coverage). Both journals now exist (`typescript-reviewer/journal/2026-04-26-iter12-sweep.md`, `qa-reviewer/journal/2026-04-26-iter12-sweep.md`), produced from the parallel-spawned sweep reports.

3. **CLAUDE.md status synced.** The "Current Status" line was two iterations behind ("Iterations 9 + 10 merged"). Now reflects iter-9 through iter-12 with one-paragraph summaries, plus iter-13 through iter-16 as PLANNED. The "Future Iterations (Backlog - Priority TBD)" section had stale numbering (iter-9 = "Animation & Polish" but actual iter-9 was undo/redo); rewritten as a sequential complete/planned list. Added "Decided in Iteration 11" and "Decided in Iteration 12" sections — Result<T> contract, useKeyboardScope, App.tsx decomposition, exactOptionalPropertyTypes, CSS organization, preview.ts as engine module, Framer Motion adoption, useCanvasViewport hook, cursor-flicker scoped user-select discipline.

4. **Two reviewer code follow-throughs landed.**
   - `AutomatonCanvas.tsx` native-wheel-listener block now has a load-bearing comment explaining why the listener manufactures a React-shaped event (React's onWheel is forced `passive: true`, blocking the `preventDefault()` we need to suppress browser-level pinch-to-zoom). The cast is at a legitimate boundary; the comment makes that visible to future readers.
   - `TransitionCreator.tsx` has a comment documenting that surfacing only `parsed.errors[0]` (rather than all errors) is intentional — the instruction line is single-line; users iterate fix-first-then-rest. Trace confirmed errors do reach the user (lines 78 and 101 in HEAD).
   - Confirmed via grep that `AutomatonLike<T>` and `TransitionLike` have zero remnants in `src/`.

5. **RTL coverage backfill — four components.** All four QA-flagged components now have RTL tests:
   - `UndoRedoControls.test.tsx` — visibility gating, click dispatch on each button, disabled state.
   - `CanvasZoomControls.test.tsx` — four buttons + scale-extreme disabling.
   - `SimulationControls.test.tsx` — full status/hasSimulation/hasInput enable/disable matrix, click dispatch, speed toggle, result banners (ACCEPTED/REJECTED), tape character click → `onJumpTo(index)`, empty-input placeholder.
   - `StatePickerPopover.test.tsx` — option rendering, selection callback, click-outside close, Esc close (via keyboard scope), `.state-node-pickable` outside-click safe-path, ArrowUp/Down navigation with wrap, Home/End jumps, Space-as-Enter alias.

Test count: **323 → 362** (+39, all green). `tsc --noEmit` clean.

---

## Phase log

| Phase | Touched | Tests added |
|---|---|---|
| 1 — Council bookkeeping (open-question close, knowledge update, verified-as-of normalization, index update) | 4 council files | 0 |
| 1b — Iter-12 sweep journals (TS + QA) | 2 council files | 0 |
| 2 — CLAUDE.md update | 1 doc | 0 |
| 3 — Code follow-throughs (wheel cast comment, parseSymbolInput UX comment) | 2 src files | 0 |
| 4 — RTL backfill (4 component test files) | 4 test files | +39 |
| 5 — useUndoableAutomaton refactor — evaluated, rejected | 0 | 0 |

---

## Design decisions

### useUndoableAutomaton reducer refactor — rejected on inspection

The plan called for a discriminated-reducer rewrite based on an audit-001 finding ("lots of one-off cases"). On inspection of the actual hook at HEAD:

- It exposes 5 actions (`setAutomaton`, `setEpsilonSymbol`, `undo`, `redo`, `clearHistory`), not "lots."
- The ref/flag pattern is **intentional and load-bearing** — documented in the hook header, set by the iter-11 commit `2605bbb refactor(hooks): move canUndo/canRedo into useState in useUndoableAutomaton`. Moving to `useReducer` would either regress to per-render flag computation or duplicate the flag state inside reducer state — net zero benefit.
- The `setAutomaton(updater)` short-circuit on reference equality is **also load-bearing** — documented in `architecture-reviewer/knowledge/result-type-error-model.md` and `immutability-discipline.md`. A reducer would always dispatch; only the reducer body could decide no-op, losing the upstream early-return.
- The 5 action shapes don't actually unify cleanly. They have distinct payload structures.

**Decision: refactor evaluated and rejected as not a code-quality improvement.** Honest documentation > busywork. If the refactor becomes appealing later (e.g., when iter-15's file-load needs to plug into the same history mechanism), revisit.

### Auditor flag P5 — closing the multi-domain-review hole

The auditor's iter-12 P5 finding ("only architect reviewed iter-12; TS-reviewer and QA-reviewer not invoked") is now structurally addressed: the sweep journals are on disk. But the deeper systemic fix (orchestrator should always spawn affected-domain reviewers in iteration close-outs) belongs in `_orchestrator.md`, not in any one journal. Captured for the next council-infrastructure pass.

### `verified-as-of` policy

Per `_conventions.md` line 71–72, commit hashes are preferred over iteration markers. Iter-13 fixed the two `iteration-11` markers. Iter-12-era knowledge files (`52bdb8e`-tagged) were not bumped — they're still accurate as of that commit; bumping would imply re-validation that didn't happen.

---

## What stayed the same

- Every engine semantic.
- Every UI behavior.
- All Framer Motion animations from iter-12.
- All keyboard shortcuts.
- The `useUndoableAutomaton` hook (intact; documented why).

---

## Out of scope / deferred

- **`useAutomatonSimulationGlue` deeper test coverage** — QA flagged thin coverage. Iter-14+.
- **`MiniTransitionSVG` geometry tests** — punted from this iteration's RTL backfill. Iter-14+ if it surfaces.
- **`InputPanel` / `AlphabetEditor` RTL** — high-value targets, not flagged as critical. Iter-14+.
- **Test-utils extraction** — duplication between RTL files. Wait for the third occurrence.
- **Reduced-motion media query** — still deferred (iter-10 → iter-12 → iter-14).
- **Orchestrator structural fix for the multi-domain-review hole** — captured for the next council-infrastructure pass.

---

## How to run

```bash
cd /Users/wesorr/Documents/Projects/Project\ Automata/.claude/worktrees/iter-12
npm test -- --run            # 362 passing
npx tsc --noEmit             # clean
```
