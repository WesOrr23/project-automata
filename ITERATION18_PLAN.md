# Iteration 18 — DFA Equivalence + Recents-Picker Integration (Plan)

## Context

Iter-17 ships the Operations widget, Convert/Minimize/Complement, and the DFA-minimization engine function. Iter-18 closes the operations-trio with **equivalence checking** — "is automaton A equivalent to automaton B?" — which is the killer feature for Selene-persona ("did I get this textbook exercise right?").

The user already saved a "reference" automaton via the file widget; they then load or build their attempt and want to ask "are these the same language?" The widget needs to let the user pick a comparison automaton from recents (or open a file fresh).

## Goals

1. **Engine: equivalence check** via product construction. `areEquivalent(a: Automaton, b: Automaton): Result<{ equivalent: boolean; counterexample: string | null }>`. The counterexample is a string that one accepts and the other rejects — the educational gold for "where did I go wrong?"
2. **OperationsWidget integration** — new "Compare against…" item under "Analysis" category. Click → opens a small picker dialog listing Recents + an Open-file shortcut. Picking one runs equivalence and shows the result via notification.
3. **Equivalence result UX** — success: green notification with "✓ Equivalent". Difference: red notification with "✗ Not equivalent" and the counterexample string highlighted as something the user can copy or re-test in the simulator.
4. **All ops still undoable.** (Equivalence is read-only, so no undo needed; Convert/Minimize/Complement remain undoable from iter-17.)

## Non-goals

- Side-by-side dual-canvas view for comparing the two automatons (still deferred to a future iteration if user demand emerges).
- Test-case bundle comparison (the file format has `testCases` but the editor doesn't surface them; iter-19+).
- Any new features outside equivalence + the picker UX.
- Step-by-step visualization of the product construction (iter-20+ if revived).

## Phase order

### Phase 1 — Engine: equivalence
1. Add `src/engine/equivalence.ts` (or fold into the iter-17 `operations.ts`/`minimizer.ts`).
2. **Algorithm**: build the product DFA over (a × b). Mark a product state (qa, qb) as "diff" iff exactly one of qa∈A.accept, qb∈B.accept holds. BFS from (a.start, b.start). If we reach a "diff" state, the automatons differ — record the path string as the counterexample. If BFS completes without hitting a diff state, equivalent.
3. **API**: `areEquivalent(a: Automaton, b: Automaton): Result<{ equivalent: boolean; counterexample: string | null }>`.
4. **Preconditions**: both DFA + complete + same alphabet. New error variants:
   - `'equivalence-requires-dfa'` (one or both not DFA)
   - `'equivalence-requires-complete-dfa'` (one or both incomplete)
   - `'equivalence-alphabet-mismatch'` (different alphabets)
5. **Tests**: textbook equivalent-pair (one minimal, one with redundant states) → equivalent; near-miss pair → not equivalent with a known counterexample; same automaton (a vs a) → equivalent with null counterexample; alphabet mismatch → error.

### Phase 2 — UI: comparison picker
6. The OperationsWidget popover gets a new item: "Compare against…" (under Analysis, only enabled when current type is DFA + complete).
7. Click → opens an inline sub-popover (or a separate compact dialog) listing Recents (filtered to DFAs only — non-DFA recents grayed with a tooltip) + a single "Open another file…" button.
8. Picking a recent loads the parsed automaton from the snapshot (we already have this via `useFileSession.openRecent` — adapt to "load but don't replace" mode, or use a separate code path that just parses the recent's snapshot string into an Automaton).
9. "Open another file…" uses the file adapter's open flow, reads + parses, then runs equivalence against the result.
10. Sub-popover closes on Esc / outside click.

### Phase 3 — Equivalence result UX
11. On success: notification severity `success`, title "Equivalent ✓", detail "These automatons accept exactly the same language." Auto-dismiss after 5s.
12. On difference: notification severity `error`, title "Not equivalent ✗", detail with the counterexample inline ("First difference: …"). Optionally a button "Test this string" that loads the counterexample into the simulator's input field.
13. On error: standard notification flow with the typed error message.

### Phase 4 — Tests + COMPLETE doc
14. Engine tests for equivalence (Phase 1).
15. RTL tests for the OperationsWidget's new item: visibility gating (DFA + complete), sub-popover behavior, picker → engine → notification path with mocks.
16. `useFileSession` may need a small extension to expose "parse-only" recent loading — test that too.
17. `ITERATION18_COMPLETE.md`.

## Success criteria

- Equivalence checking works on textbook fixtures, returns counterexample on differences.
- User can compare their current DFA against any saved DFA via the OperationsWidget.
- Counterexample surfaces in a way that supports the "now go test this in the simulator" follow-up.
- All ops still undoable / read-only as appropriate.
- `tsc --noEmit` clean. Tests grow from ~470 → ~510.

## Risks

- **Recents may include NFAs and incomplete DFAs.** Picker must filter / disable them clearly. Mitigation: parse on-demand and check; show greyed entries with tooltip explaining why.
- **Counterexample length.** Pathological pairs can produce very long counterexamples. Mitigation: BFS finds the SHORTEST counterexample by construction; display truncated with "…" if > 50 chars and full on hover/click.
- **Picker UX clutter.** Adding a sub-popover inside a popover risks chrome-layering issues. Mitigation: replace the OperationsWidget popover content entirely with the picker view when active (think: two-page popover with a back button), instead of nesting popovers.

## Out of scope / future

- **Test-case bundle equivalence**: file format includes `testCases` but no UI for them. iter-19+.
- **Three-way+ comparison.** Pairwise only.
- **Equivalence under language complement / union / intersection** (closure operations) — iter-19+ if demanded.
- **"Send counterexample to simulator" as auto-action**: gated on Phase 3 design; consider a button rather than auto-action.
