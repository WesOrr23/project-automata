# Iteration 3: Advanced Visualization

**Status**: COMPLETE
**Start Date**: 2026-03-31
**Completion Date**: 2026-04-01
**Branch**: `iteration-3`

---

## Completion Summary

### What Was Achieved

Iteration 3 replaced the dagre layout library with GraphViz (via `@hpcc-js/wasm-graphviz`) for both node positioning AND edge routing. GraphViz computes spline paths that avoid overlaps, eliminating all manual edge geometry code. The result is dramatically simpler rendering code and better visual output for realistic automata.

**Architecture Change**:
- Before: dagre computed node positions only; TransitionEdge manually calculated all edge geometry (3 rendering modes, ~300 lines of trigonometry)
- After: GraphViz computes node positions, edge splines, arrowhead positions, and label positions; TransitionEdge just renders pre-computed SVG data (~75 lines)

**Files Modified**:
- `src/ui-state/types.ts` - Added `TransitionUI` type, added `transitions` and `boundingBox` to `AutomatonUI`
- `src/ui-state/utils.ts` - Complete rewrite: dagre to GraphViz WASM. Now async. Builds DOT string, parses json output.
- `src/ui-state/constants.ts` - Removed `STATE_DIAMETER` (no longer needed for dagre node sizing)
- `src/ui-state/utils.test.ts` - All tests async. Added assertions for transitions array, SVG paths, bounding box.
- `src/components/TransitionEdge.tsx` - Simplified from 311 lines / 3 render modes to 75 lines / 1 render mode
- `src/components/AutomatonCanvas.tsx` - Uses `automatonUI.transitions` array. Removed `isPartOfBidirectionalPair()`. Canvas size from GraphViz bounding box.
- `src/App.tsx` - Added `useState`/`useEffect` for async `computeLayout()`. Shows loading state while WASM initializes.
- `package.json` - Swapped `@dagrejs/dagre` + `@types/dagre` for `@hpcc-js/wasm-graphviz`

### Success Criteria Met
- Automatic layout works for arbitrary DFAs (no manual positioning needed)
- Self-loops render correctly (GraphViz handles natively)
- Bidirectional edges route as distinct curved arrows (GraphViz handles natively)
- All transitions are clearly visible and labeled
- Layout is visually appealing and readable for realistic automata
- No regressions - all 98 tests pass (87 engine + 11 UI)

### Visual Testing Results

Four visual test cases were run:

1. **Many self-loops** (5-state chain, every state self-loops): All self-loops rendered clearly. Minor note: when a node has two self-loops (e.g., q0 with both 'b' and 'c'), they nest correctly but spacing is tight.

2. **Dense bidirectional** (4 states, bidirectional pairs, long-range edges): Edges routed cleanly. Minor note: multiple edges entering the same node can share an entry point (e.g., q1->q0 and q3->q0 conjoined at q0).

3. **Fully connected** (4 states, every state to every other, 16 total edges): Still interpretable but not pretty. Some overlapping edges and non-smooth control points. Acceptable since fully connected graphs are rare in practice.

4. **Realistic DFA** (binary divisible by 3, 3 states): Looked fantastic. Clean layout, clear edge routing, readable labels. This is the representative case for actual usage.

### Known Refinements (Documented, Not Blocking)

These are cosmetic observations, not bugs. All could be addressed via DOT attributes or post-processing in a future polish iteration:

- **Multiple self-loops on same node**: Nest correctly but spacing is tight
- **Edge-to-arrowhead gap**: GraphViz spline ends slightly before arrowhead tip (aesthetic, looks clean)
- **Shared edge endpoints**: Multiple edges entering same node can share an entry point
- **Dense graphs**: Non-smooth control points under extreme edge density (rare in practice)
- **Tuning available**: DOT attributes (`nodesep`, `ranksep`, `headport`, `tailport`, `splines`, `weight`, `minlen`) can adjust layout without code changes

### Architecture Decisions Made

1. **GraphViz over dagre**: GraphViz provides edge routing (splines) that dagre doesn't. This eliminates the entire manual edge geometry system we built in the original Iteration 3 phases.

2. **Async computeLayout**: GraphViz WASM requires async initialization (~1.5MB). Layout function is now `async`, App.tsx uses `useState`/`useEffect` pattern with loading state.

3. **Pre-computed edge data**: All edge geometry (path, arrowhead, label position) computed by GraphViz and stored in `TransitionUI` type. Components are pure renderers of pre-computed data.

4. **DOT as intermediate format**: `automatonToDot()` converts our Automaton to DOT language, GraphViz processes it, `parseGraphvizJson()` converts back. Clean pipeline with clear intermediate format.

5. **Y-axis manual flip**: GraphViz uses bottom-left origin (Y up), SVG uses top-left (Y down). We flip coordinates manually with `CANVAS_PADDING` offset rather than relying on `yInvert` option.

6. **Canvas sizing from bounding box**: `AutomatonUI.boundingBox` comes from GraphViz's computed bounding box plus padding, replacing hardcoded 800x600.

### Key Concepts Introduced

- **WASM in the browser**: GraphViz compiled to WebAssembly, loaded asynchronously
- **useEffect + useState pattern**: React's way of handling async operations (WASM loading, layout computation)
- **DOT language**: GraphViz's text format for describing graphs
- **B-spline control points**: GraphViz edge format parsed into SVG cubic Bezier paths
- **Coordinate system conversion**: GraphViz (Y up) to SVG (Y down)

### Test Summary
- 98 total tests passing (87 engine + 11 UI layout)
- TypeScript compiles with no errors
- Production build succeeds
- All visual test cases verified in browser

### Next Steps
Iteration 4: Simulation + Visual Feedback
- Input panel for test strings
- Step-by-step simulation controls
- Current state highlighting
- Accept/reject result display
- This completes the first working interactive prototype

---

## Original Planning Document

The original ITERATION3_PLAN.md documented a phased approach using dagre with manual edge geometry. That plan was fully implemented (Phases 1-3 with dagre, self-loops, curved arrows), then replaced in a subsequent pass with GraphViz WASM. The completion summary above reflects the final state.

Key phases from the original plan that were implemented then replaced:
- Phase 1: Auto-layout with dagre (replaced by GraphViz)
- Phase 2: Self-loop rendering with manual SVG paths (replaced by GraphViz splines)
- Phase 3: Curved bidirectional arrows with manual geometry (replaced by GraphViz routing)
- Phase 4: Polish and testing (carried forward, visual tests updated)
