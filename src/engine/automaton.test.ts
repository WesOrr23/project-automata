/**
 * Tests for automaton CRUD operations
 */

import { describe, it, expect } from 'vitest';
import {
  createAutomaton,
  addState,
  removeState,
  addTransition,
  setStartState,
  addAcceptState,
  removeAcceptState,
  getTransitionsFrom,
  getTransition,
} from './automaton';

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

    const dfa2 = removeState(dfa1, id1);

    expect(dfa2.states.has(0)).toBe(true);
    expect(dfa2.states.has(id1)).toBe(false);
    expect(dfa2.states.size).toBe(1);
  });

  it('removes associated transitions', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    let result = addTransition(dfa2, 0, new Set([id1]), '0');
    result = addTransition(result, id1, new Set([id2]), '1');

    const final = removeState(result, id1);

    // Both transitions involving id1 should be removed
    expect(final.transitions.length).toBe(0);
  });

  it('auto-assigns start state if removed', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    // Remove state 0 (the start state)
    const final = removeState(dfa1, 0);

    // Should auto-assign to id1 (first remaining state)
    expect(final.startState).toBe(id1);
  });

  it('throws error if trying to remove the last state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa only has state 0

    expect(() => removeState(dfa, 0)).toThrow('Cannot remove the last state');
  });

  it('removes state from accept states if present', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    let result = addAcceptState(dfa1, id1);

    const final = removeState(result, id1);

    expect(final.acceptStates.has(id1)).toBe(false);
  });

  it('throws error if state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));

    expect(() => removeState(dfa, 99)).toThrow('State 99 does not exist');
  });
});

describe('addTransition', () => {
  it('adds a transition to the automaton', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    const dfa2 = addTransition(dfa1, 0, new Set([id1]), '0');

    expect(dfa2.transitions.length).toBe(1);
    expect(dfa2.transitions[0]).toEqual({
      from: 0,
      to: new Set([id1]),
      symbol: '0',
    });
  });

  it('throws error if source state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    expect(() => addTransition(dfa1, 99, new Set([id1]), '0')).toThrow(
      'Source state 99 does not exist'
    );
  });

  it('throws error if destination state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0

    expect(() => addTransition(dfa, 0, new Set([99]), '0')).toThrow(
      'Destination state 99 does not exist'
    );
  });

  it('throws error if symbol not in alphabet', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    expect(() => addTransition(dfa1, 0, new Set([id1]), 'a')).toThrow(
      "Symbol 'a' is not in the alphabet"
    );
  });

  it('throws error for DFA with multiple destinations', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    expect(() => addTransition(dfa2, 0, new Set([id1, id2]), '0')).toThrow(
      'DFA transitions must have exactly one destination state'
    );
  });

  it('throws error for DFA with ε-transition', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    expect(() => addTransition(dfa1, 0, new Set([id1]), null)).toThrow(
      'DFA cannot have ε-transitions'
    );
  });

  it('throws error for duplicate (from, symbol) transition', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    // Add first transition from 0 on '0'
    const dfa3 = addTransition(dfa2, 0, new Set([id1]), '0');

    // Try to add another transition from 0 on '0' (duplicate)
    expect(() => addTransition(dfa3, 0, new Set([id2]), '0')).toThrow(
      "Transition from state 0 on symbol '0' already exists"
    );
  });
});

describe('setStartState', () => {
  it('sets the start state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start, add state 1
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    const dfa2 = setStartState(dfa1, id1);

    expect(dfa2.startState).toBe(id1);
  });

  it('throws error if state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));

    expect(() => setStartState(dfa, 99)).toThrow('State 99 does not exist');
  });
});

describe('addAcceptState', () => {
  it('marks a state as accepting', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0

    const dfa2 = addAcceptState(dfa, 0);

    expect(dfa2.acceptStates.has(0)).toBe(true);
  });

  it('throws error if state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));

    expect(() => addAcceptState(dfa, 99)).toThrow('State 99 does not exist');
  });

  it('throws error if state is already an accept state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const dfa2 = addAcceptState(dfa, 0);

    expect(() => addAcceptState(dfa2, 0)).toThrow(
      'State 0 is already an accept state'
    );
  });
});

describe('removeAcceptState', () => {
  it('unmarks a state as accepting', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const dfa2 = addAcceptState(dfa, 0);

    const dfa3 = removeAcceptState(dfa2, 0);

    expect(dfa3.acceptStates.has(0)).toBe(false);
  });

  it('throws error if state does not exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));

    expect(() => removeAcceptState(dfa, 99)).toThrow(
      'State 99 does not exist'
    );
  });

  it('throws error if state is not an accept state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0, which is not an accept state

    expect(() => removeAcceptState(dfa, 0)).toThrow(
      'State 0 is not an accept state'
    );
  });
});

describe('getTransitionsFrom', () => {
  it('returns all transitions from a state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    let result = addTransition(dfa2, 0, new Set([id1]), '0');
    result = addTransition(result, 0, new Set([id2]), '1');
    result = addTransition(result, id1, new Set([id2]), '0');

    const transitions = getTransitionsFrom(result, 0);

    expect(transitions.length).toBe(2);
    expect(transitions.every((t) => t.from === 0)).toBe(true);
  });

  it('returns empty array if no transitions', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 but no transitions

    const transitions = getTransitionsFrom(dfa, 0);

    expect(transitions).toEqual([]);
  });
});

describe('getTransition', () => {
  it('returns transition for specific state and symbol', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const dfa2 = addTransition(dfa1, 0, new Set([id1]), '0');

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
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const dfa2 = addTransition(dfa1, 0, new Set([id1]), '0');

    const transitions = getTransition(dfa2, 0, '1');

    expect(transitions).toEqual([]);
  });
});
