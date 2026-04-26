# Iteration 13 — Audit Cleanup (Plan)

## Context

Three council sweeps closed at the start of this iteration: a TS-reviewer pass over iter-11+12, a QA-reviewer pass over the same, and a fresh auditor pass over iter-12. Findings cluster into three buckets:

1. **Council-memory drift** (auditor): the AutomatonLike open-question is still marked open even though the fix shipped in iter-12; knowledge files reference the old "crack" as if it were still present; `verified-as-of` markers use iteration names instead of commit hashes; CLAUDE.md status line is two iterations behind.
2. **Code follow-throughs flagged by reviewers** (TS + QA): one load-bearing cast wants a comment, one engine-error path may be silently dropped, several components and hooks have no RTL tests.
3. **Carryover from prior audits** (audit-001): `useUndoableAutomaton`'s action union is "lots of one-off cases that could be a discriminated reducer" — a real refactor target, deferred from iter-11 because it overlapped with the App.tsx decomposition.

This iteration is bookkeeping + refactor — no user-visible changes, no new features. The point is to repay accumulated debt before iter-14 (UI polish) lands new work on a noisy foundation.

## Goals

1. **Council memory is honest.** Open-questions resolved when the underlying code question is resolved. Knowledge files describe the codebase as it actually is. Provenance markers (`verified-as-of`) point at commit hashes, not iteration names.
2. **CLAUDE.md is current.** Status line, iteration list, and "decided in iteration X" sections reflect reality through iter-12.
3. **TS-reviewer + QA-reviewer have iter-12 journal entries** (catching up the absences).
4. **Code-level follow-throughs from sweeps are fixed.** Cast comment, error-message UX, RTL coverage gaps, `useUndoableAutomaton` reducer refactor.
5. **All tests still green.** Test count grows (RTL backfill).

## Non-goals

- Any new product feature.
- Any visual change.
- AutomatonLike rework (it's already shipped — only the council record needs catch-up).
- Refactoring beyond what reviewers explicitly flagged.

## Phase order

### Phase 1 — Council bookkeeping

1. **Close `architecture-reviewer/open-questions/automaton-like-pending-user-review.md`.** Set `status: resolved`, `resolution: approve-fix`, add a brief close-out note pointing at commits `48cc177` and `5d496ee`.
2. **Update `architecture-reviewer/knowledge/engine-ui-separation.md`.** Remove the "one known crack" sentence. Bump `verified-as-of` to `5d496ee`.
3. **Convert `verified-as-of` iteration markers to commit hashes** across all knowledge files. Auditor flagged at least `result-type-error-model.md`; sweep all of `.claude/council/*/knowledge/*.md` for the same pattern.
4. **Write iter-12 journal entries** for `typescript-reviewer` and `qa-reviewer` based on the sweep reports already produced in this conversation. Include the follow-throughs they flagged.
5. **Spawn a fresh auditor entry** acknowledging the iter-12 catch-up sweeps and confirming the AutomatonLike memory loop is now closed.

### Phase 2 — CLAUDE.md update

6. Update **Current Status** line to reflect iter-9 through iter-12 complete.
7. Add iter-11 and iter-12 entries to the iteration plan section (matching the existing pattern: deliverables + outcome).
8. Add any "Decided in Iteration 11/12" entries that are missing — Result<T> as engine contract, useKeyboardScope as keyboard-handler primitive, Framer Motion adoption for staged animations, AutomatonLike consolidation outcome (preview module), canvas viewport hook ownership.

### Phase 3 — Reviewer follow-throughs (code)

9. **AutomatonCanvas.tsx — synthetic-wheel-event cast comment.** Add a 1–3 line comment explaining why the native wheel listener manufactures a React-shaped event and why the cast is safe at this boundary. (TS-reviewer flag.)
10. **`parseSymbolInput` error path — propagate to UI.** Trace whether `.errors: string[]` from the parser ever reaches the user. If it's silently dropped, surface as a notification or inline form error. If it already surfaces, document the path in the component code so future readers don't doubt it. (TS-reviewer flag.)
11. **Verify no `AutomatonLike<T>` remnants in `creationReducer.ts`.** Auditor confirmed the type was deleted, but TS-reviewer asked for explicit verification. Grep for the symbol; document the absence in the iter-13 complete doc.

### Phase 4 — RTL backfill (QA-reviewer flags)

12. **`StatePickerPopover` RTL suite** (~8–12 tests): option rendering per state, selection callback, disabled state, arrow-key navigation, Esc closes.
13. **`UndoRedoControls`, `CanvasZoomControls`, `SimulationControls`** — light RTL per button: onClick fires the right callback, disabled state correct.
14. **`useUndoRedoShortcuts` integration test** — minimal app shell, simulate Ctrl+Z / Ctrl+Shift+Z, assert undo/redo invoked. Skip if the hook is too thin to be worth testing in isolation.
15. **`MiniTransitionSVG` geometry tests** — self-loop arc radius and edge case for zero-length / overlapping. Low priority; defer to iter-14 if it bloats this iteration.

### Phase 5 — `useUndoableAutomaton` reducer refactor

16. The hook currently has ~10 named action types each with their own reducer branch. Audit-001 flagged this as discriminated-reducer territory. Refactor:
    - Define `UndoableAction` as a discriminated union over `kind`.
    - Single reducer function with exhaustive switch.
    - Existing tests must still pass without modification — this is a pure shape change.
    - Snapshot push/pop logic stays where it is; only the action dispatch shape changes.
17. Verify with the existing 13 hook tests + `tsc --noEmit`. No new tests needed.

## Success criteria

- Every council open-question is either `open` (still genuinely open) or `resolved` (with a `resolution` and close-out note). No "shipped but never closed" entries remain.
- `grep -rn "verified-as-of: iteration" .claude/council/` returns zero hits.
- CLAUDE.md `**Current Status**` line names iter-12.
- `tsc --noEmit` clean. All tests green. Test count: **323 → 350+**.
- `useUndoableAutomaton` is a discriminated reducer (single switch, no per-action helpers).

## Risks

- **Knowledge-file rewrites may invalidate cross-references.** Mitigation: grep for cross-references to each modified knowledge file before editing; update both sides in the same commit.
- **`useUndoableAutomaton` refactor scope creep.** The hook is small but central; touching its action shape may ripple to consumers. Mitigation: keep the public hook interface (return shape) identical; only the internal action union changes.
- **RTL backfill could exceed scope.** Cap at the four flagged components + the popover; defer MiniTransitionSVG geometry if it grows.

## Out of scope / future

- **`useAutomatonSimulationGlue` deeper test coverage** — QA flagged thin coverage but didn't escalate. Iter-14+.
- **Test-utils extraction** — duplication between RTL files. Wait for a third occurrence.
- **`InputPanel` / `AlphabetEditor` RTL** — high-value targets but not flagged as critical. Iter-14+.
- **Reduced-motion media query** — still deferred from iter-10/12.
