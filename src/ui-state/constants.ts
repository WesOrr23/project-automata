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
 * The little black arrow that points at the start state. It's drawn
 * separately from the GraphViz layout (because it has no source node)
 * but five places need to agree on how much horizontal room it takes:
 *
 *   1. StartStateArrow.tsx       — actually renders the line + head
 *   2. AutomatonCanvas.tsx       — translates the inner SVG group
 *                                  leftward so the arrow doesn't clip
 *   3. AutomatonCanvas.tsx       — passes contentReserve.left to the
 *                                  viewport hook so fit-to-content
 *                                  accounts for the arrow
 *   4. ui-state/utils.ts         — sets a phantom node's width in DOT
 *                                  so GraphViz pushes the start state
 *                                  right of its column
 *   5. (nobody else)               imageExport reads the rendered bbox
 *                                  so it picks this up automatically
 *
 * Define the primitives once here; every other site DERIVES from them.
 * Change a single primitive and all five sites stay in sync. */

/** Length of the visible arrow line (px). */
export const START_ARROW_LINE_LENGTH = 50;
/** Gap between the line's tail and the arrowhead's flat base (px) —
 *  matches the breathing whitespace transition arrowheads use. */
export const START_ARROW_HEAD_GAP = 4;
/** Size of the arrowhead triangle (px). Matches the transition-edge
 *  arrowhead size for visual consistency. */
export const START_ARROW_HEAD_SIZE = 8;

/** Total horizontal extent of the start arrow, measured from the
 *  start-state circle's left edge outward. Derived — don't hand-edit. */
export const START_ARROW_VISUAL_WIDTH =
  START_ARROW_LINE_LENGTH + START_ARROW_HEAD_GAP + START_ARROW_HEAD_SIZE;

/** Extra breathing padding so the arrow's left tip never sits flush
 *  against the inner-group's coordinate origin. Used only by the
 *  viewport translate (not by fit math — fit just needs the visual
 *  width to keep the arrow on-screen at fit zoom). */
export const START_ARROW_RESERVE_PADDING = 8;

/** Total reserve for the inner-group translate (px). Wider than the
 *  visual width by RESERVE_PADDING. */
export const START_ARROW_TOTAL_RESERVE =
  START_ARROW_VISUAL_WIDTH + START_ARROW_RESERVE_PADDING;

/** Same visual width in inches (GraphViz works in inches at 72 DPI).
 *  Used for the phantom-node width in DOT. */
export const START_ARROW_VISUAL_WIDTH_INCHES =
  START_ARROW_VISUAL_WIDTH / 72;
