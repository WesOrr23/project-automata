# Project Automata - Development Memory

## Project Overview

An interactive web-based simulator for deterministic and non-deterministic finite automata (DFA/NFA). This is a learning project built with pair programming approach - no "vibe-coding," everything is intentional and well-structured.

**Current Status**: Iteration 1 in progress - implementation done, under review (engine foundation implemented, all 74 tests passing)
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
  startState: number | null;        // ID of start state (null = not set)
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

### Iteration 1: Engine Foundation (DFA Only)
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

**Scope Notes**:
- DFA only (NFA support deferred)
- No UI components yet
- Focus on correctness and test coverage

---

### Iteration 2: Basic Visualization
**Goal**: Display a DFA on screen (static, no interaction)

**Deliverables**:
- Sample DFA renders on screen
- States shown as circles with labels
- Transitions shown as arrows with symbols
- Start state and accept states visually distinct

**Tasks**:
1. React app scaffold with Vite + TypeScript
2. Create `sample-dfa.json` in `/data` folder
3. Define UI types (positions, labels)
4. Implement `AutomatonCanvas.tsx` (SVG container)
5. Implement `StateNode.tsx` (render state circles)
6. Implement `TransitionEdge.tsx` (render arrows with labels)
7. Load JSON and render automaton

**Scope Notes**:
- Static visualization (positions hardcoded in JSON or calculated)
- No editing, no interaction yet
- Just proving we can display an automaton

---

### Iteration 3: Simulation + Visual Feedback
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
- Read-only automaton (loaded from JSON)
- DFA only
- This completes the first working prototype

---

### Future Iterations (Backlog - Priority TBD)

**Iteration 4**: Manual Editing
- Add/remove states via UI
- Add/remove transitions
- Edit labels and positions
- Save modified automaton back to JSON

**Iteration 5**: NFA Support
- Update validator for NFA rules
- Implement NFA simulation (multiple active states)
- ε-closure computation
- Visual distinction for ε-transitions

**Iteration 6**: Enhanced File Management
- File upload (.json)
- Save/download automaton
- Multiple automaton library

**Iteration 7**: Interactive Positioning
- Drag-and-drop states
- Auto-layout algorithms (optional)
- Grid snapping

**Iteration 8**: Animation & Polish
- Smooth transitions between states
- Animated simulation
- Better visual design

**Iteration 9**: Advanced Features
- NFA → DFA conversion
- Minimization
- Equivalence testing
- Complement/union/intersection operations

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
- ✅ Error handling: Throw errors (strict validation)

**To be determined in future iterations**:
- How to handle self-loops visually
- How to handle multiple transitions between same states
- Auto-layout algorithm selection (if needed)
- UI labeling strategy (default "q0", "q1" or user-editable)

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
