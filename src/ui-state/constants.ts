/**
 * UI Constants
 *
 * Shared visual constants used across UI components.
 * Single source of truth to prevent desync between rendering and layout.
 */

/**
 * Radius of state circles in pixels
 * Used for rendering state nodes and calculating arrow positions
 */
export const STATE_RADIUS = 30;

/**
 * Simulation speed bounds in milliseconds. Two-preset toggle (Slow/Fast)
 * uses these as its endpoints; the user-test feedback was that
 * Slow=3000ms felt molasses and Fast=200ms felt jittery, so the range
 * was tightened. Eventually a settings menu will expose a finer
 * control; until then these are the two values the toggle emits.
 */
export const SIMULATION_SPEED_MIN = 350;
export const SIMULATION_SPEED_MAX = 1400;
export const SIMULATION_SPEED_DEFAULT = SIMULATION_SPEED_MIN;

/* ─── Start-state arrow ─────────────────────────────────────────────
 *
 * The start arrow is now a GraphViz-routed spline (see automatonToDot
 * + parseGraphvizJson in ui-state/utils.ts). Two constants suffice:
 *
 *   - HEAD_SIZE: arrowhead triangle dimensions used at render time.
 *     Matches TransitionEdge's arrowhead so the visuals are uniform.
 *   - PHANTOM_NODE_WIDTH_INCHES: how wide the invisible source node
 *     is when emitted to DOT. Doesn't have to match any pixel value
 *     — GraphViz routes the actual spline inside whatever area it
 *     allocates around the phantom. Slightly larger than a default
 *     point so the start-arrow lane is unambiguously a "real" lane
 *     other edges have to route around.
 *
 * Earlier iterations had five constants here for line length, head
 * gap, total reserve, etc. — all became dead the moment GraphViz
 * started owning the arrow's geometry. */

/** Size of the arrowhead triangle (px). Matches TransitionEdge's
 *  ARROWHEAD_SIZE for visual consistency across the canvas. */
export const START_ARROW_HEAD_SIZE = 8;

/** Width of the invisible phantom node in GraphViz inches (72 DPI).
 *  GraphViz reserves this much horizontal space to the left of the
 *  start state — the actual visible arrow's length is whatever
 *  spline GraphViz routes into that space. Larger values give the
 *  arrow more visual breathing room. */
export const PHANTOM_NODE_WIDTH_INCHES = 0.65;
