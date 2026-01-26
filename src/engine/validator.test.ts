/**
 * Tests for automaton validation predicates
 */

import { describe, it, expect } from 'vitest';
import {
  createAutomaton,
  addState,
  addTransition,
  setStartState,
  addAcceptState,
} from './automaton';
import {
  isDFA,
  isComplete,
  hasStartState,
  hasAcceptStates,
  isRunnable,
  getOrphanedStates,
  getValidationReport,
} from './validator';

describe('isDFA', () => {
  it('returns true for valid DFA', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const dfa2 = addTransition(dfa1, 0, new Set([id1]), '0');

    expect(isDFA(dfa2)).toBe(true);
  });

  it('returns false for NFA type', () => {
    const nfa = createAutomaton('NFA', new Set(['0', '1']));

    expect(isDFA(nfa)).toBe(false);
  });

  it('returns false if multiple transitions for same (state, symbol)', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    // Manually add duplicate transitions (bypassing addTransition validation)
    const manualDfa = {
      ...dfa2,
      transitions: [
        { from: 0, to: new Set([id1]), symbol: '0' },
        { from: 0, to: new Set([id2]), symbol: '0' }, // Duplicate (state, symbol)
      ],
    };

    expect(isDFA(manualDfa)).toBe(false);
  });

  it('returns false for transitions with multiple destinations', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    // Manually create invalid transition
    const manualDfa = {
      ...dfa2,
      transitions: [{ from: 0, to: new Set([id1, id2]), symbol: '0' }],
    };

    expect(isDFA(manualDfa)).toBe(false);
  });
});

describe('isComplete', () => {
  it('returns true for complete DFA', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    // Every state has transition for every symbol
    let result = addTransition(dfa1, 0, new Set([0]), '0');
    result = addTransition(result, 0, new Set([id1]), '1');
    result = addTransition(result, id1, new Set([0]), '0');
    result = addTransition(result, id1, new Set([id1]), '1');

    expect(isComplete(result)).toBe(true);
  });

  it('returns false for incomplete DFA (missing transitions)', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    // state 0 only has transition for '0', missing '1'
    const dfa2 = addTransition(dfa1, 0, new Set([id1]), '0');

    expect(isComplete(dfa2)).toBe(false);
  });

  it('returns false for NFA', () => {
    const nfa = createAutomaton('NFA', new Set(['0', '1']));
    // nfa has state 0

    expect(isComplete(nfa)).toBe(false);
  });
});

describe('hasStartState', () => {
  it('returns true when start state is valid', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state by default

    expect(hasStartState(dfa)).toBe(true);
  });

  it('returns true when start state is changed to another valid state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const dfa2 = setStartState(dfa1, id1);

    expect(hasStartState(dfa2)).toBe(true);
  });

  it('returns false when start state reference is invalid (manually corrupted)', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));

    // Manually create an automaton with invalid start state reference
    const corruptedDfa = {
      ...dfa,
      startState: 999, // Points to non-existent state
    };

    expect(hasStartState(corruptedDfa)).toBe(false);
  });
});

describe('hasAcceptStates', () => {
  it('returns true when accept states exist', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const dfa2 = addAcceptState(dfa, 0);

    expect(hasAcceptStates(dfa2)).toBe(true);
  });

  it('returns false when no accept states', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 but no accept states

    expect(hasAcceptStates(dfa)).toBe(false);
  });
});

describe('isRunnable', () => {
  it('returns true for complete, valid DFA with start state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    let result = addTransition(dfa, 0, new Set([0]), '0');
    result = addTransition(result, 0, new Set([0]), '1');

    expect(isRunnable(result)).toBe(true);
  });

  it('returns false for DFA with invalid start state reference', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    let result = addTransition(dfa, 0, new Set([0]), '0');
    result = addTransition(result, 0, new Set([0]), '1');

    // Manually corrupt the start state
    const corruptedDfa = {
      ...result,
      startState: 999, // Invalid reference
    };

    expect(isRunnable(corruptedDfa)).toBe(false);
  });

  it('returns false for incomplete DFA', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    const result = addTransition(dfa, 0, new Set([0]), '0');
    // Missing transition for '1'

    expect(isRunnable(result)).toBe(false);
  });

  it('returns false for NFA type', () => {
    const nfa = createAutomaton('NFA', new Set(['0', '1']));

    expect(isRunnable(nfa)).toBe(false);
  });
});

describe('getOrphanedStates', () => {
  it('returns empty set when all states are reachable', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const result = addTransition(dfa1, 0, new Set([id1]), '0');

    const orphaned = getOrphanedStates(result);

    expect(orphaned.size).toBe(0);
  });

  it('identifies unreachable states', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    let result = addTransition(dfa2, 0, new Set([0]), '0');
    result = addTransition(result, id2, new Set([id2]), '1'); // id2 can't be reached

    const orphaned = getOrphanedStates(result);

    expect(orphaned.size).toBe(2); // id1 and id2 are orphaned
    expect(orphaned.has(id1)).toBe(true);
    expect(orphaned.has(id2)).toBe(true);
  });

  it('returns all states when start state reference is invalid', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0
    const { automaton: dfa1, stateId: id1 } = addState(dfa);

    // Manually corrupt start state to point to non-existent state
    const corruptedDfa = {
      ...dfa1,
      startState: 999, // Invalid reference
    };

    const orphaned = getOrphanedStates(corruptedDfa);

    expect(orphaned.size).toBe(2);
    expect(orphaned.has(0)).toBe(true);
    expect(orphaned.has(id1)).toBe(true);
  });

  it('handles cyclic graphs correctly', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    // Create a cycle: 0 → id1 → 0
    let result = addTransition(dfa2, 0, new Set([id1]), '0');
    result = addTransition(result, id1, new Set([0]), '1');
    // id2 is still unreachable

    const orphaned = getOrphanedStates(result);

    expect(orphaned.size).toBe(1);
    expect(orphaned.has(id2)).toBe(true);
  });
});

describe('getValidationReport', () => {
  it('returns no errors for valid complete DFA', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    let result = addAcceptState(dfa, 0);
    result = addTransition(result, 0, new Set([0]), '0');
    result = addTransition(result, 0, new Set([0]), '1');

    const report = getValidationReport(result);

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it('reports invalid start state reference', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0

    // Manually corrupt start state
    const corruptedDfa = {
      ...dfa,
      startState: 999, // Invalid reference
    };

    const report = getValidationReport(corruptedDfa);

    expect(report.valid).toBe(false);
    expect(report.errors).toContain('No start state defined');
  });

  it('reports incomplete DFA', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    const result = addTransition(dfa, 0, new Set([0]), '0');
    // Missing transition for '1'

    const report = getValidationReport(result);

    expect(report.valid).toBe(false);
    expect(report.errors).toContain(
      'DFA is incomplete (missing transitions for some symbols)'
    );
  });

  it('warns about missing accept states', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    let result = addTransition(dfa, 0, new Set([0]), '0');
    result = addTransition(result, 0, new Set([0]), '1');

    const report = getValidationReport(result);

    expect(report.valid).toBe(true); // Still valid, just warning
    expect(report.warnings).toContain(
      'No accept states defined (will reject all inputs)'
    );
  });

  it('warns about orphaned states', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start state
    const { automaton: dfa1, stateId: id1 } = addState(dfa);
    const { automaton: dfa2, stateId: id2 } = addState(dfa1);

    let result = addTransition(dfa2, 0, new Set([0]), '0');
    result = addTransition(result, 0, new Set([0]), '1');

    const report = getValidationReport(result);

    expect(report.warnings.some((w) => w.includes('Unreachable states'))).toBe(
      true
    );
    expect(report.warnings.some((w) => w.includes(`${id1}`))).toBe(true);
    expect(report.warnings.some((w) => w.includes(`${id2}`))).toBe(true);
  });
});
