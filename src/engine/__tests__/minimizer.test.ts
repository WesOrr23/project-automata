/**
 * Tests for minimizeDfa (Hopcroft).
 *
 * Strategy: build DFAs by hand with known redundancy + verify the
 * minimized output has the expected number of states and accepts the
 * same language. Also verifies trim (unreachable removal) and
 * preconditions.
 */

import { describe, it, expect } from 'vitest';
import { Automaton } from '../types';
import { accepts } from '../simulator';
import { minimizeDfa } from '../minimizer';

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`Expected ok, got err: ${String(result.error)}`);
  return result.value;
}

describe('minimizeDfa — preconditions', () => {
  it('rejects an NFA input', () => {
    const nfa: Automaton = {
      type: 'NFA',
      states: new Set([0]),
      alphabet: new Set(['a']),
      transitions: [{ from: 0, to: new Set([0]), symbol: 'a' }],
      startState: 0,
      acceptStates: new Set(),
      nextStateId: 1,
    };
    const result = minimizeDfa(nfa);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('minimize-requires-dfa');
  });

  it('rejects a DFA missing transitions over reachable states', () => {
    const dfa: Automaton = {
      type: 'DFA',
      states: new Set([0, 1]),
      alphabet: new Set(['a', 'b']),
      transitions: [
        { from: 0, to: new Set([1]), symbol: 'a' },
        // missing: 0 on 'b', 1 on 'a' and 'b'
      ],
      startState: 0,
      acceptStates: new Set([1]),
      nextStateId: 2,
    };
    const result = minimizeDfa(dfa);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('minimize-incomplete-dfa');
  });
});

describe('minimizeDfa — happy path', () => {
  it('an already-minimal DFA passes through with the same shape', () => {
    // 2-state DFA: q0 (non-accept) loops on 'a' to q0; on 'b' to q1 (accept).
    // q1: 'a' → q0, 'b' → q1.
    const dfa: Automaton = {
      type: 'DFA',
      states: new Set([0, 1]),
      alphabet: new Set(['a', 'b']),
      transitions: [
        { from: 0, to: new Set([0]), symbol: 'a' },
        { from: 0, to: new Set([1]), symbol: 'b' },
        { from: 1, to: new Set([0]), symbol: 'a' },
        { from: 1, to: new Set([1]), symbol: 'b' },
      ],
      startState: 0,
      acceptStates: new Set([1]),
      nextStateId: 2,
    };
    const { dfa: min, mergeMap } = expectOk(minimizeDfa(dfa));
    expect(min.states.size).toBe(2);
    // Each merge map entry is a singleton when nothing collapses.
    for (const set of mergeMap.values()) expect(set.size).toBe(1);
  });

  it('merges two states that accept the same language', () => {
    // 3-state DFA where q1 and q2 are equivalent (both accepting,
    // both loop on 'a' to themselves and on 'b' back to q0).
    // After minimization → 2 states.
    const dfa: Automaton = {
      type: 'DFA',
      states: new Set([0, 1, 2]),
      alphabet: new Set(['a', 'b']),
      transitions: [
        { from: 0, to: new Set([1]), symbol: 'a' },
        { from: 0, to: new Set([2]), symbol: 'b' },
        { from: 1, to: new Set([1]), symbol: 'a' },
        { from: 1, to: new Set([0]), symbol: 'b' },
        { from: 2, to: new Set([2]), symbol: 'a' },
        { from: 2, to: new Set([0]), symbol: 'b' },
      ],
      startState: 0,
      acceptStates: new Set([1, 2]),
      nextStateId: 3,
    };
    const { dfa: min, mergeMap } = expectOk(minimizeDfa(dfa));
    expect(min.states.size).toBe(2);
    // The merge map should have one entry that contains both 1 and 2.
    const merged = Array.from(mergeMap.values()).find((s) => s.size === 2);
    expect(merged).toBeDefined();
    expect(merged!.has(1) && merged!.has(2)).toBe(true);

    // Language equivalence over a sample.
    const samples = ['', 'a', 'b', 'aa', 'ab', 'ba', 'bb', 'aab', 'bba', 'abab'];
    for (const input of samples) {
      const before = expectOk(accepts(dfa, input));
      const after = expectOk(accepts(min, input));
      expect(after).toBe(before);
    }
  });

  it('drops states unreachable from the start state', () => {
    // 3-state DFA: q2 is disconnected (no path from q0).
    const dfa: Automaton = {
      type: 'DFA',
      states: new Set([0, 1, 2]),
      alphabet: new Set(['a']),
      transitions: [
        { from: 0, to: new Set([1]), symbol: 'a' },
        { from: 1, to: new Set([0]), symbol: 'a' },
        { from: 2, to: new Set([2]), symbol: 'a' }, // orphan
      ],
      startState: 0,
      acceptStates: new Set([1]),
      nextStateId: 3,
    };
    const { dfa: min } = expectOk(minimizeDfa(dfa));
    expect(min.states.size).toBe(2);
  });

  it('start state is preserved (translated to the new ID of its class)', () => {
    const dfa: Automaton = {
      type: 'DFA',
      states: new Set([0, 1]),
      alphabet: new Set(['a']),
      transitions: [
        { from: 0, to: new Set([0]), symbol: 'a' },
        { from: 1, to: new Set([1]), symbol: 'a' },
      ],
      startState: 0,
      acceptStates: new Set(),
      nextStateId: 2,
    };
    const { dfa: min, mergeMap } = expectOk(minimizeDfa(dfa));
    // q1 is unreachable; should be dropped. Start = 0 in new numbering.
    expect(min.states.size).toBe(1);
    expect(min.startState).toBe(0);
    expect(mergeMap.get(0)!.has(0)).toBe(true);
  });

  it('preserves accept status across merges', () => {
    // Two equivalent accept states + one non-accept; final DFA should
    // have one accept (representing the merged pair).
    const dfa: Automaton = {
      type: 'DFA',
      states: new Set([0, 1, 2]),
      alphabet: new Set(['a']),
      transitions: [
        { from: 0, to: new Set([1]), symbol: 'a' },
        { from: 1, to: new Set([2]), symbol: 'a' },
        { from: 2, to: new Set([1]), symbol: 'a' },
      ],
      startState: 0,
      acceptStates: new Set([1, 2]),
      nextStateId: 3,
    };
    const { dfa: min } = expectOk(minimizeDfa(dfa));
    // q1 and q2 are equivalent (both accept, both transition to each
    // other) → 2 states total. q0 reaches the merged accept state.
    expect(min.states.size).toBe(2);
    expect(min.acceptStates.size).toBe(1);
  });
});
