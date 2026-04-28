# Iteration 4: Simulation + Visual Feedback

**Status**: IN PROGRESS
**Start Date**: 2026-04-03
**Branch**: `iteration-4`

---

## Goal

Working interactive DFA simulator — the **first major milestone** where the app becomes interactive. Users can enter an input string, step through simulation one symbol at a time or auto-run at adjustable speed, and see the current state highlighted on the automaton visualization with clear accept/reject feedback.

---

## Scope

- **Read-only automaton** (uses auto-layout from Iteration 3)
- **DFA only** (NFA is Iteration 6)
- Automaton always has at least one state, always has a start state
- No animation of transitions between states (future iteration)
- Layout arrangement is functional/simple, not final

---

## Deliverables

### Input Panel
- Text input field for entering test strings
- Per-keystroke validation: silently rejects characters not in the automaton's alphabet (handles typing and paste)
- Full input string displayed with consumed characters greyed out
- Next character to be consumed is bold/underlined (black, not blue — to avoid confusion with transition highlighting)
- Input field disabled during simulation (must Reset to change)

### Simulation Controls
- **Back**: step backward through simulation history
- **Step**: advance one symbol manually
- **Run**: auto-step through at configurable speed
- **Pause**: interrupt a running simulation mid-execution
- **Reset**: clear simulation state (preserves input string for replay)
- **Speed slider**: logarithmic scale (200ms–3000ms), labeled Slow/Fast

### Visual Feedback
- **Active state**: light blue fill (`#4dabf7`) + darker blue stroke (`#1971c2`) during simulation
- **Next transition**: highlighted blue edge with thicker stroke and bold label
- **Accepted result**: green fill + green stroke on final state + "ACCEPTED" banner
- **Rejected result**: red fill + red stroke on final state + "REJECTED" banner

### Simulation Hook (`useSimulation`)
- `useReducer` with pure reducer function (testable without React)
- Status state machine: `idle → running → paused → finished`
- Auto-step timer via `useEffect` + `setTimeout`
- History array stores simulation snapshots for backward navigation
- Derived values: currentStateIds, stepIndex, consumedCount, accepted, nextTransition
- Replay support: Step/Run from finished state re-initializes automatically

---

## Status State Machine

```
idle     → step     → idle (or finished if input exhausted)
idle     → run      → running
idle     → stepBack → idle (if history exists)
running  → auto-step exhausts input → finished
running  → pause    → paused
paused   → step     → paused (or finished)
paused   → stepBack → paused
paused   → run      → running
finished → step     → re-initializes → idle
finished → run      → re-initializes → running
finished → stepBack → idle
ANY      → reset    → idle
ANY      → initialize → idle (auto-resets)
```

---

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useSimulation.ts` | Create | Simulation state management hook with history |
| `src/hooks/useSimulation.test.ts` | Create | Pure reducer tests (33 tests) |
| `src/components/InputPanel.tsx` | Create | Text input with validation + consumed display |
| `src/components/SimulationControls.tsx` | Create | Back/Step/Run/Pause/Reset + speed slider + result banner |
| `src/components/TransitionEdge.tsx` | Modify | Add `isNextTransition` prop for edge highlighting |
| `src/components/StateNode.tsx` | Modify | Activate `isActive`, add `resultStatus` prop |
| `src/components/AutomatonCanvas.tsx` | Modify | Pass through `activeStateIds`, `resultStatus`, `nextTransition` |
| `src/ui-state/constants.ts` | Modify | Add shared simulation speed constants |
| `src/App.tsx` | Modify | Wire hook + new components together |

---

## Engine Code Reused (No Changes Needed)

- `createSimulation(automaton, input)` — creates simulation, validates automaton
- `step(simulation)` — processes next symbol, returns new Simulation
- `isFinished(simulation)` — checks if no remaining input
- `isAccepted(simulation)` — true if finished in accept state
- `getTransition(automaton, stateId, symbol)` — used for computing next transition highlight
- `Simulation` and `SimulationStep` types
- `isRunnable()` — called internally by createSimulation

---

## Key Design Decisions

### `useReducer` over `useState`
Multiple fields change together with rules about valid transitions. A pure reducer centralizes all state logic in one function, matches the project's functional philosophy, and is directly testable without React testing utilities.

### `setTimeout` over `setInterval`
Each step creates a new Simulation object, which triggers a re-render, which re-runs the effect, scheduling the next timeout. This chains steps naturally, avoids stale closures, and makes speed changes take effect immediately.

### Separate `step` and `autoStep` actions
User-facing `step` is blocked during `running` status (to prevent double-stepping). The timer dispatches `autoStep` instead, which only operates when status is `running`.

### History array for step-back
Each forward step appends the new Simulation snapshot to a history array. Stepping back decrements the index. Stepping forward after stepping back truncates forward history (like undo/redo). No re-computation needed.

### Input validation via `onChange` filtering
Filters invalid characters on every change event (not `onKeyDown`), which correctly handles paste, autocomplete, and other input methods.

### Logarithmic speed slider
Human perception of speed is logarithmic — the difference between 200ms and 400ms feels much larger than 2000ms and 2200ms. The slider maps position to speed exponentially so perceived speed changes evenly across the range.

### Shared speed constants in `ui-state/constants.ts`
Speed bounds (`SIMULATION_SPEED_MIN`, `SIMULATION_SPEED_MAX`, `SIMULATION_SPEED_DEFAULT`) are defined once in `constants.ts` and imported by both the hook (for clamping) and the controls component (for slider math). Single source of truth.

### Next-character and next-transition color separation
The next input character uses black bold/underline (not blue) to avoid visual confusion with the blue next-transition edge highlighting on the automaton.

---

## Verification Plan

1. Type valid characters in input — invalid characters silently rejected
2. Click Step — start state highlights blue, next transition edge highlighted blue
3. Click Step repeatedly — state highlight moves, consumed characters grey out
4. Click Back — steps backward through history
5. Click Run — simulation auto-steps at slider speed
6. Click Pause mid-run — simulation stops, can resume with Run or Step
7. Let Run complete — final state shows green/red, "ACCEPTED"/"REJECTED" banner
8. Click Step or Run after completion — replays from start with same input
9. Click Reset — clears simulation, input string preserved
10. Adjust speed slider — logarithmic scaling feels even across range
11. All existing tests pass + 33 new reducer tests pass (131 total)
