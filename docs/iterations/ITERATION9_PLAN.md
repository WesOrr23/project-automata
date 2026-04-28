# Iteration 9 — Undo / Redo

## Why this iteration exists

Every edit to the automaton is a one-way door right now. You add a state by
accident, you delete an alphabet symbol and want it back, you flip DFA → NFA
and regret it — the only way out is to manually reverse your own action.
That makes the editor feel brittle. It also punishes exploration, which is
exactly the kind of use we want to encourage on a learning tool.

This iteration adds history: any meaningful edit can be reversed with
`Cmd/Ctrl+Z`, re-applied with `Cmd/Ctrl+Shift+Z`, and the two small icon
buttons that expose the same actions appear centered at the top of the
viewport.

The simulation reducer already has its own step-back history — that's a
separate concern (stepping *within* one simulation). Undo/redo operates on
the *automaton* between edits. The two don't interact.

---

## Goals

1. **Snapshot-stack history** of `Automaton` objects — every meaningful
   `setAutomaton(...)` pushes the prior automaton onto an undo stack.
2. **Cap** at 50 entries. Oldest entry evicted when a new push exceeds the
   cap (FIFO).
3. **Redo stack** populated by `undo()`, cleared by any non-undo/redo edit.
4. **Skip no-op edits**. Setting start state to the current start, toggling
   accept to its current value, adding an existing alphabet symbol — none
   of these should consume a history slot.
5. **Clear canvas** resets both stacks wholesale. The cleared state is the
   new "origin."
6. **Reserved-`e` symbol** (UI state) also covered — changing it should be
   undoable. Decision below.
7. **Keyboard shortcuts**: `Cmd/Ctrl+Z` = undo, `Cmd/Ctrl+Shift+Z` = redo.
   Suppressed when focus is in `INPUT`, `TEXTAREA`, or a contenteditable
   element — browsers already handle undo/redo for text fields.
8. **Visual controls**: two small circular icon-only buttons centered at
   the top of the viewport (overlay above the canvas), `Undo2` and `Redo2`
   from `lucide-react`. Disabled (faded + `cursor: not-allowed`) when the
   corresponding stack is empty. Tooltip shows the keyboard shortcut.

---

## Decision: where does the ε-symbol history live?

The ε-symbol is UI state, not part of `Automaton`. Two options:

1. **Fold it into the snapshot** — the undo stack holds
   `{ automaton, epsilonSymbol }` tuples instead of bare automatons. One
   stack, one source of truth for "the snapshot."
2. **Parallel stack** — keep `Automaton` snapshots as the core; add a
   separate epsilon-symbol history alongside.

**Choosing option 1** (fold into snapshot). Rationale:
- One undo action = one user-visible state restoration. Mixing two stacks
  risks the two going out of sync (edit A → change ε → undo undoes the ε
  change, not A, which is confusing).
- The hook signature stays simple: one state blob in, one state blob out.
- The payload is still tiny — `epsilonSymbol` is one character. Adding it
  to the snapshot doesn't change the memory profile.

The hook therefore works on a generic state type, not on `Automaton`
directly. Caller supplies `{ automaton, epsilonSymbol }` as the initial
state; hook exposes the same shape and manages history over it.

---

## Hook design

New file: `src/hooks/useUndoableAutomaton.ts`.

```typescript
type Snapshot = {
  automaton: Automaton;
  epsilonSymbol: string;
};

type UndoableResult = {
  automaton: Automaton;
  epsilonSymbol: string;
  setAutomaton: (updater: (prev: Automaton) => Automaton) => void;
  setEpsilonSymbol: (next: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
};

function useUndoableAutomaton(initial: Snapshot): UndoableResult;
```

### Internals

- `useState<Snapshot>` holds the current snapshot.
- `useRef<Snapshot[]>` for undo and redo stacks — refs because the stacks
  don't drive renders directly (we re-render when `canUndo`/`canRedo`
  change, derived via a version counter in state).
- `setAutomaton(updater)`:
  1. Compute `next = updater(current.automaton)`.
  2. If `next === current.automaton`, bail (no-op).
  3. Push `current` onto undo stack, cap at 50 (FIFO eviction).
  4. Clear redo stack.
  5. Commit `{ automaton: next, epsilonSymbol: current.epsilonSymbol }`.
- `setEpsilonSymbol(next)`:
  1. If `next === current.epsilonSymbol`, bail.
  2. Push `current`, clear redo, commit `{ ...current, epsilonSymbol: next }`.
- `undo()`:
  1. Pop from undo stack. If empty, bail.
  2. Push current onto redo stack.
  3. Commit the popped snapshot.
- `redo()`: mirror of undo.
- `clearHistory()`: empty both stacks, leave current snapshot alone.

### No-op detection

The hook itself does reference-equality check on the returned `next`. That
catches updaters like "add this symbol but it's already in the alphabet"
*if* the engine returns the same object on no-op. Some don't today —
`handleAlphabetAdd`, for example, always creates a new `Set`. Two paths:

1. **Caller pre-checks** — the edit handlers in App.tsx already know when
   they're no-ops (or can learn). Return early, don't call `setAutomaton`.
2. **Deep-equality** in the hook — expensive and uncertain.

Choosing **caller pre-checks**. The hook's reference-equality is a safety
net for the common case; deliberate no-ops in edit handlers short-circuit
before calling `setAutomaton`. Minor audit pass required on existing
handlers — docs list which.

---

## UI design

New file: `src/components/UndoRedoControls.tsx`.

- Two `<button>` elements, circular (border-radius 50%), icon-only.
- `Undo2` and `Redo2` from `lucide-react`, 18px size.
- Fixed position: `top: 12px, left: 50%, transform: translateX(-50%)`.
  Z-index above the canvas, below any modal/popover layer.
- Eased hover: opacity + background transition on hover (existing buttons
  use `transition: all 120ms ease` — match that cadence).
- Disabled state: 40% opacity, `cursor: not-allowed`, no hover effect.
- `title` attribute: `"Undo (⌘Z)"` / `"Redo (⌘⇧Z)"` on Mac, Ctrl
  variants on non-Mac. Detection via `navigator.platform` — simple, good
  enough.

Styles in `src/index.css` — a single block, keyed on
`.undo-redo-controls`. No component-level CSS.

---

## Keyboard handling

Global `document.addEventListener('keydown', ...)` inside a `useEffect`
in App.tsx (or a tiny hook `useUndoRedoShortcuts(undo, redo)`). I'll put
it directly in App.tsx first — if it grows, extract later. Each keydown:

1. Check `event.metaKey` (Mac) or `event.ctrlKey` (Win/Linux) — ignore
   otherwise.
2. Check `event.key.toLowerCase() === 'z'`.
3. Check `document.activeElement`: if it's an `INPUT`, `TEXTAREA`, or has
   `contentEditable === 'true'`, bail — let the browser handle it.
4. `event.shiftKey` ? `redo()` : `undo()`.
5. `event.preventDefault()`.

---

## App.tsx integration

Replace:
```typescript
const [automaton, setAutomaton] = useState<Automaton>(() => buildSampleDFA());
...
const [epsilonSymbol, setEpsilonSymbol] = useState('e');
```

With:
```typescript
const {
  automaton, epsilonSymbol,
  setAutomaton, setEpsilonSymbol,
  undo, redo, canUndo, canRedo, clearHistory,
} = useUndoableAutomaton({ automaton: buildSampleDFA(), epsilonSymbol: 'e' });
```

Wire `handleClearCanvas` to call `clearHistory()` after resetting the
automaton. The clear itself still pushes a snapshot (the pre-clear state
becomes one undo away) — wait, re-check: the request says *Clear canvas
wholesale-resets BOTH stacks*. So the order matters: call
`clearHistory()` BEFORE or AFTER the `setAutomaton`? 

After: `setAutomaton` pushes pre-clear onto undo, we then clear —
pre-clear state is lost. But then the user can't undo the clear.

Before: `clearHistory` empties both stacks while the current snapshot
(pre-clear) is still in place; then `setAutomaton` pushes pre-clear onto
the (now empty) undo stack; user *can* undo the clear.

The request says "wholesale-resets BOTH stacks" meaning the stacks are
empty after the clear. Read literally: user can't undo a Clear. That
matches "Clear canvas" being a deliberate nuke — undoing it defeats the
purpose. Going with: `setAutomaton(...)` first, then `clearHistory()`
after. Post-clear, both stacks are empty.

### Pre-checks on edit handlers

Audit `applyEdit` callers and related:
- `handleSetStartState` — already checks via engine's throw-on-no-op? No,
  `setStartState` just overwrites. Add a pre-check: if
  `stateId === automaton.startState`, bail.
- `handleToggleAcceptState` — toggling always changes state, genuine edit.
- `handleAlphabetAdd` — if `symbol` is already in alphabet, return early
  (the engine just creates a new Set with same members, reference-inequal).
- `handleAlphabetRemove` — if `symbol` not in alphabet, bail.
- `handleAddState` — always a genuine edit.
- `handleRemoveState` — genuine edit.
- `handleTypeChange` — if `type === automaton.type`, bail.
- `handleEpsilonSymbolChange` — already returns an error for invalid,
  and only commits on pass; add no-op check (`newSymbol === epsilonSymbol`).
- `handleApplyTransitionEdit` — adds & removes lists empty? Already
  implicit; if both arrays are empty, the setAutomaton updater returns
  the same shape but *different reference*. Need to short-circuit at
  caller: if `removes.length === 0 && adds.length === 0`, don't call.

Documented in the Phase 3 commit.

---

## Phases

Each phase ends with: tests pass + typecheck clean + commit.

**Phase 1 — Hook + tests**
- New file `src/hooks/useUndoableAutomaton.ts`.
- New file `src/hooks/useUndoableAutomaton.test.ts` with ~12 tests
  covering: push, undo, redo, no-op skip, cap eviction, redo-clear,
  clearHistory, epsilonSymbol integration.
- No UI changes yet.

**Phase 2 — UI component + wiring**
- New file `src/components/UndoRedoControls.tsx`.
- CSS block in `src/index.css`.
- Replace `useState<Automaton>` + `useState<string>` in App.tsx with the
  new hook.
- Render `<UndoRedoControls>` from App.tsx.
- `handleClearCanvas` calls `clearHistory()` after the reset.
- No keyboard yet.

**Phase 3 — Keyboard shortcuts + no-op audit**
- Global keydown listener in App.tsx.
- No-op short-circuits in edit handlers (audit list above).
- Verify via targeted tests: build a small DFA in App, simulate
  `handleSetStartState(currentStart)` pushes nothing — test isn't
  straightforward at App level; cover at hook level via caller pattern.

**Phase 4 — Polish + handoff**
- `ITERATION9_COMPLETE.md`.
- Update `CLAUDE.md` current-status line.
- Update `NEXT_SESSION_HANDOFF.md` ("where things stand").
- Possibly add an ARCHITECTURAL_PATTERNS entry (#21: "Undo via snapshot
  stack over the atomic unit of state"). Judgment call — entry is only
  worth it if the pattern generalizes. Leaving as maybe.

---

## Out of scope

- Time-travel UI showing the full history list.
- Persisting history across page reloads.
- Branching / non-linear history.
- Integration with JSON import (JSON import doesn't exist yet; when it
  lands, it should call `clearHistory`).
- Undo/redo within a simulation (the simulation reducer has its own
  step-back, which is orthogonal).
- Editing affordances to visually indicate an undo just happened (no
  toast, no flash).

---

## Test plan

Engine layer: no changes, so no new engine tests.

Hook tests (`useUndoableAutomaton.test.ts`):
1. Initial state returned as-is; `canUndo === false`, `canRedo === false`.
2. `setAutomaton` with a changing updater pushes snapshot; `canUndo === true`.
3. `setAutomaton` returning same reference is a no-op; no push.
4. `undo` after push restores prior state; `canRedo === true`.
5. `redo` after undo restores the un-done state.
6. New edit after undo clears the redo stack.
7. Cap: 51 edits drop the oldest; undo 50 times lands on the first edit
   after the original, not the original.
8. `clearHistory` empties both stacks; current state unchanged.
9. `setEpsilonSymbol` with new value pushes; `canUndo === true`.
10. `setEpsilonSymbol` with same value is no-op.
11. Interleaved automaton + epsilon edits undo in reverse order.
12. `undo` with empty stack is safe no-op.
13. `redo` with empty stack is safe no-op.

UI sanity: covered by typecheck + existing integration surface. Not going
to add RTL tests for the button component — it's a thin wrapper.

---

## Success criteria

- 225+ tests passing (212 baseline + ~13 new).
- Typecheck clean.
- Undo and redo visible at top-center of the viewport, disabled when
  appropriate.
- `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z` work globally except in text fields.
- Clear canvas wipes both stacks.
- No-op edits don't fill the undo stack.
