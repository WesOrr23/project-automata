# Iteration 2: Basic Visualization

**Status**: Planning
**Start Date**: 2026-01-25
**Iteration 1 Completion**: All 74 tests passing, engine foundation complete

---

## Goal

Display a DFA on screen using SVG. Static visualization only - no interaction, no editing. Just prove we can render an automaton visually.

**Success Criteria**:
- A sample DFA loads and renders on screen
- States appear as circles with clear labels
- Transitions appear as arrows with symbol labels
- Start state is visually distinct (arrow pointing to it)
- Accept states are visually distinct (double circle)
- The visualization is clean and readable

---

## Scope

**In Scope**:
- Define UI-specific types (StateUI, AutomatonUI)
- Build React components for rendering
- SVG-based visualization
- Hardcode and display a single sample DFA

**Out of Scope** (deferred to later iterations):
- JSON file management and serialization
- User interaction (clicking, dragging)
- Editing (adding/removing states/transitions)
- Simulation controls
- Multiple automaton files
- Animation
- Auto-layout algorithms
- Self-loops and multiple transitions between same states

**Key Principle**: This iteration is about proving the rendering pipeline works. Keep it simple.

---

## Architecture

### Layer Separation (Critical)

```
Engine Layer (src/engine/)
  - Already complete from Iteration 1
  - Pure TypeScript, no React dependencies
  - Exports types and functions

UI Layer (src/components/, src/ui-state/)
  - NEW in this iteration
  - React + SVG rendering
  - Imports from engine
  - Owns visual metadata (positions, labels)
```

**Rule**: UI can import from engine. Engine never imports from UI.

### Data Flow

```
Hardcoded Automaton (engine) + Hardcoded AutomatonUI (ui-state)
                            ↓
                    AutomatonCanvas (extracts props)
                            ↓
                React Components (StateNode, TransitionEdge, etc.)
                            ↓
                        SVG Rendering
```

---

## Data Structures

### UI State Types (New File: `src/ui-state/types.ts`)

**Parallel Structure to Engine Layer:**
- Engine has `Automaton` → UI has `AutomatonUI`
- Engine tracks state IDs → UI has `StateUI` objects keyed by those IDs
- Clear separation: engine owns identity/logic, UI owns presentation

```typescript
/**
 * UI metadata for a single state
 * Parallel to the state concept in the engine layer
 */
export type StateUI = {
  id: number;                           // Foreign key to engine state ID
  position: { x: number; y: number };   // Canvas coordinates
  label: string;                        // Display label (defaults to q{id})
  // Future: color, size, isSelected, etc.
};

/**
 * UI metadata for the entire automaton
 * Parallel to the Automaton type in the engine layer
 */
export type AutomatonUI = {
  states: Map<number, StateUI>;         // Keyed by state ID for O(1) lookup
  // Future: canvas settings, theme, layout algorithm, etc.
};
```

**Helper Function:**
```typescript
/**
 * Generate default label for a state
 */
export function createDefaultLabel(stateId: number): string {
  return `q${stateId}`;
}
```

### Sample DFA (Hardcoded in Code)

For this iteration, we'll create a simple DFA programmatically:
- **Language**: Accepts binary strings containing "00" as a substring
- **States**: 3 states (q0, q1, q2)
- **Alphabet**: {0, 1}
- **Start**: q0
- **Accept**: q2
- **Layout**: Horizontal line at y=300, spaced 200px apart

**Design Notes**:
- Use engine functions to build the automaton (addState, addTransition, etc.)
- Manually create corresponding StateUI objects with positions
- No self-loops in this sample (deferred)
- No multiple transitions between same states (deferred)

---

## File Structure (New Files This Iteration)

```
/src
  /ui-state                      # NEW: UI-specific types
    - types.ts                   # StateUI, AutomatonUI, helper functions

  /components                    # NEW: React components
    - AutomatonCanvas.tsx        # Main SVG container
    - StateNode.tsx              # Individual state circle
    - TransitionEdge.tsx         # Transition arrow
    - StartStateArrow.tsx        # Arrow pointing to start state

  - App.tsx                      # MODIFY: Create sample DFA and render
  - main.tsx                     # (No changes needed)
```

---

## Implementation Plan

### Task 1: UI State Types
**File**: `src/ui-state/types.ts`

**Goal**: Define TypeScript types for visual metadata

**Requirements**:
- `StateUI` type (id, position, label)
- `AutomatonUI` type (states Map)
- `createDefaultLabel()` helper function
- Clear JSDoc comments
- Export all types

**Acceptance Criteria**:
- TypeScript compiles without errors
- Types mirror engine structure (parallel architecture)
- StateUI includes id as "foreign key" to engine state
- Helper function generates "q{id}" labels
- Types are reusable across components

---

### Task 2: State Node Component
**File**: `src/components/StateNode.tsx`

**Goal**: Render a single state as SVG

**Props**:
```typescript
type StateNodeProps = {
  stateId: number;
  label: string;
  x: number;
  y: number;
  isStart: boolean;
  isAccept: boolean;
  isActive?: boolean;  // For future simulation highlighting
};
```

**Visual Requirements**:
- Normal state: Single circle
- Accept state: Double circle (concentric circles)
- Clear text label in center
- Radius ~30px

**Acceptance Criteria**:
- Renders at correct (x, y) position
- Accept states have double circle
- Label is centered and readable
- TypeScript props are type-safe

---

---

### Task 3: Start State Arrow
**File**: `src/components/StartStateArrow.tsx`

**Goal**: Render arrow pointing to start state

**Props** (granular values):
```typescript
type StartStateArrowProp = {
  targetX: number;
  targetY: number;
  stateRadius: number;
};
```

**Visual Requirements**:
- Horizontal arrow from left
- Points to edge of state circle (not center)
- Simple arrowhead

**Acceptance Criteria**:
- Arrow points correctly at state edge
- Arrowhead is visible and clear
- Length is reasonable (~50px from state)

---

---

### Task 4: Transition Edge Component
**File**: `src/components/TransitionEdge.tsx`

**Goal**: Render transition arrow between states

**Props** (granular values):
```typescript
type TransitionEdgeProp = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  symbol: string | null;  // null = ε
  stateRadius: number;
};
```

**Visual Requirements**:
- Straight arrow from source to destination
- Starts/ends at state edge (not center)
- Symbol label at midpoint
- Arrowhead at destination

**Acceptance Criteria**:
- Arrow connects state edges correctly
- Symbol label is readable and positioned well
- Arrowhead is visible
- Math for edge intersections is correct

**Note**: Self-loops deferred to later iteration (sample DFA won't have them)

---

---

### Task 5: Automaton Canvas Component
**File**: `src/components/AutomatonCanvas.tsx`

**Goal**: Main container that orchestrates all child components

**Props**:
```typescript
type AutomatonCanvasProp = {
  automaton: Automaton;
  automatonUI: AutomatonUI;
};
```

**Responsibilities**:
- Create SVG element (fixed 800x600)
- Extract granular values from StateUI objects
- Compute isAccept flags from automaton
- Render all StateNode components with extracted props
- Render all TransitionEdge components with computed coordinates
- Render StartStateArrow for start state

**Rendering Order** (important for z-index):
1. Transition edges (background layer)
2. State nodes (foreground layer)
3. Start state arrow (foreground layer)

**Acceptance Criteria**:
- All states render at correct positions
- All transitions render between correct states
- Start state has arrow pointing to it
- Parent component extracts and passes granular props to children
- Component is clean and readable

---

---

### Task 6: Create Sample DFA and Display in App
**File**: `src/App.tsx`

**Goal**: Wire everything together - create hardcoded DFA and render

**Requirements**:
- Import engine functions and types
- Import UI types
- Create sample DFA programmatically using engine functions
  - DFA that accepts binary strings containing "00"
  - 3 states, alphabet {0, 1}
  - Use addState, addTransition from engine
- Create corresponding AutomatonUI with StateUI objects
  - Horizontal layout: x positions 150, 350, 550; y=300
  - Labels: q0, q1, q2
- Render AutomatonCanvas with both objects
- Basic styling (centered on page, simple background)

**Acceptance Criteria**:
- Automaton displays correctly on `npm run dev`
- DFA is correct (could validate with engine if desired)
- States positioned horizontally as specified
- No console errors
- Page is visually clean
- Layout is reasonable (centered or reasonable default)

---

## Visual Design Guidelines

### Colors (Simple Palette)
- State fill: White (#FFFFFF)
- State stroke: Black (#000000), 2px
- Accept state inner circle: Offset by 6px
- Start arrow: Black
- Transition arrows: Black, 2px
- Text: Black, 14px font

### SVG Styling Tips
- Use `<circle>` for states
- Use `<line>` or `<path>` for arrows
- Use `<text>` for labels with `text-anchor="middle"` and `dominant-baseline="middle"`
- Use `<defs>` for arrowhead markers (reusable)

### Math for Arrow Positioning
Given states at (x1, y1) and (x2, y2) with radius r:
```
// Calculate angle
angle = atan2(y2 - y1, x2 - x1)

// Start point (edge of source circle)
startX = x1 + r * cos(angle)
startY = y1 + r * sin(angle)

// End point (edge of destination circle)
endX = x2 - r * cos(angle)
endY = y2 - r * sin(angle)
```

---

## Testing Strategy

### This Iteration
**Focus**: Manual visual testing
- Does the automaton render correctly?
- Are states positioned as expected?
- Are transitions clearly visible?
- Is the start state marked?
- Are accept states distinct?

**Validation**:
- Load sample DFA and verify it matches expected visual
- Check browser dev tools for console errors
- Verify SVG structure in dev tools

### Future Iterations
- Component unit tests (render props correctly)
- Visual regression tests (optional)
- Integration tests for user interactions

---

## Definition of Done

**Iteration 2 is complete when**:
- [ ] UI type definitions complete (StateUI, AutomatonUI)
- [ ] Helper function for default labels implemented
- [ ] StateNode component renders correctly
- [ ] StartStateArrow component renders correctly
- [ ] TransitionEdge component renders correctly
- [ ] AutomatonCanvas component orchestrates rendering with granular props
- [ ] App.tsx creates sample DFA and displays it
- [ ] Visual output is clean and readable
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Code follows project conventions (functional style, immutability)
- [ ] Component prop types use singular "Prop" naming

---

## Risks & Mitigations

**Risk**: SVG math for arrow positioning is tricky
**Mitigation**: Start with simple horizontal layout, test thoroughly before complex layouts

**Risk**: Self-loops require special handling
**Mitigation**: Deferred - sample DFA will not include self-loops

**Risk**: Multiple transitions between same states
**Mitigation**: Deferred - sample DFA will have only single transitions between any pair of states

**Risk**: SVG coordinate system confusion (origin at top-left)
**Mitigation**: Test with known positions, add visual grid temporarily if needed

---

## Dependencies

**Required from Iteration 1**:
- Engine types (Automaton, Transition)
- Engine functions (for future validation)
- React + Vite setup (already done)

**New Dependencies**:
- None! Using only React and SVG (built-in)

---

## Future Iteration Hints

**Iteration 3 will add**:
- Simulation state management (current state tracking)
- Highlighting active states during simulation
- Input panel and controls
- Step/run functionality

**Things to keep in mind**:
- `StateNode` already has optional `isActive` prop for future use
- Component architecture should make it easy to add interactivity later
- Keep components pure and stateless for now

---

## Decisions Made

1. **SVG canvas size**: Fixed 800x600 (will make dynamic in future iteration)
2. **Self-loops**: Deferred - not included in sample DFA
3. **Multiple transitions between same states**: Deferred - not included in sample DFA
4. **Label defaults**: Always use "q{id}" format via helper function
5. **JSON handling**: Deferred entirely to future iteration - hardcode sample DFA for now
6. **Type structure**: StateUI and AutomatonUI mirror engine architecture
7. **Component props**: Granular values (Option A), using singular "Prop" naming

---

## Notes

- This iteration is purely about rendering, not logic
- All the hard logic work was done in Iteration 1
- Focus on clean, reusable component architecture
- Don't over-engineer - simple and working is the goal
- Next iteration will make it interactive, so keep components flexible
