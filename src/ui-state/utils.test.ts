import { describe, it, expect } from 'vitest';
import { computeLayout } from './utils';
import { createAutomaton, addState, addTransition } from '../engine/automaton';

describe('computeLayout', () => {
  it('should position all states with valid coordinates', () => {
    const automaton = createAutomaton('DFA', new Set(['0', '1']));
    const automatonUI = computeLayout(automaton);

    // Should have exactly one state (state 0 created by default)
    expect(automatonUI.states.size).toBe(1);
    expect(automatonUI.states.get(0)).toBeDefined();

    const stateUI = automatonUI.states.get(0)!;

    // Positions should be non-negative numbers
    expect(stateUI.position.x).toBeGreaterThanOrEqual(0);
    expect(stateUI.position.y).toBeGreaterThanOrEqual(0);
    expect(typeof stateUI.position.x).toBe('number');
    expect(typeof stateUI.position.y).toBe('number');
  });

  it('should generate default labels for all states', () => {
    const automaton = createAutomaton('DFA', new Set(['0', '1']));
    const automatonUI = computeLayout(automaton);

    const stateUI = automatonUI.states.get(0)!;
    expect(stateUI.label).toBe('q0');
  });

  it('should handle multiple states with reasonable separation', () => {
    let automaton = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: automaton2, stateId: state1 } = addState(automaton);
    automaton = addTransition(automaton2, 0, new Set([state1]), '0');

    const automatonUI = computeLayout(automaton);

    expect(automatonUI.states.size).toBe(2);

    const position0 = automatonUI.states.get(0)!.position;
    const position1 = automatonUI.states.get(state1)!.position;

    // Calculate distance between states
    const distance = Math.sqrt(
      Math.pow(position1.x - position0.x, 2) +
      Math.pow(position1.y - position0.y, 2)
    );

    // States should be reasonably separated (at least 50px apart)
    expect(distance).toBeGreaterThan(50);
  });

  it('should handle disconnected states (no edges between them)', () => {
    let automaton = createAutomaton('DFA', new Set(['0', '1']));
    const { automaton: automaton2 } = addState(automaton);

    const automatonUI = computeLayout(automaton2);

    expect(automatonUI.states.size).toBe(2);

    // Both states should have valid positions even without connections
    automatonUI.states.forEach((stateUI) => {
      expect(stateUI.position.x).toBeGreaterThanOrEqual(0);
      expect(stateUI.position.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle single-state automaton', () => {
    const automaton = createAutomaton('DFA', new Set(['0', '1']));
    const automatonUI = computeLayout(automaton);

    expect(automatonUI.states.size).toBe(1);

    const stateUI = automatonUI.states.get(0)!;
    expect(stateUI.position.x).toBeGreaterThanOrEqual(0);
    expect(stateUI.position.y).toBeGreaterThanOrEqual(0);
    expect(stateUI.id).toBe(0);
    expect(stateUI.label).toBe('q0');
  });

  it('should handle automaton with self-loops', () => {
    let automaton = createAutomaton('DFA', new Set(['0', '1']));
    automaton = addTransition(automaton, 0, new Set([0]), '0');

    const automatonUI = computeLayout(automaton);

    expect(automatonUI.states.size).toBe(1);

    const stateUI = automatonUI.states.get(0)!;
    expect(stateUI.position.x).toBeGreaterThanOrEqual(0);
    expect(stateUI.position.y).toBeGreaterThanOrEqual(0);
  });

  it('should create StateUI objects with correct structure', () => {
    const automaton = createAutomaton('DFA', new Set(['a', 'b']));
    const automatonUI = computeLayout(automaton);

    const stateUI = automatonUI.states.get(0)!;

    // Verify StateUI structure
    expect(stateUI).toHaveProperty('id');
    expect(stateUI).toHaveProperty('position');
    expect(stateUI).toHaveProperty('label');
    expect(stateUI.position).toHaveProperty('x');
    expect(stateUI.position).toHaveProperty('y');
  });

  it('should handle linear chain of states', () => {
    // Create 0 → 1 → 2 → 3
    let automaton = createAutomaton('DFA', new Set(['a']));
    let state1: number, state2: number, state3: number;

    ({ automaton, stateId: state1 } = addState(automaton));
    ({ automaton, stateId: state2 } = addState(automaton));
    ({ automaton, stateId: state3 } = addState(automaton));

    automaton = addTransition(automaton, 0, new Set([state1]), 'a');
    automaton = addTransition(automaton, state1, new Set([state2]), 'a');
    automaton = addTransition(automaton, state2, new Set([state3]), 'a');

    const automatonUI = computeLayout(automaton);

    expect(automatonUI.states.size).toBe(4);

    // All states should have valid positions
    automatonUI.states.forEach((stateUI) => {
      expect(stateUI.position.x).toBeGreaterThanOrEqual(0);
      expect(stateUI.position.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle cyclic automaton', () => {
    // Create 0 → 1 → 2 → 0 (cycle)
    let automaton = createAutomaton('DFA', new Set(['a']));
    let state1: number, state2: number;

    ({ automaton, stateId: state1 } = addState(automaton));
    ({ automaton, stateId: state2 } = addState(automaton));

    automaton = addTransition(automaton, 0, new Set([state1]), 'a');
    automaton = addTransition(automaton, state1, new Set([state2]), 'a');
    automaton = addTransition(automaton, state2, new Set([0]), 'a');

    const automatonUI = computeLayout(automaton);

    expect(automatonUI.states.size).toBe(3);

    // All states should have valid positions
    automatonUI.states.forEach((stateUI) => {
      expect(stateUI.position.x).toBeGreaterThanOrEqual(0);
      expect(stateUI.position.y).toBeGreaterThanOrEqual(0);
    });
  });
});
