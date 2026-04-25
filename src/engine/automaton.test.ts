/**
 * Tests for automaton CRUD operations
 *
 * Fallible operations return Result<Automaton>. Tests unwrap successful
 * results via the small helpers below; failure-case tests assert on the
 * `error` discriminant variant directly.
 */

import { describe, it, expect } from 'vitest';
import {
  createAutomaton,
  addState,
  removeState,
  addTransition,
  addTransitionDestination,
  removeTransitionDestination,
  setStartState,
  addAcceptState,
  removeAcceptState,
  getTransitionsFrom,
  getTransition,
} from './automaton';
import type { Result } from './result';
import type { Automaton } from './types';

/**
 * Test helper: assert a Result is ok and return its value. Throws an
 * AssertionError with the actual error variant on failure so the test
 * report includes the variant name.
 */
function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, got err: ${result.error}`);
  }
  return result.value;
}

describe('createAutomaton', () => {
  it('creates a DFA with initial state 0 and given alphabet', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));

    expect(dfa.type).toBe('DFA');
    expect(dfa.alphabet).toEqual(new Set(['0', '1']));
    expect(dfa.states.size).toBe(1); // Auto-created state 0
    expect(dfa.states.has(0)).toBe(true);
    expect(dfa.transitions.length).toBe(0);
    expect(dfa.startState).toBe(0); // State 0 is the start state
    expect(dfa.acceptStates.size).toBe(0);
    expect(dfa.nextStateId).toBe(1); // Next ID is 1
  });

  it('throws error for empty alphabet', () => {
    // createAutomaton's empty-alphabet check stayed as a throw — it's a
    // programmer-fault contract (the UI never lets it happen), not a
    // user-recoverable error.
    expect(() => createAutomaton('DFA', new Set())).toThrow('Alphabet cannot be empty');
  });
});

describe('addState', () => {
  it('adds a new state with auto-generated ID', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa already has state 0, so next ID is 1
    const { automaton: dfa2, stateId } = addState(dfa);

    expect(stateId).toBe(1); // First added state ID is 1 (0 auto-created)
    expect(dfa2.states.has(0)).toBe(true);
    expect(dfa2.states.has(1)).toBe(true);
    expect(dfa2.states.size).toBe(2);
    expect(dfa2.nextStateId).toBe(2);
  });

  it('auto-increments state IDs', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa already has state 0

    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);
    const { automaton: dfa3, stateId: id3 } = addState(dfa2);

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(id3).toBe(3);
    expect(dfa3.states).toEqual(new Set([0, 1, 2, 3]));
  });

  it('returns a new automaton (immutability)', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa2 } = addState(dfa);

    // Original unchanged
    expect(dfa.states.size).toBe(1); // State 0 auto-created
    expect(dfa.nextStateId).toBe(1);

    // New one changed
    expect(dfa2.states.size).toBe(2);
    expect(dfa2.nextStateId).toBe(2);
  });
});

describe('removeState', () => {
  it('removes a state from the automaton', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0, add state 1
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    const dfa2 = expectOk(removeState(dfa1, id1));

    expect(dfa2.states.has(0)).toBe(true);
    expect(dfa2.states.has(id1)).toBe(false);
    expect(dfa2.states.size).toBe(1);
  });

  it('removes associated transitions', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    let result: Automaton = expectOk(addTransition(dfa2, 0, new Set([id1]), '0'));
    result = expectOk(addTransition(result, id1, new Set([id2]), '1'));

    const final = expectOk(removeState(result, id1));

    // Both transitions involving id1 should be removed
    expect(final.transitions.length).toBe(0);
  });

  it('auto-assigns start state if removed', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    // Remove state 0 (the start state)
    const final = expectOk(removeState(dfa1, 0));

    // Should auto-assign to id1 (first remaining state)
    expect(final.startState).toBe(id1);
  });

  it('returns err(cannot-remove-only-state) when only one state remains', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa only has state 0
    const result = removeState(dfa, 0);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('cannot-remove-only-state');
  });

  it('removes state from accept states if present', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const result = expectOk(addAcceptState(dfa1, id1));

    const final = expectOk(removeState(result, id1));

    expect(final.acceptStates.has(id1)).toBe(false);
  });

  it('returns err(state-not-found) if state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const result = removeState(dfa, 99);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('state-not-found');
  });
});

describe('addTransition', () => {
  it('adds a transition to the automaton', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    const dfa2 = expectOk(addTransition(dfa1, 0, new Set([id1]), '0'));

    expect(dfa2.transitions.length).toBe(1);
    expect(dfa2.transitions[0]).toEqual({
      from: 0,
      to: new Set([id1]),
      symbol: '0',
    });
  });

  it('returns err(state-not-found) if source state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const result = addTransition(dfa1, 99, new Set([id1]), '0');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('state-not-found');
  });

  it('returns err(state-not-found) if destination state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const result = addTransition(dfa, 0, new Set([99]), '0');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('state-not-found');
  });

  it('returns err(symbol-not-in-alphabet) if symbol not in alphabet', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const result = addTransition(dfa1, 0, new Set([id1]), 'a');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('symbol-not-in-alphabet');
  });

  it('returns err(multi-destination-not-allowed-in-dfa) for DFA with multiple destinations', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);
    const result = addTransition(dfa2, 0, new Set([id1, id2]), '0');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('multi-destination-not-allowed-in-dfa');
  });

  it('returns err(epsilon-not-allowed-in-dfa) for DFA with ε-transition', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const result = addTransition(dfa1, 0, new Set([id1]), null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('epsilon-not-allowed-in-dfa');
  });

  it('returns err(transition-already-exists) for duplicate (from, symbol) transition', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    const dfa3 = expectOk(addTransition(dfa2, 0, new Set([id1]), '0'));
    const result = addTransition(dfa3, 0, new Set([id2]), '0');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('transition-already-exists');
  });
});

describe('setStartState', () => {
  it('sets the start state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    const dfa2 = expectOk(setStartState(dfa1, id1));

    expect(dfa2.startState).toBe(id1);
  });

  it('is a no-op (same reference) when target is already the start state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const result = setStartState(dfa, 0);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(dfa); // reference equality
  });

  it('returns err(state-not-found) if state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const result = setStartState(dfa, 99);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('state-not-found');
  });
});

describe('addAcceptState', () => {
  it('marks a state as accepting', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const dfa2 = expectOk(addAcceptState(dfa, 0));

    expect(dfa2.acceptStates.has(0)).toBe(true);
  });

  it('returns err(state-not-found) if state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const result = addAcceptState(dfa, 99);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('state-not-found');
  });

  it('is a no-op (same reference) when state is already an accept state', () => {
    // Previously this was an error; new semantics treat it as idempotent
    // so the toggle pattern in App.tsx becomes simpler and the undoable
    // store sees the same reference and skips the history push.
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const dfa2 = expectOk(addAcceptState(dfa, 0));
    const result = addAcceptState(dfa2, 0);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(dfa2); // reference equality
  });
});

describe('removeAcceptState', () => {
  it('unmarks a state as accepting', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const dfa2 = expectOk(addAcceptState(dfa, 0));

    const dfa3 = expectOk(removeAcceptState(dfa2, 0));

    expect(dfa3.acceptStates.has(0)).toBe(false);
  });

  it('returns err(state-not-found) if state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const result = removeAcceptState(dfa, 99);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('state-not-found');
  });

  it('is a no-op (same reference) if state is not an accept state', () => {
    // Mirror of addAcceptState's idempotent semantics.
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const result = removeAcceptState(dfa, 0);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(dfa);
  });
});

describe('getTransitionsFrom', () => {
  it('returns all transitions from a state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    let result: Automaton = expectOk(addTransition(dfa2, 0, new Set([id1]), '0'));
    result = expectOk(addTransition(result, 0, new Set([id2]), '1'));
    result = expectOk(addTransition(result, id1, new Set([id2]), '0'));

    const transitions = getTransitionsFrom(result, 0);

    expect(transitions.length).toBe(2);
    expect(transitions.every((t) => t.from === 0)).toBe(true);
  });

  it('returns empty array if no transitions', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));

    const transitions = getTransitionsFrom(dfa, 0);

    expect(transitions).toEqual([]);
  });
});

describe('getTransition', () => {
  it('returns transition for specific state and symbol', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const dfa2 = expectOk(addTransition(dfa1, 0, new Set([id1]), '0'));

    const transitions = getTransition(dfa2, 0, '0');

    expect(transitions.length).toBe(1);
    expect(transitions[0]).toEqual({
      from: 0,
      to: new Set([id1]),
      symbol: '0',
    });
  });

  it('returns empty array if no matching transition', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const dfa2 = expectOk(addTransition(dfa1, 0, new Set([id1]), '0'));

    const transitions = getTransition(dfa2, 0, '1');

    expect(transitions).toEqual([]);
  });
});

describe('addTransitionDestination', () => {
  it('creates a new transition record when none exists', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    nfa = expectOk(addTransitionDestination(n1, 0, q1, 'a'));

    expect(nfa.transitions).toHaveLength(1);
    expect(nfa.transitions[0]!.from).toBe(0);
    expect(nfa.transitions[0]!.symbol).toBe('a');
    expect(nfa.transitions[0]!.to).toEqual(new Set([q1]));
  });

  it('unions a new destination into an existing record', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    const { automaton: n2, stateId: q2 } = addState(n1);
    nfa = expectOk(addTransitionDestination(n2, 0, q1, 'a'));
    nfa = expectOk(addTransitionDestination(nfa, 0, q2, 'a'));

    expect(nfa.transitions).toHaveLength(1);
    expect(nfa.transitions[0]!.to).toEqual(new Set([q1, q2]));
  });

  it('is a no-op (same reference) when the destination is already present', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    nfa = expectOk(addTransitionDestination(n1, 0, q1, 'a'));
    const before = nfa;
    nfa = expectOk(addTransitionDestination(nfa, 0, q1, 'a'));
    expect(nfa).toBe(before);
  });

  it('supports ε-transitions in NFA mode', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    nfa = expectOk(addTransitionDestination(n1, 0, q1, null));
    expect(nfa.transitions[0]!.symbol).toBe(null);
  });

  it('returns err(add-destination-not-allowed-in-dfa) in DFA mode', () => {
    const dfa = createAutomaton('DFA', new Set(['a']));
    const { automaton: d1, stateId: q1 } = addState(dfa);
    const result = addTransitionDestination(d1, 0, q1, 'a');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('add-destination-not-allowed-in-dfa');
  });

  it('returns err(state-not-found) when source state does not exist', () => {
    const nfa = createAutomaton('NFA', new Set(['a']));
    const result = addTransitionDestination(nfa, 99, 0, 'a');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('state-not-found');
  });
});

describe('removeTransitionDestination', () => {
  it('removes a destination from a multi-destination transition', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    const { automaton: n2, stateId: q2 } = addState(n1);
    nfa = expectOk(addTransitionDestination(n2, 0, q1, 'a'));
    nfa = expectOk(addTransitionDestination(nfa, 0, q2, 'a'));

    nfa = removeTransitionDestination(nfa, 0, q1, 'a');
    expect(nfa.transitions).toHaveLength(1);
    expect(nfa.transitions[0]!.to).toEqual(new Set([q2]));
  });

  it('drops the entire transition when the last destination is removed', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    nfa = expectOk(addTransitionDestination(n1, 0, q1, 'a'));

    nfa = removeTransitionDestination(nfa, 0, q1, 'a');
    expect(nfa.transitions).toHaveLength(0);
  });

  it('is a no-op when the (from, symbol) pair has no transition', () => {
    const nfa = createAutomaton('NFA', new Set(['a']));
    const result = removeTransitionDestination(nfa, 0, 0, 'a');
    expect(result).toBe(nfa);
  });

  it('is a no-op when the destination is not in the to set', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    const { automaton: n2, stateId: q2 } = addState(n1);
    nfa = expectOk(addTransitionDestination(n2, 0, q1, 'a'));
    const before = nfa;
    nfa = removeTransitionDestination(nfa, 0, q2, 'a');
    expect(nfa).toBe(before);
  });
});
