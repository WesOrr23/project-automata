/**
 * Tests for DFA simulation engine
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
  getFinalState,
  getExecutionTrace,
} from './simulator';

// Helper: Create a simple DFA that accepts strings ending in "01"
function createEndsWith01DFA() {
  let dfa = createAutomaton('DFA', new Set(['0', '1']));
  // dfa has state 0 (start state)

  // Add more states
  const { automaton: dfa1, stateId: q1 } = addState(dfa); // Last char was 0
  const { automaton: dfa2, stateId: q2 } = addState(dfa1); // Last two chars were 01 (accept)

  // Accept state
  dfa = addAcceptState(dfa2, q2);

  // Transitions
  // From q0 (state 0)
  dfa = addTransition(dfa, 0, new Set([q1]), '0'); // See 0 → go to q1
  dfa = addTransition(dfa, 0, new Set([0]), '1'); // See 1 → stay in q0

  // From q1
  dfa = addTransition(dfa, q1, new Set([q1]), '0'); // See 0 → stay in q1
  dfa = addTransition(dfa, q1, new Set([q2]), '1'); // See 1 → go to q2 (accept!)

  // From q2
  dfa = addTransition(dfa, q2, new Set([q1]), '0'); // See 0 → go to q1
  dfa = addTransition(dfa, q2, new Set([0]), '1'); // See 1 → go to q0

  return { dfa, q0: 0, q1, q2 };
}

describe('createSimulation', () => {
  it('creates a simulation with initial state', () => {
    const { dfa, q0 } = createEndsWith01DFA();

    const sim = createSimulation(dfa, '101');

    expect(sim.currentStates).toEqual(new Set([q0]));
    expect(sim.remainingInput).toBe('101');
    expect(sim.input).toBe('101');
    expect(sim.steps.length).toBe(1);
    expect(sim.steps[0]).toEqual({
      currentState: q0,
      symbolProcessed: null,
      remainingInput: '101',
    });
  });

  it('throws error for non-runnable automaton', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 but is incomplete (no transitions)

    expect(() => createSimulation(dfa, '01')).toThrow('Automaton is not runnable');
  });

  it('throws error for NFA', () => {
    const nfa = createAutomaton('NFA', new Set(['0', '1']));

    expect(() => createSimulation(nfa, '01')).toThrow(
      'NFA simulation not yet supported'
    );
  });
});

describe('step', () => {
  it('transitions to the correct next state', () => {
    const { dfa, q1 } = createEndsWith01DFA();

    let sim = createSimulation(dfa, '01');
    sim = step(sim);

    expect(sim.currentStates).toEqual(new Set([q1]));
    expect(sim.remainingInput).toBe('1');
  });

  it('records step in history', () => {
    const { dfa, q1 } = createEndsWith01DFA();

    let sim = createSimulation(dfa, '01');
    sim = step(sim);

    expect(sim.steps.length).toBe(2);
    expect(sim.steps[1]).toEqual({
      currentState: q1,
      symbolProcessed: '0',
      remainingInput: '1',
    });
  });

  it('throws error when simulation is finished', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = createSimulation(dfa, '');

    expect(() => step(sim)).toThrow('Simulation is already finished');
  });

  it('throws error for symbol not in alphabet', () => {
    const { dfa } = createEndsWith01DFA();

    // Manually create simulation with invalid input (bypass createSimulation)
    const invalidSim = {
      automaton: dfa,
      currentStates: new Set([0]),
      remainingInput: 'a',
      steps: [],
      input: 'a',
    };

    expect(() => step(invalidSim)).toThrow(
      "Symbol 'a' is not in the alphabet"
    );
  });
});

describe('isFinished', () => {
  it('returns false when input remains', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = createSimulation(dfa, '01');

    expect(isFinished(sim)).toBe(false);
  });

  it('returns true when no input remains', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = createSimulation(dfa, '');

    expect(isFinished(sim)).toBe(true);
  });

  it('returns true after processing all input', () => {
    const { dfa } = createEndsWith01DFA();

    let sim = createSimulation(dfa, '0');
    sim = step(sim);

    expect(isFinished(sim)).toBe(true);
  });
});

describe('isAccepted', () => {
  it('returns true when finished in accept state', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = runSimulation(dfa, '01');

    expect(isAccepted(sim)).toBe(true);
  });

  it('returns false when finished in non-accept state', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = runSimulation(dfa, '10');

    expect(isAccepted(sim)).toBe(false);
  });

  it('returns false when not finished', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = createSimulation(dfa, '01');
    // Not stepped yet, still has input

    expect(isAccepted(sim)).toBe(false);
  });
});

describe('runSimulation', () => {
  it('correctly accepts input ending in "01"', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = runSimulation(dfa, '101');

    expect(isAccepted(sim)).toBe(true);
    expect(sim.input).toBe('101');
  });

  it('correctly rejects input not ending in "01"', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = runSimulation(dfa, '110');

    expect(isAccepted(sim)).toBe(false);
  });

  it('accepts empty string if start state is accept state', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 as start
    let result = addAcceptState(dfa, 0); // Start is also accept
    result = addTransition(result, 0, new Set([0]), '0');
    result = addTransition(result, 0, new Set([0]), '1');

    const sim = runSimulation(result, '');

    expect(isAccepted(sim)).toBe(true);
  });

  it('rejects empty string if start state is not accept state', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = runSimulation(dfa, '');

    expect(isAccepted(sim)).toBe(false);
  });

  it('records all simulation steps', () => {
    const { dfa, q0, q1, q2 } = createEndsWith01DFA();

    const sim = runSimulation(dfa, '01');

    // Should have 3 steps: initial + 2 symbols
    expect(sim.steps.length).toBe(3);

    // Step 0: Initial state
    expect(sim.steps[0]).toEqual({
      currentState: q0,
      symbolProcessed: null,
      remainingInput: '01',
    });

    // Step 1: After processing '0'
    expect(sim.steps[1]).toEqual({
      currentState: q1,
      symbolProcessed: '0',
      remainingInput: '1',
    });

    // Step 2: After processing '1'
    expect(sim.steps[2]).toEqual({
      currentState: q2,
      symbolProcessed: '1',
      remainingInput: '',
    });
  });

  it('throws error for invalid symbol in input', () => {
    const { dfa } = createEndsWith01DFA();

    expect(() => runSimulation(dfa, '01a')).toThrow(
      "Symbol 'a' is not in the alphabet"
    );
  });

  it('handles single character input', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = runSimulation(dfa, '0');

    expect(isAccepted(sim)).toBe(false); // Doesn't end in "01"
    expect(sim.steps.length).toBe(2); // Initial + 1 symbol
  });

  it('handles long input strings', () => {
    const { dfa } = createEndsWith01DFA();

    const sim = runSimulation(dfa, '111111101');

    expect(isAccepted(sim)).toBe(true);
  });
});

describe('accepts', () => {
  it('returns true for accepted input', () => {
    const { dfa } = createEndsWith01DFA();

    expect(accepts(dfa, '01')).toBe(true);
    expect(accepts(dfa, '101')).toBe(true);
    expect(accepts(dfa, '001')).toBe(true);
  });

  it('returns false for rejected input', () => {
    const { dfa } = createEndsWith01DFA();

    expect(accepts(dfa, '0')).toBe(false);
    expect(accepts(dfa, '1')).toBe(false);
    expect(accepts(dfa, '10')).toBe(false);
    expect(accepts(dfa, '110')).toBe(false);
  });

  it('correctly handles edge cases', () => {
    const { dfa } = createEndsWith01DFA();

    expect(accepts(dfa, '')).toBe(false); // Empty string
    expect(accepts(dfa, '0101')).toBe(true); // Multiple occurrences
  });
});

describe('getFinalState', () => {
  it('returns the final state after processing input', () => {
    const { dfa, q1, q2, q0 } = createEndsWith01DFA();

    expect(getFinalState(dfa, '0')).toBe(q1);
    expect(getFinalState(dfa, '01')).toBe(q2);
    expect(getFinalState(dfa, '1')).toBe(q0);
  });

  it('returns start state for empty input', () => {
    const { dfa, q0 } = createEndsWith01DFA();

    expect(getFinalState(dfa, '')).toBe(q0);
  });
});

describe('getExecutionTrace', () => {
  it('generates human-readable trace', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = runSimulation(dfa, '01');

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
    const sim = runSimulation(dfa, '10');

    const trace = getExecutionTrace(sim);

    expect(trace[trace.length - 1]).toBe('Result: REJECTED');
  });

  it('handles empty input', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = runSimulation(dfa, '');

    const trace = getExecutionTrace(sim);

    expect(trace).toEqual(['Start: q0 | Remaining: ""', 'Result: REJECTED']);
  });

  it('does not show result for incomplete simulation', () => {
    const { dfa } = createEndsWith01DFA();
    const sim = createSimulation(dfa, '01');
    // Not stepped - still has input

    const trace = getExecutionTrace(sim);

    // Should not have Result line
    expect(trace.length).toBe(1);
    expect(trace[0]).toBe('Start: q0 | Remaining: "01"');
  });
});

// Integration test: Complex DFA
describe('Complex DFA: divisible by 3 in binary', () => {
  // Create DFA that accepts binary numbers divisible by 3
  function createDivisibleBy3DFA() {
    let dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 (r0 = remainder 0, divisible by 3)

    // States represent remainder when divided by 3
    const { automaton: dfa1, stateId: r1 } = addState(dfa); // Remainder 1
    const { automaton: dfa2, stateId: r2 } = addState(dfa1); // Remainder 2

    dfa = addAcceptState(dfa2, 0); // Divisible by 3 (r0 = state 0)

    // Transition formula: new_remainder = (old_remainder * 2 + bit) % 3
    // From r0 (state 0)
    dfa = addTransition(dfa, 0, new Set([0]), '0'); // (0*2+0)%3 = 0
    dfa = addTransition(dfa, 0, new Set([r1]), '1'); // (0*2+1)%3 = 1

    // From r1
    dfa = addTransition(dfa, r1, new Set([r2]), '0'); // (1*2+0)%3 = 2
    dfa = addTransition(dfa, r1, new Set([0]), '1'); // (1*2+1)%3 = 0

    // From r2
    dfa = addTransition(dfa, r2, new Set([r1]), '0'); // (2*2+0)%3 = 1
    dfa = addTransition(dfa, r2, new Set([r2]), '1'); // (2*2+1)%3 = 2

    return dfa;
  }

  it('accepts binary numbers divisible by 3', () => {
    const dfa = createDivisibleBy3DFA();

    // 0 (decimal 0) → divisible by 3
    expect(accepts(dfa, '0')).toBe(true);

    // 11 (decimal 3) → divisible by 3
    expect(accepts(dfa, '11')).toBe(true);

    // 110 (decimal 6) → divisible by 3
    expect(accepts(dfa, '110')).toBe(true);

    // 1001 (decimal 9) → divisible by 3
    expect(accepts(dfa, '1001')).toBe(true);

    // 1100 (decimal 12) → divisible by 3
    expect(accepts(dfa, '1100')).toBe(true);
  });

  it('rejects binary numbers not divisible by 3', () => {
    const dfa = createDivisibleBy3DFA();

    // 1 (decimal 1) → not divisible
    expect(accepts(dfa, '1')).toBe(false);

    // 10 (decimal 2) → not divisible
    expect(accepts(dfa, '10')).toBe(false);

    // 100 (decimal 4) → not divisible
    expect(accepts(dfa, '100')).toBe(false);

    // 101 (decimal 5) → not divisible
    expect(accepts(dfa, '101')).toBe(false);
  });
});
