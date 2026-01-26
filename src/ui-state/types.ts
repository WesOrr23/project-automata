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
 * UI metadata for the entire automaton
 *
 * This type mirrors the Automaton type from the engine layer, but contains
 * only visual/presentation concerns. It uses the same Map-based structure
 * for O(1) lookups by state ID.
 */
export type AutomatonUI = {
  /** Map of state ID to UI metadata */
  states: Map<number, StateUI>;
};

/**
 * Generate default label for a state
 *
 * Creates a label in the format "q{id}" where id is the numeric state ID.
 * This follows the standard convention in automata theory.
 *
 * @param stateId - The numeric ID of the state
 * @returns A label string (e.g., "q0", "q1", "q2")
 *
 * @example
 * createDefaultLabel(0) // Returns "q0"
 * createDefaultLabel(5) // Returns "q5"
 */
export function createDefaultLabel(stateId: number): string {
  return `q${stateId}`;
}
