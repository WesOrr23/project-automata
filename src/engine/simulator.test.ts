/**
 * Tests for DFA / NFA simulation engine
 *
 * createSimulation, step, runSimulation, accepts, and getFinalStates all
 * return Result. The expectOk helper unwraps successful results; failure
 * cases assert on the error variant directly.
 */

import { describe, it, expect } from 'vitest';
import {
  createAutomaton,
  addState,
  addTransition,
  addAcceptState,
} from './automaton';
import {
  createSimulation,
  step,
  isFinished,
  isAccepted,
  runSimulation,
  accepts,
  getFinalStates,
  getExecutionTrace,
} from './simulator';
import { epsilonClosure } from './utils';
import type { Result } from './result';
import type { Automaton } from './types';

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`expected ok, got err: ${result.error}`);
  }
  return result.value;
}

// Helper: Create a simple DFA that accepts strings ending in "01"
function createEndsWith01DFA() {
  let dfa = createAutomaton('DFA', new Set(['0', '1']));

  const { automaton: dfa1, stateId: q1 } = addState(dfa);
  const { automaton: dfa2, stateId: q2 } = addState(dfa1);

  dfa = expectOk(addAcceptState(dfa2, q2));

  dfa = expectOk(addTransition(dfa, 0, new Set([q1]), '0'));
  dfa = expectOk(addTransition(dfa, 0, new Set([0]), '1'));
  dfa = expectOk(addTransition(dfa, q1, new Set([q1]), '0'));
  dfa = expectOk(addTransition(dfa, q1, new Set([q2]), '1'));
  dfa = expectOk(addTransition(dfa, q2, new Set([q1]), '0'));
  dfa = expectOk(addTransition(dfa, q2, new Set([0]), '1'));

  return { dfa, q0: 0, q1, q2 };
}

describe('createSimulation', () => {
  it('creates a simulation with initial state', () => {
    const { dfa, q0 } = createEndsWith01DFA();

    const sim = expectOk(createSimulation(dfa, '101'));

    expect(sim.currentStates).toEqual(new Set([q0]));
    expect(sim.remainingInput).toBe('101');
    expect(sim.input).toBe('101');
    expect(sim.steps.length).toBe(1);
    expect(sim.steps[0]).toEqual({
      currentStates: new Set([q0]),
      dyingStateIds: new Set(),
      firedTransitions: [],
      symbolProcessed: null,
      remainingInput: '101',
    });
  });

  it('returns err(automaton-not-runnable-incomplete-dfa) for incomplete DFA', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    const result = createSimulation(dfa, '01');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('automaton-not-runnable-incomplete-dfa');
  });
});

describe('step', () => {
  it('transitions to the correct next state', () => {
    const { dfa, q1 } = createEndsWith01DFA();

    let sim = expectOk(createSimulation(dfa, '01'));
    sim = expectOk(step(sim));

    expect(sim.currentStates).toEqual(new Set([q1]));
    expect(sim.remainingInput).toBe('1');
  });

  it('records step in history', () => {
    const { dfa, q1 } = createEndsWith01DFA();

    let sim = expectOk(createSimulation(dfa, '01'));
    sim = expectOk(step(sim));

    expect(sim.steps.length).toBe(2);
    expect(sim.steps[1]).toEqual({
      currentStates: new Set([q1]),
      dyingStateIds: new Set(),
      firedTransitions: [{ from: 0, to: q1, symbol: '0' }],
      symbolProcessed: '0',
      remainingInput: '1',
    });
  });

  it('returns err(simulation-already-finished) when simulation is finished', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = expectOk(createSimulation(dfa, ''));
    const result = step(sim);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('simulation-already-finished');
  });

  it('returns err(symbol-not-in-alphabet) for symbol not in alphabet', () => {
    const { dfa } = createEndsWith01DFA();

    // Manually create simulation with invalid input (bypass createSimulation)
    const invalidSim = {
      automaton: dfa,
      currentStates: new Set([0]),
      remainingInput: 'a',
      steps: [],
      input: 'a',
    };

    const result = step(invalidSim);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('symbol-not-in-alphabet');
  });
});

describe('isFinished', () => {
  it('returns false when input remains', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(createSimulation(dfa, '01'));
    expect(isFinished(sim)).toBe(false);
  });

  it('returns true when no input remains', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(createSimulation(dfa, ''));
    expect(isFinished(sim)).toBe(true);
  });

  it('returns true after processing all input', () => {
    const { dfa } = createEndsWith01DFA();

    let sim = expectOk(createSimulation(dfa, '0'));
    sim = expectOk(step(sim));

    expect(isFinished(sim)).toBe(true);
  });
});

describe('isAccepted', () => {
  it('returns true when finished in accept state', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '01'));
    expect(isAccepted(sim)).toBe(true);
  });

  it('returns false when finished in non-accept state', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '10'));
    expect(isAccepted(sim)).toBe(false);
  });

  it('returns false when not finished', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(createSimulation(dfa, '01'));
    expect(isAccepted(sim)).toBe(false);
  });
});

describe('runSimulation', () => {
  it('correctly accepts input ending in "01"', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '101'));

    expect(isAccepted(sim)).toBe(true);
    expect(sim.input).toBe('101');
  });

  it('correctly rejects input not ending in "01"', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '110'));
    expect(isAccepted(sim)).toBe(false);
  });

  it('accepts empty string if start state is accept state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    let result: Automaton = expectOk(addAcceptState(dfa, 0));
    result = expectOk(addTransition(result, 0, new Set([0]), '0'));
    result = expectOk(addTransition(result, 0, new Set([0]), '1'));

    const sim = expectOk(runSimulation(result, ''));

    expect(isAccepted(sim)).toBe(true);
  });

  it('rejects empty string if start state is not accept state', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, ''));
    expect(isAccepted(sim)).toBe(false);
  });

  it('records all simulation steps', () => {
    const { dfa, q0, q1, q2 } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '01'));

    // Should have 3 steps: initial + 2 symbols
    expect(sim.steps.length).toBe(3);

    expect(sim.steps[0]).toEqual({
      currentStates: new Set([q0]),
      dyingStateIds: new Set(),
      firedTransitions: [],
      symbolProcessed: null,
      remainingInput: '01',
    });

    expect(sim.steps[1]).toEqual({
      currentStates: new Set([q1]),
      dyingStateIds: new Set(),
      firedTransitions: [{ from: q0, to: q1, symbol: '0' }],
      symbolProcessed: '0',
      remainingInput: '1',
    });

    expect(sim.steps[2]).toEqual({
      currentStates: new Set([q2]),
      dyingStateIds: new Set(),
      firedTransitions: [{ from: q1, to: q2, symbol: '1' }],
      symbolProcessed: '1',
      remainingInput: '',
    });
  });

  it('returns err(symbol-not-in-alphabet) for invalid symbol in input', () => {
    const { dfa } = createEndsWith01DFA();
    const result = runSimulation(dfa, '01a');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('symbol-not-in-alphabet');
  });

  it('handles single character input', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '0'));

    expect(isAccepted(sim)).toBe(false);
    expect(sim.steps.length).toBe(2);
  });

  it('handles long input strings', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '111111101'));
    expect(isAccepted(sim)).toBe(true);
  });
});

describe('accepts', () => {
  it('returns ok(true) for accepted input', () => {
    const { dfa } = createEndsWith01DFA();

    expect(expectOk(accepts(dfa, '01'))).toBe(true);
    expect(expectOk(accepts(dfa, '101'))).toBe(true);
    expect(expectOk(accepts(dfa, '001'))).toBe(true);
  });

  it('returns ok(false) for rejected input', () => {
    const { dfa } = createEndsWith01DFA();

    expect(expectOk(accepts(dfa, '0'))).toBe(false);
    expect(expectOk(accepts(dfa, '1'))).toBe(false);
    expect(expectOk(accepts(dfa, '10'))).toBe(false);
    expect(expectOk(accepts(dfa, '110'))).toBe(false);
  });

  it('correctly handles edge cases', () => {
    const { dfa } = createEndsWith01DFA();

    expect(expectOk(accepts(dfa, ''))).toBe(false);
    expect(expectOk(accepts(dfa, '0101'))).toBe(true);
  });
});

describe('getFinalStates', () => {
  it('returns the final state set after processing input', () => {
    const { dfa, q1, q2, q0 } = createEndsWith01DFA();

    expect(expectOk(getFinalStates(dfa, '0'))).toEqual(new Set([q1]));
    expect(expectOk(getFinalStates(dfa, '01'))).toEqual(new Set([q2]));
    expect(expectOk(getFinalStates(dfa, '1'))).toEqual(new Set([q0]));
  });

  it('returns start state for empty input', () => {
    const { dfa, q0 } = createEndsWith01DFA();
    expect(expectOk(getFinalStates(dfa, ''))).toEqual(new Set([q0]));
  });
});

describe('getExecutionTrace', () => {
  it('generates human-readable trace', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '01'));

    const trace = getExecutionTrace(sim);

    expect(trace).toEqual([
      'Start: q0 | Remaining: "01"',
      'Read \'0\': q0 → q1 | Remaining: "1"',
      'Read \'1\': q1 → q2 | Remaining: ""',
      'Result: ACCEPTED',
    ]);
  });

  it('shows REJECTED for rejected input', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, '10'));

    const trace = getExecutionTrace(sim);

    expect(trace[trace.length - 1]).toBe('Result: REJECTED');
  });

  it('handles empty input', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(runSimulation(dfa, ''));

    const trace = getExecutionTrace(sim);

    expect(trace).toEqual(['Start: q0 | Remaining: ""', 'Result: REJECTED']);
  });

  it('does not show result for incomplete simulation', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = expectOk(createSimulation(dfa, '01'));

    const trace = getExecutionTrace(sim);

    expect(trace.length).toBe(1);
    expect(trace[0]).toBe('Start: q0 | Remaining: "01"');
  });
});

// Integration test: Complex DFA
describe('Complex DFA: divisible by 3 in binary', () => {
  function createDivisibleBy3DFA() {
    let dfa = createAutomaton('DFA', new Set(['0', '1']));

    const { automaton: dfa1, stateId: r1 } = addState(dfa);
    const { automaton: dfa2, stateId: r2 } = addState(dfa1);

    dfa = expectOk(addAcceptState(dfa2, 0));

    dfa = expectOk(addTransition(dfa, 0, new Set([0]), '0'));
    dfa = expectOk(addTransition(dfa, 0, new Set([r1]), '1'));

    dfa = expectOk(addTransition(dfa, r1, new Set([r2]), '0'));
    dfa = expectOk(addTransition(dfa, r1, new Set([0]), '1'));

    dfa = expectOk(addTransition(dfa, r2, new Set([r1]), '0'));
    dfa = expectOk(addTransition(dfa, r2, new Set([r2]), '1'));

    return dfa;
  }

  it('accepts binary numbers divisible by 3', () => {
    const dfa = createDivisibleBy3DFA();

    expect(expectOk(accepts(dfa, '0'))).toBe(true);
    expect(expectOk(accepts(dfa, '11'))).toBe(true);
    expect(expectOk(accepts(dfa, '110'))).toBe(true);
    expect(expectOk(accepts(dfa, '1001'))).toBe(true);
    expect(expectOk(accepts(dfa, '1100'))).toBe(true);
  });

  it('rejects binary numbers not divisible by 3', () => {
    const dfa = createDivisibleBy3DFA();

    expect(expectOk(accepts(dfa, '1'))).toBe(false);
    expect(expectOk(accepts(dfa, '10'))).toBe(false);
    expect(expectOk(accepts(dfa, '100'))).toBe(false);
    expect(expectOk(accepts(dfa, '101'))).toBe(false);
  });
});

describe('epsilonClosure', () => {
  it('returns the input set when there are no ε-transitions', () => {
    const closure = epsilonClosure(new Set([0, 1]), [
      { from: 0, to: new Set([1]), symbol: 'a' },
    ]);
    expect(closure).toEqual(new Set([0, 1]));
  });

  it('follows a single ε-transition', () => {
    const closure = epsilonClosure(new Set([0]), [
      { from: 0, to: new Set([1]), symbol: null },
    ]);
    expect(closure).toEqual(new Set([0, 1]));
  });

  it('follows chained ε-transitions transitively', () => {
    const closure = epsilonClosure(new Set([0]), [
      { from: 0, to: new Set([1]), symbol: null },
      { from: 1, to: new Set([2]), symbol: null },
    ]);
    expect(closure).toEqual(new Set([0, 1, 2]));
  });

  it('handles ε-cycles without infinite-looping', () => {
    const closure = epsilonClosure(new Set([0]), [
      { from: 0, to: new Set([1]), symbol: null },
      { from: 1, to: new Set([0]), symbol: null },
    ]);
    expect(closure).toEqual(new Set([0, 1]));
  });

  it('unions the closures of every seed state', () => {
    const closure = epsilonClosure(new Set([0, 1]), [
      { from: 0, to: new Set([2]), symbol: null },
      { from: 1, to: new Set([3]), symbol: null },
    ]);
    expect(closure).toEqual(new Set([0, 1, 2, 3]));
  });

  it('does not follow non-ε transitions', () => {
    const closure = epsilonClosure(new Set([0]), [
      { from: 0, to: new Set([1]), symbol: 'a' },
    ]);
    expect(closure).toEqual(new Set([0]));
  });
});

describe('NFA simulation', () => {
  function createEndsWith01NFA() {
    let nfa = createAutomaton('NFA', new Set(['0', '1']));
    const { automaton: nfa1, stateId: q1 } = addState(nfa);
    const { automaton: nfa2, stateId: q2 } = addState(nfa1);
    nfa = expectOk(addAcceptState(nfa2, q2));

    nfa = expectOk(addTransition(nfa, 0, new Set([0, q1]), '0'));
    nfa = expectOk(addTransition(nfa, 0, new Set([0]), '1'));
    nfa = expectOk(addTransition(nfa, q1, new Set([q2]), '1'));
    return { nfa, q0: 0, q1, q2 };
  }

  it('starts with the ε-closure of {start}', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    nfa = expectOk(addTransition(n1, 0, new Set([q1]), null));

    const sim = expectOk(createSimulation(nfa, ''));
    expect(sim.currentStates).toEqual(new Set([0, q1]));
  });

  it('follows multiple destinations in parallel', () => {
    const { nfa, q0, q1 } = createEndsWith01NFA();
    let sim = expectOk(createSimulation(nfa, '0'));
    sim = expectOk(step(sim));
    expect(sim.currentStates).toEqual(new Set([q0, q1]));
  });

  it('accepts when any branch reaches an accept state', () => {
    const { nfa } = createEndsWith01NFA();
    expect(expectOk(accepts(nfa, '01'))).toBe(true);
    expect(expectOk(accepts(nfa, '0001'))).toBe(true);
    expect(expectOk(accepts(nfa, '1101'))).toBe(true);
  });

  it('rejects when no branch reaches an accept state', () => {
    const { nfa } = createEndsWith01NFA();
    expect(expectOk(accepts(nfa, ''))).toBe(false);
    expect(expectOk(accepts(nfa, '0'))).toBe(false);
    expect(expectOk(accepts(nfa, '10'))).toBe(false);
    expect(expectOk(accepts(nfa, '100'))).toBe(false);
  });

  it('lets dying branches drop out of the active set', () => {
    const { nfa, q0 } = createEndsWith01NFA();
    let sim = expectOk(createSimulation(nfa, '01'));
    sim = expectOk(step(sim));
    sim = expectOk(step(sim));
    expect(sim.currentStates.has(q0)).toBe(true);
    expect(sim.currentStates.has(2)).toBe(true);
    expect(sim.currentStates.has(1)).toBe(false);
  });

  it('does not mark a state as dying if another branch routes back into it', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    nfa = expectOk(addTransition(n1, 0, new Set([0, q1]), 'a'));

    let sim = expectOk(createSimulation(nfa, 'aa'));
    sim = expectOk(step(sim));
    sim = expectOk(step(sim));
    expect(sim.currentStates).toEqual(new Set([0, q1]));
    expect(sim.steps[2]!.dyingStateIds).toEqual(new Set());
  });

  it('records dying state IDs on the step where a branch died', () => {
    let nfa = createAutomaton('NFA', new Set(['a', 'b']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    const { automaton: n2, stateId: q2 } = addState(n1);
    nfa = expectOk(addTransition(n2, 0, new Set([q1, q2]), 'a'));
    nfa = expectOk(addTransition(nfa, q2, new Set([q2]), 'b'));

    let sim = expectOk(createSimulation(nfa, 'ab'));
    sim = expectOk(step(sim));
    expect(sim.steps[1]!.dyingStateIds).toEqual(new Set());
    sim = expectOk(step(sim));
    expect(sim.steps[2]!.dyingStateIds).toEqual(new Set([q1]));
    expect(sim.currentStates).toEqual(new Set([q2]));
  });

  it('applies ε-closure after a symbol step', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    const { automaton: n2, stateId: q2 } = addState(n1);
    nfa = expectOk(addAcceptState(n2, q2));
    nfa = expectOk(addTransition(nfa, 0, new Set([q1]), 'a'));
    nfa = expectOk(addTransition(nfa, q1, new Set([q2]), null));

    let sim = expectOk(createSimulation(nfa, 'a'));
    sim = expectOk(step(sim));
    expect(sim.currentStates).toEqual(new Set([q1, q2]));
    expect(isAccepted(sim)).toBe(true);
  });

  it('produces a multi-state trace via getExecutionTrace', () => {
    const { nfa } = createEndsWith01NFA();
    const sim = expectOk(runSimulation(nfa, '01'));
    const trace = getExecutionTrace(sim);
    expect(trace.some((line) => line.includes('{q0, q1}'))).toBe(true);
    expect(trace[trace.length - 1]).toBe('Result: ACCEPTED');
  });
});
