# Iteration 17 — Operations Widget + DFA Minimization (Plan)

> Branch: `iteration-17-minify-and-menu` (already exists; built on the menu re-arch and centering fixes from iter-16+ polish).

## Context

After Variant B (CommandBar) shipped, Convert-to-DFA was briefly hosted in the bar's EDIT segment, then pulled back to an inline button in EditPanel because operation-tier transformations don't belong in the common command strip. `ADVANCED_OPS_BRAINSTORM.md` recommends a dedicated **Operations widget** as the long-term home for Convert / Minimize / Equivalence / Complement / Regex / Image-export.

Iter-17 ships the widget itself, moves Convert into it, drops the borderline-meaningless `1:1` zoom button, and adds **Hopcroft DFA minimization** as the second op so the widget has more than one entry on day one.

## Goals

1. **OperationsWidget** — floating top-center, EDIT-only, anchored to the right of the CommandBar with a small gap. One icon button (Wand2 or Sparkles from Lucide); click → categorized popover. Discoverable but quiet.
2. **Move Convert to DFA** out of EditPanel into the widget under a "Conversions" category.
3. **Add DFA Minimization** (Hopcroft's algorithm) as a new engine function, surface it in the widget under an "Analysis" category. Only enabled when type is DFA AND the DFA is not already minimal.
4. **Add Complement** (one-liner: flip accept states on a complete DFA). Under "Conversions". Only enabled when type is DFA AND the DFA is complete.
5. **Drop the `1:1` button** from CanvasZoomControls. Three buttons left: `+` / `−` / Fit. Saves a button + the now-unused `reset` callback.
6. **Strip the EditPanel Operations footer** and its CSS once Convert moves out.
7. **Strip the debug centering dots** before commit (they served their purpose).

## Non-goals

- Equivalence checking (iter-18).
- Regex → NFA (out of scope per Wes).
- Tape view + algorithm step-through visualization (out of scope).
- ⌘K command palette (deferred until the operations menu has 8+ items).
- Image export (out of scope for this iteration; planned later).

## Phase order

### Phase 1 — Engine: minimization
1. Create `src/engine/minimizer.ts` with `minimizeDfa(dfa: Automaton): Result<{ dfa: Automaton; mergeMap: Map<number, Set<number>> }>`. Hopcroft's algorithm: partition refinement starting from {accept-states, non-accept-states}.
2. Returns the minimized DFA + a `mergeMap` (new state ID → set of original state IDs that collapsed into it). For label generation if we want it.
3. Refuses NFAs (`'minimization-requires-dfa'`). Refuses incomplete DFAs (`'minimization-requires-complete-dfa'`) — caller can choose to add a trap state first or surface the error.
4. New `EngineError` variants + `errorMessage` cases.
5. Tests in `src/engine/__tests__/minimizer.test.ts`: textbook DFA → known-minimal DFA, idempotence (minimize-twice = minimize-once), DFA where every state is reachable + distinguishable (no-op), DFA with unreachable states (trimmed), all-accept and no-accept edge cases.

### Phase 2 — Engine: complement
6. Add `complementDfa(dfa: Automaton): Result<Automaton>` to `src/engine/automaton.ts` (or a new `src/engine/operations.ts` if we prefer a fresh home for transformation ops).
7. Refuses NFAs (`'complement-requires-dfa'`). Refuses incomplete DFAs (`'complement-requires-complete-dfa'`).
8. Implementation: new acceptStates = states - acceptStates.
9. Tests: complement of {strings ending 01} = {strings NOT ending 01}; complement of complement = original (modulo state renumbering).

### Phase 3 — UI: OperationsWidget
10. Create `src/components/OperationsWidget.tsx`. Single icon button (Wand2 from lucide-react) in a floating pill matching CommandBar/UndoRedo aesthetic. Click → popover.
11. Popover layout: categorized sections (Conversions, Analysis), each item is `{ label, hint?, enabled, onClick }`.
12. Anchored absolute below the widget button. Closes on outside click + Escape — same idiom as the CommandBar `⋯` popover.
13. Visibility gated by `appMode === 'EDITING'` via AnimatePresence (matching the existing tip pattern).
14. Position: TOP-CENTER, just to the right of CommandBar. Use `position: fixed; top: 16px;` with a left calc that places it after the bar. Or — simpler — render it as a sibling of CommandBar in a top-center stack (`flex-direction: row`, gap), and let the stack auto-arrange.
15. CSS in `src/styles/simulation.css` (where command-bar lives) — `.operations-widget` + `.operations-widget-popover` + `.operations-widget-section` + `.operations-widget-item`.

### Phase 4 — App.tsx wiring
16. Compute `canConvertToDfa = automaton.type === 'NFA'`, `canMinimize = automaton.type === 'DFA' && !isAlreadyMinimal(automaton)`, `canComplement = automaton.type === 'DFA' && isComplete(automaton)`.
17. Define `handleMinimize`, `handleComplement`, both follow the `handleConvertToDfa` pattern (call engine, push onto undo via setAutomaton, notify on success/error).
18. Render `<OperationsWidget>` as sibling of `<CommandBar>`. Pass the three handler-+-enabled tuples.
19. Remove the EditPanel `onConvertToDfa` / `canConvertToDfa` props and the inline button. Drop `.edit-panel-operations` CSS.
20. Remove debug center dots from AutomatonCanvas (and the contentBBox circle markers).

### Phase 5 — Drop 1:1
21. Remove the `1:1` button from `CanvasZoomControls.tsx`. Strip its prop (`reset`) and the related `aria-label="Reset zoom"`. Update RTL test (`CanvasZoomControls.test.tsx`) to drop the related cases.
22. Keep `reset` in `useCanvasViewport` — it's still used internally (by `Cmd+0` shortcut maybe?) — actually check if anything else uses it; if not, remove. Also drop `Cmd+0` from canvas keyboard shortcuts if present.

### Phase 6 — Tests + COMPLETE doc
23. RTL tests for OperationsWidget: visibility gating, popover open/close, item click → callback, disabled state per category.
24. Engine tests for minimization (Phase 1) + complement (Phase 2).
25. Update CommandBar tests if anything changed (probably not; CommandBar wasn't touched).
26. `ITERATION17_COMPLETE.md` summarizing.

## Success criteria

- Operations widget visible top-center in EDIT mode, hidden elsewhere.
- Convert to DFA, Minimize DFA, Complement DFA all reachable from the popover.
- Each correctly enabled/disabled based on automaton state.
- All ops undoable.
- `tsc --noEmit` clean. Tests grow from 432 → ~470.
- 1:1 button gone. Centering dots gone. EditPanel Operations footer gone.

## Risks

- **Dropping `1:1` requires a bit of grep work** to make sure no test, comment, or shortcut depends on it. Mitigation: grep for `'1:1'`, `Reset zoom`, `0` keyboard shortcut.
- **OperationsWidget positioning next to CommandBar** — needs to coexist with CommandBar's centered transform. Two options: (a) render as a sibling inside a flex row that's centered as a unit, or (b) absolute-position relative to CommandBar's right edge. Option (a) is cleaner; refactor CommandBar's wrapper into a `.top-center-stack`.
- **Hopcroft implementation correctness** — partition refinement is fiddly. Mitigation: textbook fixture from Sipser / Hopcroft-Ullman; idempotence test; property test (random short inputs match between original and minimized).

## Out of scope / deferred

- Equivalence checking → iter-18.
- "Show me the steps" visualization for minimize → iter-20+ if/when we revive that idea.
- Image export → later iteration (still listed in NEXT_FEATURES).
- ⌘K palette → much later.
