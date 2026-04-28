# Iteration 4: Simulation + Visual Feedback

**Goal**: Working interactive DFA simulator — users can enter input, step or auto-play through simulation with visual state highlighting and accept/reject feedback.

**Status**: **COMPLETE** — All 131 tests passing, first major interactive milestone shipped.

**Start Date**: 2026-04-03
**Completion Date**: 2026-04-04
**Branch**: `iteration-4`

---

## What We Built

### Completion Summary

Iteration 4 transformed the app from a static visualization into an interactive DFA simulator — the **first major milestone**. Users can enter an input string, step through or auto-play the simulation, and see the automaton respond with state highlighting, transition highlighting, and accept/reject results.

A full UI redesign was also completed, moving from a test-page layout to a polished product interface with a floating sidebar, full-viewport canvas, and a design system built on your programmer-dna UI/UX principles.

**Architecture**: The engine layer required zero changes. All simulation logic (`createSimulation`, `step`, `isFinished`, `isAccepted`) was already built in Iteration 1. This iteration wired it to the UI through a `useReducer`-based hook.

### Files Created

| File | Purpose |
|------|---------|
| `src/hooks/useSimulation.ts` | Simulation state management — reducer + hook with history, auto-step timer, derived values |
| `src/hooks/useSimulation.test.ts` | 33 pure reducer tests covering all state transitions and edge cases |
| `src/components/InputPanel.tsx` | Text input with per-keystroke alphabet filtering |
| `src/components/SimulationControls.tsx` | Playback controls, speed toggle, character progress display, result banner |
| `src/index.css` | Global design system — color tokens, typography, spacing, component styles |
| `ITERATION4_PLAN.md` | Planning document (written before implementation) |
| `ITERATION4_BRIEF.md` | Comprehensive code walkthrough of all changes |

### Files Modified

| File | Changes |
|------|---------|
| `src/App.tsx` | Full rewrite — floating sidebar layout, simulation wiring, auto-reset on input change |
| `src/components/AutomatonCanvas.tsx` | Pass-through for `activeStateIds`, `resultStatus`, `nextTransition` |
| `src/components/StateNode.tsx` | Activated `isActive` prop, added `resultStatus` for accept/reject coloring |
| `src/components/TransitionEdge.tsx` | Added `isNextTransition` prop for blue edge highlighting |
| `src/ui-state/constants.ts` | Added shared simulation speed constants (single source of truth) |
| `src/main.tsx` | CSS import added |

### Success Criteria Met

- User can enter input string with invalid characters silently filtered
- Step-by-step simulation with current state highlighted (blue)
- Next transition edge highlighted (blue, thicker stroke)
- Auto-play mode with Slow/Fast speed toggle
- Pause interrupts auto-play
- Accept/reject result shown with green/red coloring + banner
- Backward stepping through full simulation history
- Forward/backward jumping by clicking characters in the progress display
- Characters clickable without needing to press Play first (auto-initializes)
- Input always editable — typing auto-resets any active simulation
- All 131 tests passing (98 existing + 33 new)

---

### Architecture Decisions Made

1. **`useReducer` over `useState`**: Multiple fields change together with strict transition rules. The pure reducer function centralizes all state logic, matches the project's functional philosophy, and is directly testable without React testing utilities.

2. **History array for step-back**: Each forward step appends a `Simulation` snapshot to an array. Backward navigation is O(1) — just decrement the index. Memory cost is trivial for DFAs (a Set with 1 number + a string per snapshot). The alternative (re-computing from scratch) would make `jumpTo(N)` require N calls to `engineStep()`.

3. **Separate `step` and `autoStep` actions**: User-facing `step` is blocked during `running` status (prevents double-stepping from click + timer). The timer dispatches `autoStep`, which only works during `running`. They're logical inverses.

4. **`setTimeout` over `setInterval`**: Each step produces new state → re-render → new effect → new timeout. This chains naturally, avoids stale closures, and makes speed changes take effect immediately on the next step.

5. **`jumpTo` with auto-initialization**: Clicking a character before pressing Play should just work. `jumpTo` optionally accepts the automaton and input string — if no simulation exists, it creates one and then jumps. This eliminates a class of "you must do X before Y" UX friction.

6. **Input always editable**: No disabled state on the text field. Typing while a simulation is active calls `reset()` then updates the string. Eliminates the Reset button as a concept.

7. **Speed as two presets**: A continuous slider communicated "fine-grained control" that users don't need. Two presets (Slow: 3000ms, Fast: 200ms) as a pill toggle gives clear affordance with minimal cognitive load.

8. **SVG colors as hardcoded hex**: SVG elements don't inherit CSS custom properties reliably. Colors are hardcoded but commented with their CSS variable names for maintainability.

---

### UI/UX Design Decisions

1. **Full-viewport canvas**: The automaton owns the screen. The sidebar floats over it and can be collapsed. This prioritizes the content the user is here to see.

2. **Fixed sidebar layout**: All controls are always visible in the same positions. Nothing hides/shows between states. Disabled controls use low opacity. This prevents the jarring "where did that button come from" feeling.

3. **Layout order**: Input → Speed → Playback (progress, Play, Back/Step) → Result. This follows the logical flow: type → configure → act → observe.

4. **Blue-ramp color system**: Built from a central `#3b82f6` with blue-tinted neutrals. The brand color is used sparingly — Play button, focus rings, active states, transition highlights, character hover. Green/red reserved strictly for accept/reject semantics.

5. **4-layer color system** from the programmer-dna UI/UX principles: neutral foundation, blue accent ramp, semantic colors. All defined as CSS custom properties in `:root`.

6. **Typography**: 1 font family, 4 sizes, 2 weights. Monospace only for the character progress display where alignment matters.

7. **Spacing**: Strict 4px grid (4, 8, 12, 16, 24, 32, 40, 48). No arbitrary values.

8. **Character progress**: Consumed characters grey out, next character bold/underlined, all characters clickable (hover → blue). Clicking jumps the simulation to that position, auto-initializing if needed.

---

### Key Concepts Introduced

- **React hooks** (`useReducer`, `useEffect`, `useCallback`): State management patterns for React functional components
- **Reducer pattern**: Pure function `(state, action) → newState` — centralizes state transitions, directly testable
- **History/undo pattern**: Array of snapshots + index pointer for O(1) backward navigation
- **Derived state**: Values computed each render rather than stored (avoids sync bugs)
- **CSS custom properties**: Design tokens in `:root` for consistent theming
- **Progressive disclosure through color**: All controls visible, emphasis communicates availability

### Test Summary

- 131 total tests passing (98 engine/UI + 33 new hook tests)
- TypeScript compiles with no errors
- All simulation scenarios verified in browser

### Known Limitations

- Speed toggle only has two presets (Slow/Fast) — could add a Medium option if needed
- No transition animation between states (future iteration)
- Sidebar collapse button uses basic `‹` / `›` characters — could use proper icons
- SVG colors hardcoded instead of using CSS variables (SVG limitation)

## Status State Machine

The simulation hook implements a clear state machine:

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

## File Structure

```
/src
  /hooks
    - useSimulation.ts          # Reducer + hook with history, auto-step timer
    - useSimulation.test.ts     # 33 pure reducer tests
  /components
    - InputPanel.tsx            # Text input with alphabet filtering
    - SimulationControls.tsx    # Playback + speed + character progress + result banner
    - AutomatonCanvas.tsx       # MODIFIED: pass-through for activeStateIds, resultStatus, nextTransition
    - StateNode.tsx             # MODIFIED: activated isActive, added resultStatus
    - TransitionEdge.tsx        # MODIFIED: added isNextTransition for blue highlighting
  /ui-state
    - constants.ts              # MODIFIED: shared simulation speed constants
  - App.tsx                     # REWRITE: floating sidebar layout, simulation wiring
  - main.tsx                    # MODIFIED: CSS import added
  - index.css                   # NEW: design system tokens, components, layout
```

---

## Metrics

- **Test Coverage**: 131 tests, 100% passing (98 prior + 33 new hook tests)
- **Type Safety**: TypeScript clean
- **Engine Changes**: Zero — all simulation logic was already built in Iteration 1

---

## What's Next: Iteration 5

Manual editing:
- Add/remove states via UI
- Add/remove transitions
- Edit labels
- Save modified automaton to JSON

---

## Lessons Learned

1. **`useReducer` shines for state machines** — the simulation has multiple interrelated fields with strict transition rules; centralizing them in a pure reducer was the right call.
2. **History array beats re-computation** — storing snapshots makes O(1) backward navigation trivial; memory cost is negligible for DFAs.
3. **`setTimeout` chains naturally** — each step → re-render → effect → next timeout, avoiding stale closure bugs from `setInterval`.
4. **Always-editable input eliminated a button** — auto-resetting on input change made "Reset" disappear as a concept.
5. **SVG colors must be hardcoded** — SVG elements don't inherit CSS custom properties reliably; comment them with their token names instead.
