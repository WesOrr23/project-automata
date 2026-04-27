/**
 * Tests for engine/operations.ts. Currently: complementDfa.
 */

import { describe, it, expect } from 'vitest';
import { Automaton } from '../types';
import { accepts } from '../simulator';
import { complementDfa } from '../operations';

function endsIn01DFA(): Automaton {
  // q0 = haven't seen 0; q1 = just saw 0; q2 = saw 01 (accept).
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

function expectOk<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`expected ok, got err: ${String(r.error)}`);
  return r.value;
}

describe('complementDfa — preconditions', () => {
  it('rejects an NFA', () => {
    const nfa: Automaton = { ...endsIn01DFA(), type: 'NFA' };
    const r = complementDfa(nfa);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('complement-requires-dfa');
  });

  it('rejects an incomplete DFA', () => {
    const incomplete: Automaton = {
      type: 'DFA',
      states: new Set([0, 1]),
      alphabet: new Set(['0', '1']),
      transitions: [{ from: 0, to: new Set([1]), symbol: '0' }],
      startState: 0,
      acceptStates: new Set([1]),
      nextStateId: 2,
    };
    const r = complementDfa(incomplete);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('complement-requires-complete-dfa');
  });
});

describe('complementDfa — semantics', () => {
  it('flips accept states', () => {
    const dfa = endsIn01DFA();
    const c = expectOk(complementDfa(dfa));
    // Original accepts {2}; complement should accept {0, 1}.
    expect(Array.from(c.acceptStates).sort()).toEqual([0, 1]);
  });

  it('preserves states, alphabet, transitions, start state', () => {
    const dfa = endsIn01DFA();
    const c = expectOk(complementDfa(dfa));
    expect(Array.from(c.states).sort()).toEqual([0, 1, 2]);
    expect(Array.from(c.alphabet).sort()).toEqual(['0', '1']);
    expect(c.startState).toBe(0);
    expect(c.transitions.length).toBe(dfa.transitions.length);
    expect(c.type).toBe('DFA');
  });

  it("complement accepts exactly the inputs the original rejects", () => {
    const dfa = endsIn01DFA();
    const c = expectOk(complementDfa(dfa));
    const samples = ['', '0', '1', '01', '10', '001', '101', '110', '111', '0101', '1101'];
    for (const s of samples) {
      const orig = expectOk(accepts(dfa, s));
      const comp = expectOk(accepts(c, s));
      expect(comp).toBe(!orig);
    }
  });

  it('complement of complement is the original (modulo transitions identity)', () => {
    const dfa = endsIn01DFA();
    const cc = expectOk(complementDfa(expectOk(complementDfa(dfa))));
    expect(Array.from(cc.acceptStates).sort()).toEqual(Array.from(dfa.acceptStates).sort());
    // Verify behaviorally rather than by Set identity (the wrapped
    // sets are fresh references but should denote the same language).
    const samples = ['', '0', '1', '01', '10', '101'];
    for (const s of samples) {
      expect(expectOk(accepts(cc, s))).toBe(expectOk(accepts(dfa, s)));
    }
  });

  it('returns a fresh Automaton (defensive clone)', () => {
    const dfa = endsIn01DFA();
    const c = expectOk(complementDfa(dfa));
    expect(c).not.toBe(dfa);
    expect(c.acceptStates).not.toBe(dfa.acceptStates);
    expect(c.states).not.toBe(dfa.states);
  });
});
