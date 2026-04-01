# Iteration 3: Advanced Visualization

**Status**: 🚧 IN PROGRESS
**Start Date**: 2026-03-31
**Branch**: `iteration-3`

---

## Goal

Complete the visualization foundation with automatic graph layout and proper rendering for all transition types.

**Success Criteria**:
- Automatic layout works for arbitrary DFAs (no manual positioning needed)
- Self-loops render as visible curved paths with labels
- Bidirectional edges render as distinct curved arrows
- All transitions are clearly visible and labeled
- Layout is visually appealing and readable
- No regressions from Iteration 2

---

## Context

### Why This Iteration is Needed

Iteration 2 successfully established basic SVG visualization, but has critical limitations:
1. **Self-loops render invisibly** - When `from === to`, the arrow has 0-length (invisible)
2. **Multiple transitions between same states overlap** - Completely hidden, unusable
3. **Manual positioning is tedious** - Hardcoded x/y coordinates for every state

These limitations block progress toward interactive simulation (Iteration 4) and manual editing (Iteration 5).

### What We're Building

This iteration adds:
- **Automatic graph layout** using dagre library (eliminates manual positioning)
- **Self-loop rendering** using curved SVG paths (makes self-loops visible)
- **Curved bidirectional arrows** (prevents overlaps between A→B and B→A)

### Intended Outcome

Users can visualize arbitrary DFAs without manual positioning. All transition types (straight arrows, self-loops, bidirectional edges) render clearly and distinctly.

---

## Scope

### In Scope
- Install and integrate dagre library for automatic layout
- Create UI utility function for computing positions from automaton
- Implement self-loop rendering with curved SVG paths
- Implement curved arrows for bidirectional transitions
- Update existing components to support new transition types
- Create sample DFA files demonstrating various layouts
- Add unit tests for layout utility
- Fine-tune layout parameters for visual quality

### Out of Scope (Deferred to Future Iterations)
- Interactive simulation (Iteration 4)
- Manual editing of automatons (Iteration 5)
- Drag-and-drop state positioning (Iteration 8)
- Manual override of auto-layout (Iteration 8)
- Animation of transitions (Iteration 9)
- NFA support (Iteration 6)
- Multiple transitions between same states (more than bidirectional pairs)

### Key Principle
Build on Iteration 2's foundation without breaking existing architecture. Maintain clean engine/UI separation. Focus on visualization quality, not interaction.

---

## Architecture

### Layer Ownership (Clarified)

**Two-Layer Architecture** (no third layer):

```
Engine Layer (src/engine/)
  - Owns automaton logic
  - Types, operations, validation, simulation
  - Pure TypeScript, no React dependencies
  - No knowledge of visual representation

UI Layer (src/ui-state/, src/components/)
  - Owns visual representation (including positions)
  - Can calculate positions manually (Iteration 2)
  - Can use dagre to calculate positions automatically (Iteration 3)
  - dagre is just a tool/dependency, not a separate owner
```

**Important Clarification**:
The UI layer owns positioning. dagre is a utility library the UI layer uses to **calculate** positions automatically - it's not a separate architectural layer. Just like the engine uses `Math.atan2` without making "math" a separate owner.

### Data Flow

```
Automaton (engine)
       ↓
computeLayout() - UI utility function (uses dagre internally)
       ↓
AutomatonUI (UI state with computed positions)
       ↓
AutomatonCanvas (extracts granular props)
       ↓
Components (StateNode, TransitionEdge, StartStateArrow)
       ↓
SVG Rendering
```

---

## File Structure

### New Files This Iteration
```
/src
  /ui-state
    - utils.ts                    # NEW: UI utility functions (computeLayout, etc.)
    - utils.test.ts               # NEW: Unit tests for utilities

  /data
    - self-loop-dfa.json          # NEW: Sample DFA with self-loops
    - bidirectional-dfa.json      # NEW: Sample DFA with bidirectional edges
    - complex-dfa.json            # NEW: Sample DFA mixing all transition types
```

### Modified Files This Iteration
```
  /components
    - TransitionEdge.tsx          # MAJOR: Add self-loop and curved arrow rendering
    - AutomatonCanvas.tsx         # MODERATE: Detect bidirectional edges, pass new props

  - App.tsx                       # MINOR: Replace manual positioning with computeLayout()
  - package.json                  # MINOR: Add dagre dependencies
```

### Unchanged Files
```
  /engine                         # No changes (engine layer isolated)
  /ui-state/types.ts             # No changes (types already support this)
  /components/StateNode.tsx      # No changes (already complete)
  /components/StartStateArrow.tsx # No changes (already complete)
```

---

## Data Structures

### No New Types Required

Existing types from Iteration 2 already support auto-layout:

```typescript
// src/ui-state/types.ts (unchanged)
type StateUI = {
  id: number;                           // Foreign key to engine state
  position: { x: number; y: number };   // Canvas coordinates (can be computed or manual)
  label: string;                        // Display label
};

type AutomatonUI = {
  states: Map<number, StateUI>;         // Keyed by state ID
};
```

The beauty of this design: `position` doesn't care whether it was computed automatically (dagre) or set manually (hardcoded). The components just consume positions.

### New UI Utility Functions

```typescript
// src/ui-state/utils.ts (NEW FILE)

/**
 * Compute automatic layout positions for an automaton using dagre
 *
 * @param automaton - The engine automaton to lay out
 * @returns AutomatonUI with computed positions and default labels
 */
export function computeLayout(automaton: Automaton): AutomatonUI;

/**
 * Compute canvas dimensions needed to fit the automaton
 *
 * @param automatonUI - UI state with positioned states
 * @returns Width and height needed with margin
 */
export function computeCanvasDimensions(
  automatonUI: AutomatonUI
): { width: number; height: number };
```

---

## Implementation Plan

### Phase 1: Auto-Layout Foundation (Critical Path)

#### Task 1.1: Install Dependencies
**Files**: `package.json`

**Actions**:
```bash
npm install @dagrejs/dagre
npm install --save-dev @types/dagre
```

**Rationale**:
- `@dagrejs/dagre` is actively maintained fork (v3.0.0)
- TypeScript types provide type safety
- Dagre is specifically designed for directed graphs (perfect for DFAs)

**Acceptance Criteria**:
- Dependencies appear in package.json
- TypeScript recognizes dagre types
- No installation errors

---

#### Task 1.2: Create UI Utilities Module
**File**: `src/ui-state/utils.ts`

**Goal**: Implement `computeLayout()` function using dagre

**Implementation**:
```typescript
import dagre from '@dagrejs/dagre';
import { Automaton } from '../engine/types';
import { AutomatonUI, StateUI, createDefaultLabel } from './types';

/**
 * Configuration for dagre graph layout algorithm
 */
const LAYOUT_CONFIG = {
  rankdir: 'LR',           // Left-to-right layout (standard for DFAs)
  nodesep: 100,            // Horizontal spacing between nodes (pixels)
  ranksep: 150,            // Vertical spacing between ranks (pixels)
  marginx: 50,             // Canvas margin horizontal (pixels)
  marginy: 50,             // Canvas margin vertical (pixels)
};

/**
 * Node dimensions for dagre layout calculation
 */
const NODE_CONFIG = {
  width: 60,               // Match STATE_RADIUS * 2 from components
  height: 60,              // Square bounding box for circular states
};

/**
 * Compute automatic layout positions for an automaton using dagre.
 *
 * This is a pure function - given an automaton, it calculates optimal
 * positions for all states using a directed graph layout algorithm.
 *
 * @param automaton - The engine automaton to lay out
 * @returns AutomatonUI with computed positions and default labels
 */
export function computeLayout(automaton: Automaton): AutomatonUI {
  // Create new dagre graph instance
  const graph = new dagre.graphlib.Graph();

  // Configure graph layout algorithm
  graph.setGraph(LAYOUT_CONFIG);
  graph.setDefaultEdgeLabel(() => ({}));

  // Add all states as nodes to the graph
  automaton.states.forEach((stateId) => {
    graph.setNode(stateId.toString(), NODE_CONFIG);
  });

  // Add all transitions as edges to the graph
  // Note: dagre automatically handles multiple edges between same nodes
  automaton.transitions.forEach((transition) => {
    transition.to.forEach((destinationStateId) => {
      graph.setEdge(
        transition.from.toString(),
        destinationStateId.toString()
      );
    });
  });

  // Run dagre layout algorithm (computes x, y positions)
  dagre.layout(graph);

  // Extract computed positions and create StateUI objects
  const states = new Map<number, StateUI>();

  automaton.states.forEach((stateId) => {
    const nodeData = graph.node(stateId.toString());

    states.set(stateId, {
      id: stateId,
      position: {
        x: nodeData.x,
        y: nodeData.y
      },
      label: createDefaultLabel(stateId),
    });
  });

  return { states };
}
```

**Key Design Decisions**:
- **Pure function**: No side effects, deterministic output
- **Clear variable names**: `graph`, `nodeData`, `destinationStateId` (no shorthand!)
- **Configuration constants**: Easy to tune spacing and margins
- **Left-to-right layout**: Standard for DFA diagrams
- **Generous spacing**: Prevents visual crowding

**Acceptance Criteria**:
- Function compiles without TypeScript errors
- Returns valid AutomatonUI structure
- All states have computed positions
- Labels use default "q{id}" format

---

#### Task 1.3: Add Unit Tests for Layout Utility
**File**: `src/ui-state/utils.test.ts`

**Tests to Implement**:
1. Should position all states with valid coordinates
2. Should generate default labels for all states
3. Should handle multiple states with reasonable separation
4. Should handle disconnected states (no edges)
5. Should handle single-state automaton
6. Should handle automaton with self-loops
7. All positions should be non-negative

**Example Test**:
```typescript
import { describe, it, expect } from 'vitest';
import { computeLayout } from './utils';
import { createAutomaton, addState, addTransition } from '../engine/automaton';

describe('computeLayout', () => {
  it('should position all states with valid coordinates', () => {
    const automaton = createAutomaton('DFA', new Set(['0', '1']));
    const automatonUI = computeLayout(automaton);

    expect(automatonUI.states.size).toBe(1);
    expect(automatonUI.states.get(0)).toBeDefined();

    const stateUI = automatonUI.states.get(0)!;
    expect(stateUI.position.x).toBeGreaterThanOrEqual(0);
    expect(stateUI.position.y).toBeGreaterThanOrEqual(0);
  });

  it('should generate default labels', () => {
    const automaton = createAutomaton('DFA', new Set(['0', '1']));
    const automatonUI = computeLayout(automaton);

    expect(automatonUI.states.get(0)?.label).toBe('q0');
  });

  it('should handle multiple states with reasonable separation', () => {
    let automaton = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: automaton2, stateId: state1 } = addState(automaton);
    automaton = addTransition(automaton2, 0, new Set([state1]), '0');

    const automatonUI = computeLayout(automaton);

    const position0 = automatonUI.states.get(0)!.position;
    const position1 = automatonUI.states.get(state1)!.position;

    const distance = Math.sqrt(
      Math.pow(position1.x - position0.x, 2) +
      Math.pow(position1.y - position0.y, 2)
    );

    // States should be reasonably separated (at least 50px apart)
    expect(distance).toBeGreaterThan(50);
  });
});
```

**Acceptance Criteria**:
- All tests pass
- Tests cover edge cases (single state, disconnected, self-loops)
- Tests validate position values are reasonable

---

#### Task 1.4: Update App.tsx to Use Auto-Layout
**File**: `src/App.tsx`

**Changes**:
```typescript
// Before (Iteration 2 - manual positioning):
const automatonUI: AutomatonUI = {
  states: new Map([
    [0, { id: 0, position: { x: 200, y: 300 }, label: createDefaultLabel(0) }],
    [state1, { id: state1, position: { x: 450, y: 300 }, label: createDefaultLabel(state1) }],
    [state2, { id: state2, position: { x: 600, y: 300 }, label: createDefaultLabel(state2) }],
  ]),
};

// After (Iteration 3 - automatic layout):
import { computeLayout } from './ui-state/utils';

const automatonUI = computeLayout(dfa);
```

**Full Updated App.tsx**:
```typescript
import { createAutomaton, addState, addTransition, addAcceptState } from './engine/automaton';
import { AutomatonCanvas } from './components/AutomatonCanvas';
import { computeLayout } from './ui-state/utils';

function App() {
  // Create a DFA that accepts binary strings ending in "01"
  let dfa = createAutomaton('DFA', new Set(['0', '1']));

  let state1: number;
  ({ automaton: dfa, stateId: state1 } = addState(dfa));

  let state2: number;
  ({ automaton: dfa, stateId: state2 } = addState(dfa));

  dfa = addAcceptState(dfa, state2);

  // Transitions
  dfa = addTransition(dfa, 0, new Set([state1]), '0');
  dfa = addTransition(dfa, 0, new Set([0]), '1');
  dfa = addTransition(dfa, state1, new Set([state1]), '0');
  dfa = addTransition(dfa, state1, new Set([state2]), '1');
  dfa = addTransition(dfa, state2, new Set([state1]), '0');
  dfa = addTransition(dfa, state2, new Set([0]), '1');

  // Compute layout automatically (replaces manual positioning)
  const automatonUI = computeLayout(dfa);

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Project Automata</h1>
      <p>Iteration 3: Advanced Visualization</p>
      <p style={{ fontSize: '14px', color: '#666' }}>
        DFA accepting binary strings ending in "01" (auto-layout)
      </p>

      <AutomatonCanvas automaton={dfa} automatonUI={automatonUI} />
    </div>
  );
}

export default App;
```

**Acceptance Criteria**:
- App loads without errors
- DFA renders with automatic layout
- States are positioned sensibly
- No manual x/y coordinates in code
- Browser console shows no errors

---

### Phase 2: Self-Loop Rendering

#### Task 2.1: Update TransitionEdge Props
**File**: `src/components/TransitionEdge.tsx`

**Add New Props**:
```typescript
type TransitionEdgeProp = {
  /** X coordinate of the source state center */
  fromX: number;

  /** Y coordinate of the source state center */
  fromY: number;

  /** X coordinate of the destination state center */
  toX: number;

  /** Y coordinate of the destination state center */
  toY: number;

  /** Transition symbol (null represents ε-transition) */
  symbol: string | null;

  /** Radius of state circles (to calculate edge intersections) */
  stateRadius: number;

  /** Source state ID (NEW - needed to detect self-loops) */
  fromStateId: number;

  /** Destination state ID (NEW - needed to detect self-loops) */
  toStateId: number;
};
```

**Acceptance Criteria**:
- Props type updated
- TypeScript compiles
- No breaking changes to existing prop usage (backward compatible until canvas updated)

---

#### Task 2.2: Implement Self-Loop Rendering Logic
**File**: `src/components/TransitionEdge.tsx`

**Refactor Component Structure**:
```typescript
export function TransitionEdge(props: TransitionEdgeProp) {
  const isSelfLoop = props.fromStateId === props.toStateId;

  if (isSelfLoop) {
    return renderSelfLoop(props);
  }

  return renderStraightArrow(props);
}
```

**Implement renderSelfLoop Helper**:
```typescript
/**
 * Configuration for self-loop appearance
 */
const SELF_LOOP_CONFIG = {
  loopRadius: 25,              // Radius of the loop curve (pixels)
  loopOffsetAngle: -90,        // Position loop at top of state (degrees)
  labelOffsetY: -45,           // Label position above loop (pixels)
};

/**
 * Render a self-loop (transition from a state to itself)
 * Uses a curved SVG path positioned above the state
 */
function renderSelfLoop(props: TransitionEdgeProp): JSX.Element {
  const { fromX, fromY, symbol, stateRadius } = props;
  const { loopRadius, loopOffsetAngle, labelOffsetY } = SELF_LOOP_CONFIG;

  // Convert angle from degrees to radians
  const angleRadians = (loopOffsetAngle * Math.PI) / 180;

  // Calculate start point on state circle edge
  const startX = fromX + stateRadius * Math.cos(angleRadians - 0.3);
  const startY = fromY + stateRadius * Math.sin(angleRadians - 0.3);

  // Calculate end point on state circle edge
  const endX = fromX + stateRadius * Math.cos(angleRadians + 0.3);
  const endY = fromY + stateRadius * Math.sin(angleRadians + 0.3);

  // Control point for curve (positioned above state)
  const controlX = fromX;
  const controlY = fromY - stateRadius - loopRadius;

  // Create SVG path using quadratic bezier curve
  const pathData = `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`;

  // Calculate arrowhead angle at end point
  const arrowheadAngle = Math.atan2(endY - controlY, endX - controlX);

  // Calculate arrowhead triangle points
  const arrowheadSize = 8;
  const arrowheadAngle1 = arrowheadAngle + Math.PI - Math.PI / 6;
  const arrowheadAngle2 = arrowheadAngle + Math.PI + Math.PI / 6;

  const arrowheadPoint1X = endX + arrowheadSize * Math.cos(arrowheadAngle1);
  const arrowheadPoint1Y = endY + arrowheadSize * Math.sin(arrowheadAngle1);
  const arrowheadPoint2X = endX + arrowheadSize * Math.cos(arrowheadAngle2);
  const arrowheadPoint2Y = endY + arrowheadSize * Math.sin(arrowheadAngle2);

  const displaySymbol = symbol === null ? 'ε' : symbol;

  return (
    <g>
      {/* Self-loop path */}
      <path
        d={pathData}
        fill="none"
        stroke="black"
        strokeWidth={2}
      />

      {/* Arrowhead */}
      <polygon
        points={`${endX},${endY} ${arrowheadPoint1X},${arrowheadPoint1Y} ${arrowheadPoint2X},${arrowheadPoint2Y}`}
        fill="black"
      />

      {/* Label positioned above loop */}
      <text
        x={fromX}
        y={fromY + labelOffsetY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill="black"
        fontFamily="Arial, sans-serif"
      >
        {displaySymbol}
      </text>
    </g>
  );
}
```

**Extract Existing Logic into renderStraightArrow**:
```typescript
/**
 * Render a straight arrow between two different states
 * This is the existing logic from Iteration 2
 */
function renderStraightArrow(props: TransitionEdgeProp): JSX.Element {
  // Existing straight arrow logic (unchanged from Iteration 2)
  // ... (copy existing implementation)
}
```

**Acceptance Criteria**:
- Self-loops render as curved paths above states
- Arrowheads point correctly
- Labels are positioned above loops and readable
- Straight arrows still work for normal transitions
- No TypeScript errors

---

#### Task 2.3: Update AutomatonCanvas to Pass New Props
**File**: `src/components/AutomatonCanvas.tsx`

**Changes**:
```typescript
<TransitionEdge
  key={`transition-${transitionIndex}-to-${toStateId}`}
  fromX={fromState.position.x}
  fromY={fromState.position.y}
  toX={toState.position.x}
  toY={toState.position.y}
  fromStateId={transition.from}     // NEW
  toStateId={toStateId}              // NEW
  symbol={transition.symbol}
  stateRadius={STATE_RADIUS}
/>
```

**Acceptance Criteria**:
- New props passed to TransitionEdge
- No TypeScript errors
- Component still renders correctly

---

### Phase 3: Curved Bidirectional Arrows

#### Task 3.1: Add Bidirectional Detection Helper
**File**: `src/components/AutomatonCanvas.tsx`

**Implement Helper Function**:
```typescript
/**
 * Check if a transition is part of a bidirectional pair (A→B and B→A both exist)
 *
 * @param sourceStateId - The source state ID
 * @param destinationStateId - The destination state ID
 * @param allTransitions - All transitions in the automaton
 * @returns True if there's a reverse transition (B→A exists)
 */
function isPartOfBidirectionalPair(
  sourceStateId: number,
  destinationStateId: number,
  allTransitions: Transition[]
): boolean {
  return allTransitions.some((transition) =>
    transition.from === destinationStateId &&
    transition.to.has(sourceStateId)
  );
}
```

**Acceptance Criteria**:
- Function correctly identifies bidirectional pairs
- Returns false for unidirectional transitions
- Returns false for self-loops

---

#### Task 3.2: Update TransitionEdge for Curved Arrows
**File**: `src/components/TransitionEdge.tsx`

**Add New Prop**:
```typescript
type TransitionEdgeProp = {
  // ... existing props ...

  /** Whether this transition is part of a bidirectional pair (NEW) */
  isBidirectional?: boolean;
};
```

**Update Rendering Logic**:
```typescript
export function TransitionEdge(props: TransitionEdgeProp) {
  const isSelfLoop = props.fromStateId === props.toStateId;

  if (isSelfLoop) {
    return renderSelfLoop(props);
  }

  if (props.isBidirectional) {
    return renderCurvedArrow(props);
  }

  return renderStraightArrow(props);
}
```

**Implement renderCurvedArrow Helper**:
```typescript
/**
 * Configuration for curved bidirectional arrows
 */
const CURVED_ARROW_CONFIG = {
  curveOffset: 20,  // Distance to curve away from straight line (pixels)
};

/**
 * Render a curved arrow for bidirectional transitions
 * Uses quadratic bezier with perpendicular offset to prevent overlap
 */
function renderCurvedArrow(props: TransitionEdgeProp): JSX.Element {
  const { fromX, fromY, toX, toY, symbol, stateRadius } = props;
  const { curveOffset } = CURVED_ARROW_CONFIG;

  // Calculate angle from source to destination
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Calculate midpoint
  const midpointX = (fromX + toX) / 2;
  const midpointY = (fromY + toY) / 2;

  // Calculate perpendicular angle (90 degrees offset)
  const perpendicularAngle = angle + Math.PI / 2;

  // Calculate control point offset perpendicular to line
  const controlPointX = midpointX + curveOffset * Math.cos(perpendicularAngle);
  const controlPointY = midpointY + curveOffset * Math.sin(perpendicularAngle);

  // Calculate start point on source circle edge
  const startX = fromX + stateRadius * Math.cos(angle);
  const startY = fromY + stateRadius * Math.sin(angle);

  // Calculate end point on destination circle edge
  const endX = toX - stateRadius * Math.cos(angle);
  const endY = toY - stateRadius * Math.sin(angle);

  // Create SVG path using quadratic bezier curve
  const pathData = `M ${startX} ${startY} Q ${controlPointX} ${controlPointY}, ${endX} ${endY}`;

  // Calculate arrowhead angle at end point (tangent to curve)
  const arrowheadAngle = Math.atan2(
    endY - controlPointY,
    endX - controlPointX
  );

  // Calculate arrowhead triangle points
  const arrowheadSize = 8;
  const arrowheadAngle1 = arrowheadAngle + Math.PI - Math.PI / 6;
  const arrowheadAngle2 = arrowheadAngle + Math.PI + Math.PI / 6;

  const arrowheadPoint1X = endX + arrowheadSize * Math.cos(arrowheadAngle1);
  const arrowheadPoint1Y = endY + arrowheadSize * Math.sin(arrowheadAngle1);
  const arrowheadPoint2X = endX + arrowheadSize * Math.cos(arrowheadAngle2);
  const arrowheadPoint2Y = endY + arrowheadSize * Math.sin(arrowheadAngle2);

  const displaySymbol = symbol === null ? 'ε' : symbol;

  return (
    <g>
      {/* Curved arrow path */}
      <path
        d={pathData}
        fill="none"
        stroke="black"
        strokeWidth={2}
      />

      {/* Arrowhead */}
      <polygon
        points={`${endX},${endY} ${arrowheadPoint1X},${arrowheadPoint1Y} ${arrowheadPoint2X},${arrowheadPoint2Y}`}
        fill="black"
      />

      {/* Label positioned at control point (naturally offset from line) */}
      <text
        x={controlPointX}
        y={controlPointY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill="black"
        fontFamily="Arial, sans-serif"
      >
        {displaySymbol}
      </text>
    </g>
  );
}
```

**Acceptance Criteria**:
- Curved arrows render for bidirectional pairs
- Arrows curve away from each other (visible and distinct)
- Labels positioned at control point (readable, offset from line)
- Arrowheads point correctly along curve tangent

---

#### Task 3.3: Update AutomatonCanvas to Detect and Mark Bidirectional Edges
**File**: `src/components/AutomatonCanvas.tsx`

**Changes in Transition Rendering**:
```typescript
{automaton.transitions.flatMap((transition, transitionIndex) => {
  const fromState = automatonUI.states.get(transition.from);
  if (!fromState) {
    return [];
  }

  return Array.from(transition.to).map((toStateId) => {
    const toState = automatonUI.states.get(toStateId);
    if (!toState) {
      return null;
    }

    // Detect if this transition is part of a bidirectional pair
    const isBidirectional = isPartOfBidirectionalPair(
      transition.from,
      toStateId,
      automaton.transitions
    );

    return (
      <TransitionEdge
        key={`transition-${transitionIndex}-to-${toStateId}`}
        fromX={fromState.position.x}
        fromY={fromState.position.y}
        toX={toState.position.x}
        toY={toState.position.y}
        fromStateId={transition.from}
        toStateId={toStateId}
        symbol={transition.symbol}
        stateRadius={STATE_RADIUS}
        isBidirectional={isBidirectional}  // NEW
      />
    );
  });
})}
```

**Acceptance Criteria**:
- Bidirectional detection works correctly
- isBidirectional prop passed to TransitionEdge
- Curved arrows render for bidirectional pairs
- Straight arrows render for unidirectional transitions

---

### Phase 4: Polish and Testing

#### Task 4.1: Create Sample DFA Files
**Files**: `src/data/*.json`

Create comprehensive test DFAs:

**self-loop-dfa.json** - DFA with self-loops:
```json
{
  "type": "DFA",
  "states": [0, 1],
  "alphabet": ["a", "b"],
  "transitions": [
    { "from": 0, "to": [0], "symbol": "a" },
    { "from": 0, "to": [1], "symbol": "b" },
    { "from": 1, "to": [1], "symbol": "b" },
    { "from": 1, "to": [0], "symbol": "a" }
  ],
  "startState": 0,
  "acceptStates": [1],
  "nextStateId": 2
}
```

**bidirectional-dfa.json** - DFA with bidirectional edges:
```json
{
  "type": "DFA",
  "states": [0, 1, 2],
  "alphabet": ["0", "1"],
  "transitions": [
    { "from": 0, "to": [1], "symbol": "0" },
    { "from": 1, "to": [0], "symbol": "0" },
    { "from": 1, "to": [2], "symbol": "1" },
    { "from": 2, "to": [1], "symbol": "1" },
    { "from": 2, "to": [2], "symbol": "0" },
    { "from": 0, "to": [0], "symbol": "1" }
  ],
  "startState": 0,
  "acceptStates": [2],
  "nextStateId": 3
}
```

**complex-dfa.json** - Mix of all transition types:
```json
{
  "type": "DFA",
  "states": [0, 1, 2, 3],
  "alphabet": ["a", "b"],
  "transitions": [
    { "from": 0, "to": [0], "symbol": "a" },
    { "from": 0, "to": [1], "symbol": "b" },
    { "from": 1, "to": [2], "symbol": "a" },
    { "from": 2, "to": [1], "symbol": "a" },
    { "from": 1, "to": [1], "symbol": "b" },
    { "from": 2, "to": [3], "symbol": "b" },
    { "from": 3, "to": [3], "symbol": "a" },
    { "from": 3, "to": [0], "symbol": "b" }
  ],
  "startState": 0,
  "acceptStates": [3],
  "nextStateId": 4
}
```

**Acceptance Criteria**:
- All JSON files valid and loadable
- Represent different transition patterns
- Can be used for manual testing

---

#### Task 4.2: Fine-Tune Layout Parameters
**File**: `src/ui-state/utils.ts`

**Parameters to Tune**:
```typescript
const LAYOUT_CONFIG = {
  rankdir: 'LR',      // Try 'TB' if vertical layout preferred
  nodesep: 100,       // Adjust if states too close/far horizontally
  ranksep: 150,       // Adjust if states too close/far vertically
  marginx: 50,        // Increase for more canvas padding
  marginy: 50,
};
```

**Testing Approach**:
- Load various DFAs (linear chains, trees, cycles)
- Verify no overlaps between states or labels
- Adjust spacing until visually appealing
- Document final values chosen

**Acceptance Criteria**:
- Layout looks good for various DFA structures
- No visual overlaps
- Reasonable spacing between elements

---

#### Task 4.3: Add Dynamic Canvas Sizing (Optional Enhancement)
**File**: `src/ui-state/utils.ts`

**New Utility Function**:
```typescript
/**
 * Compute canvas dimensions needed to fit the automaton
 *
 * @param automatonUI - UI state with positioned states
 * @returns Width and height with margin
 */
export function computeCanvasDimensions(
  automatonUI: AutomatonUI
): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;

  automatonUI.states.forEach((stateUI) => {
    maxX = Math.max(maxX, stateUI.position.x);
    maxY = Math.max(maxY, stateUI.position.y);
  });

  return {
    width: maxX + 100,   // Add margin
    height: maxY + 100,
  };
}
```

**Integration in AutomatonCanvas**:
```typescript
const { width, height } = computeCanvasDimensions(automatonUI);

return (
  <svg width={width} height={height} style={{ border: '1px solid #ccc' }}>
    {/* ... components ... */}
  </svg>
);
```

**Acceptance Criteria**:
- Canvas resizes to fit automaton
- No clipping of states or labels
- Reasonable margins maintained

---

#### Task 4.4: Manual Visual Testing
**Process**:

1. **Test Self-Loops**:
   - Load self-loop-dfa.json
   - Verify curved loops appear above states
   - Verify labels are readable
   - Verify arrowheads point correctly

2. **Test Bidirectional Arrows**:
   - Load bidirectional-dfa.json
   - Verify arrows curve away from each other
   - Verify both arrows visible and distinct
   - Verify labels don't overlap

3. **Test Auto-Layout**:
   - Create various DFAs programmatically
   - Linear chain (0→1→2→3)
   - Tree structure (0→1, 0→2, 1→3, 1→4)
   - Cyclic (0→1→2→0)
   - Verify layout is visually appealing

4. **Test Mixed Transitions**:
   - Load complex-dfa.json
   - Verify all transition types render correctly
   - Verify no overlaps
   - Verify overall readability

**Acceptance Criteria**:
- All transition types render correctly
- No visual artifacts or overlaps
- Layout is readable and aesthetically pleasing
- No browser console errors

---

## Testing Strategy

### Unit Tests
**File**: `src/ui-state/utils.test.ts`

**Coverage**:
- computeLayout positions all states
- Default labels generated correctly
- Multiple states separated adequately
- Disconnected states handled
- Single-state automaton handled
- Self-loops handled in layout

**Run Command**: `npm test`

### Integration Tests
**Manual visual testing** (documented in Task 4.4 above)

### Regression Testing
- Verify all 87 existing engine tests still pass
- Verify Iteration 2 sample DFA still renders correctly
- No TypeScript compilation errors
- No runtime errors in browser console

---

## Definition of Done

Iteration 3 is complete when:

- [  ] dagre dependencies installed
- [  ] `src/ui-state/utils.ts` created with `computeLayout()` function
- [  ] `src/ui-state/utils.test.ts` created with comprehensive tests
- [  ] All unit tests pass (87 existing + new utils tests)
- [  ] `App.tsx` uses `computeLayout()` instead of manual positioning
- [  ] Auto-layout works for arbitrary DFAs
- [  ] `TransitionEdge.tsx` supports three rendering modes:
  - Self-loops (curved paths)
  - Bidirectional arrows (curved)
  - Straight arrows (existing)
- [  ] `AutomatonCanvas.tsx` detects and marks bidirectional transitions
- [  ] Self-loops render as visible curved paths above states
- [  ] Bidirectional edges render as distinct curved arrows
- [  ] All transition labels are readable and well-positioned
- [  ] Sample DFA files created (self-loop, bidirectional, complex)
- [  ] Layout parameters tuned for visual quality
- [  ] Manual visual testing complete (all transition types verified)
- [  ] No regressions from Iteration 2
- [  ] No TypeScript errors
- [  ] No console errors in browser
- [  ] Code follows project conventions:
  - Clear variable names (no shorthand)
  - Functional style
  - Immutability
  - Clean separation of concerns

---

## Risks & Mitigations

**Risk**: dagre produces poor layouts for DFAs
- **Mitigation**: Test with multiple sample DFAs early in Phase 1
- **Fallback**: Tune LAYOUT_CONFIG parameters or consider alternative algorithms

**Risk**: SVG path math errors (bezier curves, arrowheads)
- **Mitigation**: Start with simple cases, use browser DevTools to inspect paths
- **Fallback**: Reference SVG path documentation, test incrementally

**Risk**: Label overlap on curved edges
- **Mitigation**: Position labels at control points (naturally offset)
- **Fallback**: Add background rect to labels for better readability

**Risk**: Performance issues with large graphs
- **Mitigation**: Test with 20+ state DFA during Phase 4
- **Fallback**: dagre is fast, but could add memoization if needed

**Risk**: Curved arrows too subtle or hard to see
- **Mitigation**: Tune `curveOffset` parameter
- **Fallback**: Increase offset or use different curve function

---

## Dependencies

### Required from Previous Iterations
- Iteration 1: Engine layer complete (all tests passing)
- Iteration 2: Basic visualization complete (components, types)
- React + Vite setup (already done)
- SVG rendering foundation (already done)

### New Dependencies
- `@dagrejs/dagre` (^3.0.0) - Graph layout algorithm
- `@types/dagre` - TypeScript type definitions

### External Resources
- [Dagre documentation](https://github.com/dagrejs/dagre/wiki)
- [SVG Path documentation](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths)
- [Quadratic Bezier curves](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#curve_commands)

---

## Architecture Decisions Made

### 1. UI Utilities Module (Not a Third Owner)
**Decision**: Create `src/ui-state/utils.ts` for layout calculations

**Rationale**:
- UI layer owns positioning (clear ownership)
- dagre is a tool the UI layer uses (not a separate owner)
- Keeps type definitions separate from utility logic
- Allows testing layout logic independently

**Alternative Rejected**: Separate "layout module" as third architectural layer
- Would introduce confusion about ownership
- UI already owns positions, dagre just helps calculate them

### 2. Clear Variable Naming (No Shorthand)
**Decision**: Use descriptive variable names throughout

**Examples**:
- `graph` not `g`
- `nodeData` not `n`
- `destinationStateId` not `toId` or `dest`
- `arrowheadAngle` not `arrowAngle` or `aa`

**Rationale**:
- Improves code readability
- Reduces cognitive load
- Makes intent explicit
- User preference from CLAUDE.md

### 3. Three Rendering Modes in TransitionEdge
**Decision**: Refactor into `renderSelfLoop()`, `renderCurvedArrow()`, `renderStraightArrow()`

**Rationale**:
- Clean separation of concerns
- Each function handles one case
- Easier to test and maintain
- Clear control flow (if/else chain)

**Alternative Rejected**: Single complex function with many conditionals
- Would be harder to read and maintain
- Would mix different SVG path logic

### 4. Bidirectional Detection in Parent Component
**Decision**: `AutomatonCanvas` detects bidirectional pairs and passes flag to `TransitionEdge`

**Rationale**:
- Canvas has full context (all transitions)
- TransitionEdge stays simple (just renders based on props)
- Follows existing pattern (canvas extracts data, children render)

**Alternative Rejected**: TransitionEdge receives all transitions and detects internally
- Would violate separation of concerns
- Would require passing more data than needed

### 5. Quadratic Bezier Curves (Not Cubic)
**Decision**: Use quadratic bezier (`Q` command) for self-loops and curved arrows

**Rationale**:
- Simpler than cubic (one control point vs two)
- Sufficient for our needs (smooth curves)
- Easier to calculate arrowhead tangents

**Alternative Considered**: Cubic bezier
- More control, but unnecessary complexity for this use case

### 6. Self-Loops Positioned Above States
**Decision**: Default loop position is top of state (-90 degrees)

**Rationale**:
- Least likely to overlap with incoming/outgoing transitions
- Standard in automata theory diagrams
- Configurable via `loopOffsetAngle` if needed

**Alternative Considered**: Position based on available space
- Too complex for Iteration 3
- Can be added in future iteration if needed

### 7. Fixed Curve Offset for Bidirectional Arrows
**Decision**: Use fixed 20px perpendicular offset

**Rationale**:
- Simple and predictable
- Works well for most cases
- Easy to tune if needed

**Alternative Considered**: Dynamic offset based on distance
- More complex, deferred to future iteration if needed

---

## Configuration Reference

### Layout Spacing (src/ui-state/utils.ts)
```typescript
const LAYOUT_CONFIG = {
  rankdir: 'LR',      // 'LR' | 'RL' | 'TB' | 'BT'
  nodesep: 100,       // Horizontal spacing (pixels)
  ranksep: 150,       // Vertical spacing (pixels)
  marginx: 50,        // Canvas margin (pixels)
  marginy: 50,
};
```

### Self-Loop Appearance (src/components/TransitionEdge.tsx)
```typescript
const SELF_LOOP_CONFIG = {
  loopRadius: 25,         // Size of loop (pixels)
  loopOffsetAngle: -90,   // Position (-90 = top, 0 = right, 90 = bottom, 180 = left)
  labelOffsetY: -45,      // Label position (pixels)
};
```

### Curved Arrow Strength (src/components/TransitionEdge.tsx)
```typescript
const CURVED_ARROW_CONFIG = {
  curveOffset: 20,  // Perpendicular offset (pixels) - larger = more curve
};
```

---

## Future Iterations Preview

### Iteration 4: Simulation + Visual Feedback
- Input panel for test strings
- Step-by-step simulation controls
- Current state highlighting (use `isActive` prop)
- Accept/reject result display

### Iteration 5: Manual Editing
- Add/remove states via UI
- Add/remove transitions via UI
- Edit labels
- Save to JSON

### Iteration 8: Interactive Positioning
- Drag-and-drop states
- Manual override of auto-layout
- Grid snapping

---

## Notes

- This iteration builds entirely on Iteration 2's foundation
- No changes to engine layer (complete separation maintained)
- dagre is a dependency, not an architectural layer
- All variable names are explicit (no shorthand)
- Self-loops and curved arrows are visual-only (engine unchanged)
- Ready for Iteration 4 (simulation) after this completes

---

## Lessons to Remember

1. **Keep ownership clear** - Two layers (Engine, UI), not three
2. **Tools vs Owners** - dagre is a tool the UI uses, not an owner
3. **Variable naming matters** - Explicit names improve maintainability
4. **Refactor into helpers** - Clean separation (renderSelfLoop, renderCurvedArrow, renderStraightArrow)
5. **Test incrementally** - Each phase builds on previous, verify as you go
6. **Configuration at top** - Easy to tune without changing logic
7. **Pure functions FTW** - computeLayout is testable because it's pure

---

**Next Step**: Begin Phase 1 - Install dagre and create utils module! 🚀
