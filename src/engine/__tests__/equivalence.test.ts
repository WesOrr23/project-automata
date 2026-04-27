/**
 * Tests for engine/equivalence.ts. Product-construction BFS with
 * counterexample reconstruction.
 */

import { describe, it, expect } from 'vitest';
import { Automaton } from '../types';
import { accepts } from '../simulator';
import { areEquivalent } from '../equivalence';

function expectOk<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`expected ok, got err: ${String(r.error)}`);
  return r.value;
}

// "ends in 01" minimal DFA.
function endsIn01(): Automaton {
  return {
    type: 'DFA',
    states: new Set([0, 1, 2]),
    alphabet: new Set(['0', '1']),
    transitions: [
      { from: 0, to: new Set([1]), symbol: '0' },
      { from: 0, to: new Set([0]), symbol: '1' },
      { from: 1, to: new Set([1]), symbol: '0' },
      { from: 1, to: new Set([2]), symbol: '1' },
      { from: 2, to: new Set([1]), symbol: '0' },
      { from: 2, to: new Set([0]), symbol: '1' },
    ],
    startState: 0,
    acceptStates: new Set([2]),
    nextStateId: 3,
  };
}

// "ends in 01" expressed with one redundant state. Same language.
function endsIn01Redundant(): Automaton {
  // q0' = saw nothing or 1; q1' = redundant copy of q0'; q2 = saw 0; q3 = accept.
  return {
    type: 'DFA',
    states: new Set([0, 1, 2, 3]),
    alphabet: new Set(['0', '1']),
    transitions: [
      { from: 0, to: new Set([2]), symbol: '0' },
      { from: 0, to: new Set([1]), symbol: '1' },
      { from: 1, to: new Set([2]), symbol: '0' },
      { from: 1, to: new Set([0]), symbol: '1' },
      { from: 2, to: new Set([2]), symbol: '0' },
      { from: 2, to: new Set([3]), symbol: '1' },
      { from: 3, to: new Set([2]), symbol: '0' },
      { from: 3, to: new Set([0]), symbol: '1' },
    ],
    startState: 0,
    acceptStates: new Set([3]),
    nextStateId: 4,
  };
}

describe('areEquivalent — preconditions', () => {
  it('rejects when one side is an NFA', () => {
    const dfa = endsIn01();
    const nfa: Automaton = { ...dfa, type: 'NFA' };
    const r = areEquivalent(dfa, nfa);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('equivalence-requires-dfa');
  });

  it('rejects when one DFA is incomplete', () => {
    const dfa = endsIn01();
    const incomplete: Automaton = {
      type: 'DFA',
      states: new Set([0]),
      alphabet: new Set(['0', '1']),
      transitions: [{ from: 0, to: new Set([0]), symbol: '0' }],
      startState: 0,
      acceptStates: new Set(),
      nextStateId: 1,
    };
    const r = areEquivalent(dfa, incomplete);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('equivalence-requires-complete-dfa');
  });

  it('rejects when alphabets differ', () => {
    const dfa = endsIn01();
    const other: Automaton = {
      type: 'DFA',
      states: new Set([0]),
      alphabet: new Set(['a', 'b']),
      transitions: [
        { from: 0, to: new Set([0]), symbol: 'a' },
        { from: 0, to: new Set([0]), symbol: 'b' },
      ],
      startState: 0,
      acceptStates: new Set(),
      nextStateId: 1,
    };
    const r = areEquivalent(dfa, other);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('equivalence-alphabet-mismatch');
  });
});

describe('areEquivalent — happy path', () => {
  it('reports equivalent for the same DFA', () => {
    const out = expectOk(areEquivalent(endsIn01(), endsIn01()));
    expect(out.equivalent).toBe(true);
    expect(out.counterexample).toBeNull();
  });

  it('reports equivalent for two DFAs that recognize the same language', () => {
    const out = expectOk(areEquivalent(endsIn01(), endsIn01Redundant()));
    expect(out.equivalent).toBe(true);
    expect(out.counterexample).toBeNull();
  });

  it('reports a counterexample for two DFAs with different languages', () => {
    // Subtly different: the second one accepts strings ending in '11' instead.
    const endsIn11: Automaton = {
      type: 'DFA',
      states: new Set([0, 1, 2]),
      alphabet: new Set(['0', '1']),
      transitions: [
        { from: 0, to: new Set([0]), symbol: '0' },
        { from: 0, to: new Set([1]), symbol: '1' },
        { from: 1, to: new Set([0]), symbol: '0' },
        { from: 1, to: new Set([2]), symbol: '1' },
        { from: 2, to: new Set([0]), symbol: '0' },
        { from: 2, to: new Set([2]), symbol: '1' },
      ],
      startState: 0,
      acceptStates: new Set([2]),
      nextStateId: 3,
    };
    const out = expectOk(areEquivalent(endsIn01(), endsIn11));
    expect(out.equivalent).toBe(false);
    if (out.equivalent) return;
    // Counterexample must actually differentiate them.
    expect(typeof out.counterexample).toBe('string');
    const acceptsA = expectOk(accepts(endsIn01(), out.counterexample));
    const acceptsB = expectOk(accepts(endsIn11, out.counterexample));
    expect(acceptsA).not.toBe(acceptsB);
    // acceptingSide identifies which one accepts.
    if (out.acceptingSide === 'a') expect(acceptsA).toBe(true);
    else expect(acceptsB).toBe(true);
  });

  it('reports the empty string when start states disagree on accept', () => {
    // A's start is accepting; B's is not.
    const acceptStart: Automaton = {
      type: 'DFA',
      states: new Set([0]),
      alphabet: new Set(['a']),
      transitions: [{ from: 0, to: new Set([0]), symbol: 'a' }],
      startState: 0,
      acceptStates: new Set([0]),
      nextStateId: 1,
    };
    const rejectStart: Automaton = { ...acceptStart, acceptStates: new Set() };
    const out = expectOk(areEquivalent(acceptStart, rejectStart));
    expect(out.equivalent).toBe(false);
    if (out.equivalent) return;
    expect(out.counterexample).toBe('');
    expect(out.acceptingSide).toBe('a');
  });

  it('returns the SHORTEST counterexample (BFS guarantees this)', () => {
    // Two DFAs over {0}. A accepts strings of length divisible by 2;
    // B accepts strings of length divisible by 3. They first disagree
    // on length 2 ('00': A accepts, B rejects). Length 0 both accept.
    const lenMod2: Automaton = {
      type: 'DFA',
      states: new Set([0, 1]),
      alphabet: new Set(['0']),
      transitions: [
        { from: 0, to: new Set([1]), symbol: '0' },
        { from: 1, to: new Set([0]), symbol: '0' },
      ],
      startState: 0,
      acceptStates: new Set([0]),
      nextStateId: 2,
    };
    const lenMod3: Automaton = {
      type: 'DFA',
      states: new Set([0, 1, 2]),
      alphabet: new Set(['0']),
      transitions: [
        { from: 0, to: new Set([1]), symbol: '0' },
        { from: 1, to: new Set([2]), symbol: '0' },
        { from: 2, to: new Set([0]), symbol: '0' },
      ],
      startState: 0,
      acceptStates: new Set([0]),
      nextStateId: 3,
    };
    const out = expectOk(areEquivalent(lenMod2, lenMod3));
    expect(out.equivalent).toBe(false);
    if (out.equivalent) return;
    expect(out.counterexample).toBe('00');
  });
});
