/**
 * Tests for the file format module — round-trip serialization,
 * strict parser rejection of malformed inputs, and metadata handling.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeAutomaton,
  parseAutomataFile,
  defaultMetadata,
  FORMAT_KIND,
  FORMAT_VERSION,
} from '../format';
import { Automaton } from '../../engine/types';

function makeAutomaton(): Automaton {
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

describe('serializeAutomaton', () => {
  it('produces a valid AutomataFile JSON shape', () => {
    const json = serializeAutomaton(makeAutomaton(), defaultMetadata('Test'));
    const parsed = JSON.parse(json);
    expect(parsed.kind).toBe(FORMAT_KIND);
    expect(parsed.formatVersion).toBe(FORMAT_VERSION);
    expect(parsed.metadata.name).toBe('Test');
    expect(parsed.automaton.type).toBe('DFA');
    expect(parsed.automaton.states).toEqual([0, 1, 2]);
    expect(parsed.automaton.alphabet).toEqual(['0', '1']);
  });

  it('produces sorted arrays (deterministic output)', () => {
    const a = makeAutomaton();
    a.states = new Set([2, 0, 1]); // unsorted insertion order
    a.alphabet = new Set(['1', '0']);
    a.acceptStates = new Set([2]);
    const json = JSON.parse(serializeAutomaton(a, defaultMetadata()));
    expect(json.automaton.states).toEqual([0, 1, 2]);
    expect(json.automaton.alphabet).toEqual(['0', '1']);
  });
});

describe('parseAutomataFile — happy path', () => {
  it('round-trips an automaton through serialize → parse', () => {
    const original = makeAutomaton();
    const json = serializeAutomaton(original, defaultMetadata('Roundtrip'));
    const result = parseAutomataFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.metadata.name).toBe('Roundtrip');
    const a = result.value.automaton;
    expect(a.type).toBe('DFA');
    expect(Array.from(a.states).sort()).toEqual([0, 1, 2]);
    expect(Array.from(a.alphabet).sort()).toEqual(['0', '1']);
    expect(a.startState).toBe(0);
    expect(Array.from(a.acceptStates)).toEqual([2]);
    expect(a.nextStateId).toBe(3);
    expect(a.transitions).toHaveLength(6);
    // Spot-check: first transition should match original.
    const first = a.transitions[0]!;
    expect(first.from).toBe(0);
    expect(Array.from(first.to)).toEqual([1]);
    expect(first.symbol).toBe('0');
  });

  it('preserves description when set', () => {
    const json = serializeAutomaton(makeAutomaton(), {
      ...defaultMetadata('With description'),
      description: 'Sample DFA',
    });
    const result = parseAutomataFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metadata.description).toBe('Sample DFA');
  });

  it('omits description when not set', () => {
    const json = serializeAutomaton(makeAutomaton(), defaultMetadata());
    const result = parseAutomataFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metadata.description).toBeUndefined();
  });

  it('handles ε-transitions (symbol: null)', () => {
    const nfa = makeAutomaton();
    nfa.type = 'NFA';
    nfa.transitions.push({ from: 0, to: new Set([2]), symbol: null });
    const json = serializeAutomaton(nfa, defaultMetadata());
    const result = parseAutomataFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const epsilon = result.value.automaton.transitions.find((t) => t.symbol === null);
    expect(epsilon).toBeDefined();
  });
});

describe('parseAutomataFile — rejection', () => {
  it('rejects invalid JSON', () => {
    const result = parseAutomataFile('not valid json {');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-invalid-json');
  });

  it('rejects wrong kind', () => {
    const result = parseAutomataFile(JSON.stringify({ kind: 'something-else', formatVersion: 1 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-wrong-kind');
  });

  it('rejects unknown formatVersion', () => {
    const result = parseAutomataFile(JSON.stringify({ kind: FORMAT_KIND, formatVersion: 999 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-bad-version');
  });

  it('rejects missing metadata', () => {
    const result = parseAutomataFile(JSON.stringify({ kind: FORMAT_KIND, formatVersion: 1 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-malformed');
  });

  it('rejects metadata with wrong-typed name', () => {
    const result = parseAutomataFile(
      JSON.stringify({
        kind: FORMAT_KIND,
        formatVersion: 1,
        metadata: { name: 42, createdAt: '', modifiedAt: '' },
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-malformed');
  });

  it('rejects automaton with missing states', () => {
    const result = parseAutomataFile(
      JSON.stringify({
        kind: FORMAT_KIND,
        formatVersion: 1,
        metadata: defaultMetadata(),
        automaton: { type: 'DFA', alphabet: ['0'], transitions: [], startState: 0, acceptStates: [], nextStateId: 1 },
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-malformed');
  });

  it('rejects automaton with non-integer state IDs', () => {
    const result = parseAutomataFile(
      JSON.stringify({
        kind: FORMAT_KIND,
        formatVersion: 1,
        metadata: defaultMetadata(),
        automaton: {
          type: 'DFA',
          states: ['q0', 'q1'],
          alphabet: ['0'],
          transitions: [],
          startState: 0,
          acceptStates: [],
          nextStateId: 2,
        },
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-malformed');
  });

  it('rejects automaton with wrong type field', () => {
    const result = parseAutomataFile(
      JSON.stringify({
        kind: FORMAT_KIND,
        formatVersion: 1,
        metadata: defaultMetadata(),
        automaton: {
          type: 'PDA',
          states: [0],
          alphabet: ['0'],
          transitions: [],
          startState: 0,
          acceptStates: [],
          nextStateId: 1,
        },
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-malformed');
  });

  it('rejects null input', () => {
    const result = parseAutomataFile('null');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('parse-malformed');
  });
});
