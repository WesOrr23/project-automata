# Iteration 17 — Operations Widget + Complement + State-Centric Centering (Complete)

## What shipped

Six threads landed under the iter-17 banner:

1. **OperationsWidget** — new floating top-center pill (sibling of CommandBar), EDIT-only via `<AnimatePresence>`. Single Wand2 icon → categorized popover with sections (Conversions / Analysis) and per-item enable/disable + tooltip-on-disabled-explaining-why. Outside-click + Escape close. Auto-resets on EDIT exit so reopen doesn't show stale state.
2. **`complementDfa`** in a new `src/engine/operations.ts`. Refuses NFAs (`'complement-requires-dfa'`) + incomplete DFAs (`'complement-requires-complete-dfa'`); on a complete DFA, returns a fresh automaton with `acceptStates ← states − acceptStates`. Defensive Set/transition clones.
3. **Three operations wired in App.tsx**: Convert (NFA-only), Complement (DFA + complete only), Minimize (DFA + complete only). Minimize already existed as `src/engine/minimizer.ts` (auto-applied after Convert in iter-16); now also surfaced as a standalone op. All three are undoable via the existing `setAutomaton` + snapshot stack.
4. **EditPanel "Operations" footer removed** — Convert button no longer lives inline; it's in the widget. Footer CSS dropped.
5. **`1:1` zoom button removed**. Fit-to-view does what 1:1 was supposed to do (show me the whole thing optimally). `Cmd+0` shortcut repurposed to Fit. CanvasZoomControls down to 3 buttons; `reset` callback no longer threaded.
6. **State-centric centering** replacing the iter-16-era `getBBox` measurement. The bbox returned by `getBBox` includes transition labels (e.g., the "0" label above q1's self-loop) which pulled the visual center upward away from where the user perceives "the FA's center" — namely, the cluster of state circles. New approach: union of state circle bboxes (position ± stateRadius) plus the start arrow's leftmost extent. Labels excluded by design.
7. **Debug center dots removed** — they served their purpose (verified centering visually); the test suite covers the math now.

Tests: **432 → 450** (+18 — 7 complement, 12 OperationsWidget, refresh of CanvasZoomControls). All green. `tsc --noEmit` clean.

---

## Phase log

| Phase | Touched | Tests added |
|---|---|---|
| 1 — `complementDfa` engine + tests | operations.ts + result.ts (2 new variants) | +7 |
| 2 — OperationsWidget component + CSS | OperationsWidget.tsx + simulation.css | 0 |
| 3 — App.tsx wiring (3 ops + categories) | App.tsx | 0 |
| 4 — EditPanel footer strip + Convert/canConvert props removed | EditPanel.tsx + App.tsx | 0 |
| 5 — Drop `1:1` button + reset prop + Cmd+0 → Fit | CanvasZoomControls.tsx + AutomatonCanvas.tsx + test | 0 |
| 6 — State-centric centering | AutomatonCanvas.tsx | 0 |
| 7 — Strip debug dots + innerContentGRef | AutomatonCanvas.tsx | 0 |
| OperationsWidget RTL tests | OperationsWidget.test.tsx | +12 |

---

## Design decisions

### Why a categorized popover over a row of inline buttons
The widget will accumulate operations: iter-18 adds Equivalence; future iterations may add Image Export, Complete-this-DFA (auto-add trap), Reverse-language-DFA, etc. A row would push the bar wide; a popover scales without claiming horizontal real estate at rest.

### Why the widget is a sibling of CommandBar (not absorbed into it)
The CommandBar holds COMMON command-tier UI (file, history). Operations are NICHE — used a few times per FA, sometimes never. Putting them in CommandBar would re-create the noise problem we deleted Convert for in the first place. The widget shares the CommandBar's visual language (same pill, shadow, blur) so they read as related, not random.

### State-centric vs. pixel-bbox centering
`getBBox` is the right answer for "the rendered pixel bounds." But the user reads "centered" as "the states are arranged around a vertical/horizontal mid-line," not "the PNG you'd save would have a centered-by-pixels FA." Labels above states (self-loop labels especially) pull the pixel-bbox center up; the state-circle-only center matches perception. Verified with the debug-dot pass before stripping them.

### Cmd+0 → Fit (not unbound)
With `1:1` gone, `Cmd+0` previously bound to it had to either be unbound or repurposed. Repurposed to Fit because (a) it preserves muscle memory ("zero" = back to baseline) and (b) Fit is the closest semantic kin to what 1:1 was trying to be.

### Tooltip-on-disabled-explaining-why
Disabled buttons with no explanation are frustrating ("why can't I click that?"). Each disabled item gets a `title` like "Requires a complete DFA" so the user knows what's blocking them rather than guessing. The omit-only spread-conditional pattern (`...(condition ? {} : { title: '...' })`) honors `exactOptionalPropertyTypes`.

---

## What stayed the same
- All engine semantics outside the new `complementDfa`.
- All CommandBar behavior + tests (the bar wasn't touched after the iter-16 cleanup).
- All keyboard shortcuts other than Cmd+0's repurpose.
- Notifications, undo/redo, file ops.

---

## Out of scope / deferred
- **Equivalence checking** — iter-18.
- **Regex → NFA, tape view, algorithm step-through visualization** — explicitly out of scope per Wes.
- **Image export (PNG/SVG)** — future iteration; would slot into the widget under a new "Export" category.
- **`⌘K` command palette** — defer until the operations menu has 8+ items.
- **Right-click canvas context menus** — orthogonal; can land any time.
- **Narrow-viewport popover overflow** — at viewports < ~600px, the OperationsWidget popover can clip on the right. Acceptable for now; would need anchored-right positioning (or a portal that flips based on available space) to fix.

---

## How to run
```bash
cd /Users/wesorr/Documents/Projects/Project\ Automata/.claude/worktrees/iter-12
npm test -- --run            # 450 passing
npx tsc --noEmit             # clean
npm run dev                  # browser at http://localhost:5181
```

In the browser:
1. Switch to EDIT mode → wand icon appears next to CommandBar.
2. Click wand → popover with Conversions (Convert NFA→DFA / Complement) + Analysis (Minimize DFA).
3. Sample is a DFA so Convert is disabled; Complement and Minimize are enabled (DFA is complete).
4. Click Complement → accept states swap; banner notifies.
5. Click Minimize → if states merge, banner shows the count; if already minimal, "Already minimal" info banner.
6. ⌘Z reverts each operation.
