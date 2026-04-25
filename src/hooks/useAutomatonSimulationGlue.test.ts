/**
 * @vitest-environment jsdom
 *
 * Tests the contract:
 * - Reset is called on every non-initial automaton change.
 * - Input string is filtered when (and only when) the alphabet changes
 *   in a way that removes characters present in the input.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Automaton } from '../engine/types';
import { createAutomaton, addState } from '../engine/automaton';
import { useAutomatonSimulationGlue } from './useAutomatonSimulationGlue';

function makeDFA(alphabet: ReadonlySet<string> = new Set(['0', '1'])): Automaton {
  let dfa = createAutomaton('DFA', new Set(alphabet));
  ({ automaton: dfa } = addState(dfa));
  return dfa;
}

describe('useAutomatonSimulationGlue', () => {
  it('does NOT reset on the initial mount', () => {
    const reset = vi.fn();
    const setInput = vi.fn();
    renderHook(() =>
      useAutomatonSimulationGlue({
        automaton: makeDFA(),
        resetSimulation: reset,
        inputString: '',
        setInputString: setInput,
      })
    );
    expect(reset).not.toHaveBeenCalled();
  });

  it('resets when the automaton reference changes', () => {
    const reset = vi.fn();
    const setInput = vi.fn();
    const { rerender } = renderHook(
      ({ automaton }: { automaton: Automaton }) =>
        useAutomatonSimulationGlue({
          automaton,
          resetSimulation: reset,
          inputString: '',
          setInputString: setInput,
        }),
      { initialProps: { automaton: makeDFA() } }
    );
    expect(reset).not.toHaveBeenCalled();
    rerender({ automaton: makeDFA() });
    expect(reset).toHaveBeenCalledOnce();
  });

  it('filters the input string when a symbol is removed from the alphabet', () => {
    const reset = vi.fn();
    const setInput = vi.fn();
    const initialAutomaton = makeDFA(new Set(['0', '1']));
    const { rerender } = renderHook(
      ({ automaton, inputString }: { automaton: Automaton; inputString: string }) =>
        useAutomatonSimulationGlue({
          automaton,
          resetSimulation: reset,
          inputString,
          setInputString: setInput,
        }),
      { initialProps: { automaton: initialAutomaton, inputString: '0101' } }
    );
    // No filter call on initial mount when input matches alphabet.
    expect(setInput).not.toHaveBeenCalled();

    // Rerender with an alphabet that's missing '1' — input '0101' should
    // be filtered to '00'.
    const reducedAutomaton = makeDFA(new Set(['0']));
    rerender({ automaton: reducedAutomaton, inputString: '0101' });
    expect(setInput).toHaveBeenCalledWith('00');
  });

  it('does not call setInputString when the alphabet change is a no-op for the input', () => {
    const reset = vi.fn();
    const setInput = vi.fn();
    const automatonA = makeDFA(new Set(['0', '1']));
    const automatonB = makeDFA(new Set(['0', '1', '2'])); // superset
    const { rerender } = renderHook(
      ({ automaton }: { automaton: Automaton }) =>
        useAutomatonSimulationGlue({
          automaton,
          resetSimulation: reset,
          inputString: '0101',
          setInputString: setInput,
        }),
      { initialProps: { automaton: automatonA } }
    );
    rerender({ automaton: automatonB });
    // The alphabet's Set reference changed (different automaton), but the
    // filter result equals the input — no setInputString call.
    expect(setInput).not.toHaveBeenCalled();
  });
});
