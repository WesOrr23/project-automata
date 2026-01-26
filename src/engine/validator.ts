/**
 * Automaton validation predicates
 *
 * These functions check semantic properties of automatons:
 * - Is it a valid DFA?
 * - Is it complete (all transitions defined)?
 * - Are there unreachable states?
 * etc.
 *
 * Important: These are EXTERNAL validators
 * Automatons can be INCOMPLETE during construction (that's OK!)
 * These validators check if an automaton is READY for simulation
 */

import type { Automaton } from './types';

/**
 * Check if automaton satisfies DFA properties
 *
 * A valid DFA must:
 * 1. Have no ε-transitions (epsilon transitions)
 * 2. Have exactly ONE transition per (state, symbol) pair
 * 3. Each transition must have exactly ONE destination
 *
 * @param automaton - The automaton to validate
 * @returns true if valid DFA, false otherwise
 *
 * @example
 * if (isDFA(automaton)) {
 *   // Safe to simulate as DFA
 * }
 */
export function isDFA(automaton: Automaton): boolean {
  // Type must be 'DFA'
  if (automaton.type !== 'DFA') {
    return false;
  }

  // Check for ε-transitions (null symbols)
  const hasEpsilonTransitions = automaton.transitions.some((t) => t.symbol === null);
  if (hasEpsilonTransitions) {
    return false;
  }

  // Check that each transition has exactly one destination
  const hasMultipleDestinations = automaton.transitions.some((t) => t.to.size !== 1);
  if (hasMultipleDestinations) {
    return false;
  }

  // Check for determinism: at most one transition per (state, symbol) pair
  // Build a map: "state,symbol" -> count
  const transitionCounts = new Map<string, number>();

  for (const transition of automaton.transitions) {
    const key = `${transition.from},${transition.symbol}`;
    const count = transitionCounts.get(key) || 0;
    transitionCounts.set(key, count + 1);

    // If we see the same (state, symbol) pair twice, it's non-deterministic
    if (count >= 1) {
      return false;
    }
  }

  return true;
}

/**
 * Check if DFA is complete (total function)
 *
 * A complete DFA has a transition for EVERY (state, symbol) pair
 * This means the automaton can process ANY input string
 *
 * @param automaton - The automaton to validate
 * @returns true if complete, false otherwise
 *
 * @example
 * if (isComplete(automaton)) {
 *   // Automaton can process any input
 * }
 */
export function isComplete(automaton: Automaton): boolean {
  // Must be a valid DFA first
  if (!isDFA(automaton)) {
    return false;
  }

  // Check that every state has a transition for every symbol
  for (const state of automaton.states) {
    for (const symbol of automaton.alphabet) {
      // Find transitions from this state on this symbol
      const transitions = automaton.transitions.filter(
        (t) => t.from === state && t.symbol === symbol
      );

      // Must have exactly one transition
      if (transitions.length !== 1) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if automaton has a valid start state
 *
 * With non-nullable startState, this just verifies the start state
 * actually exists in the states set (should always be true for
 * properly constructed automatons)
 *
 * @param automaton - The automaton to validate
 * @returns true if start state exists in states set
 */
export function hasStartState(automaton: Automaton): boolean {
  return automaton.states.has(automaton.startState);
}

/**
 * Check if automaton has at least one accept state
 *
 * @param automaton - The automaton to validate
 * @returns true if at least one accept state exists
 */
export function hasAcceptStates(automaton: Automaton): boolean {
  return automaton.acceptStates.size > 0;
}

/**
 * Check if automaton is ready for simulation
 *
 * An automaton is "runnable" if:
 * 1. It's a DFA (NFA support not yet implemented)
 * 2. It has a valid start state
 * 3. It satisfies DFA properties
 * 4. It's complete (all transitions defined)
 *
 * @param automaton - The automaton to validate
 * @returns true if ready to simulate
 */
export function isRunnable(automaton: Automaton): boolean {
  // Explicit DFA check (NFA simulation not yet supported)
  if (automaton.type !== 'DFA') {
    return false;
  }

  return hasStartState(automaton) && isDFA(automaton) && isComplete(automaton);
}

/**
 * Find all unreachable states (orphaned states)
 *
 * A state is reachable if there's a path from the start state to it
 * Unreachable states are "dead code" - they can never be visited
 *
 * @param automaton - The automaton to analyze
 * @returns Set of unreachable state IDs
 *
 * @example
 * const orphans = getOrphanedStates(automaton);
 * if (orphans.size > 0) {
 *   console.log('Unreachable states:', [...orphans]);
 * }
 */
export function getOrphanedStates(automaton: Automaton): Set<number> {
  if (!hasStartState(automaton)) {
    // If start state is invalid, all states are technically orphaned
    return new Set(automaton.states);
  }

  // BFS (Breadth-First Search) from start state
  const reachable = new Set<number>();
  const queue: number[] = [automaton.startState];
  reachable.add(automaton.startState);

  while (queue.length > 0) {
    const current = queue.shift()!; // We know queue is not empty

    // Find all states reachable from current state
    for (const transition of automaton.transitions) {
      if (transition.from === current) {
        for (const destState of transition.to) {
          if (!reachable.has(destState)) {
            reachable.add(destState);
            queue.push(destState);
          }
        }
      }
    }
  }

  // Orphaned states = all states - reachable states
  const orphaned = new Set<number>();
  for (const state of automaton.states) {
    if (!reachable.has(state)) {
      orphaned.add(state);
    }
  }

  return orphaned;
}

/**
 * Get a detailed validation report
 *
 * @param automaton - The automaton to validate
 * @returns Object with validation results and error messages
 *
 * @example
 * const report = getValidationReport(automaton);
 * if (!report.valid) {
 *   console.log('Errors:', report.errors);
 * }
 */
export function getValidationReport(
  automaton: Automaton
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for start state
  if (!hasStartState(automaton)) {
    errors.push('No start state defined');
  }

  // Check if it's a valid DFA
  if (!isDFA(automaton)) {
    errors.push('Not a valid DFA (check for ε-transitions or non-determinism)');
  }

  // Check completeness
  if (isDFA(automaton) && !isComplete(automaton)) {
    errors.push('DFA is incomplete (missing transitions for some symbols)');
  }

  // Check for accept states
  if (!hasAcceptStates(automaton)) {
    warnings.push('No accept states defined (will reject all inputs)');
  }

  // Check for orphaned states
  const orphaned = getOrphanedStates(automaton);
  if (orphaned.size > 0) {
    warnings.push(`Unreachable states: ${[...orphaned].join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
