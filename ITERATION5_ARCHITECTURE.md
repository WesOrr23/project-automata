# Iteration 5 Architecture

A layered reference for understanding how Project Automata works after Iteration 5. Read top-down: start with the bird's-eye view, then descend into progressively more technical detail. Each layer assumes you've read the one above.

---

## Layer 0 — What the app does

Project Automata is a browser-based **DFA/NFA simulator**. A user can:

1. **Configure** an automaton — choose type (DFA or NFA), define its input alphabet.
2. **Edit** its structure — add/remove states, mark them as start or accept, add/remove transitions between them.
3. **Simulate** a string against it — enter an input, play it through, see the automaton step from state to state, get an accept/reject verdict.
4. **Export** the finished automaton as JSON.

Everything is client-side. No backend, no accounts, no persistence beyond the current tab.

---

## Layer 1 — The user's mental model

From the user's perspective, the screen has two zones:

```
┌─────────────────────────────────────────────┐
│  ┌───┐                                      │
│  │ T │                                      │
│  │ o │         ┌─────┐                      │
│  │ o │         │ q0  │─────0─────► ┌─────┐  │
│  │ l │         └─────┘             │ q1  │  │
│  │   │                  ◄──1───── └─────┘  │
│  │ M │                                      │
│  │ e │                                      │
│  │ n │                                      │
│  │ u │                                      │
│  └───┘                                      │
│                                             │
│  ← Tool Menu                Canvas →        │
└─────────────────────────────────────────────┘
```

- **Tool Menu** (left) — a 3-state sidebar:
  - **Collapsed**: narrow icon strip
  - **Expanded**: icons + labels (on hover)
  - **Open**: one submenu open with editing controls
- **Canvas** (right) — the live graph of the automaton

The Tool Menu has three submenus:
- **Configure** — alphabet + type
- **Edit** — states + transitions
- **Simulate** — input + playback

Editing and simulating are **mutually exclusive** — entering the Edit tab resets any running simulation.

---

## Layer 2 — The two-domain architecture

The codebase is sharply divided into two domains. This split predates Iteration 5 and is the single most important design decision to internalize.

```
┌──────────────────────────────────────────────────────────┐
│                     ENGINE LAYER                         │
│                                                          │
│  Pure TypeScript. No React. No DOM.                      │
│  Answers: "What is a DFA? How does it simulate?"         │
│                                                          │
│  - types.ts           Automaton, Transition, Simulation  │
│  - automaton.ts       Create / mutate automaton (pure)   │
│  - validator.ts       isDFA, isRunnable, getReport       │
│  - simulator.ts       createSimulation, step, accepts    │
└──────────────────────────────────────────────────────────┘
                              ▲
                              │ (engine owns identity;
                              │  UI imports engine, never reverse)
                              │
┌──────────────────────────────────────────────────────────┐
│                       UI LAYER                           │
│                                                          │
│  React components. CSS. Browser APIs.                    │
│  Answers: "How does the user see and interact with it?"  │
│                                                          │
│  - App.tsx                 Orchestrator, state owner     │
│  - components/toolMenu/*   The 3-state sidebar           │
│  - components/*            Canvas, state/edge rendering  │
│  - hooks/useSimulation.ts  Simulation state machine      │
│  - ui-state/types.ts       Positions, labels (visual)    │
│  - ui-state/utils.ts       GraphViz layout computation   │
└──────────────────────────────────────────────────────────┘
```

The engine is **completely unaware** of React, CSS, or the DOM. You could rip out the UI and write a CLI on top of the engine without changing a line of engine code. Iteration 5 added zero engine code — all editing capability already existed as pure functions.

---

## Layer 3 — Data flow

Everything flows from **one source of truth: the `automaton` state in `App.tsx`.** Here's the circuit:

```
User interaction (click "Add State")
         │
         ▼
Prop callback (onAddState)
         │
         ▼
Handler in App.tsx (handleAddState)
         │
         ▼
Pure engine function (addState)
         │
         ▼
setAutomaton(newAutomaton)   ← state update triggers re-render
         │
         ├──► useEffect: sim.reset() + setInputString('')
         │
         ├──► useEffect: computeLayout(newAutomaton).then(setAutomatonUI)
         │                 (debounced 120ms, version-guarded)
         │
         ▼
Children re-render with new props
         │
         ├──► StateEditor shows the new row
         ├──► TransitionEditor sees new state in dropdowns
         └──► AutomatonCanvas renders the new node
```

**Key invariants:**
- State changes are never mutating — every engine function returns a new `Automaton`.
- The canvas never modifies the automaton — it's a pure view of it.
- The simulation reads from `automaton` at `createSimulation()` time; editing the automaton resets any in-flight simulation.

---

## Layer 4 — Component tree

```
App.tsx
│
├─ ToolMenu                                         (the 3-state sidebar)
│   │
│   ├─ (mode === 'COLLAPSED')
│   │    └─ 3 icon buttons (Settings, Pencil, Play)
│   │
│   ├─ (mode === 'EXPANDED')
│   │    └─ 3 pill buttons (icon + label)
│   │
│   └─ (mode === 'OPEN')
│        ├─ ChevronLeft back button
│        └─ 3 tab cards (one active, two compact)
│             │
│             ├─ active tab === 'CONFIG':
│             │   └─ ConfigPanel
│             │        ├─ Type toggle (DFA/NFA)
│             │        ├─ Alphabet badges + add form
│             │        └─ Export JSON button
│             │
│             ├─ active tab === 'EDIT':
│             │   └─ EditPanel
│             │        ├─ StateEditor (add, list of rows)
│             │        │    └─ each row: start / accept / delete
│             │        ├─ TransitionEditor
│             │        │    ├─ add form (from, to, symbol)
│             │        │    └─ list (row per transition)
│             │        └─ error banner (dismissible)
│             │
│             └─ active tab === 'SIMULATE':
│                 ├─ if isRunnable(automaton):
│                 │    ├─ InputPanel
│                 │    └─ SimulationControls
│                 └─ else: ValidationView (shows what's missing)
│
└─ AutomatonCanvas                                  (the SVG graph)
    ├─ TransitionEdge[] (arrows + labels)
    ├─ StateNode[] (circles)
    └─ StartStateArrow (marker for start state)
```

All editing UI lives under `App.tsx > ToolMenu > EditPanel > (StateEditor | TransitionEditor)`. The canvas stays purely visual — **you cannot click the canvas to edit**, intentionally (form-based editing only this iteration).

---

## Layer 5 — State ownership

React state is distributed deliberately. This is the full inventory of *where every piece of state lives:*

| State | Owner | Purpose |
|---|---|---|
| `automaton: Automaton` | App.tsx | The source of truth. Every edit produces a new value. |
| `automatonUI: AutomatonUI \| null` | App.tsx | Computed layout (positions, edge paths) from GraphViz. Rebuilt via `useEffect` on automaton change. |
| `inputString: string` | App.tsx | The string being simulated. |
| `menuState: ToolMenuState` | App.tsx | 3-state FSM for the sidebar (COLLAPSED / EXPANDED / OPEN). |
| `editError: string \| null` | App.tsx | Last error from an engine edit (e.g., duplicate transition). |
| Simulation internals | `useSimulation` hook | History, index, status, speed. Returned to App as a flat API. |
| `draftSymbol`, local `error` | ConfigPanel | The symbol being typed before it's added. Local because no one else needs to know. |
| `fromState`, `toState`, `symbol` | TransitionEditor | The dropdown selections before clicking Add. Local for the same reason. |

**The rule applied:** state lives at the lowest component that needs it. If only one component reads it, it's local. If two or more do (or the app needs to coordinate between them), it's lifted to App.

---

## Layer 6 — The 3-state sidebar FSM

The `ToolMenuState` type encodes the state machine:

```typescript
type ToolMenuState =
  | { mode: 'COLLAPSED' }
  | { mode: 'EXPANDED' }
  | { mode: 'OPEN'; activeTab: ToolTabID };
```

Transition table:

| From → To | Trigger |
|---|---|
| COLLAPSED → EXPANDED | `onMouseEnter` on the strip |
| EXPANDED → COLLAPSED | `onMouseLeave` from the strip |
| COLLAPSED → OPEN | click on icon button (iteration-5 audit fix) |
| EXPANDED → OPEN | click on pill |
| OPEN → OPEN (swap tab) | click another compact card |
| OPEN → COLLAPSED | click the `‹` back button |

Why a discriminated union: `activeTab` only makes sense in the `OPEN` variant. Encoding it as an optional field on a flat object would let you construct invalid states like `{ mode: 'COLLAPSED', activeTab: 'EDIT' }` that make no sense. The union makes those states **unrepresentable**.

Derived from `ToolMenuState`: the app-level `appMode` (`'IDLE' | 'EDITING' | 'SIMULATING'`), which drives canvas behavior (no simulation highlights while editing) and mode-transition effects (resetting simulation when entering Edit).

---

## Layer 7 — The edit cycle in detail

Here's every step that happens when you add a state:

1. **Click Add**: Button in `StateEditor` fires `onClick={onAddState}`.
2. **Callback propagation**: `StateEditor.onAddState` is the prop passed from `EditPanel`, which got it from `App.tsx`.
3. **Handler in App**: `handleAddState()` runs. It's wrapped in `runEdit(...)`, a try/catch helper that sets `editError` on failure.
4. **Engine call**: `addState(automaton)` returns `{ automaton: newAutomaton, stateId }`. The engine creates a brand-new Automaton with the extra state, auto-generating the numeric ID.
5. **State update**: `setAutomaton(newAutomaton)` tells React the value has changed.
6. **React re-renders**: every descendant that reads `automaton` gets the new value.
7. **Effects fire** (after render):
   - `useEffect([automaton])` schedules a debounced `computeLayout` call.
   - A second `useEffect([automaton])` resets the simulation and clears the input string.
8. **120ms later**: `computeLayout` runs. It:
   - Converts the Automaton to a DOT graph.
   - Invokes GraphViz WASM to compute node positions and edge splines.
   - Returns a new `AutomatonUI` object.
   - A version counter ensures only the latest call's result is committed (`setAutomatonUI`).
9. **Canvas re-renders** with the new layout — the new state appears visually.

This same pattern — click → callback → engine function → setAutomaton → re-render + effects — is used for **every** edit: add/remove state, set start, toggle accept, add/remove transition, alphabet changes, type changes.

---

## Layer 8 — Cascade behaviors

Some edits trigger implicit changes. These are encoded in either the engine or the App handlers:

| Trigger | Cascade |
|---|---|
| Remove a state | Engine: also removes every transition touching that state. If it was the start state, reassigns start to the lowest-numbered remaining state. |
| Remove an alphabet symbol | App handler: filters out every transition using that symbol (the engine alone wouldn't know — alphabets are data, not a constraint on existing transitions). |
| Any automaton edit | App effect: resets the simulation. Clears the input string. |
| Enter the Edit tab | App effect: resets the simulation (even without editing). |
| Automaton becomes non-runnable | Simulate tab shows `ValidationView` instead of playback controls. |

---

## Layer 9 — The async layout system

`computeLayout(automaton)` is the bridge between engine data and visual data. It's async because GraphViz is a WebAssembly module that loads once and computes layouts per call.

```
┌─────────────┐    dot()     ┌─────────────┐    parse    ┌─────────────┐
│  Automaton  │─────────────►│  GraphViz   │────────────►│ AutomatonUI │
│ (states,    │   async      │  WASM       │             │  (positions,│
│  edges)     │              │             │             │  splines)   │
└─────────────┘              └─────────────┘             └─────────────┘
```

Two complications this creates:

**1. Debouncing.** A user typing `abc` into the symbol field produces three automaton changes within ~500ms. Computing layout three times in rapid succession is wasteful and causes visual flicker. The `useEffect` uses `setTimeout(120ms)` so only the last change within a burst triggers layout.

**2. Race conditions.** If the user makes 10 edits and layout N-1 takes longer than layout N, the stale result could clobber the fresh one. The version counter (`layoutVersionRef`) tags each invocation; only the promise whose version matches the current counter commits its result. This was added as an audit fix.

---

## Layer 10 — Validation gating

The user can build a half-finished automaton (no start state, incomplete transitions, etc.) without the app crashing. The engine's validators are consulted before simulation:

- `isRunnable(automaton)` — boolean: is this ready to simulate?
- `getValidationReport(automaton)` — returns `{ errors, warnings }` for UX display.

If not runnable, the Simulate tab shows `ValidationView` with the specific issues, and a hint to fix them in the Edit tab. This keeps editing non-destructive: the user is never blocked from making partial progress, but also never lets them run garbage through the simulator.

---

## Layer 11 — JSON export

The Config tab's "Export JSON" button serializes the automaton and triggers a download. Three moving pieces:

1. **Set → Array conversion.** `Automaton` uses `Set<number>` and `Set<string>` internally because membership operations should be O(1) and uniqueness should be enforced structurally. But JSON has no Set type — it gets serialized as `{}`. So before `JSON.stringify`, the handler converts every Set to a sorted array.

2. **`Blob` + `URL.createObjectURL`.** Instead of writing to a server or localStorage, the handler creates an in-memory blob with MIME type `application/json`, then wraps it in an object URL. This gives us a temporary `blob:...` URL pointing at the in-memory data.

3. **Synthetic click on a temp anchor.** Create a hidden `<a>`, set `href` to the blob URL and `download` to the filename, programmatically click it. The browser treats this like a user-initiated download. Clean up with `URL.revokeObjectURL` to free the memory.

---

## Layer 12 — What's explicitly *not* in this iteration

Understanding what we didn't build is as important as what we did.

- **Canvas click interactions.** You can't drag states, click to create them on the canvas, or click-drag between them for transitions. All editing is form-based. This is a deliberate Iteration 5 constraint — canvas interaction is its own complexity (SVG hit detection, drag events, geometric math) and belongs in a future iteration.
- **NFA simulation.** The engine data model supports NFAs (`to: Set<number>` can hold multiple destinations, transitions can have `symbol: null` for ε). But NFA simulation isn't implemented yet. The Config tab disables the NFA option.
- **JSON import.** You can export, but not re-load. A round-trip pipeline is left for later.
- **Persistence.** Refreshing the tab loses everything. Intentional — every user session starts from the hardcoded sample DFA.
- **Undo/redo.** Edits are permanent (modulo removing what you just added). No history stack for edits themselves. (The simulation hook *does* have history — that's separate.)

---

## Layer 13 — Dependency diagram of iteration-5 files

```
types.ts
  └─ (no dependencies — pure types)
       ▲
       │
       ├─── ToolMenu.tsx ─── lucide-react, react (ReactNode type)
       ├─── ConfigPanel.tsx ─── lucide-react, react (useState)
       ├─── StateEditor.tsx ─── lucide-react, ui-state/types (createDefaultLabel)
       ├─── TransitionEditor.tsx ─── lucide-react, react, engine/types, ui-state/types
       └─── EditPanel.tsx ─── StateEditor, TransitionEditor, engine/types
                                        ▲
                                        │
App.tsx ─── engine/{automaton, validator, types}
         ├─ hooks/useSimulation
         ├─ ui-state/{types, utils}
         ├─ components/{AutomatonCanvas, InputPanel, SimulationControls}
         └─ components/toolMenu/{ToolMenu, ConfigPanel, EditPanel, types}

index.css ─── (design tokens + class rules; referenced by className attrs above)
```

No cycles. No surprising imports. The only file that imports from every direction is App.tsx — which is appropriate for an orchestrator.

---

## Layer 14 — Known friction / audit findings

Documented in the codebase audit after Iteration 5. Priority items were fixed; lower-priority items are deferred:

### Fixed during iteration 5
- Missing onClick in collapsed sidebar → icons now open their tab directly.
- Race condition in `computeLayout` → version counter added.
- Error banner had click but no keyboard handler → Enter/Space now dismiss.

### Deferred (worth fixing if revisited)
- **String literal casing inconsistency**: existing codebase uses lowercase (`'idle'`, `'running'`); iter-5 added uppercase (`'CONFIG'`, `'OPEN'`). Not wrong, but an inconsistency.
- **No `useMemo` on sorting operations**: `StateEditor` and `TransitionEditor` sort on every render. Works fine for typical automata (<20 states), would matter for a 500-state automaton.
- **No `useCallback` on App handlers**: every handler is recreated per render. Given how shallow the tree is, the perf impact is negligible.
- **No tests for iter-5 components**: 131 tests all pass, but none exercise the new UI. Highest-value target: the 3-state FSM transitions.
- **App.tsx is 370+ lines**: candidate for a `useToolMenu` custom hook extraction.
- **Inline flexbox styles in JSX**: repeated `style={{ display: 'flex' ... }}` blocks could be CSS utility classes.

---

## Reading this doc alongside the code

Every section above references specific files. As you go through the companion `ITERATION5_REVIEW_PLAN.md`, consult this doc for context: when you're reading `App.tsx`, Layer 3 (data flow) and Layer 7 (edit cycle) are your orientation. When you're reading `ToolMenu.tsx`, Layer 6 (FSM) is your orientation.

The review plan takes you **into each file**. This doc zooms back out to **how the files fit together**. Keep both tabs open.
