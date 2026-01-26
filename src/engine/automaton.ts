/**
 * Automaton CRUD operations
 *
 * All functions are PURE:
 * - They return NEW automaton objects
 * - They never mutate the input automaton
 * - They enforce structural invariants (valid references, etc.)
 *
 * Error handling: Functions throw errors for invalid operations
 *
 * State IDs: Auto-incremented integers (0, 1, 2, ...)
 * - Engine owns IDs, UI layer owns labels
 * - No duplicate IDs possible (auto-generated)
 */

import type { Automaton, Transition } from './types';

/**
 * Create a new empty automaton
 *
 * @param type - 'DFA' or 'NFA'
 * @param alphabet - Set of input symbols (e.g., new Set(['0', '1']))
 * @returns A new automaton with a singular initial state and no transitions
 *
 * @example
 * const dfa = createAutomaton('DFA', new Set(['0', '1']));
 */
export function createAutomaton(
  type: 'DFA' | 'NFA',
  alphabet: Set<string>
): Automaton {
  if (alphabet.size === 0) {
    throw new Error('Alphabet cannot be empty');
  }

  // Auto-create state 0 as the start state
  return {
    type,
    states: new Set([0]),
    alphabet,
    transitions: [],
    startState: 0, // State 0 is always the start state
    acceptStates: new Set(),
    nextStateId: 1, // Next ID is 1 (0 already used)
  };
}

/**
 * Add a new state to the automaton
 * State ID is auto-generated (auto-incrementing integer)
 *
 * @param automaton - The automaton to modify
 * @returns Object with new automaton and the generated state ID
 *
 * @example
 * const { automaton: dfa2, stateId } = addState(dfa);
 * console.log('Created state:', stateId); // 0, 1, 2, ...
 */
export function addState(
  automaton: Automaton
): { automaton: Automaton; stateId: number } {
  const stateId = automaton.nextStateId;

  return {
    automaton: {
      ...automaton,
      states: new Set([...automaton.states, stateId]),
      nextStateId: automaton.nextStateId + 1,
    },
    stateId,
  };
}

/**
 * Remove a state from the automaton
 * Also removes all transitions involving this state
 * If removing start state, auto-assigns to first remaining state
 *
 * @param automaton - The automaton to modify
 * @param stateId - ID of the state to remove
 * @returns New automaton with the state removed
 * @throws Error if state doesn't exist
 *
 * @example
 * const dfa2 = removeState(dfa, 0);
 */
export function removeState(
  automaton: Automaton,
  stateId: number
): Automaton {
  if (!automaton.states.has(stateId)) {
    throw new Error(`State ${stateId} does not exist`);
  }

  // Prevent deleting the last state (automaton must always have at least one state)
  if (automaton.states.size === 1) {
    throw new Error('Cannot remove the last state');
  }

  // Remove state from states set
  const newStates = new Set(automaton.states);
  newStates.delete(stateId);

  // Remove state from accept states if present
  const newAcceptStates = new Set(automaton.acceptStates);
  newAcceptStates.delete(stateId);

  // Remove all transitions involving this state
  const newTransitions = automaton.transitions.filter(
    (t) => t.from !== stateId && !t.to.has(stateId)
  );

  // Auto-assign start state if we're removing current start state
  let newStartState = automaton.startState;
  if (automaton.startState === stateId) {
    // Since we already checked that this isn't the last state,
    // there must be at least one remaining state
    const remaining = Array.from(newStates).sort((a, b) => a - b);
    newStartState = remaining[0]!; // First remaining state (always exists)
  }

  return {
    ...automaton,
    states: newStates,
    acceptStates: newAcceptStates,
    transitions: newTransitions,
    startState: newStartState,
  };
}

/**
 * Add a transition to the automaton
 *
 * @param automaton - The automaton to modify
 * @param from - Source state ID
 * @param to - Destination state IDs (Set of numbers)
 *             For DFA: Set with 1 element, e.g., new Set([1])
 *             For NFA: Set with multiple elements, e.g., new Set([1, 2])
 * @param symbol - Input symbol (or null for ε-transition)
 * @returns New automaton with the transition added
 * @throws Error if states don't exist or symbol not in alphabet
 *
 * @example
 * const dfa2 = addTransition(dfa, 0, new Set([1]), '0');
 */
export function addTransition(
  automaton: Automaton,
  from: number,
  to: Set<number>,
  symbol: string | null
): Automaton {
  // Validate source state exists
  if (!automaton.states.has(from)) {
    throw new Error(`Source state ${from} does not exist`);
  }

  // Validate all destination states exist
  for (const destState of to) {
    if (!automaton.states.has(destState)) {
      throw new Error(`Destination state ${destState} does not exist`);
    }
  }

  // Validate symbol (must be in alphabet or null for ε-transition)
  if (symbol !== null && !automaton.alphabet.has(symbol)) {
    throw new Error(`Symbol '${symbol}' is not in the alphabet`);
  }

  // For DFA, ensure exactly one destination
  if (automaton.type === 'DFA' && to.size !== 1) {
    throw new Error('DFA transitions must have exactly one destination state');
  }

  // For DFA, ε-transitions are not allowed
  if (automaton.type === 'DFA' && symbol === null) {
    throw new Error('DFA cannot have ε-transitions (epsilon transitions)');
  }

  // Check for existing transition with same (from, symbol) - prevents invalid structure.
  const existingTransition = automaton.transitions.find(
    (t) => t.from === from && t.symbol === symbol
  );
  if (existingTransition) {
    const symbolDisplay = symbol === null ? 'ε' : `'${symbol}'`;
    throw new Error(
      `Transition from state ${from} on symbol ${symbolDisplay} already exists`
    );
  }

  // Create new transition
  const newTransition: Transition = {
    from,
    to,
    symbol,
  };

  return {
    ...automaton,
    transitions: [...automaton.transitions, newTransition],
  };
}

/**
 * Remove a specific transition from the automaton
 *
 * @param automaton - The automaton to modify
 * @param from - Source state ID
 * @param to - Destination state IDs (Set)
 * @param symbol - Input symbol
 * @returns New automaton with the transition removed
 *
 * @example
 * const dfa2 = removeTransition(dfa, 0, new Set([1]), '0');
 */
export function removeTransition(
  automaton: Automaton,
  from: number,
  to: Set<number>,
  symbol: string | null
): Automaton {
  // Helper: Check if two Sets are equal
  const setsEqual = (a: Set<number>, b: Set<number>): boolean => {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  };

  // Filter out matching transition (keep those that do not match what we are removing).
  const newTransitions = automaton.transitions.filter((t) => {
    if (t.from !== from || t.symbol !== symbol) return true;
    return !setsEqual(t.to, to);
  });

  return {
    ...automaton,
    transitions: newTransitions,
  };
}

/**
 * Set the start state of the automaton
 *
 * @param automaton - The automaton to modify
 * @param stateId - ID of the state to make the start state
 * @returns New automaton with start state updated
 * @throws Error if state doesn't exist
 *
 * @example
 * const dfa2 = setStartState(dfa, 0);
 */
export function setStartState(
  automaton: Automaton,
  stateId: number
): Automaton {
  if (!automaton.states.has(stateId)) {
    throw new Error(`State ${stateId} does not exist`);
  }

  return {
    ...automaton,
    startState: stateId,
  };
}

/**
 * Mark a state as an accept state
 *
 * @param automaton - The automaton to modify
 * @param stateId - ID of the state to mark as accepting
 * @returns New automaton with accept state added
 * @throws Error if state doesn't exist
 *
 * @example
 * const dfa2 = addAcceptState(dfa, 2);
 */
export function addAcceptState(
  automaton: Automaton,
  stateId: number
): Automaton {
  if (!automaton.states.has(stateId)) {
    throw new Error(`State ${stateId} does not exist`);
  }

  if (automaton.acceptStates.has(stateId)) {
    throw new Error(`State ${stateId} is already an accept state`);
  }

  return {
    ...automaton,
    acceptStates: new Set([...automaton.acceptStates, stateId]),
  };
}

/**
 * Unmark a state as an accept state
 *
 * @param automaton - The automaton to modify
 * @param stateId - ID of the state to unmark
 * @returns New automaton with accept state removed
 * @throws Error if state doesn't exist or isn't an accept state
 *
 * @example
 * const dfa2 = removeAcceptState(dfa, 2);
 */
export function removeAcceptState(
  automaton: Automaton,
  stateId: number
): Automaton {
  if (!automaton.states.has(stateId)) {
    throw new Error(`State ${stateId} does not exist`);
  }

  if (!automaton.acceptStates.has(stateId)) {
    throw new Error(`State ${stateId} is not an accept state`);
  }

  const newAcceptStates = new Set(automaton.acceptStates);
  newAcceptStates.delete(stateId);

  return {
    ...automaton,
    acceptStates: newAcceptStates,
  };
}

/**
 * Helper: Get all transitions from a specific state
 *
 * @param automaton - The automaton to query
 * @param stateId - Source state ID
 * @returns Array of transitions from this state
 *
 * @example
 * const transitions = getTransitionsFrom(dfa, 0);
 */
export function getTransitionsFrom(
  automaton: Automaton,
  stateId: number
): Transition[] {
  return automaton.transitions.filter((t) => t.from === stateId);
}

/**
 * Helper: Get the transition from a state on a specific symbol
 * For DFAs, this should return at most one transition
 *
 * @param automaton - The automaton to query
 * @param stateId - Source state ID
 * @param symbol - Input symbol
 * @returns Array of matching transitions (empty if none found)
 *
 * @example
 * const transitions = getTransition(dfa, 0, '0');
 */
export function getTransition(
  automaton: Automaton,
  stateId: number,
  symbol: string
): Transition[] {
  return automaton.transitions.filter(
    (t) => t.from === stateId && t.symbol === symbol
  );
}
