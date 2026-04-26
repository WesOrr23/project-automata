# Project Automata - Development Memory

## Project Overview

An interactive web-based simulator for deterministic and non-deterministic finite automata (DFA/NFA). This is a learning project built with pair programming approach - no "vibe-coding," everything is intentional and well-structured.

**Current Status**: Iterations 9–12 complete. Iter-9 + 10: undo/redo (snapshot stack capped at 50, ⌘/Ctrl+Z) + aliveness (eased tab swap, breathing, motion vocabulary). Iter-11: Major Change Proposals from the iter-9+10 council debate — `Result<T>` engine error model, `App.tsx` decomposition into three hooks, `useKeyboardScope` stack-based primitive, sim history cap, `useUndoableAutomaton` flags refactor, CSS split into per-feature stylesheets, `exactOptionalPropertyTypes` enabled, RTL coverage backfill. Iter-12: AutomatonLike consolidation (preview moved to `src/engine/preview.ts`, structural-shadow generic + casts deleted), tool-menu Framer Motion rewrite (open/close mirror in three staged phases), canvas zoom + pan (`useCanvasViewport` + `CanvasZoomControls`, trackpad pinch + buttons + keyboard), GraphViz left-most start state, cursor-flicker fix, undo/redo gated to EDIT mode. Plans drafted for iter-13 (audit cleanup), iter-14 (UI polish + viewport clamp), iter-15 (file save/load + recents), iter-16 (NFA→DFA conversion). See `ITERATION{9,10,11,12}_COMPLETE.md` and `ITERATION{13,14,15,16}_PLAN.md`.
**Development Approach**: Agile iterations with clear deliverables
**Primary Developer Experience**: Familiar with vanilla HTML/CSS/JS, minimal JavaScript experience, learning React and TypeScript

---

## Tech Stack

- **Language**: TypeScript (for type safety and better learning experience)
- **Frontend Framework**: React
- **Rendering**: SVG (for visual automata representation)
- **Architecture**: Functional programming style (plain objects + pure functions)
- **Backend**: None - purely client-side application
- **Build Tool**: Vite
- **Testing**: Vitest

---

## Core Architecture Decisions

### Functional Approach (Not Class-Based)

**Rationale**:
- Better integration with React state management (immutability)
- Trivial JSON serialization
- More idiomatic in TypeScript/React ecosystem
- Forces explicit state transformations

**Pattern**:
```typescript
// Automaton is plain data
type Automaton = { ... }

// Operations are pure functions that return new automatons
function addState(automaton: Automaton): { automaton: Automaton; stateId: number } {
  // Returns NEW automaton with auto-generated state ID, doesn't mutate
}
```

### Separation of Concerns

**Engine Layer** (`/src/engine`):
- Pure TypeScript logic
- NO dependencies on React or UI concepts
- Handles automaton operations, validation, simulation
- Can be tested independently

**UI Layer** (`/src/components`, `/src/ui-state`):
- React components
- SVG rendering
- Visual metadata (positions, labels)
- Imports from engine, never the reverse

---

## Data Model

### Core Automaton Structure (Engine)

```typescript
type Transition = {
  from: number;                     // Source state ID (numeric)
  to: Set<number>;                  // Destination state IDs (Set for NFA-compatibility)
  symbol: string | null;            // Input symbol (null = ε-transition)
};

type Automaton = {
  type: 'DFA' | 'NFA';
  states: Set<number>;              // State IDs (auto-incremented integers)
  alphabet: Set<string>;            // Input alphabet
  transitions: Transition[];        // All transitions
  startState: number;               // ID of start state (always set: createAutomaton seeds state 0)
  acceptStates: Set<number>;        // IDs of accept states
  nextStateId: number;              // Auto-increment counter for new states
};
```

**Key Design Decisions**:
- **Numeric state IDs**: Auto-incremented integers (0, 1, 2...) prevent duplicate ID errors
- **Sets everywhere**: States, alphabet, accept states, and transition destinations use Sets (enforces uniqueness)
- **Type ordering**: Transition defined before Automaton (dependencies first)
- **Auto-increment tracking**: `nextStateId` field ensures unique IDs
- **Engine owns IDs, UI owns labels**: Engine uses numbers, UI layer maps to "q0", "q1" for display
- **ε-transitions**: Use `symbol: null` (type-safe, explicit)

### UI Metadata (Separate from Core Model)

```typescript
type UIState = {
  positions: Map<number, { x: number; y: number }>;  // State positions on canvas (keyed by numeric ID)
  labels: Map<number, string>;                        // Display labels (e.g., 0 → "q0", optional)
  selectedStates: Set<number>;                        // For editing mode (future)
};
```

**Rationale**: Visual concerns don't belong in core automaton logic. Engine uses numeric IDs, UI layer handles display labels and positioning.

---

## Project Structure

```
/src
  /engine                    # Pure logic (no React dependencies)
    - types.ts               # Type definitions (Automaton, Transition, etc.)
    - automaton.ts           # CRUD operations (create, addState, addTransition, etc.)
    - simulator.ts           # Execution logic (step, run, accepts)
    - validator.ts           # Validation predicates (isDFA, isComplete, etc.)
    - utils.ts               # Helper functions (epsilonClosure, etc.)

  /components                # React + SVG visualization
    - AutomatonCanvas.tsx    # Main SVG container
    - StateNode.tsx          # Individual state (circle)
    - TransitionEdge.tsx     # Transition arrow between states
    - SimulationControls.tsx # Play/pause/step/reset buttons
    - InputPanel.tsx         # Input string entry field

  /hooks                     # React hooks
    - useAutomaton.ts        # Managing automaton state
    - useSimulation.ts       # Managing simulation state

  /ui-state                  # UI-specific types and logic
    - types.ts               # UIState, positions, labels

  /data                      # Sample automaton JSON files
    - sample-dfa.json        # Example DFA for testing
```

---

## Validation Strategy

**Two-Tier Approach**:

1. **Structural Invariants** (enforced in `automaton.ts`):
   - No duplicate state IDs
   - All transition references point to existing states
   - Ensures automaton cannot be corrupted

2. **Semantic Validation** (external in `validator.ts`):
   - `isDFA()` - checks if automaton satisfies DFA properties
   - `isComplete()` - all states have transitions for all symbols
   - `hasOrphanedStates()` - unreachable states check
   - etc.

**Rationale**: Automaton can be incomplete during construction, but validator checks if it's ready for simulation

---

## Agile Development Plan

### Iteration 1: Engine Foundation (DFA Only) ✅ COMPLETE
**Goal**: Core automaton logic works correctly, testable without UI

**Deliverables**:
- Can create DFA programmatically
- Validator correctly identifies valid/invalid DFAs
- Simulator correctly accepts/rejects strings
- All engine tests pass

**Tasks**:
1. Project setup (TypeScript, testing framework, Vite)
2. Define core types (`Automaton`, `Transition` in `types.ts`)
3. Implement `automaton.ts` (createAutomaton, addState, addTransition, removeState, etc.)
4. Implement `validator.ts` (isDFA, isComplete)
5. Implement `simulator.ts` (step, run, accepts)
6. Write comprehensive unit tests

**Outcome**:
- ✅ All 74 engine tests passing
- ✅ DFA operations fully functional
- ✅ Validation and simulation working correctly
- ✅ Strong foundation for UI layer

---

### Iteration 2: Basic Visualization ✅ COMPLETE
**Goal**: Display a DFA on screen (static, no interaction)

**Deliverables**:
- Sample DFA renders on screen
- States shown as circles with labels
- Transitions shown as arrows with symbols
- Start state and accept states visually distinct

**Tasks**:
1. Define UI types (StateUI, AutomatonUI in `src/ui-state/types.ts`)
2. Implement `StateNode.tsx` (render state circles)
3. Implement `StartStateArrow.tsx` (arrow pointing to start state)
4. Implement `TransitionEdge.tsx` (render arrows with labels)
5. Implement `AutomatonCanvas.tsx` (SVG container, orchestrates rendering)
6. Create hardcoded sample DFA in `App.tsx` and display

**Outcome**:
- ✅ SVG-based rendering working
- ✅ All basic components functional (StateNode, TransitionEdge, StartStateArrow, AutomatonCanvas)
- ✅ Sample DFA displays correctly (accepts strings ending in "01")
- ✅ Clean separation between engine and UI layers
- ✅ Granular prop pattern established for components
- ⚠️ Known limitations: self-loops render invisibly, manual positioning only (addressed in Iteration 3)

---

### Iteration 3: Advanced Visualization (PLANNED)
**Goal**: Complete visualization foundation with auto-layout and proper rendering for all transition types

**Deliverables**:
- Automatic graph layout using dagre library
- Self-loop rendering (curved SVG paths)
- Curved arrows for bi-directional transitions
- Better label positioning (avoid overlaps)

**Tasks**:
1. Install dagre library and create layout module (`src/ui-state/layout.ts`)
2. Implement self-loop rendering in TransitionEdge component
3. Add curved arrow support for multiple transitions between same states
4. Update App.tsx to use auto-layout instead of manual positioning
5. Create comprehensive sample DFAs demonstrating various layouts

**Scope Notes**:
- Builds on Iteration 2's rendering foundation
- Addresses known limitations from Iteration 2
- No simulation or editing yet (still static visualization)
- Essential foundation for future editing features (Iteration 5)

---

### Iteration 4: Simulation + Visual Feedback
**Goal**: Working interactive DFA simulator (FIRST MAJOR MILESTONE)

**Deliverables**:
- User can enter input string
- Step-by-step simulation with visual feedback
- Current state highlighted during execution
- Clear accept/reject result display

**Tasks**:
1. Create `InputPanel.tsx` (text input for test string)
2. Create `SimulationControls.tsx` (step/run/reset buttons)
3. Create `useSimulation.ts` hook (manages current state, step index, etc.)
4. Implement state highlighting (CSS or SVG styling)
5. Implement step-by-step execution
6. Implement full run mode
7. Display accept/reject result

**Scope Notes**:
- Read-only automaton (uses auto-layout from Iteration 3)
- DFA only
- This completes the first working interactive prototype

---

### Iteration 5: Manual Editing ✅ COMPLETE
Add/remove states + transitions via UI, edit labels, save modified automaton to JSON. See `ITERATION5_*.md`.

### Iteration 6: NFA Support ✅ COMPLETE
NFA validator + simulation (multi-active-state), ε-closure, visual distinction for ε-transitions. See `ITERATION6_COMPLETE.md`.

### Iteration 7: Enhanced File Management ✅ COMPLETE
Sample DFAs/NFAs, JSON export plumbing. See `ITERATION7_COMPLETE.md`. (Real save/load → iter-15.)

### Iteration 8: Interactive Positioning + GraphViz Migration ✅ COMPLETE
Replaced dagre with GraphViz WASM for layout (proper spline routing); state positioning derived from GraphViz output. See `ITERATION8_COMPLETE.md`.

### Iteration 9: Undo / Redo ✅ COMPLETE
Snapshot-based undo/redo (history capped at 50), floating top-center controls, ⌘/Ctrl+Z shortcuts. See `ITERATION9_COMPLETE.md`.

### Iteration 10: Aliveness + Smooth Tab Transitions ✅ COMPLETE
Eased tool-menu tab swaps, idle start-arrow + accept-ring breathing, single motion vocabulary for hover/press/toast. See `ITERATION10_COMPLETE.md`.

### Iteration 11: Major Change Proposals ✅ COMPLETE
Engine `Result<T>`, `App.tsx` decomposition, `useKeyboardScope`, sim history cap, `useUndoableAutomaton` flags refactor, CSS split, `exactOptionalPropertyTypes`, RTL backfill. See `ITERATION11_COMPLETE.md`.

### Iteration 12: UI Polish + Canvas Viewport ✅ COMPLETE
AutomatonLike consolidation (preview moved to engine), tool-menu Framer Motion rewrite, canvas zoom + pan (`useCanvasViewport`), GraphViz left-most start, cursor-flicker fix, undo/redo EDIT-mode gating. See `ITERATION12_COMPLETE.md`.

---

### Iteration 13: Audit Cleanup (PLANNED)
Council-memory drift cleanup, CLAUDE.md status sync, reviewer code follow-throughs (wheel-cast comment, parseSymbolInput UX), RTL backfill (StatePickerPopover + the three control components), `useUndoableAutomaton` discriminated-reducer refactor. See `ITERATION13_PLAN.md`.

### Iteration 14: UI Polish + Viewport Clamping (PLANNED)
Cohesive viewport clamping ("centered slack"), `worldToScreen` helper for popovers + notification highlights at non-1× zoom, tool-menu active-row swap via Framer `layoutId`. See `ITERATION14_PLAN.md`.

### Iteration 15: File Save/Load + Recents (PLANNED)
Hybrid file adapter (FS Access API + blob download fallback), versioned JSON format, recents store (localStorage + IndexedDB), dirty tracking, ⌘S/⌘O/⌘N. See `ITERATION15_PLAN.md`.

### Iteration 16: NFA → DFA Conversion (PLANNED)
Eager subset construction over reachable subsets, explicit trap state, undo-as-side-by-side workflow, subset labels. See `ITERATION16_PLAN.md`.

### Future backlog
See `FUTURE_ITERATIONS.md` for one-page sketches of iter-17 (DFA minimization + equivalence), iter-18 (regex → NFA), iter-19 (shareable URL), iter-20 (algorithm step-through), iter-21 (tape view + image export). See `CUSTOMER_BRAINSTORM.md` for persona-driven feature prioritization.

---

## Key Principles & Patterns

### Immutability
All engine functions return NEW automatons rather than mutating existing ones:
```typescript
// Good
const { automaton: newAutomaton, stateId } = addState(automaton);

// Bad (don't do this)
automaton.states.add(3);
```

### Separation of Concerns
- Engine never imports from UI
- UI imports from engine
- Clear boundaries enable independent testing

### Start Simple, Refactor When Needed
- Don't over-engineer (rejected: custom ID class with global tracking)
- Build for current iteration, not hypothetical future
- Agile means iterating based on actual needs

### DFA-First, NFA-Compatible
- Data structures designed to support NFA (e.g., `to: Set<number>` allows multiple destinations)
- But validation/simulation initially DFA-only (checks `to.size === 1`)
- Makes migration to NFA smoother later

### JSON as Source of Truth
- Automatons stored as plain JSON
- Easy serialization/deserialization
- Can version control sample automatons
- Later: user import/export

---

## Coding Preferences & Conventions

### Type Definition Order
**Principle**: Define dependencies before types that use them

**Example**:
```typescript
// Good: Transition defined first, then Automaton uses it
type Transition = { ... };
type Automaton = { transitions: Transition[] };

// Bad: Would cause forward reference issues
type Automaton = { transitions: Transition[] };
type Transition = { ... };
```

**Rationale**: Improves readability, prevents circular dependencies, makes dependencies explicit

---

### Data Structure Selection

**Principle**: Use Sets for collections with uniqueness constraints

**When to use Sets**:
- State IDs (no duplicate states)
- Alphabet symbols (each symbol appears once)
- Accept states (no duplicate accepts)
- Transition destinations (no duplicate targets in NFA)

**When to use Arrays**:
- Ordered sequences (simulation steps)
- Lists where duplicates are meaningful
- JSON serialization contexts (convert Sets to arrays)

**Example**:
```typescript
// Good: Sets enforce uniqueness automatically
alphabet: Set<string>;  // Prevents ['0', '1', '0']

// Bad: Arrays allow duplicates
alphabet: string[];  // Could accidentally have ['0', '1', '0']
```

**Trade-off accepted**: Sets are harder to serialize to JSON, but theoretical correctness and automatic uniqueness validation outweigh convenience

---

### ID Management

**Principle**: Use auto-increment integers for entities where user shouldn't control IDs

**Implementation**:
- State IDs are auto-generated integers (0, 1, 2...)
- `nextStateId` field tracks next available ID
- `addState()` returns both new automaton AND generated ID
- Engine owns numeric IDs, UI layer owns display labels

**Example**:
```typescript
// Engine layer: numeric IDs
const { automaton: dfa, stateId } = addState(automaton);
// stateId = 0

// UI layer: maps to display labels
const label = `q${stateId}`;  // "q0"
```

**Benefits**:
- Eliminates duplicate ID errors (user can't create "q0" twice)
- Simplifies API (no ID parameter needed)
- Clear separation: engine handles identity, UI handles presentation

**Rejected alternative**: User-provided string IDs (error-prone, requires duplicate checking)

---

### User Experience Over Restrictions

**Principle**: Auto-assign reasonable defaults rather than blocking user actions

**Example**: When removing the start state:
```typescript
// Good: Auto-assign to first remaining state
if (removedState === automaton.startState) {
  newStartState = states.values().next().value ?? null;
}

// Bad: Throw error and block operation
if (removedState === automaton.startState) {
  throw new Error("Cannot remove start state");
}
```

**Rationale**:
- Better UX (user can continue working)
- Graceful degradation (automaton becomes invalid but not corrupted)
- Validation layer can warn about issues without blocking construction

---

### Function Signatures

**Principle**: Keep parameters simple and type-safe, avoid overloading

**Example**:
```typescript
// Good: Single clear parameter type
function addTransition(
  automaton: Automaton,
  from: number,
  to: Set<number>,      // Only accepts Set
  symbol: string | null
): Automaton;

// Bad: Multiple types requiring normalization
function addTransition(
  automaton: Automaton,
  from: number,
  to: number | Set<number>,  // Would need normalization logic
  symbol: string | null
): Automaton;
```

**Rationale**: Simpler code, fewer edge cases, less error-prone, clearer intent

---

### JSON Serialization

**Principle**: Accept that Sets don't serialize directly to JSON

**Strategy**:
- Engine uses Sets for correctness
- JSON files use arrays (e.g., `"states": [0, 1, 2]`)
- Deserialization converts arrays to Sets
- Serialization converts Sets to arrays

**Example JSON structure**:
```json
{
  "automaton": {
    "states": [0, 1, 2],
    "alphabet": ["0", "1"],
    "transitions": [
      { "from": 0, "to": [1], "symbol": "0" }
    ],
    "startState": 0,
    "acceptStates": [2],
    "nextStateId": 3
  }
}
```

**Note**: The inconvenience of manual conversion is acceptable for the benefits of Sets in the type system

---

## Testing Strategy

**Engine Tests** (Iteration 1):
- Unit tests for all automaton operations
- Validator edge cases (incomplete DFA, invalid references, etc.)
- Simulator correctness (known input/output pairs)

**UI Tests** (Later iterations):
- Component rendering tests
- Integration tests (user interactions)
- Visual regression testing (optional)

---

## Open Questions / Future Decisions

**Decided in Iteration 1**:
- ✅ Testing framework: Vitest
- ✅ State IDs: Auto-incremented integers (0, 1, 2...)
- ✅ Data structures: Sets for states, alphabet, transitions
- ✅ Error handling: Throw errors (strict validation) **— superseded in Iteration 11 by `Result<T>` for the public engine surface; throws now reserved for programmer-fault contracts.**

**Decided in Iteration 2**:
- ✅ UI type structure: StateUI and AutomatonUI mirror engine architecture
- ✅ Component prop pattern: Granular values (not object props)
- ✅ Prop naming: Singular "Prop" suffix (StateNodeProp, not StateNodeProps)
- ✅ UI labeling strategy: Default "q{id}" format via createDefaultLabel() helper

**Decided for Iteration 3**:
- ✅ Auto-layout algorithm: dagre **— superseded in Iteration 8 by GraphViz WASM (`@hpcc-js/wasm-graphviz`) for proper spline routing**
- ✅ Self-loops: curved SVG paths (bezier or arc)
- ✅ Multiple transitions between same states: curved arrows with offsets

**Decided in Iteration 11**:
- ✅ Engine error model: `Result<T>` with typed `EngineError` string-literal union; `errorMessage(error)` total switch at the notification boundary
- ✅ Keyboard-handler primitive: stack-based `useKeyboardScope` (top wins); replaced three global keydown listeners
- ✅ App.tsx decomposed into `useAutomatonLayout`, `useUndoRedoShortcuts`, `useAutomatonSimulationGlue`
- ✅ Strict TS flag: `exactOptionalPropertyTypes` enabled; satisfy via omit-only optional patterns, not `?? undefined` shims
- ✅ CSS organization: per-feature stylesheets in `src/styles/`, imported in `src/index.css` in tokens → animations → features → globals order

**Decided in Iteration 12**:
- ✅ Preview architecture: `computePreview` lives in `src/engine/preview.ts`, returns `{ automaton, overlays }`; `EdgeOverlay` is a discriminated union over `kind` ('add' | 'modify' | 'delete'). The `AutomatonLike<T>` shadow generic is gone; UI imports engine types directly.
- ✅ Animation library: Framer Motion (`motion` package) for staged animations and `<AnimatePresence>` delayed-unmount; CSS keyframes still own breathing/pulse loops
- ✅ Canvas viewport ownership: `useCanvasViewport` hook owns `{scale, panX, panY}` + handlers; `AutomatonCanvas` consumes via prop. `CanvasViewport` transform applied as inline `style.transform` on the content `<g>` (CSS syntax with units; SVG attribute syntax is silently rejected by the inline-style path).
- ✅ Cursor-flicker discipline: `user-select: none` is scoped to specific containers, not `body`; pre-promote layers via `will-change: filter` and explicit child-element cursors

---

## Development Workflow

**Chat Organization**:
- This file (`Claude.md`) serves as master reference
- Separate chats for each iteration's planning and implementation
- Each chat references this file for context

**Pair Programming Philosophy**:
- No assumptions or "vibe-coding"
- Explicit discussion of trade-offs
- Question suggestions rather than blindly accepting
- Learn TypeScript/React while building

---

## Notes

- Developer is learning TypeScript and React through this project
- Emphasis on understanding WHY, not just WHAT
- Prefer explicit over implicit
- Value honesty about trade-offs over false validation
