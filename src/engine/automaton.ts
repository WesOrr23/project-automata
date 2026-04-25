/**
 * Automaton CRUD operations
 *
 * All functions are PURE:
 * - They return NEW automaton objects
 * - They never mutate the input automaton
 * - They enforce structural invariants (valid references, etc.)
 *
 * Error handling: fallible operations return `Result<Automaton>` rather
 * than throwing. Callers branch on `result.ok`. The only remaining throw
 * is `createAutomaton`'s empty-alphabet check — that's a programmer-fault
 * contract (UI never lets it happen) and surfacing it as a user-facing
 * error would obscure the real bug.
 *
 * No-op semantics: when an operation has no effect on the automaton
 * (e.g. marking a state that's already an accept state), the function
 * returns `ok(automaton)` with the SAME reference. The undoable-store
 * uses reference equality to short-circuit history pushes, so preserving
 * the reference matters.
 *
 * State IDs: Auto-incremented integers (0, 1, 2, ...)
 * - Engine owns IDs, UI layer owns labels
 * - No duplicate IDs possible (auto-generated)
 */

import type { Automaton, Transition } from './types';
import { type Result, ok, err } from './result';

/**
 * Create a new empty automaton
 *
 * @param type - 'DFA' or 'NFA'
 * @param alphabet - Set of input symbols (e.g., new Set(['0', '1']))
 * @returns A new automaton with a singular initial state and no transitions
 *
 * @throws Error if the alphabet is empty. This is a programmer-fault
 *         contract (the UI gates construction so it never happens), not
 *         a user-recoverable error — keeping it as a throw makes misuse
 *         loud at the call site rather than burying it behind a Result
 *         that callers might forget to check.
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
 * Always succeeds — no Result wrapper needed. Returns the new automaton
 * along with the freshly-generated state ID so the caller knows what to
 * reference.
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
 * @returns ok(newAutomaton) on success;
 *          err('state-not-found') if the state doesn't exist;
 *          err('cannot-remove-only-state') if removal would leave no states.
 */
export function removeState(
  automaton: Automaton,
  stateId: number
): Result<Automaton> {
  if (!automaton.states.has(stateId)) {
    return err('state-not-found');
  }

  // Prevent deleting the last state (automaton must always have at least one state)
  if (automaton.states.size === 1) {
    return err('cannot-remove-only-state');
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

  // Auto-assign start state if we're removing current start state.
  // The size === 1 guard above makes newStates non-empty here, which
  // is why the [0]! assertion is sound — not a bare guess.
  let newStartState = automaton.startState;
  if (automaton.startState === stateId) {
    const remaining = Array.from(newStates).sort((a, b) => a - b);
    newStartState = remaining[0]!;
  }

  return ok({
    ...automaton,
    states: newStates,
    acceptStates: newAcceptStates,
    transitions: newTransitions,
    startState: newStartState,
  });
}

/**
 * Add a transition to the automaton.
 *
 * @returns ok(newAutomaton) on success; on failure, one of:
 *   - 'state-not-found' (source or any destination missing)
 *   - 'symbol-not-in-alphabet' (and not ε)
 *   - 'multi-destination-not-allowed-in-dfa' (DFA + |to| ≠ 1)
 *   - 'epsilon-not-allowed-in-dfa' (DFA + symbol === null)
 *   - 'transition-already-exists' (duplicate (from, symbol) pair)
 */
export function addTransition(
  automaton: Automaton,
  from: number,
  to: Set<number>,
  symbol: string | null
): Result<Automaton> {
  // Validate source state exists
  if (!automaton.states.has(from)) {
    return err('state-not-found');
  }

  // Validate all destination states exist
  for (const destState of to) {
    if (!automaton.states.has(destState)) {
      return err('state-not-found');
    }
  }

  // Validate symbol (must be in alphabet or null for ε-transition)
  if (symbol !== null && !automaton.alphabet.has(symbol)) {
    return err('symbol-not-in-alphabet');
  }

  // For DFA, ensure exactly one destination
  if (automaton.type === 'DFA' && to.size !== 1) {
    return err('multi-destination-not-allowed-in-dfa');
  }

  // For DFA, ε-transitions are not allowed
  if (automaton.type === 'DFA' && symbol === null) {
    return err('epsilon-not-allowed-in-dfa');
  }

  // Check for existing transition with same (from, symbol) - prevents invalid structure.
  const existingTransition = automaton.transitions.find(
    (t) => t.from === from && t.symbol === symbol
  );
  if (existingTransition) {
    return err('transition-already-exists');
  }

  // Create new transition
  const newTransition: Transition = {
    from,
    to,
    symbol,
  };

  return ok({
    ...automaton,
    transitions: [...automaton.transitions, newTransition],
  });
}

/**
 * Add a destination to a (from, symbol) pair without replacing existing
 * destinations — this is the NFA-friendly counterpart to addTransition.
 *
 * If a transition record for (from, symbol) already exists, the new
 * destination is unioned into its `to` set. If not, a fresh transition
 * record with a single-element destination set is created.
 *
 * Used by the editor when in NFA mode: typing a symbol that already has
 * a transition from the same source adds a parallel branch instead of
 * triggering an "overwrite" warning.
 *
 * @returns ok(automaton) — same reference — when the destination is
 *          already present (no-op).
 *          err('add-destination-not-allowed-in-dfa') in DFA mode.
 *          err('state-not-found') if source/destination is missing.
 *          err('symbol-not-in-alphabet') if symbol isn't in alphabet (and not ε).
 */
export function addTransitionDestination(
  automaton: Automaton,
  from: number,
  destination: number,
  symbol: string | null
): Result<Automaton> {
  if (automaton.type === 'DFA') {
    return err('add-destination-not-allowed-in-dfa');
  }
  if (!automaton.states.has(from)) {
    return err('state-not-found');
  }
  if (!automaton.states.has(destination)) {
    return err('state-not-found');
  }
  if (symbol !== null && !automaton.alphabet.has(symbol)) {
    return err('symbol-not-in-alphabet');
  }

  const existingIndex = automaton.transitions.findIndex(
    (transition) => transition.from === from && transition.symbol === symbol
  );

  if (existingIndex === -1) {
    return ok({
      ...automaton,
      transitions: [
        ...automaton.transitions,
        { from, to: new Set([destination]), symbol },
      ],
    });
  }

  // Union into existing record. Skip the rebuild when the destination is
  // already present so callers don't get a new automaton reference for a
  // no-op edit (the undoable-store relies on reference equality to skip
  // history pushes).
  const existing = automaton.transitions[existingIndex]!;
  if (existing.to.has(destination)) {
    return ok(automaton);
  }
  const newTo = new Set(existing.to);
  newTo.add(destination);
  const newTransitions = [...automaton.transitions];
  newTransitions[existingIndex] = { from, to: newTo, symbol };
  return ok({ ...automaton, transitions: newTransitions });
}

/**
 * Remove a single destination from a (from, symbol) transition. If the
 * transition's `to` set becomes empty, the entire transition record is
 * dropped — there's no meaningful "transition with no destinations."
 *
 * Inverse of addTransitionDestination. No-op (returns the same
 * automaton reference) if the (from, symbol) transition doesn't exist
 * or doesn't include the given destination — pure transformation, no
 * Result wrapper needed.
 */
export function removeTransitionDestination(
  automaton: Automaton,
  from: number,
  destination: number,
  symbol: string | null
): Automaton {
  const existingIndex = automaton.transitions.findIndex(
    (transition) => transition.from === from && transition.symbol === symbol
  );
  if (existingIndex === -1) return automaton;

  const existing = automaton.transitions[existingIndex]!;
  if (!existing.to.has(destination)) return automaton;

  const newTo = new Set(existing.to);
  newTo.delete(destination);

  if (newTo.size === 0) {
    return {
      ...automaton,
      transitions: automaton.transitions.filter((_, i) => i !== existingIndex),
    };
  }

  const newTransitions = [...automaton.transitions];
  newTransitions[existingIndex] = { from, to: newTo, symbol };
  return { ...automaton, transitions: newTransitions };
}

/**
 * Remove a specific transition from the automaton. Pure no-op if the
 * matching transition doesn't exist (no Result needed — there's nothing
 * to fail on).
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
 * Set the start state of the automaton.
 *
 * @returns ok(newAutomaton) on success;
 *          ok(automaton) (same reference) if the state is already the start;
 *          err('state-not-found') if the state doesn't exist.
 */
export function setStartState(
  automaton: Automaton,
  stateId: number
): Result<Automaton> {
  if (!automaton.states.has(stateId)) {
    return err('state-not-found');
  }

  // No-op short-circuit: same start state, same reference.
  if (automaton.startState === stateId) {
    return ok(automaton);
  }

  return ok({
    ...automaton,
    startState: stateId,
  });
}

/**
 * Mark a state as an accept state.
 *
 * @returns ok(automaton) (same reference) if the state is already an
 *          accept state — no-op rather than an error, since "make this
 *          state accept" is idempotent from the user's perspective.
 *          err('state-not-found') if the state doesn't exist.
 */
export function addAcceptState(
  automaton: Automaton,
  stateId: number
): Result<Automaton> {
  if (!automaton.states.has(stateId)) {
    return err('state-not-found');
  }

  // No-op short-circuit: idempotent from the user's perspective, and we
  // want to preserve reference equality so the undoable store doesn't
  // push a redundant history entry.
  if (automaton.acceptStates.has(stateId)) {
    return ok(automaton);
  }

  return ok({
    ...automaton,
    acceptStates: new Set([...automaton.acceptStates, stateId]),
  });
}

/**
 * Unmark a state as an accept state.
 *
 * @returns ok(automaton) (same reference) if the state isn't currently
 *          an accept state — idempotent removal mirrors idempotent add.
 *          err('state-not-found') if the state doesn't exist.
 */
export function removeAcceptState(
  automaton: Automaton,
  stateId: number
): Result<Automaton> {
  if (!automaton.states.has(stateId)) {
    return err('state-not-found');
  }

  if (!automaton.acceptStates.has(stateId)) {
    return ok(automaton);
  }

  const newAcceptStates = new Set(automaton.acceptStates);
  newAcceptStates.delete(stateId);

  return ok({
    ...automaton,
    acceptStates: newAcceptStates,
  });
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
