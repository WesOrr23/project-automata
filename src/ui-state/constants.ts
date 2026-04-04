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
 * Simulation speed bounds in milliseconds
 * Used by useSimulation hook (for clamping) and SimulationControls (for slider)
 */
export const SIMULATION_SPEED_MIN = 200;
export const SIMULATION_SPEED_MAX = 3000;
export const SIMULATION_SPEED_DEFAULT = 500;
