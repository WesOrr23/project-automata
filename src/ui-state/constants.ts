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
