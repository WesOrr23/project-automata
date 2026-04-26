# Iteration 11 — Major Change Proposals (Complete)

## What shipped

Seven of the eight Major Change Proposals from the iter-9+10 council debate. Zero user-visible changes; the app behaves identically. Under the hood, the code now:

1. **Engine returns `Result<T>`, not exceptions.** `addState`, `addTransition`, `removeState`, simulation step/run all return `{ ok: true, value }` or `{ ok: false, error }`. `EngineError` is a string-literal union; `errorMessage(error)` is exhaustive. App + hooks handle both branches explicitly. No more `try`/`catch` around engine calls in the UI layer.

2. **App.tsx decomposed.** Three new hooks live in `src/hooks/`:
   - `useAutomatonLayout` — owns the GraphViz layout request lifecycle.
   - `useUndoRedoShortcuts` — owns ⌘/Ctrl+Z+Shift binding, gated on a single `enabled` flag.
   - `useAutomatonSimulationGlue` — bridges the automaton + simulation reducers.

3. **`useKeyboardScope`** — a stack-based keyboard-handler primitive. Three previously-global keydown listeners now register and unregister cleanly via this hook (App-level Esc, popover Esc, picker arrow keys). The top of the stack wins; popping restores the underlying handler.

4. **`useUndoableAutomaton` flags refactor.** `canUndo` / `canRedo` are now stored in `useState` (set in the same dispatch as the snapshot push/pop), not recomputed every render. Same correctness, fewer wasted re-renders.

5. **Simulation history cap.** `useSimulation` keeps the last 1000 steps. Before, a long-running NFA could grow the history array without bound.

6. **CSS split.** `src/index.css` now imports per-feature stylesheets in `src/styles/`: `tokens.css`, `animations.css`, `canvas.css`, `tool-menu.css`, `popover.css`, `simulation.css`, `notifications.css`. Order matters (tokens → animations → features → globals); documented at the top of `index.css`.

7. **`exactOptionalPropertyTypes: true`** in `tsconfig.json`. All resulting type errors fixed by tightening to omit-only optional patterns rather than `?? undefined` shims.

8. **Component test backfill.** Three new RTL test files: `AutomatonCanvas.test.tsx`, `StateActionsPopover.test.tsx`, `TransitionCreator.test.tsx`. Plus unit tests for `automatonToDot` parse helpers and reducer tests for `computePreview` DFA conflict branches.

Test count: **212 → 290+**. All green. `tsc` clean.

---

## Phase log

| Phase | Commits | Notes |
|---|---|---|
| 1 — Result<T> foundation | `6a10bc8`, `5428453`, `32328a8`, `40cd783` | Engine + simulator + consumers |
| 2 — useKeyboardScope | `d131f11`, `e666a06`, `632ac70` | Hook + 3 global listeners + popover |
| 3 — App.tsx decomposition | `f8dc1a7`, `70599b3`, `f55e9ea` | Layout, undo/redo, sim glue |
| 4 — Undoable refactor | `2605bbb` | canUndo/canRedo in useState |
| 5 — Sim history cap | `42e2efc` | 1000-step bound |
| 6 — CSS split | `58cb284` | 7 per-feature files |
| 7 — exactOptionalPropertyTypes | `3607000`, `5cba947` | tsconfig + omit tightening |
| 8 — Tests | `9dddd28`, `86ceefd`, `60f28e8`, `c4759e7`, `3a9956f` | 5 new test files |
| Council | `77de9ca`, `f897b2f` | Memory updates + audit-002 follow-throughs |
| Merge | `6708f64` | Merge into iteration-11 |

---

## Design decisions

### Result<T> as the engine's contract

Engine code can fail in well-defined ways: state-not-found, duplicate-symbol, no-start-state. Throwing exceptions for these forces every call to be wrapped in `try`/`catch` at the UI layer, and the type system can't tell which calls might throw. With `Result<T>`, the type signature names the failure modes and the consumer is forced to handle them. We use a string-literal union for `EngineError` so adding a new failure variant lights up every consumer that hasn't handled it.

### Why the App.tsx hooks landed in this order

Layout is read-only on the automaton — extracting it first introduced no new coupling. Undo/redo shortcuts are pure binding glue with no shared state. Sim glue last because it crosses the most reducer boundaries (automaton ⇆ simulation) and benefits most from having the other extractions out of the way.

### useKeyboardScope is a stack, not a registry

Earlier sketches used a flat registry keyed by event name. Doesn't model nesting: a popover Esc handler should win over App-level Esc *while open*, then yield it back on close. A stack does this for free — `useEffect` push on mount, return-from-effect pop on unmount. The top wins.

### `canUndo`/`canRedo` as state, not derived

They were computed each render from the snapshot stack length. Cheap, but two consumers (App + UndoRedoControls) re-rendered on every keystroke even when the flags hadn't actually flipped. Moving them into `useState` (set inside the same dispatch as the snapshot mutation) means consumers only re-render when the flag itself changes.

### `exactOptionalPropertyTypes` — omit-only over `?? undefined`

Two ways to satisfy the strict mode: (a) pass `undefined` explicitly with `?? undefined` shims, or (b) reshape callers so optional fields are *omitted* entirely when absent. We chose (b) almost everywhere. It's slightly more code, but it makes "field is set to undefined" actually mean something different from "field isn't set" — which is what the strict mode is for.

---

## What stayed the same

- Every keyboard shortcut, popover behavior, canvas-edit interaction.
- All animations from iter-10.
- Engine API semantics (only the call shape changed — Result wrapper).
- All existing tests still pass without modification.

---

## Out of scope / deferred

- **AutomatonLike consolidation (Proposal #1)** — deferred for personal review by Wes; landed in iter-12 as `src/engine/preview.ts`.
- **`useUndoableAutomaton` further refactor.** Audit-001 flagged the action union as "lots of one-off cases that could be a discriminated reducer." Captured for iter-13+.
- **Test-utils extraction.** Some duplication between RTL files (mock automatons, render helpers). Captured for whenever it shows up in a third file.

---

## How to run

```bash
cd /Users/wesorr/Documents/Projects/Project\ Automata/.claude/worktrees/iter-12
npm test -- --run            # 290+ passing
npx tsc --noEmit             # clean
```
