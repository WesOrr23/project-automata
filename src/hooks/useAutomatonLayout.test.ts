/**
 * @vitest-environment jsdom
 *
 * Tests for the layout glue hook. We mock `computeLayout` so the test
 * stays synchronous and independent of the GraphViz wasm runtime — the
 * hook's responsibility under test is the *glue* (debouncing, stale-
 * promise rejection, relabel pass), not GraphViz itself.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Automaton } from '../engine/types';
import { createAutomaton, addState } from '../engine/automaton';
import type { AutomatonUI } from '../ui-state/types';

// Hoisted mock holder so the vi.mock factory below can read/write it.
const mocks = vi.hoisted(() => ({
  // Each call returns a layout whose first state's label is "ENGINE-LABEL".
  // The hook is supposed to overwrite that with the sequential display
  // label (q0), so the test can detect the relabel pass by inspecting the
  // final result.
  computeLayout: vi.fn(async (automaton: Automaton): Promise<AutomatonUI> => {
    const states = new Map();
    for (const stateId of automaton.states) {
      states.set(stateId, {
        id: stateId,
        position: { x: 0, y: 0 },
        label: 'ENGINE-LABEL',
        isStart: stateId === automaton.startState,
        isAccept: automaton.acceptStates.has(stateId),
      });
    }
    return {
      states,
      transitions: new Map(),
      width: 100,
      height: 100,
    } as unknown as AutomatonUI;
  }),
}));

vi.mock('../ui-state/utils', () => ({
  computeLayout: mocks.computeLayout,
}));

import { useAutomatonLayout } from './useAutomatonLayout';

beforeEach(() => {
  mocks.computeLayout.mockClear();
  vi.useRealTimers();
});

function makeDFA(): Automaton {
  let dfa = createAutomaton('DFA', new Set(['0']));
  ({ automaton: dfa } = addState(dfa));
  return dfa;
}

describe('useAutomatonLayout', () => {
  it('starts in loading state and resolves to a relabeled AutomatonUI', async () => {
    const automaton = makeDFA();
    const { result } = renderHook(() => useAutomatonLayout(automaton));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.automatonUI).toBeNull();

    await waitFor(() => {
      expect(result.current.automatonUI).not.toBeNull();
    });

    expect(result.current.isLoading).toBe(false);
    // The mock returns 'ENGINE-LABEL' for every state. The hook MUST
    // overwrite that with the sequential display label (q0, q1, ...).
    const firstStateUI = Array.from(result.current.automatonUI!.states.values())[0];
    expect(firstStateUI?.label).toMatch(/^q\d+$/);
    expect(firstStateUI?.label).not.toBe('ENGINE-LABEL');
  });

  it('discards stale layout promises when the input changes mid-flight', async () => {
    vi.useFakeTimers();
    const automatonA = makeDFA();
    const automatonB = makeDFA();

    // Make computeLayout for the FIRST call resolve later than the second.
    let resolveFirst: ((value: AutomatonUI) => void) | null = null;
    mocks.computeLayout.mockImplementationOnce(
      () =>
        new Promise<AutomatonUI>((res) => {
          resolveFirst = res;
        })
    );

    const { rerender, result } = renderHook(
      ({ automaton }: { automaton: Automaton }) => useAutomatonLayout(automaton),
      { initialProps: { automaton: automatonA } }
    );

    // Advance past the debounce so the first layout call kicks off.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // First call started but hasn't resolved yet.
    expect(mocks.computeLayout).toHaveBeenCalledTimes(1);

    // Re-render with a new automaton — bumps the version counter, schedules
    // a fresh debounce.
    rerender({ automaton: automatonB });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mocks.computeLayout).toHaveBeenCalledTimes(2);

    // Now resolve the FIRST (stale) promise. The hook must NOT commit it.
    vi.useRealTimers();
    const staleLayout: AutomatonUI = {
      states: new Map([
        [
          999,
          {
            id: 999,
            position: { x: 0, y: 0 },
            label: 'STALE',
            isStart: false,
            isAccept: false,
          },
        ],
      ]),
      transitions: new Map(),
      width: 100,
      height: 100,
    } as unknown as AutomatonUI;
    await act(async () => {
      resolveFirst!(staleLayout);
    });

    // The committed UI must come from the SECOND call (the default mock),
    // which used automatonB's states. State 999 from the stale layout
    // must not appear.
    await waitFor(() => {
      expect(result.current.automatonUI).not.toBeNull();
    });
    expect(result.current.automatonUI!.states.has(999)).toBe(false);
  });
});
