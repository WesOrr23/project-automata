# UI Architecture Deep Dive

This document surveys the reusable UI infrastructure in Project Automata, organized to help identify which patterns and systems are worth extracting into a shared library for future web apps.

## 1. Layered Architecture Map

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│  Composition root; owns automaton + ephemeral UI state      │
└─────────────────────────────────────────────────────────────┘
                              ▲
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐        ┌─────────────┐       ┌──────────┐
   │ ToolMenu│        │AutomatonUI  │       │Modals &  │
   │(EditPanels)      │Canvas + SVG │       │Popovers  │
   └─────────┘        └─────────────┘       └──────────┘
        ▲                     ▲                     ▲
        │                     │                     │
   ┌────┴──────────────────────┴─────────────────────┴────┐
   │         Keyboard Scope Stack (useKeyboardScope)       │
   │    Stacked, pre-emptible keyboard event routing      │
   └─────────────────────────────────────────────────────┘
        ▲
   ┌─────────────────────────────────────────────────────┐
   │      Notifications + Toast Stack (NotificationStack) │
   │    Global notifications with severity + targeting    │
   └─────────────────────────────────────────────────────┘
        ▲
   ┌─────────────────────────────────────────────────────┐
   │         Engine (Automaton + Simulation)              │
   │    No React; pure state transformations             │
   └─────────────────────────────────────────────────────┘

HOOK TREE (manages state across the layers):
  useUndoableAutomaton      → { automaton, epsilonSymbol, description }
  useSimulation             → { currentStateIds, status, nextTransitions }
  useCanvasViewport         → { scale, panX, panY } + zoom/pan handlers
  useAutomatonLayout        → { states, transitions, boundingBox } [GraphViz]
  useFileSession            → { currentName, recents, isDirty } [localStorage]
  
KEYBOARD SCOPES (stack, top-to-bottom):
  1. Onboarding (capture=true when visible)
  2. Modals (StateActionsPopover, BatchTestModal, etc.) (capture=true)
  3. SimulationShortcuts (Space, ←/→, scoped to SIMULATING tab)
  4. UndoRedoShortcuts (Ctrl+Z/Y, scoped to DEFINING/EDITING)
  5. GlobalShortcuts (F, ?, Esc, always-on except in text inputs)

CONTEXT TREE:
  NotificationContext → { notify(), dismiss(), rehighlight() } [global stack]
  [No other providers; everything else is prop-threading]
```

---

## 2. Inventory: Components & Hooks

### Top-Level Components

| Component | Location | Purpose | Generalizability |
|-----------|----------|---------|-------------------|
| `App` | `src/App.tsx` | Root; manages automaton state, mode/tab routing, all edits | **Project-specific** — tightly bound to automaton semantics |
| `AutomatonCanvas` | `src/components/AutomatonCanvas.tsx` | SVG rendering + interaction surface for graph visualization | **Could-generalize** (canvas layout, zoom/pan, node/edge rendering) |
| `ToolMenu` | `src/components/toolMenu/ToolMenu.tsx` | Left-side collapsible menu with 3 tabs (Configure, Edit, Simulate) | **Could-generalize** (tabbed sidebar + hover states + animation) |
| `CommandBar` | `src/components/CommandBar.tsx` | Top-center command pill with File, Operations, Undo/Redo, Export | **Could-generalize** (command aggregator, segments, popovers) |
| `NotificationStack` | `src/notifications/NotificationStack.tsx` | Renders stacked toasts at bottom-right; no provider logic | **Clearly-reusable** |
| `Onboarding` | `src/components/Onboarding.tsx` | First-launch tour with keyboard scope and step control | **Could-generalize** (tour framework; currently fa-specific) |

### Panels (inside ToolMenu)

| Component | Location | Purpose | Generalizability |
|-----------|----------|---------|-------------------|
| `ConfigPanel` | `src/components/toolMenu/ConfigPanel.tsx` | Alphabet + ε-symbol + automaton type editor | **Project-specific** |
| `EditPanel` | `src/components/toolMenu/EditPanel.tsx` | Transition creation form + state management UI | **Project-specific** |
| `AlphabetEditor` | `src/components/toolMenu/AlphabetEditor.tsx` | Add/remove alphabet symbols with validation | **Project-specific** |

### Popovers & Modals

| Component | Location | Purpose | Generalizability |
|-----------|----------|---------|-------------------|
| `StateActionsPopover` | `src/components/popover/StateActionsPopover.tsx` | Float menu (Set start, Toggle accept, Delete, Create edge) | **Could-generalize** (popover anchoring, capture scope, keyboard) |
| `StatePickerPopover` | `src/components/popover/StatePickerPopover.tsx` | Floating list picker for state selection | **Could-generalize** (popover + focus mgmt) |
| `BatchTestModal` | `src/components/BatchTestModal.tsx` | Modal for batch input testing | **Project-specific** (though modal pattern is reusable) |
| `ComparePicker` | `src/components/ComparePicker.tsx` | File-load modal for equivalence comparison | **Could-generalize** (file picker modal pattern) |

### Transition Editor

| Component | Location | Purpose | Generalizability |
|-----------|----------|---------|-------------------|
| `TransitionCreator` | `src/components/transitionEditor/TransitionCreator.tsx` | 3-input form for source/dest/symbol; dispatches into creationReducer | **Project-specific** |
| `MiniTransitionSVG` | `src/components/transitionEditor/MiniTransitionSVG.tsx` | Inline SVG preview of transition | **Project-specific** |
| `creationReducer` | `src/components/transitionEditor/creationReducer.ts` | Pure state machine for multi-slot picking flow | **Could-generalize** (multi-step form state machine pattern) |

### Canvas Components

| Component | Location | Purpose | Generalizability |
|-----------|----------|---------|-------------------|
| `StateNode` | `src/components/StateNode.tsx` | SVG circle + label + decorators (start arrow, accept ring) | **Project-specific** |
| `TransitionEdge` | `src/components/TransitionEdge.tsx` | SVG path + arrowhead + label for transition | **Project-specific** |
| `StartStateArrow` | `src/components/StartStateArrow.tsx` | Decorative arrow pointing at start state | **Project-specific** |
| `CanvasZoomControls` | `src/components/CanvasZoomControls.tsx` | Floating zoom buttons; dispatches into useCanvasViewport | **Could-generalize** (zoom control button group) |

### Other Components

| Component | Location | Purpose | Generalizability |
|-----------|----------|---------|-------------------|
| `InputPanel` | `src/components/InputPanel.tsx` | Single-symbol input field with alphabet filtering | **Project-specific** |
| `SimulationControls` | `src/components/SimulationControls.tsx` | Play/pause, speed, step controls | **Project-specific** |
| `ValidationView` | `src/App.tsx` | Inline error display when automaton can't run | **Could-generalize** (validation message list pattern) |

---

## 3. Custom Hooks (Deep Reusability Audit)

### Keyboard Management

**`useKeyboardScope`** — `src/hooks/useKeyboardScope.ts`
- **What it does**: Stack-based global keyboard event routing. Replaces scattered `document.addEventListener` calls with a stacked, pre-emptible system.
- **API**: `useKeyboardScope({ id, active, capture, inTextInputs, onKey })`. Handlers return truthy to consume; `capture=true` preempts lower scopes.
- **Project coupling**: None. Pure React + DOM APIs.
- **To extract**: Already library-ready. Trivial copy-paste; no deps except React.
- **Reusability rating**: **CLEARLY-REUSABLE** ✓

**`useGlobalShortcuts`** — `src/hooks/useGlobalShortcuts.ts`
- **What it does**: Wires F (fit), ? (tour), Esc (collapse menu) shortcuts using `useKeyboardScope` + text-input filtering.
- **API**: `useGlobalShortcuts({ onFit, onShowTour, menuIsOpen, onCollapseMenu, enabled })`.
- **Project coupling**: Knowledge of "fit" and "tour" semantics; references `menuIsOpen` state.
- **To extract**: Parameterize the shortcuts (`shortcuts: { key: Handler }[]`); rename handlers to generic names.
- **Reusability rating**: **COULD-GENERALIZE** — the keyboard-scope integration is clean, but shortcut names are app-specific.

**`useSimulationShortcuts`** — `src/hooks/useSimulationShortcuts.ts`
- **What it does**: Space (play/pause), ← (step back), → (step) — scoped to simulation UI.
- **API**: `useSimulationShortcuts({ enabled, isRunning, onPlay, onPause, onStep, onStepBack })`.
- **Project coupling**: Simulation-specific semantics (play, step, etc.).
- **Reusability rating**: **PROJECT-SPECIFIC** — good pattern, but semantics are domain-bound.

**`useUndoRedoShortcuts`** — `src/hooks/useUndoRedoShortcuts.ts`
- **What it does**: Ctrl/Cmd+Z/Y for undo/redo.
- **API**: `useUndoRedoShortcuts({ undo, redo, canUndo, canRedo, enabled })`.
- **Project coupling**: None. Generic undo/redo.
- **Reusability rating**: **CLEARLY-REUSABLE** ✓

**`useFileShortcuts`** — `src/hooks/useFileShortcuts.ts`
- **What it does**: Ctrl/Cmd+N (new), Ctrl/Cmd+O (open), Ctrl/Cmd+S (save), Ctrl/Cmd+Shift+S (save-as).
- **API**: `useFileShortcuts({ enabled, onNew, onOpen, onSave, onSaveAs })`.
- **Project coupling**: None. Purely keyboard bindings.
- **Reusability rating**: **CLEARLY-REUSABLE** ✓

### State Management

**`useUndoableAutomaton`** — `src/hooks/useUndoableAutomaton.ts`
- **What it does**: Snapshot-stack undo/redo over an atomic state object (`{ automaton, epsilonSymbol, description }`). Supports history cap, dirty tracking, and loading.
- **API**: `useUndoableAutomaton(initial)` → `{ automaton, setAutomaton, undo, redo, canUndo, canRedo, isDirty, markSaved, replaceSnapshot }`.
- **Project coupling**: `Snapshot` type includes `automaton`, but the hook is generic over the snapshot shape. Can be parameterized.
- **To extract**: Rename `Snapshot` → `T`; remove automaton-specific code. Already mostly generic.
- **Reusability rating**: **COULD-GENERALIZE** — the undo/redo + history cap + dirty-flag logic is universal; just needs a type param.

**`useSimulation`** — `src/hooks/useSimulation.ts`
- **What it does**: Wraps engine `Simulation` type; tracks status (idle/running/paused/finished), history for step-back, auto-step timer, speed.
- **API**: `useSimulation(automaton)` → `{ simulation, status, accepted, stepIndex, currentStateIds, nextTransitions, run, pause, step, stepBack, reset, initialize, jumpTo, setSpeed, canStepBack }`.
- **Project coupling**: Tight coupling to `Simulation` engine type and `SIMULATION_SPEED_*` constants.
- **Reusability rating**: **PROJECT-SPECIFIC** — tied to simulation semantics.

**`useFileSession`** — `src/hooks/useFileSession.ts`
- **What it does**: Manages file I/O (new/open/save/save-as), recent-files list, dirty tracking, and filename state.
- **API**: `useFileSession(props, blankFactory)` → `{ currentName, recents, save, saveAs, openFile, newFile, openRecent, forgetRecent, renameCurrent }`.
- **Project coupling**: Uses `FileAdapter` pattern; couples to `Automaton` snapshot shape via `props.automaton, .epsilonSymbol, .description`.
- **To extract**: Parameterize `TSnapshot`; inject `FileAdapter<TSnapshot>`. Already close to generic.
- **Reusability rating**: **COULD-GENERALIZE** — the file I/O pattern is universal; just needs type params.

**`useOnboarding`** — `src/hooks/useOnboarding.ts`
- **What it does**: Manages first-launch tour visibility (localStorage flag).
- **API**: `useOnboarding()` → `{ visible, show, dismiss }`.
- **Project coupling**: None. Pure visibility state.
- **Reusability rating**: **CLEARLY-REUSABLE** ✓

### Canvas & Layout

**`useCanvasViewport`** — `src/hooks/useCanvasViewport.ts` (31KB)
- **What it does**: Zoom + pan state. Exposes SVG transform, pointer/wheel handlers, and programmatic `zoomIn/Out/reset/fitToContent` controls.
- **API**: `useCanvasViewport({ contentBoundingBox, viewportInset, fitScale })` → `{ transform, scale, panX, panY, onPointerDown, onWheel, zoomIn, zoomOut, reset, fitToContent, isAnimating }`.
- **Project coupling**: None. Pure geometry.
- **To extract**: Already library-ready. SVG-agnostic; can be used with any 2D canvas.
- **Reusability rating**: **CLEARLY-REUSABLE** ✓

**`useAutomatonLayout`** — `src/hooks/useAutomatonLayout.ts`
- **What it does**: Calls out to GraphViz (via `ui-state/utils.ts`) to compute state positions and edge splines. Handles debouncing, stale-promise rejection, and relabeling.
- **API**: `useAutomatonLayout(automaton)` → `{ automatonUI }`.
- **Project coupling**: Tight. Knows about `Automaton`, `AutomatonUI`, GraphViz DOT generation.
- **Reusability rating**: **PROJECT-SPECIFIC** — entire GraphViz integration is fa-specific.

### Glue Hooks

**`useAutomatonSimulationGlue`** — `src/hooks/useAutomatonSimulationGlue.ts`
- **What it does**: Keeps simulation + input string in sync when automaton structure changes (resets simulation, filters input alphabet).
- **API**: `useAutomatonSimulationGlue({ automaton, resetSimulation, inputString, setInputString })`.
- **Project coupling**: Automaton-specific coupling (structure changes, alphabet).
- **Reusability rating**: **PROJECT-SPECIFIC** — the pattern (listen-to-A, reset-B) is generic, but semantics are domain-bound.

**`useDebugOverlay`** — `src/hooks/useDebugOverlay.ts`
- **What it does**: Toggles a debug overlay (keyboard shortcut, localStorage flag).
- **API**: `useDebugOverlay()` → `{ enabled, toggle }`.
- **Project coupling**: None.
- **Reusability rating**: **CLEARLY-REUSABLE** ✓

---

## 4. Notification System (NotificationStack + NotificationContext)

Located: `src/notifications/`

**Core types** — `types.ts`
- `NotificationSeverity` — 'error' | 'warning' | 'info' | 'success'
- `NotificationTarget` — Discriminated union: `{ kind: 'state'; stateId }` | `{ kind: 'transition'; from; to; symbol }` | `{ kind: 'alphabet'; symbol }`
- `Notification` — Full record with `id`, severity, title, detail?, target?, createdAt, autoDismissMs
- `NotifyInput` — User-facing API (title, severity, detail?, target?, autoDismissMs?)

**NotificationContext** — `NotificationContext.tsx` (207 lines)
- Pure Context + Provider. Owns notification array, highlights, auto-dismiss timers, pause/resume.
- API:
  - `notify(input)` → `id` — adds notification + activates highlight (2s timeout)
  - `dismiss(id)` — removes notification
  - `rehighlight(id)` — re-activate highlight for a notification
  - `pauseDismiss(id)` / `resumeDismiss(id)` — pause/resume auto-dismiss timer
- **Project coupling**: `NotificationTarget` type is automaton-specific (has fields for stateId, from/to, symbol).
- **To extract**: Parameterize `NotificationTarget` as a type param; rename enum values to generic (e.g., 'primary' | 'secondary' | 'tertiary').

**NotificationStack** — `NotificationStack.tsx` (46 lines)
- Renders `useNotifications().notifications` as `NotificationToast` components.
- Uses `AnimatePresence` for enter/exit animations.

**NotificationToast** — `NotificationToast.tsx` (112 lines)
- Individual toast component. Styled as a card, shows severity color, title, detail, action button to highlight target.
- Click highlights the target; click toast to dismiss.
- Pause auto-dismiss on hover.

**useNotifications** — `useNotifications.ts` (25 lines)
- Thin hook wrapper around `useContext(NotificationContext)` with error boundary.

**Reusability rating**: **CLEARLY-REUSABLE** ✓
- The entire subsystem is generic over the target type. Rename `NotificationTarget` → `TTarget` (generic param), and it's library-ready.
- Code quality is high; no edge-case bugs observed.

---

## 5. Popover System

Located: `src/components/popover/`

**StateActionsPopover** — `StateActionsPopover.tsx`
- Floating menu anchored to the right of the tool menu or to a clicked state.
- Buttons: Set Start, Toggle Accept, Delete, Create Transition.
- Uses `useKeyboardScope` with `capture=true` to own Esc/Space/Del while open.
- Positioning logic: `useLayoutEffect` reads menuRect + anchorRect, computes top/left with overflow prevention.
- **Reusability**: Pattern is generic (anchored floating menu + keyboard scope), but content is fa-specific.

**StatePickerPopover** — `StatePickerPopover.tsx`
- Similar anchoring; renders a filterable list of states for picking.
- Used by transition creator and some modals.

**Pattern**: Both popovers follow the same structure:
1. `useRef` for DOM element
2. `useLayoutEffect` to compute position based on anchor + viewport
3. `useKeyboardScope` with `capture=true` for modal behavior
4. Click outside → close (via document listener or event delegation)

**Reusability rating**: **COULD-GENERALIZE** — the anchoring + positioning + keyboard-scope pattern is universal. Content is specific.

---

## 6. Design Token System

Located: `src/styles/tokens.css` (80+ lines)

Defines:
- **Neutral foundation**: `--bg-page`, `--bg-sidebar`, `--bg-card`, `--bg-input`, text colors
- **Blue accent ramp**: 50–900 levels, brand-centered at 500 (#3b82f6)
- **Semantic colors**: success (green), error (red), active (blue)
- **Typography**: `--font-sans` system stack, 4 sizes (`--text-{base,sm,lg,xl}`), 2 weights
- **Spacing**: Implicitly 4px base unit (token names use multiples: 4, 8, 12, 16...)
- **Motion**: `--easing-*` curves, `--duration-*` timings

Per-feature stylesheets:
- `popover.css` — floating menu positioning, animation
- `tool-menu.css` — sidebar tabs, animation, collapse behavior
- `canvas.css` — SVG canvas, zoom controls, state nodes, edges
- `animations.css` — shared motion vocabulary (fade, slide, scale)
- `notifications.css` — toast styling, stacking, severity colors
- `simulation.css` — simulation-specific visuals (state highlighting, transition firing)
- `index.css` — global reset, root, light/dark mode (partial)

**Reusability rating**: **CLEARLY-REUSABLE** ✓
- Token names are generic (no automaton references).
- Per-feature split is a good pattern to carry forward.
- Move tokens into a `tokens/` package; component stylesheets remain co-located.

---

## 7. UI State Types & Utilities

Located: `src/ui-state/`

**types.ts**
- `StateUI` — `{ id, position, label }`
- `TransitionUI` — `{ fromStateId, toStateId, symbols, pathData, arrowheadPosition, arrowheadAngle, labelPosition }`
- `AutomatonUI` — `{ states: Map<number, StateUI>, transitions: TransitionUI[], boundingBox }`
- `computeDisplayLabels(states: Set<number>)` — Maps engine IDs → sequential display labels (q0, q1, q2...)
- `createDefaultLabel(stateId)` — Returns `q${stateId}`

**constants.ts**
- `STATE_RADIUS` — 30px
- `SIMULATION_SPEED_*` — 350–1400ms range
- `START_ARROW_*` — Derived constants for the start-state arrow (line length, head size, visual width in pixels & inches for GraphViz)

**utils.ts** (17KB)
- `buildGraphvizDOT(automaton, labels)` — Generates DOT syntax for GraphViz; adds phantom node for start arrow
- `parseGraphvizOutput(json)` — Extracts positions + edge splines from GraphViz JSON output
- `edgeConsolidation(transitions)` — Groups transitions by `(from, to)` into visual edges
- `isTextInputFocused()` — Moved here from keyboard-scope; used by multiple features

**imageExport.ts** (272 lines)
- `exportCanvasAsPNG(svg, filename, options)` — SVG → Canvas → PNG (2x pixel density)
- `exportCanvasAsSVG(svg, filename, options)` — Self-contained SVG export (data-url images, inline CSS)
- Handles transparent/white background option
- Uses Canvas API for PNG; raw SVG serialization for SVG

**Reusability rating**: 
- **types.ts**: **COULD-GENERALIZE** — rename `AutomatonUI` → `TGraphUI`; remove automaton-specific field names.
- **constants.ts**: **PROJECT-SPECIFIC** — all values are fa-tuned (state radius, simulation speed).
- **utils.ts**: **PROJECT-SPECIFIC** — GraphViz integration is tightly coupled to automaton semantics.
- **imageExport.ts**: **CLEARLY-REUSABLE** ✓ — generic SVG/PNG export logic, no domain coupling.

---

## 8. Modal Patterns

**Onboarding** — `src/components/Onboarding.tsx`
- Multi-step tour with localStorage persistence ("don't show again").
- Uses `useKeyboardScope` with `capture=true` to preempt all other scopes.
- Step-by-step UI with back/next/done buttons.
- **Pattern**: Modal-like lifecycle (visible ↔ dismissed), step control.

**BatchTestModal** — `src/components/BatchTestModal.tsx`
- CSV table viewer; click a row to load its input into the single-input field.
- Animates in/out via `AnimatePresence`.
- **Pattern**: Dialog modal + data table + action row selection.

**ComparePicker** — `src/components/ComparePicker.tsx`
- File picker modal; lists recent files + open-file button.
- Click a file to load it for equivalence comparison.
- **Pattern**: Modal + file list + async file loading.

**Pattern (all)**: Modal composability is handled by React conditional render + AnimatePresence. No shared modal wrapper component. Each modal owns its own visibility state.

**Reusability**: **COULD-GENERALIZE** — the patterns are modal mechanics, but no shared abstraction in the codebase. A library could offer:
- `useModalVisibility(initial)` → `{ visible, open, close, toggle }`
- `<ModalContainer open={visible}>` wrapping for centering + backdrop

---

## 9. Discriminated Union Patterns

**ToolMenuState** — `src/components/toolMenu/types.ts`
```typescript
export type ToolMenuState = 
  | { mode: 'COLLAPSED' }
  | { mode: 'EXPANDED' }
  | { mode: 'OPEN'; activeTab: ToolTabID };
```
- Encodes "only OPEN variant has activeTab," making invalid states unrepresentable.
- Used to gate UI rendering: `menuState.mode === 'OPEN' && menuState.activeTab === 'EDIT'`.

**CreationState** — `src/components/transitionEditor/creationReducer.ts`
```typescript
export type CreationState = {
  phase: 'idle' | 'picking-source' | 'picking-destination';
  source: number | null;
  destination: number | null;
  symbol: string;
  editingExisting: { ... } | null;
};
```
- Tracks which slot is being picked; unused slots can be null.
- `creationReducer` guarantees state machine invariants (e.g., source-picked → advance to destination or idle, never hang).

**NotificationTarget** — `src/notifications/types.ts`
- Discriminated union over `kind`: `'state' | 'transition' | 'alphabet'`.
- Each variant carries its own fields (stateId, from/to/symbol, symbol).
- Consumers use `pickHighlight<K extends NotificationTarget['kind']>` to safely extract the right variant.

**Pattern convention**: Discriminated unions eliminate invalid state combinations and make pattern-matching in consuming code type-safe.

**Reusability**: Pattern is universal; it's a TypeScript best practice, not automata-specific.

---

## 10. Granular Prop Pattern

Seen throughout: Props are split into logical groups, often with conditional spreads to avoid explicit `undefined` values.

Example from `App.tsx`:
```typescript
notify({
  severity: 'error',
  title: titleOnError ?? errorMessage(errorVariant),
  ...(titleOnError !== undefined && { detail: errorMessage(errorVariant) }),
  ...(targetOnError !== undefined && { target: targetOnError }),
  autoDismissMs: 6_000,
});
```

Benefits:
- Omit-only optional fields (via `exactOptionalPropertyTypes`): missing key ≠ explicit `undefined`.
- Props stay flat (no deeply-nested sub-objects).
- Type narrowing by discriminant is obvious (`if (stateActions !== null) { ... stateActions.stateId ...}`).

**Reusability**: Pattern is universal TypeScript style; carry forward to all future projects.

---

## 11. Multi-Step Form State Machine (creationReducer)

**Problem**: Transition creator requires filling 3 slots (source, destination, symbol) in any order, with canvas affordances (pick-mode) and form state (touched slots).

**Solution**: Pure reducer function + useReducer.

```typescript
export type CreationAction =
  | { type: 'sourcePicked'; stateId: number }
  | { type: 'destinationPicked'; stateId: number }
  | { type: 'symbolChanged'; symbol: string }
  | { type: 'reset' }
  | ...;

// Dispatched from:
// - Canvas clicks (sourcePicked, destinationPicked)
// - Symbol input (symbolChanged)
// - Form submission (reset)
```

**Strengths**:
- State machine is pure (testable without React).
- Invariants enforced (e.g., can't transition from picking-source → picking-destination without intermediate state check).
- Caller doesn't need to know state machine details; just dispatches actions.

**Reusability**: **COULD-GENERALIZE** — pattern is universal for multi-step form creation. Automate the "next slot" logic into a framework.

---

## 12. Command Bar Architecture (CommandBar.tsx)

Aggregates commands (File, Operations, Export, Undo/Redo) into a top-center pill that morphs with mode.

**Layout**:
- FILE segment (always visible): filename + recent menu
- HISTORY segment (DEFINING/EDITING): undo/redo buttons
- EDIT segment (EDITING only): operations menu
- SIMULATE segment (SIMULATING + VIEWING): export menu

**Mode-specific rendering**:
```typescript
<AnimatePresence>
  {appMode === 'EDITING' && <EditSegment />}
  {appMode === 'SIMULATING' && <SimulateSegment />}
</AnimatePresence>
```

**Design choices** (from comments):
- Operations live in the bar (not a floating widget).
- Recents promoted to top-level (easier reach than buried in overflow).
- Filename is inline-editable (click to edit).
- Async actions (open, save) show loading pulse.
- All popovers share "exclusive open" state (opening one closes others).

**Reusability**: **COULD-GENERALIZE** — the segment + modal pattern is generic. Parameterize segment definitions and mode mapping.

---

## 13. Canvas Interaction Patterns

### Zoom & Pan (useCanvasViewport)

Manages `{ scale, panX, panY }`. SVG uses `translate(panX, panY) scale(scale)` transform.

**Input handling**:
- **Wheel**: Pan by delta (or zoom-toward-cursor when Ctrl/Cmd held).
- **Drag (pointer)**: Pan, but skip drags originating on state nodes or edges (those stay free for clicks).
- **Buttons** (zoom in/out/fit): Update state + set `isAnimating=true` so CSS transition applies.

**Clamping**:
- Scale: [0.25, 4.0]
- Pan: "centered slack" policy — when scaled content is smaller than viewport on an axis, lock pan to center; when larger, keep content covering viewport.

**Reusability**: **CLEARLY-REUSABLE** ✓ — Geometry is generic; can drive any 2D canvas.

### State Clicking & Edge Clicking

**State click** (canvas → App):
- If in EDITING mode + not picking: open StateActionsPopover.
- If in DEFINING mode + not picking: jump to EDITING tab + open popover.
- If in SIMULATING: no-op (observation mode).

**Edge click** (canvas → App):
- If in EDITING mode: load the edge into the transition creator form for editing/deletion.

**Reusability**: Interaction logic is automaton-specific, but the pattern (click-handler → dispatch action → update state) is generic.

---

## 14. Summary: Reusability Ratings

### CLEARLY-REUSABLE (Copy & go)

1. **useKeyboardScope** — Stacked keyboard event routing
2. **useUndoRedoShortcuts** — Undo/redo keyboard bindings
3. **useFileShortcuts** — File command keyboard bindings
4. **useOnboarding** — First-launch tour visibility
5. **useCanvasViewport** — Zoom + pan state machine
6. **NotificationSystem** (Context + Stack + Toast + types) — Once `NotificationTarget` is parameterized
7. **imageExport.ts** — SVG/PNG export utilities
8. **Design tokens (tokens.css)** — CSS custom properties (extract to shared stylesheet)

### COULD-GENERALIZE (Parameterize, then reuse)

1. **useUndoableAutomaton** → `useUndoableState<T>`
2. **useFileSession** → `useFileSession<TSnapshot>` (inject FileAdapter<TSnapshot>)
3. **useGlobalShortcuts** → Parameterize shortcut names
4. **CommandBar** → Parameterize segments + mode mapping
5. **Popover system** — Extract anchoring + positioning + keyboard-scope pattern
6. **Modal pattern** → `useModalVisibility` + `<ModalContainer>`
7. **creationReducer pattern** → Multi-step form framework
8. **Design tokens (color ramp, typography)** → Extract to CSS-in-JS or SASS functions

### PROJECT-SPECIFIC (Domain-bound)

1. **useSimulation** — Simulation-specific state machine
2. **useAutomatonLayout** — GraphViz integration for automata
3. **useAutomatonSimulationGlue** — Automaton + simulation syncing
4. **AutomatonCanvas** — FA graph rendering
5. **StateNode, TransitionEdge, StartStateArrow** — FA-specific rendering
6. **All panels** (ConfigPanel, EditPanel, AlphabetEditor, TransitionCreator) — Automaton structure editing
7. **Onboarding** — Tour steps are fa-specific
8. **BatchTestModal, ComparePicker** — Automaton-specific workflows
9. **ui-state/utils.ts** (GraphViz DOT generation) — FA-specific layout
10. **ui-state/constants.ts** (STATE_RADIUS, SIMULATION_SPEED_*) — FA-tuned values

---

## 15. Conventions Worth Carrying Forward

**Type system**:
1. Discriminated unions for state machines (ToolMenuState, CreationState, NotificationTarget).
2. `exactOptionalPropertyTypes` to keep props flat and prevent `undefined` pollution.
3. `Result<T>` for error handling (engine); propagate errors to UI via notifications.
4. Numeric IDs for identity; strings for display (engine doesn't know labels).

**State management**:
1. Lifted to lowest common ancestor (LCA) rule for React state.
2. Snapshot stacks for undo/redo (easier than parallel history stacks).
3. Per-notification auto-dismiss timers + pause/resume (user can hover to keep a toast).
4. Keyboard scope stack over scattered `document.addEventListener` calls.

**Component patterns**:
1. Granular props with conditional spreads (avoid explicit `undefined`).
2. Per-feature CSS files over monolithic stylesheets.
3. Modal lifecycle managed by parent state (no modal framework, just React conditionals).
4. Popovers anchored to DOM elements, positioned in useLayoutEffect, keyboard-scoped with capture.

**Styling**:
1. CSS custom properties for tokens (-- prefix).
2. Per-layer color ramp (neutrals → brand → semantics).
3. Shared motion vocabulary (easing curves, duration tokens).
4. Accessibility: focus rings, semantic HTML, ARIA attributes in components.

**Code organization**:
1. Engine (pure logic, no React) vs. UI (React, styling, interactions).
2. Hooks for stateful patterns (keyboard, viewport, undo, file I/O).
3. Tests co-located with source (*.test.ts/tsx in __tests__ or next to the file).
4. Reducer functions as pure exports (testable without React).

---

## 16. Open Questions & Friction Points

**GraphViz Integration Overhead**
- Currently uses a web wrapper to call `dot` (GraphViz) asynchronously. This is powerful (arbitrary layout algorithms) but introduces a dependency + latency.
- For future projects, consider: Dagre (pure JS layout) vs. ELK (Java service) vs. custom layout engine?

**Notification Target Coupling**
- `NotificationTarget` is parameterized by automaton fields (stateId, symbol, from/to). Once parameterized as `TTarget`, this becomes a non-issue, but the design assumes "you want to highlight something in the model."
- For a project with no model interactions (e.g., a pure UI tool), you'd just use `target: undefined` everywhere.

**Popover Positioning**
- Currently uses `useLayoutEffect` + manual DOM querying (`document.querySelector('.tool-menu-open')`). Fragile if DOM structure changes.
- Better approach: Pass anchor element/rect as a prop; avoid selectors.

**Keyboard Scope Isolation**
- Text-input filter is centralized (`isTextInputFocused()`), but edge cases exist: contenteditable divs, custom input components, shadow DOM.
- Consider: Scope-specific text-input checks via options.

**File I/O**
- Currently uses browser File API (open/save dialogs). For desktop Electron apps or web-based IDEs (vs. SPA), integration points differ.
- Hook signature is generic; adapter pattern handles this, but documentation matters.

**Simulation History Cap**
- 1000-step history limit prevents memory bloat, but caps long inputs. User-test feedback suggested this was fine for "educational automata" but might be inadequate for other simulations.
- Consider: Make cap configurable; add a "reached limit" notification.

**Animation Library**
- Framer Motion (`motion/react`) is used extensively. Good DX, but adds a dependency.
- For future projects: Consider Tailwind Animate or vanilla CSS transitions if reducing deps is a goal.

---

## 17. Extraction Checklist for Future Projects

**Immediate candidates** (copy files, minimal adaptation):
- [ ] `useKeyboardScope` hook
- [ ] `useCanvasViewport` hook
- [ ] `useUndoRedoShortcuts` + `useFileShortcuts` hooks
- [ ] `NotificationContext` + `NotificationStack` + `NotificationToast` (parameterize `NotificationTarget`)
- [ ] `imageExport.ts` utilities
- [ ] Design tokens CSS (tokens.css)
- [ ] `Onboarding` component (parameterize steps)

**Worth parameterizing** (refactor, then reuse):
- [ ] `useUndoableAutomaton` → `useUndoableState<T>`
- [ ] `useFileSession` → `useFileSession<TSnapshot>` with injected `FileAdapter`
- [ ] Popover anchoring pattern
- [ ] Modal visibility hook
- [ ] Multi-step form reducer pattern

**Document for future reference** (patterns, not code):
- [ ] Discriminated union state machines (ToolMenuState, CreationState)
- [ ] Granular prop convention with conditional spreads
- [ ] Keyboard scope stack ordering (modal → shortcuts → global)
- [ ] Notification targeting with visual highlight (from click in toast)
- [ ] Per-feature CSS split strategy
- [ ] Result<T> error model in engine, bubbles to UI notifications

---

## 18. Example Extraction: Undo/Redo System

To show how COULD-GENERALIZE works, here's how `useUndoableAutomaton` becomes a library hook:

**Current** (Project Automata):
```typescript
export type Snapshot = {
  automaton: Automaton;
  epsilonSymbol: string;
  description: string;
};

export function useUndoableAutomaton(initial: Snapshot | (() => Snapshot)): UseUndoableAutomatonResult {
  const [current, setCurrent] = useState<Snapshot>(initial);
  // ...
}
```

**Library version** (useUndoableState):
```typescript
export function useUndoableState<T>(initial: T | (() => T)): UseUndoableStateResult<T> {
  const [current, setCurrent] = useState<T>(initial);
  // identical implementation
  return {
    current,
    setCurrent,
    undo,
    redo,
    canUndo,
    canRedo,
    isDirty,
    markSaved,
    replaceSnapshot,
  };
}
```

**Usage in future project**:
```typescript
type MyAppState = { document: Document; settings: Settings };

const { current, setCurrent, undo, redo, canUndo, canRedo } = 
  useUndoableState<MyAppState>(initialState);
```

**Effort**: ~20 minutes (rename Snapshot → T, remove automaton-specific field names, test).

---

## Conclusion

This codebase demonstrates a mature UI architecture optimized for a single project (automata visualization). The engineering is clean: separation of engine and UI, immutability discipline, keyboard scope stack, notification targeting, and reusable hooks.

For Wes's library extraction goal:
- **Start with the clearly-reusable pieces** (keyboard scope, canvas viewport, notifications, export utilities). These are drop-in, require no adaptation.
- **Parameterize the generics** (undo/redo, file session) — 30-60 mins per hook to rename types and remove domain coupling.
- **Document the patterns** (discriminated unions, granular props, CSS tokens, reducer patterns) — they're worth replicating even when code doesn't transfer.
- **Accept the project-specific** (simulation, automaton layout, FA-specific components) — these stay here.

The result will be a modern, battle-tested UI library ready for the next 5 web apps.
