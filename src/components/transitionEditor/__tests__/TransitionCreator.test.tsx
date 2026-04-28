/**
 * @vitest-environment jsdom
 *
 * Tests for the TransitionCreator visual form. We render the component
 * with a controlled creationState + a spy dispatch so we can observe
 * what actions the form fires.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TransitionCreator } from '../TransitionCreator';
import {
  INITIAL_CREATION_STATE,
  type CreationState,
} from '../creationReducer';
import type { Automaton } from '../../../engine/types';

function makeAutomaton(): Automaton {
  return {
    type: 'DFA',
    states: new Set([0, 1]),
    alphabet: new Set(['a', 'b']),
    transitions: [],
    startState: 0,
    acceptStates: new Set(),
    nextStateId: 2,
  };
}

const displayLabels = new Map([
  [0, 'q0'],
  [1, 'q1'],
]);

const EPSILON = 'e';

function makeProps(overrides: {
  creationState?: CreationState;
  dispatch?: ReturnType<typeof vi.fn>;
  apply?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    automaton: makeAutomaton(),
    displayLabels,
    creationState: overrides.creationState ?? INITIAL_CREATION_STATE,
    creationDispatch: overrides.dispatch ?? vi.fn(),
    epsilonSymbol: EPSILON,
    onApplyTransitionEdit: overrides.apply ?? vi.fn(),
  };
}

describe('TransitionCreator', () => {
  it('renders the empty form initially', () => {
    const { container, getByText } = render(<TransitionCreator {...makeProps()} />);
    // The action button shows "Add" in create mode.
    expect(getByText('Add')).toBeTruthy();
    // The symbol input is present and empty.
    const input = container.querySelector('input[aria-label="Transition symbol"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('');
  });

  it('Add button is disabled when the form is incomplete', () => {
    const { getByText } = render(<TransitionCreator {...makeProps()} />);
    const button = getByText('Add').closest('button');
    expect(button?.disabled).toBe(true);
  });

  it('Add button is enabled when source, destination, and symbol are all filled', () => {
    const state: CreationState = {
      ...INITIAL_CREATION_STATE,
      source: 0,
      destination: 1,
      symbol: 'a',
    };
    const { getByText } = render(
      <TransitionCreator {...makeProps({ creationState: state })} />
    );
    const button = getByText('Add').closest('button');
    expect(button?.disabled).toBe(false);
  });

  it('typing in the symbol input dispatches symbolChanged', () => {
    const dispatch = vi.fn();
    const { container } = render(
      <TransitionCreator {...makeProps({ dispatch })} />
    );
    const input = container.querySelector('input[aria-label="Transition symbol"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'symbolChanged', symbol: 'a' });
  });

  it('clicking Add when ready calls onApplyTransitionEdit with the right payload', () => {
    const apply = vi.fn();
    const dispatch = vi.fn();
    const state: CreationState = {
      ...INITIAL_CREATION_STATE,
      source: 0,
      destination: 1,
      symbol: 'a',
    };
    const { getByText } = render(
      <TransitionCreator {...makeProps({ creationState: state, dispatch, apply })} />
    );
    fireEvent.click(getByText('Add'));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[0]).toEqual([]); // no removes
    expect(apply.mock.calls[0]?.[1]).toEqual([
      { from: 0, to: 1, symbol: 'a' },
    ]);
    // Reducer reset after commit.
    expect(dispatch).toHaveBeenCalledWith({ type: 'reset' });
  });

  it('Escape resets the form via dispatch (useKeyboardScope) when the form is non-empty', () => {
    const dispatch = vi.fn();
    // Form must be non-empty for the Esc scope to be active —
    // pass a state with a picked source so it has something to clear.
    // (Empty form pass-through is by design — Esc with nothing to
    // clear should bubble down to the global menu-collapse handler.)
    const stateWithSource: CreationState = {
      ...INITIAL_CREATION_STATE,
      source: 0,
      phase: 'picking-destination',
    };
    render(<TransitionCreator {...makeProps({ dispatch, creationState: stateWithSource })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'reset' });
  });

  it('Escape with an empty form does NOT consume the key (passes through to global handlers)', () => {
    const dispatch = vi.fn();
    render(<TransitionCreator {...makeProps({ dispatch })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('shows "Delete" as the action button when an existing transition is loaded unchanged', () => {
    // editingExisting + matching slots/symbol = mode 'delete'.
    const state: CreationState = {
      phase: 'idle',
      source: 0,
      destination: 1,
      symbol: 'a',
      editingExisting: { from: 0, to: 1, symbols: ['a'] },
    };
    const { getByText } = render(
      <TransitionCreator {...makeProps({ creationState: state })} />
    );
    expect(getByText('Delete')).toBeTruthy();
  });

  it('shows "Modify" as the action button when a loaded transition has been changed', () => {
    // Same loaded edge but with a different destination → mode 'modify'.
    const state: CreationState = {
      phase: 'idle',
      source: 0,
      destination: 0, // changed from 1 → 0
      symbol: 'a',
      editingExisting: { from: 0, to: 1, symbols: ['a'] },
    };
    const { getByText } = render(
      <TransitionCreator {...makeProps({ creationState: state })} />
    );
    expect(getByText('Modify')).toBeTruthy();
  });

  it('renders the symbol input pre-populated with the loaded transition symbol', () => {
    const state: CreationState = {
      phase: 'idle',
      source: 0,
      destination: 1,
      symbol: 'a',
      editingExisting: { from: 0, to: 1, symbols: ['a'] },
    };
    const { container } = render(
      <TransitionCreator {...makeProps({ creationState: state })} />
    );
    const input = container.querySelector('input[aria-label="Transition symbol"]') as HTMLInputElement;
    expect(input.value).toBe('a');
  });

  it('Delete mode click dispatches removes for every symbol on the loaded edge', () => {
    const apply = vi.fn();
    const dispatch = vi.fn();
    // Multi-symbol consolidated edge being deleted as one unit.
    const state: CreationState = {
      phase: 'idle',
      source: 0,
      destination: 1,
      symbol: 'a, b',
      editingExisting: { from: 0, to: 1, symbols: ['a', 'b'] },
    };
    const { getByText } = render(
      <TransitionCreator {...makeProps({ creationState: state, dispatch, apply })} />
    );
    fireEvent.click(getByText('Delete'));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[0]).toEqual([
      { from: 0, to: 1, symbol: 'a' },
      { from: 0, to: 1, symbol: 'b' },
    ]);
    expect(apply.mock.calls[0]?.[1]).toEqual([]);
    expect(dispatch).toHaveBeenCalledWith({ type: 'reset' });
  });

  it('renders an empty-alphabet hint when the alphabet is empty', () => {
    const automaton: Automaton = {
      ...makeAutomaton(),
      alphabet: new Set(),
    };
    const { container } = render(
      <TransitionCreator {...{ ...makeProps(), automaton }} />
    );
    expect(container.textContent).toContain('alphabet');
  });
});
