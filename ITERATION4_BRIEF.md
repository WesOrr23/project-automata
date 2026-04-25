# Iteration 4: Comprehensive Code Brief

This document explains every file created or modified in Iteration 4, what it does, and why it was built the way it was.

---

## New Files

### 1. `src/hooks/useSimulation.ts` — The Brain

**What it is**: A React hook that manages all simulation state. This is the bridge between the engine layer (which knows how to simulate DFAs) and the UI layer (which needs to display the results).

**Why `useReducer` instead of `useState`**: The simulation has multiple interrelated pieces of state (simulation data, status, speed, history) with strict rules about which transitions are valid (e.g., you can't step while running). A reducer centralizes all these rules in one pure function. This also means the state logic is testable without React — you can call `simulationReducer(someState, someAction)` directly in tests.

**The state shape**:
```typescript
{
  history: Simulation[],   // Every simulation snapshot, in order
  historyIndex: number,    // Where we currently are in that array
  status: 'idle' | 'running' | 'paused' | 'finished',
  speed: number,           // Auto-step interval in milliseconds
}
```

**Why `history` array instead of a single `simulation`**: Originally there was just one `Simulation` object. But you asked for backward stepping, which means we need to go back to previous states. Rather than re-computing from scratch, we store every snapshot. `historyIndex` points to whichever snapshot is "current" — stepping back just decrements the index, stepping forward appends a new snapshot. This is the undo/redo pattern.

**Key actions in the reducer**:
- `initialize` — Creates the first simulation from the engine's `createSimulation()`, stores it as history[0]
- `step` — Calls the engine's `step()`, appends the result to history. Blocked during `running` status to prevent double-stepping
- `autoStep` — Same as step, but only works during `running` status. This is what the timer dispatches
- `stepBack` — Decrements `historyIndex`. No computation needed, just index movement
- `jumpTo` — The most complex action. Can jump backward (just move the index) or forward (compute missing steps). Also auto-initializes if no simulation exists yet, which is how clicking a character before pressing Play works
- `run` / `pause` — Toggle between `running` and `paused` status
- `reset` — Clears everything back to initial state

**The auto-step timer** (lines 226-235): Uses `useEffect` with `setTimeout`, not `setInterval`. Why? Each step produces a new `Simulation` object, which changes state, which triggers a re-render, which re-runs the effect, which schedules the *next* timeout. This chains naturally. `setInterval` would cause stale closure problems because the callback would close over an old simulation value.

**Derived values** (lines 237-263): Computed fresh each render, not stored in state. Things like `currentStateIds`, `consumedCount`, `accepted`, and `nextTransition`. These are all derivable from the current simulation snapshot, so storing them would be redundant. `nextTransition` uses the engine's `getTransition()` to figure out which edge will be taken next — this powers the blue edge highlighting.

**`useCallback` on actions** (lines 265-283): React optimization. Without this, every render would create new function references, potentially causing child components to re-render unnecessarily. `useCallback` memoizes them so the same function reference is reused between renders.

---

### 2. `src/hooks/useSimulation.test.ts` — 33 Tests

Tests the reducer as a pure function — no React involved. Creates a test DFA, then exercises every action type and edge case:
- Each action in isolation (step, stepBack, run, pause, reset, setSpeed)
- Invalid transitions are no-ops (stepping when finished, pausing when idle)
- `stepBack` with history truncation (stepping forward after going back discards the old forward path)
- Full walkthrough tests (accepted string, rejected string, auto-step run)
- Speed clamping (values below minimum or above maximum get clamped)

---

### 3. `src/components/InputPanel.tsx` — Text Input

**What it is**: A controlled text input with alphabet validation.

**Alphabet filtering** (line 24-29): On every `onChange` event, the raw value is split into characters, filtered against the automaton's alphabet Set, and joined back. This handles typing, paste, autocomplete — anything that modifies the input. Using `onChange` instead of `onKeyDown` is important because `onKeyDown` misses paste and autocomplete events.

**Always editable**: The input is never disabled. If you type while a simulation is active, App.tsx's `handleInputChange` calls `sim.reset()` first, then updates the string. This eliminates the need for a Reset button.

---

### 4. `src/components/SimulationControls.tsx` — Buttons + Progress + Speed

**Layout order**: Speed → Playback (progress + buttons) → Result. This follows the logical flow: configure, then act, then see results.

**Fixed layout**: All controls are always visible in the same positions. Nothing hides/shows. Disabled buttons use low opacity (0.3) to indicate "not available now" while remaining visible so the user knows what's possible.

**Play/Pause swap** (lines 155-164): These occupy the same slot. When `status === 'running'`, the Play button becomes Pause. This is the only layout change — and since they're the same size in the same position, it doesn't feel jarring.

**Speed toggle** (lines 67-86): A pill-shaped toggle with two options: Slow (3000ms) and Fast (200ms). Replaced a continuous slider because the slider communicated "fine-grained control" which was overkill — users don't care about the difference between 400ms and 450ms.

**Character progress display** (lines 92-153): Shows the input string with consumed characters greyed out and the next character bold/underlined. Every character is clickable — clicking auto-initializes the simulation if needed and jumps to that position. Hover changes color to blue as an affordance. The display always reserves its minimum height to prevent layout shift.

**`closestPreset()`** (lines 35-38): Maps the current speed value to whichever preset it's closest to, so the toggle reflects the current state correctly.

---

### 5. `src/index.css` — Design System

**4-layer color system** (lines 10-70):
- **Layer 1 — Neutral foundation**: Page background (`#f0f3f8`, blue-tinted), sidebar (solid white), input field (light gray `#f4f6f9`), text hierarchy (heading/body/secondary/consumed at decreasing opacity)
- **Layer 2 — Blue accent ramp**: 10-step scale from `--blue-50` to `--blue-900`, centered on `#3b82f6`. Buttons hover to `--blue-50`, active states use `--blue-200`/`--blue-600`, the Play button uses `--blue-500`
- **Layer 3 — Semantic colors**: Green for accepted, red for rejected. Only used for simulation results
- **Layer 4 — Not implemented yet** (theming)

**Typography constraints** (lines 72-85): 1 sans-serif font family, 4 sizes (20/14/12/20mono), 2 weights (400/600). The mono font is only for the character progress display where alignment matters.

**Spacing system** (lines 87-96): 4px base unit. All values are multiples: 4, 8, 12, 16, 24, 32, 40, 48. No arbitrary values anywhere in the codebase.

**Floating sidebar** (lines 141-166): `position: fixed`, slides off-screen when collapsed via `transform: translateX()` with a 0.2s ease transition. `pointer-events: none` when collapsed prevents it from intercepting clicks while invisible.

**Button system** (lines 216-262): Two tiers. Standard `.btn` is white with subtle border and shadow, hover lifts to blue-50. `.btn-primary` is solid blue-500, used only for the Play button — the primary action.

**Why no `backdrop-filter`**: The original glassmorphism (blur + semi-transparent backgrounds) made the sidebar feel washed out. Switching to solid white with a clean shadow gave better contrast and readability, aligning with your UI/UX principles: "If an effect does not make the information clearer or the interaction more intuitive, remove it."

---

### 6. `ITERATION4_PLAN.md` — Plan Document

Written before implementation began (per your preference). Documents the goal, scope, deliverables, state machine, file changes, design decisions, and verification plan. Updated throughout to reflect additions (back button, transition highlighting, clickable characters, UI redesign).

---

## Modified Files

### 7. `src/App.tsx` — The Orchestrator

**Before**: A simple centered layout rendering the automaton.

**After**: Manages the full application state — input string, simulation hook, sidebar visibility — and wires everything together.

**Key orchestration logic**:
- `handleInputChange` (lines 51-56): Auto-resets simulation when input changes. This is why there's no Reset button.
- `ensureInitialized` (lines 62-68): Called by `handleStep` and `handlePlay` to create the simulation on first interaction. Handles the chicken-and-egg problem where the user needs to click Play before a simulation exists.
- `handleJumpTo` (lines 90-93): Passes both the character index AND the input string to `sim.jumpTo()`. The input string is needed because `jumpTo` might need to auto-initialize — and the hook doesn't own the input state, App does.
- `resultStatus` computation (lines 95-98): Derives the accept/reject status for visual feedback. Only set when finished.

**Layout** (lines 100-172): Fragment (`<>`) with three children — the sidebar toggle button, the floating sidebar, and the full-viewport canvas area. No wrapper div needed.

---

### 8. `src/components/AutomatonCanvas.tsx` — Pass-Through Layer

**Added props**: `activeStateIds`, `resultStatus`, `nextTransition`. These flow from App → AutomatonCanvas → StateNode/TransitionEdge.

**Transition matching** (lines 48-52): For each transition in the UI data, checks if it matches the `nextTransition` by comparing `fromStateId`, `toStateId`, and `symbol`. If so, passes `isNextTransition={true}` to TransitionEdge.

**State result status** (line 73): Only passes `resultStatus` to the *active* (current) state — not all states. You only want the final state colored green/red, not every state.

---

### 9. `src/components/StateNode.tsx` — Visual Feedback

**Activated `isActive` prop**: Was previously defined but unused (aliased to `_isActive`). Now drives the fill/stroke color.

**Color priority** (lines 55-67): `resultStatus > isActive > default`. When finished, the current state shows green (accepted) or red (rejected). During simulation, the active state shows blue. Otherwise, white with slate-700 stroke.

**Why hardcoded hex values instead of CSS variables**: SVG elements don't inherit CSS custom properties the same way HTML does. The hex values are commented with their corresponding CSS variable names for maintainability.

**Updated font**: Changed from `Arial` to the system font stack to match the design system.

---

### 10. `src/components/TransitionEdge.tsx` — Edge Highlighting

**Added `isNextTransition` prop**: When true, the edge renders in blue-600 with 3px stroke width and bold label text. When false, default slate color with 2px stroke.

**All three SVG elements respond**: The path, arrowhead polygon, and text label all use `edgeColor`, so the entire transition lights up as a unit.

---

### 11. `src/ui-state/constants.ts` — Shared Constants

**Added simulation speed constants**: `SIMULATION_SPEED_MIN` (200ms), `SIMULATION_SPEED_MAX` (3000ms), `SIMULATION_SPEED_DEFAULT` (500ms). Imported by both the hook (for clamping in the reducer) and SimulationControls (for the toggle preset values). Single source of truth — previously these were duplicated in two files.

---

### 12. `src/main.tsx` — CSS Import

One line added: `import './index.css'`. This loads the global design system.

---

## Architecture Summary

```
App.tsx (orchestrator)
├── useSimulation hook ← engine/simulator.ts (pure functions)
├── InputPanel (text input + alphabet filtering)
├── SimulationControls (buttons + progress + speed + result)
└── AutomatonCanvas (SVG rendering)
    ├── TransitionEdge (with next-transition highlighting)
    ├── StateNode (with active/result coloring)
    └── StartStateArrow

index.css (design system — tokens, components, layout)
constants.ts (shared values between hook + UI)
```

**Data flow**: User types → App manages input string → User clicks Play/Step/character → App calls hook actions → Hook dispatches to reducer → Reducer produces new state → React re-renders → Derived values (currentStateIds, nextTransition, consumedCount) flow down to visual components → SVG updates.

**Engine layer untouched**: Zero changes to `engine/`. All simulation logic (`createSimulation`, `step`, `isFinished`, `isAccepted`, `getTransition`) was already built in Iteration 1. This iteration only wired it to the UI.
