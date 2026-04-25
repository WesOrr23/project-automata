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
  getFinalStates,
  getExecutionTrace,
} from './simulator';
import { epsilonClosure } from './utils';

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
      currentStates: new Set([q0]),
      dyingStateIds: new Set(),
      firedTransitions: [],
      symbolProcessed: null,
      remainingInput: '101',
    });
  });

  it('throws error for incomplete DFA', () => {
    const dfa = createAutomaton('DFA', new Set(['0', '1']));
    // dfa has state 0 but is incomplete (no transitions)

    expect(() => createSimulation(dfa, '01')).toThrow('Automaton is not runnable');
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
      currentStates: new Set([q1]),
      dyingStateIds: new Set(),
      firedTransitions: [{ from: 0, to: q1, symbol: '0' }],
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
      currentStates: new Set([q0]),
      dyingStateIds: new Set(),
      firedTransitions: [],
      symbolProcessed: null,
      remainingInput: '01',
    });

    // Step 1: After processing '0'
    expect(sim.steps[1]).toEqual({
      currentStates: new Set([q1]),
      dyingStateIds: new Set(),
      firedTransitions: [{ from: q0, to: q1, symbol: '0' }],
      symbolProcessed: '0',
      remainingInput: '1',
    });

    // Step 2: After processing '1'
    expect(sim.steps[2]).toEqual({
      currentStates: new Set([q2]),
      dyingStateIds: new Set(),
      firedTransitions: [{ from: q1, to: q2, symbol: '1' }],
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

describe('getFinalStates', () => {
  it('returns the final state set after processing input', () => {
    const { dfa, q1, q2, q0 } = createEndsWith01DFA();

    expect(getFinalStates(dfa, '0')).toEqual(new Set([q1]));
    expect(getFinalStates(dfa, '01')).toEqual(new Set([q2]));
    expect(getFinalStates(dfa, '1')).toEqual(new Set([q0]));
  });

  it('returns start state for empty input', () => {
    const { dfa, q0 } = createEndsWith01DFA();

    expect(getFinalStates(dfa, '')).toEqual(new Set([q0]));
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
    // 0 -ε-> 1 -ε-> 2
    const closure = epsilonClosure(new Set([0]), [
      { from: 0, to: new Set([1]), symbol: null },
      { from: 1, to: new Set([2]), symbol: null },
    ]);
    expect(closure).toEqual(new Set([0, 1, 2]));
  });

  it('handles ε-cycles without infinite-looping', () => {
    // 0 -ε-> 1 -ε-> 0
    const closure = epsilonClosure(new Set([0]), [
      { from: 0, to: new Set([1]), symbol: null },
      { from: 1, to: new Set([0]), symbol: null },
    ]);
    expect(closure).toEqual(new Set([0, 1]));
  });

  it('unions the closures of every seed state', () => {
    // 0 -ε-> 2, 1 -ε-> 3
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
  // Build an NFA that accepts strings ending in "01".
  // q0 self-loops on 0/1, plus has an extra 0-edge to q1 (so on '0',
  // q0 has two destinations: itself and q1 — the source of the
  // non-determinism). q1 transitions to q2 (accept) on '1'.
  // Multi-destination is encoded in the transition's `to` Set.
  function createEndsWith01NFA() {
    let nfa = createAutomaton('NFA', new Set(['0', '1']));
    const { automaton: nfa1, stateId: q1 } = addState(nfa);
    const { automaton: nfa2, stateId: q2 } = addState(nfa1);
    nfa = addAcceptState(nfa2, q2);

    nfa = addTransition(nfa, 0, new Set([0, q1]), '0'); // q0 -0-> {q0, q1}
    nfa = addTransition(nfa, 0, new Set([0]), '1');     // q0 -1-> q0
    nfa = addTransition(nfa, q1, new Set([q2]), '1');   // q1 -1-> q2
    return { nfa, q0: 0, q1, q2 };
  }

  it('starts with the ε-closure of {start}', () => {
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    nfa = addTransition(n1, 0, new Set([q1]), null); // ε from q0 to q1

    const sim = createSimulation(nfa, '');
    expect(sim.currentStates).toEqual(new Set([0, q1]));
  });

  it('follows multiple destinations in parallel', () => {
    const { nfa, q0, q1 } = createEndsWith01NFA();
    let sim = createSimulation(nfa, '0');
    sim = step(sim);
    // After reading '0' from q0, both q0 (self-loop) and q1 are active.
    expect(sim.currentStates).toEqual(new Set([q0, q1]));
  });

  it('accepts when any branch reaches an accept state', () => {
    const { nfa } = createEndsWith01NFA();
    expect(accepts(nfa, '01')).toBe(true);
    expect(accepts(nfa, '0001')).toBe(true);
    expect(accepts(nfa, '1101')).toBe(true);
  });

  it('rejects when no branch reaches an accept state', () => {
    const { nfa } = createEndsWith01NFA();
    expect(accepts(nfa, '')).toBe(false);
    expect(accepts(nfa, '0')).toBe(false);
    expect(accepts(nfa, '10')).toBe(false);
    expect(accepts(nfa, '100')).toBe(false);
  });

  it('lets dying branches drop out of the active set', () => {
    const { nfa, q0 } = createEndsWith01NFA();
    let sim = createSimulation(nfa, '01');
    sim = step(sim); // read '0' → {q0, q1}
    sim = step(sim); // read '1' → q0 self-loops, q1 → q2 (accept). q1 dies.
    expect(sim.currentStates.has(q0)).toBe(true);
    expect(sim.currentStates.has(2)).toBe(true);
    expect(sim.currentStates.has(1)).toBe(false);
  });

  it('does not mark a state as dying if another branch routes back into it', () => {
    // q0 -a-> {q0, q1}. On 'a', q1 has no outgoing transition (would
    // die) but q0's self-loop still keeps q0 alive AND another q0
    // transition reaches q1. So q1 is reborn; it shouldn't be dying.
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    nfa = addTransition(n1, 0, new Set([0, q1]), 'a');

    let sim = createSimulation(nfa, 'aa');
    sim = step(sim); // {q0, q1}
    sim = step(sim);
    expect(sim.currentStates).toEqual(new Set([0, q1]));
    expect(sim.steps[2]!.dyingStateIds).toEqual(new Set());
  });

  it('records dying state IDs on the step where a branch died', () => {
    // Construct a tiny NFA where one branch unambiguously dies on the
    // next step. q0 → 'a' → {q1, q2}. q1 has no outgoing transition on
    // 'b' — it dies. q2 → 'b' → q2 — survives.
    let nfa = createAutomaton('NFA', new Set(['a', 'b']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    const { automaton: n2, stateId: q2 } = addState(n1);
    nfa = addTransition(n2, 0, new Set([q1, q2]), 'a');
    nfa = addTransition(nfa, q2, new Set([q2]), 'b');

    let sim = createSimulation(nfa, 'ab');
    sim = step(sim); // read 'a' → {q1, q2}, no dying yet
    expect(sim.steps[1]!.dyingStateIds).toEqual(new Set());
    sim = step(sim); // read 'b' → q1 dies, q2 self-loops
    expect(sim.steps[2]!.dyingStateIds).toEqual(new Set([q1]));
    expect(sim.currentStates).toEqual(new Set([q2]));
  });

  it('applies ε-closure after a symbol step', () => {
    // q0 -a-> q1 -ε-> q2
    let nfa = createAutomaton('NFA', new Set(['a']));
    const { automaton: n1, stateId: q1 } = addState(nfa);
    const { automaton: n2, stateId: q2 } = addState(n1);
    nfa = addAcceptState(n2, q2);
    nfa = addTransition(nfa, 0, new Set([q1]), 'a');
    nfa = addTransition(nfa, q1, new Set([q2]), null); // ε

    let sim = createSimulation(nfa, 'a');
    sim = step(sim);
    expect(sim.currentStates).toEqual(new Set([q1, q2]));
    expect(isAccepted(sim)).toBe(true);
  });

  it('produces a multi-state trace via getExecutionTrace', () => {
    const { nfa } = createEndsWith01NFA();
    const sim = runSimulation(nfa, '01');
    const trace = getExecutionTrace(sim);
    // After reading '0' the active set is {q0, q1}; format matches the
    // helper's `{a, b}` rendering.
    expect(trace.some((line) => line.includes('{q0, q1}'))).toBe(true);
    expect(trace[trace.length - 1]).toBe('Result: ACCEPTED');
  });
});
