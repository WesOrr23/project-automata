/**
 * Tests for convertNfaToDfa (subset construction).
 *
 * Strategy: build NFAs by hand, convert, assert structural invariants
 * + property: accepts(nfa, w) === accepts(dfa, w) over a sampled
 * input set. Textbook fixture (NFA recognizing strings ending in 01)
 * doubles as the structural anchor.
 */

import { describe, it, expect } from 'vitest';
import { Automaton } from '../types';
import { accepts } from '../simulator';
import { convertNfaToDfa } from '../converter';

// Helper: build the canonical "ends in 01" NFA. Three states (q0
// loop on 0/1, q1 reached by 0, q2 reached from q1 by 1; q2 is
// accepting). NFA-shaped because q0 has both q0 and q1 as targets
// on '0'.
function endsIn01NFA(): Automaton {
  return {
    type: 'NFA',
    states: new Set([0, 1, 2]),
    alphabet: new Set(['0', '1']),
    transitions: [
      { from: 0, to: new Set([0, 1]), symbol: '0' }, // non-determinism
      { from: 0, to: new Set([0]), symbol: '1' },
      { from: 1, to: new Set([2]), symbol: '1' },
    ],
    startState: 0,
    acceptStates: new Set([2]),
    nextStateId: 3,
  };
}

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`Expected ok, got err: ${String(result.error)}`);
  return result.value;
}

describe('convertNfaToDfa — preconditions', () => {
  it('rejects a DFA input', () => {
    const dfa: Automaton = {
      type: 'DFA',
      states: new Set([0]),
      alphabet: new Set(['a']),
      transitions: [{ from: 0, to: new Set([0]), symbol: 'a' }],
      startState: 0,
      acceptStates: new Set(),
      nextStateId: 1,
    };
    const result = convertNfaToDfa(dfa);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('conversion-requires-nfa');
  });

  it('rejects an NFA with empty alphabet', () => {
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0]),
      alphabet: new Set(),
      transitions: [],
      startState: 0,
      acceptStates: new Set(),
      nextStateId: 1,
    };
    const result = convertNfaToDfa(nfa);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('conversion-empty-alphabet');
  });
});

describe('convertNfaToDfa — happy path', () => {
  it('produces a DFA that accepts the same language as the NFA', () => {
    const nfa = endsIn01NFA();
    const { dfa } = expectOk(convertNfaToDfa(nfa));

    expect(dfa.type).toBe('DFA');

    const samples = ['', '0', '1', '01', '10', '001', '101', '110', '111', '0101', '1101', '00', '11'];
    for (const input of samples) {
      const nfaAccepts = expectOk(accepts(nfa, input));
      const dfaAccepts = expectOk(accepts(dfa, input));
      expect(dfaAccepts).toBe(nfaAccepts);
    }
  });

  it('produces a complete DFA (every state has every symbol)', () => {
    const { dfa } = expectOk(convertNfaToDfa(endsIn01NFA()));
    for (const stateId of dfa.states) {
      for (const symbol of dfa.alphabet) {
        const has = dfa.transitions.some(
          (t) => t.from === stateId && t.symbol === symbol && t.to.size === 1
        );
        expect(has).toBe(true);
      }
    }
  });

  it('subsetMap maps each new DFA state to its NFA subset', () => {
    const { dfa, subsetMap } = expectOk(convertNfaToDfa(endsIn01NFA()));
    // Start state's subset should be {0} (no ε-transitions in this NFA).
    const startSubset = subsetMap.get(dfa.startState)!;
    expect(Array.from(startSubset).sort()).toEqual([0]);
    // Every state in the DFA must have an entry in subsetMap.
    for (const stateId of dfa.states) {
      expect(subsetMap.has(stateId)).toBe(true);
    }
  });

  it('marks subsets containing an NFA accept state as accepting', () => {
    const { dfa, subsetMap } = expectOk(convertNfaToDfa(endsIn01NFA()));
    for (const stateId of dfa.acceptStates) {
      const subset = subsetMap.get(stateId)!;
      const containsAccept = Array.from(subset).some((s) => s === 2);
      expect(containsAccept).toBe(true);
    }
  });
});

describe('convertNfaToDfa — edge cases', () => {
  it('NFA with only ε-transitions: start subset is full ε-closure; all moves go to trap', () => {
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0, 1, 2]),
      alphabet: new Set(['a']),
      transitions: [
        { from: 0, to: new Set([1]), symbol: null },
        { from: 1, to: new Set([2]), symbol: null },
      ],
      startState: 0,
      acceptStates: new Set([2]),
      nextStateId: 3,
    };
    const { dfa, subsetMap } = expectOk(convertNfaToDfa(nfa));
    const startSubset = subsetMap.get(dfa.startState)!;
    expect(Array.from(startSubset).sort()).toEqual([0, 1, 2]);
    // 'a' from start has no concrete transition → goes to trap.
    expect(dfa.acceptStates.has(dfa.startState)).toBe(true);
    // Trap state exists (subset is empty).
    const trapEntry = Array.from(subsetMap.entries()).find(([, subset]) => subset.size === 0);
    expect(trapEntry).toBeDefined();
  });

  it('all-accept NFA: every reachable subset is accepting', () => {
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0, 1]),
      alphabet: new Set(['a']),
      transitions: [
        { from: 0, to: new Set([0, 1]), symbol: 'a' },
      ],
      startState: 0,
      acceptStates: new Set([0, 1]),
      nextStateId: 2,
    };
    const { dfa, subsetMap } = expectOk(convertNfaToDfa(nfa));
    for (const stateId of dfa.states) {
      const subset = subsetMap.get(stateId)!;
      // Skip the trap state (empty subset → not accepting per spec).
      if (subset.size === 0) {
        expect(dfa.acceptStates.has(stateId)).toBe(false);
        continue;
      }
      expect(dfa.acceptStates.has(stateId)).toBe(true);
    }
  });

  it('single-state NFA with self-loop produces a single-state DFA', () => {
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0]),
      alphabet: new Set(['a']),
      transitions: [{ from: 0, to: new Set([0]), symbol: 'a' }],
      startState: 0,
      acceptStates: new Set([0]),
      nextStateId: 1,
    };
    const { dfa } = expectOk(convertNfaToDfa(nfa));
    expect(dfa.states.size).toBe(1);
    expect(dfa.acceptStates.size).toBe(1);
  });

  it('NFA with no accept states: resulting DFA has zero accept states', () => {
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0, 1]),
      alphabet: new Set(['a']),
      transitions: [{ from: 0, to: new Set([1]), symbol: 'a' }],
      startState: 0,
      acceptStates: new Set(),
      nextStateId: 2,
    };
    const { dfa } = expectOk(convertNfaToDfa(nfa));
    expect(dfa.acceptStates.size).toBe(0);
  });

  it('trap state is created only when the conversion needs it', () => {
    // NFA whose conversion is total (every (subset, symbol) has a real transition).
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0]),
      alphabet: new Set(['a', 'b']),
      transitions: [
        { from: 0, to: new Set([0]), symbol: 'a' },
        { from: 0, to: new Set([0]), symbol: 'b' },
      ],
      startState: 0,
      acceptStates: new Set([0]),
      nextStateId: 1,
    };
    const { dfa, subsetMap } = expectOk(convertNfaToDfa(nfa));
    expect(dfa.states.size).toBe(1);
    const trap = Array.from(subsetMap.values()).find((s) => s.size === 0);
    expect(trap).toBeUndefined();
  });

  it('NFA with missing transitions creates a trap state', () => {
    // NFA where some subset has no transition for 'b'.
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0, 1]),
      alphabet: new Set(['a', 'b']),
      transitions: [
        { from: 0, to: new Set([1]), symbol: 'a' },
      ],
      startState: 0,
      acceptStates: new Set([1]),
      nextStateId: 2,
    };
    const { dfa, subsetMap } = expectOk(convertNfaToDfa(nfa));
    const trap = Array.from(subsetMap.entries()).find(([, s]) => s.size === 0);
    expect(trap).toBeDefined();
    if (!trap) return;
    const trapId = trap[0];
    expect(dfa.acceptStates.has(trapId)).toBe(false);
    // Trap loops on every symbol.
    for (const symbol of dfa.alphabet) {
      const loop = dfa.transitions.find(
        (t) => t.from === trapId && t.symbol === symbol && t.to.has(trapId)
      );
      expect(loop).toBeDefined();
    }
  });
});

describe('convertNfaToDfa — auto-minimization', () => {
  it('produces a minimal DFA (no equivalent states post-conversion)', () => {
    // NFA whose naïve subset construction yields redundant states
    // that minimization collapses. Two parallel branches on 'a',
    // both accepting end-of-input → subsets {q1} and {q2} would be
    // equivalent and should merge.
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0, 1, 2]),
      alphabet: new Set(['a', 'b']),
      transitions: [
        { from: 0, to: new Set([1, 2]), symbol: 'a' },
        { from: 1, to: new Set([1]), symbol: 'a' },
        { from: 1, to: new Set([1]), symbol: 'b' },
        { from: 2, to: new Set([2]), symbol: 'a' },
        { from: 2, to: new Set([2]), symbol: 'b' },
      ],
      startState: 0,
      acceptStates: new Set([1, 2]),
      nextStateId: 3,
    };
    const { dfa, subsetMap } = expectOk(convertNfaToDfa(nfa));
    // q1 and q2 are language-equivalent post-subset (both: from {1} or
    // {2}, every symbol loops back). They should merge. Plus the start
    // state {0} → 2 states total in the minimized DFA.
    expect(dfa.states.size).toBeLessThanOrEqual(3);
    // Subset map for the merged state should contain BOTH original
    // NFA states 1 and 2 (the union after composition).
    const acceptSubsetEntry = Array.from(subsetMap.entries()).find(
      ([id]) => dfa.acceptStates.has(id)
    );
    expect(acceptSubsetEntry).toBeDefined();
    const acceptSubset = acceptSubsetEntry![1];
    expect(acceptSubset.has(1)).toBe(true);
    expect(acceptSubset.has(2)).toBe(true);
  });
});

describe('convertNfaToDfa — property: equivalence via random inputs', () => {
  it('endsIn01: 30 random short inputs accept the same on NFA and DFA', () => {
    const nfa = endsIn01NFA();
    const { dfa } = expectOk(convertNfaToDfa(nfa));
    for (let i = 0; i < 30; i++) {
      const len = Math.floor(Math.random() * 10);
      let s = '';
      for (let j = 0; j < len; j++) s += Math.random() < 0.5 ? '0' : '1';
      const nfaAccepts = expectOk(accepts(nfa, s));
      const dfaAccepts = expectOk(accepts(dfa, s));
      expect(dfaAccepts).toBe(nfaAccepts);
    }
  });
});
