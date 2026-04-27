/**
 * @vitest-environment jsdom
 *
 * RTL tests for ComparePicker. Tests the picker's three concerns:
 *   1. Visibility gating + close paths.
 *   2. Recents filtering: only DFAs with matching alphabet are
 *      enabled; everything else renders disabled with a reason.
 *   3. Click → onPicked dispatch with the parsed automaton.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ComparePicker } from '../ComparePicker';
import type { Automaton } from '../../engine/types';
import type { RecentEntry } from '../../files/recentsStore';
import type { FileAdapter } from '../../files/fileAdapter';
import { serializeAutomaton, defaultMetadata } from '../../files/format';

function dfa(): Automaton {
  return {
    type: 'DFA',
    states: new Set([0, 1]),
    alphabet: new Set(['0', '1']),
    transitions: [
      { from: 0, to: new Set([1]), symbol: '0' },
      { from: 0, to: new Set([0]), symbol: '1' },
      { from: 1, to: new Set([0]), symbol: '0' },
      { from: 1, to: new Set([1]), symbol: '1' },
    ],
    startState: 0,
    acceptStates: new Set([1]),
    nextStateId: 2,
  };
}

function nfa(): Automaton {
  return { ...dfa(), type: 'NFA' };
}

function dfaDifferentAlphabet(): Automaton {
  return {
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
}

function makeRecent(name: string, automaton: Automaton, id?: string): RecentEntry {
  const snapshot = serializeAutomaton(automaton, defaultMetadata(name));
  return {
    id: id ?? `id-${name}`,
    name,
    savedAt: new Date().toISOString(),
    openedAt: new Date().toISOString(),
    sizeBytes: snapshot.length,
    snapshot,
  };
}

const noopAdapter: FileAdapter = {
  save: async () => ({ ok: true, value: { name: 'unused' } }),
  open: async () => ({ ok: false, error: 'file-cancelled' }),
};

function defaultProps() {
  return {
    visible: true,
    current: dfa(),
    recents: [] as ReadonlyArray<RecentEntry>,
    adapter: noopAdapter,
    onPicked: vi.fn(),
    onClose: vi.fn(),
    notify: vi.fn(),
  };
}

describe('ComparePicker — visibility', () => {
  it('renders nothing when visible=false', () => {
    const { queryByRole } = render(<ComparePicker {...defaultProps()} visible={false} />);
    expect(queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog when visible=true', () => {
    const { getByRole } = render(<ComparePicker {...defaultProps()} />);
    expect(getByRole('dialog')).toBeTruthy();
  });
});

describe('ComparePicker — close paths', () => {
  it('Escape invokes onClose', () => {
    const props = defaultProps();
    render(<ComparePicker {...props} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('outside-click invokes onClose', () => {
    const props = defaultProps();
    render(<ComparePicker {...props} />);
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    fireEvent.mouseDown(outside);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('close button invokes onClose', () => {
    const props = defaultProps();
    const { getByLabelText } = render(<ComparePicker {...props} />);
    fireEvent.click(getByLabelText('Close comparison picker'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ComparePicker — recents filtering', () => {
  it('shows "No recent files" when none', () => {
    const { getByText } = render(<ComparePicker {...defaultProps()} />);
    expect(getByText('No recent files.')).toBeTruthy();
  });

  it('lists non-loadable recents alongside loadable ones (with reasons)', () => {
    // The picker no longer hides recents when none are loadable —
    // showing them as disabled-with-reason is more informative.
    const recents = [makeRecent('other.json', dfaDifferentAlphabet())];
    const { getByText } = render(<ComparePicker {...defaultProps()} recents={recents} />);
    expect(getByText('other.json')).toBeTruthy();
    expect(getByText('Different alphabet')).toBeTruthy();
  });

  it('lists matching DFA recents as enabled', () => {
    const recents = [makeRecent('match.json', dfa())];
    const { getByText } = render(<ComparePicker {...defaultProps()} recents={recents} />);
    const button = getByText('match.json').closest('button') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(false);
  });

  it('lists NFA recents as disabled with reason', () => {
    const recents = [makeRecent('nfa.json', nfa())];
    const { getByText } = render(<ComparePicker {...defaultProps()} recents={recents} />);
    const button = getByText('nfa.json').closest('button') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(true);
    expect(getByText('Not a DFA')).toBeTruthy();
  });

  it('lists alphabet-mismatch DFA recents as disabled with reason', () => {
    const recents = [
      makeRecent('match.json', dfa()),
      makeRecent('different.json', dfaDifferentAlphabet()),
    ];
    const { getByText } = render(<ComparePicker {...defaultProps()} recents={recents} />);
    const matchButton = getByText('match.json').closest('button') as HTMLButtonElement;
    const diffButton = getByText('different.json').closest('button') as HTMLButtonElement;
    expect(matchButton.disabled).toBe(false);
    expect(diffButton.disabled).toBe(true);
    expect(getByText('Different alphabet')).toBeTruthy();
  });
});

describe('ComparePicker — picking', () => {
  it('clicking an enabled recent dispatches onPicked with the parsed automaton', () => {
    const props = defaultProps();
    const recents = [makeRecent('match.json', dfa())];
    const { getByText } = render(<ComparePicker {...props} recents={recents} />);
    fireEvent.click(getByText('match.json'));
    expect(props.onPicked).toHaveBeenCalledTimes(1);
    const [picked, name] = props.onPicked.mock.calls[0]!;
    expect(picked.type).toBe('DFA');
    expect(name).toBe('match.json');
  });

  it('clicking a disabled recent does NOT dispatch onPicked', () => {
    const props = defaultProps();
    const recents = [makeRecent('nfa.json', nfa())];
    const { getByText } = render(<ComparePicker {...props} recents={recents} />);
    fireEvent.click(getByText('nfa.json'));
    expect(props.onPicked).not.toHaveBeenCalled();
  });
});
