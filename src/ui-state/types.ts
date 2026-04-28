/**
 * UI State Types
 *
 * This module defines types for visual metadata in the automaton UI layer.
 * These types are separate from the engine layer and focus purely on
 * presentation concerns.
 *
 * Architecture:
 * - Engine owns: Automaton, states (as IDs), transitions, logic
 * - UI owns: StateUI, AutomatonUI, positions, labels, visual properties
 *
 * The two layers communicate via numeric state IDs, which act as foreign keys.
 */

/**
 * UI metadata for a single state
 *
 * This type represents the visual properties of a state in the automaton.
 * It is separate from the engine's state representation and focuses purely
 * on presentation concerns.
 *
 * The `id` field acts as a foreign key, linking this UI metadata to the
 * corresponding state in the engine's Automaton type.
 */
export type StateUI = {
  /** State ID - foreign key to engine state (0, 1, 2, ...) */
  id: number;

  /** Position on the SVG canvas */
  position: { x: number; y: number };

  /** Display label (e.g., "q0", "q1", "start", etc.) */
  label: string;
};

/**
 * UI metadata for a single rendered transition edge.
 *
 * One TransitionUI may represent multiple engine transitions when they
 * share the same `(from, to)` pair — edge consolidation collapses
 * "q0 → q1 on 'a' AND q0 → q1 on 'b'" into one arrow labeled "a, b".
 * The `symbols` array holds every underlying symbol (with `null` for
 * ε-transitions); the rendered label is comma-joined.
 *
 * Contains pre-computed SVG rendering data from GraphViz layout —
 * GraphViz computes the spline, arrowhead position/angle, and label
 * position; TransitionEdge just renders the values.
 */
export type TransitionUI = {
  /** Source state ID */
  fromStateId: number;

  /** Destination state ID */
  toStateId: number;

  /**
   * Every engine-transition symbol consolidated into this edge. `null`
   * represents an ε-transition. Sorted with non-null symbols first
   * (alphabetical), ε last — same convention as the rendered label.
   */
  symbols: ReadonlyArray<string | null>;

  /** SVG path d attribute (cubic bezier spline from GraphViz) */
  pathData: string;

  /** Position of the arrowhead tip */
  arrowheadPosition: { x: number; y: number };

  /** Arrowhead angle in radians (direction the arrow points) */
  arrowheadAngle: number;

  /** GraphViz-computed label position */
  labelPosition: { x: number; y: number };
};

/**
 * Pre-computed rendering data for the start-state arrow.
 *
 * Same shape fields as TransitionUI's spline data — GraphViz computes
 * a phantom edge `_start -> startState` whose spline we render as the
 * visible start arrow. Letting GraphViz route it (instead of drawing
 * it manually at fixed pixel offsets) means OTHER edges' splines
 * actually avoid this lane during routing — fixes the case where
 * e.g. q2→q0 was being routed through the same area we manually drew
 * the start arrow on top of, producing the visual collision in iter-17
 * user tests.
 */
export type StartArrowUI = {
  /** SVG path d attribute (cubic bezier spline from GraphViz) */
  pathData: string;
  /** Position of the arrowhead tip (touches the start state's circle). */
  arrowheadPosition: { x: number; y: number };
  /** Arrowhead angle in radians. */
  arrowheadAngle: number;
  /**
   * Axis-aligned bounding box of the spline control points (in
   * post-transform canvas coords). Lets the canvas widen its
   * fit-to-content reserve so the start arrow always stays on-screen
   * at fit zoom — without us having to re-parse pathData.
   */
  boundingBox: { x: number; y: number; width: number; height: number };
};

/**
 * UI metadata for the entire automaton
 *
 * This type mirrors the Automaton type from the engine layer, but contains
 * only visual/presentation concerns. It uses the same Map-based structure
 * for O(1) lookups by state ID.
 */
export type AutomatonUI = {
  /** Map of state ID to UI metadata */
  states: Map<number, StateUI>;

  /** Pre-computed transition rendering data from GraphViz */
  transitions: TransitionUI[];

  /**
   * Pre-computed start-arrow geometry from GraphViz, or null on the
   * brief layout-debounce frames where no layout is available yet.
   * Always non-null in steady state because the engine guarantees a
   * start state.
   */
  startArrow: StartArrowUI | null;

  /** Bounding box of the entire graph (for canvas sizing) */
  boundingBox: { width: number; height: number };
};

/**
 * Generate default label for a state
 *
 * Creates a label in the format "q{id}" where id is the numeric state ID.
 * This follows the standard convention in automata theory.
 *
 * Note: prefer `computeDisplayLabels` when you have access to the full state
 * set — it produces contiguous sequential labels (q0, q1, q2, ...) regardless
 * of deletions, which is better UX than using raw engine IDs.
 *
 * @param stateId - The numeric ID of the state
 * @returns A label string (e.g., "q0", "q1", "q2")
 */
export function createDefaultLabel(stateId: number): string {
  return `q${stateId}`;
}

/**
 * Compute sequential display labels for a set of state IDs.
 *
 * Engine IDs are stable but may have gaps after deletions (e.g. 0, 3, 7).
 * The UI prefers to show users contiguous labels (q0, q1, q2) sorted by ID.
 * This function detaches display from identity: internal IDs stay stable,
 * but the labels the user sees are always clean.
 *
 * @param states - The Set of engine state IDs
 * @returns Map from engine state ID → display label (e.g. 7 → "q2")
 *
 * @example
 * computeDisplayLabels(new Set([0, 3, 7]))
 *   // Returns Map(0→"q0", 3→"q1", 7→"q2")
 */
export function computeDisplayLabels(states: Set<number>): Map<number, string> {
  const sorted = Array.from(states).sort((a, b) => a - b);
  const labels = new Map<number, string>();
  sorted.forEach((stateId, index) => {
    labels.set(stateId, `q${index}`);
  });
  return labels;
}
