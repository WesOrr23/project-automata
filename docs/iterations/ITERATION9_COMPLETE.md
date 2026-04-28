# Iteration 9 — Undo / Redo (Complete)

## What shipped

Every meaningful edit is now reversible. Two circular icon buttons at the
top-center of the viewport expose undo and redo; the same actions are
bound to `⌘Z` / `⌘⇧Z` (Mac) and `Ctrl+Z` / `Ctrl+Shift+Z` (Win/Linux). A
snapshot stack of `{ automaton, epsilonSymbol }` tuples backs both, capped
at 50 entries with FIFO eviction. "Clear canvas" wipes the history
wholesale — the cleared state becomes the new origin.

---

## Phase log

| Phase | Commit | Files | Tests added |
|---|---|---|---|
| Plan | `5a8a95b` | 1 (new) | 0 |
| 1 — hook + tests | `5153d0e` | 2 (new) | 13 |
| 2 — App wiring + UndoRedoControls + CSS | `52d57de` | 1 new, 3 modified | 0 |
| 3 — keyboard shortcuts + no-op guards | `12f8d03` | 1 modified | 0 |
| 4 — docs (this commit) | — | 3 modified | 0 |

Total: **225 tests passing** (was 212 before iter 9 started). Typecheck
clean throughout.

---

## Architectural notes

### Snapshot over the atomic unit of state
The ε-symbol is UI state, not part of `Automaton`, but it *co-evolves*
with automaton edits. Folding both into a single `Snapshot =
{ automaton, epsilonSymbol }` tuple means one undo action = one
user-visible state restoration. The alternative (two parallel history
stacks) would let the two drift out of alignment — e.g. after edit-A
followed by change-ε, a single undo could either undo A or the ε change,
with no good way to decide which the user meant.

### Refs for stacks, state for the snapshot
The undo and redo stacks live in `useRef` because consumers don't iterate
over them; they only care about the snapshot itself and two booleans
(`canUndo`, `canRedo`). Refs don't force re-renders on every push, which
keeps the hook cheap. `canUndo`/`canRedo` are computed from stack length
on each render — the render only happens when `setCurrent` fires, and at
that point the stack length has already been mutated.

### No-op detection is layered
The hook does a reference-equality check on what the updater returns. If
`updater(previous) === previous`, no push happens. But many edit
handlers build a fresh `Set` or a spread object even when the content is
identical — those would slip past reference equality. Phase 3 audited
the handlers and added explicit pre-check short-circuits
(`handleTypeChange`, `handleAlphabetAdd`, `handleAlphabetRemove`,
`handleSetStartState`, `handleEpsilonSymbolChange`,
`handleApplyTransitionEdit`). Two guards, one defense in depth.

### Keyboard handler respects text field semantics
The global keydown listener bails when `document.activeElement` is an
`INPUT`, `TEXTAREA`, or contenteditable element. Browsers already
implement undo/redo for text fields; intercepting those keystrokes there
would break expected behavior. Everywhere else, the handler calls
`preventDefault()` so the browser's default page-level undo (which does
nothing here) doesn't fire.

### Clear canvas wipes history
`handleClearCanvas` calls `clearHistory()` *after* the reset. The
sequence is deliberate: `setAutomaton` first pushes the pre-clear
snapshot onto undo, then `clearHistory` drops it. Result: the cleared
state is the new origin; you can't undo a Clear. That matches the
"wholesale nuke" intent — users click Clear when they want the old
state gone.

---

## Files touched

New:
- `src/hooks/useUndoableAutomaton.ts`
- `src/hooks/useUndoableAutomaton.test.ts`
- `src/components/UndoRedoControls.tsx`
- `ITERATION9_PLAN.md`
- `ITERATION9_COMPLETE.md` (this file)

Modified:
- `src/App.tsx` — swapped `useState<Automaton>` + `useState<string>` for
  `useUndoableAutomaton`; added keyboard listener; added no-op guards;
  wired `clearHistory()` into `handleClearCanvas`; rendered
  `<UndoRedoControls>`.
- `src/index.css` — `.undo-redo-controls` + `.undo-redo-button` block.
- `CLAUDE.md` — updated current-status line.
- `NEXT_SESSION_HANDOFF.md` — updated for iter 9 shipped.

---

## What stayed the same / out of scope

- Simulation reducer's step-back history (internal to `useSimulation`,
  governs stepping *within* one simulation). Untouched.
- The Automaton type / engine layer. Untouched.
- Undo/redo UI beyond the two floating buttons. No history panel, no
  time-travel slider, no keyboard shortcut customization.
- Persisting history across page reloads. Deferred.
- JSON import integration (JSON import doesn't exist yet; when it lands,
  it should call `clearHistory`).

---

## How to run

```bash
npm test -- --run    # 225 passing
npx tsc --noEmit     # clean
npm run dev          # browser at http://localhost:5174
```

In the browser:
1. Edit tab → add a state, toggle accept, add an alphabet symbol.
2. Watch the Undo button light up at the top of the viewport.
3. Press `⌘Z` (or `Ctrl+Z`) — the edit reverses.
4. Press `⌘⇧Z` — it redoes.
5. Make a new edit after undoing — redo disables (new history branch).
6. Configure tab → Clear canvas — both undo and redo go disabled.
