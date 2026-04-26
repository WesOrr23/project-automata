/**
 * @vitest-environment jsdom
 *
 * RTL tests for CommandBar. Covers:
 *   - file segment is present in every appMode
 *   - EDIT segment (undo/redo + Convert to DFA) appears in EDITING and
 *     hides in IDLE / SIMULATING
 *   - clicks on file + edit buttons dispatch the right callbacks
 *   - the ⋯ popover opens, lists Save As + Recents, dispatches
 */

import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CommandBar, type CommandBarAppMode } from '../CommandBar';

function makeProps(overrides: Partial<ComponentProps<typeof CommandBar>> = {}) {
  return {
    appMode: 'IDLE' as CommandBarAppMode,
    currentName: null,
    isDirty: false,
    recents: [],
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpenRecent: vi.fn(),
    onForgetRecent: vi.fn(),
    canUndo: true,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canConvert: true,
    onConvertToDfa: vi.fn(),
    ...overrides,
  };
}

describe('CommandBar — file segment', () => {
  it('is present in IDLE mode', () => {
    const { getByLabelText, getByText } = render(<CommandBar {...makeProps()} />);
    expect(getByLabelText('New')).toBeTruthy();
    expect(getByLabelText('Open')).toBeTruthy();
    expect(getByLabelText('Save')).toBeTruthy();
    expect(getByText('Untitled')).toBeTruthy();
  });

  it('is present in EDITING mode', () => {
    const { getByLabelText } = render(<CommandBar {...makeProps({ appMode: 'EDITING' })} />);
    expect(getByLabelText('New')).toBeTruthy();
    expect(getByLabelText('Save')).toBeTruthy();
  });

  it('is present in SIMULATING mode', () => {
    const { getByLabelText } = render(<CommandBar {...makeProps({ appMode: 'SIMULATING' })} />);
    expect(getByLabelText('New')).toBeTruthy();
    expect(getByLabelText('Save')).toBeTruthy();
  });

  it('shows the current filename and dirty marker', () => {
    const { getByText, container } = render(
      <CommandBar {...makeProps({ currentName: 'myfa', isDirty: true })} />
    );
    expect(getByText('myfa')).toBeTruthy();
    expect(container.querySelector('.command-bar-dirty-dot')).toBeTruthy();
  });

  it('dispatches file callbacks on click', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CommandBar {...props} />);
    fireEvent.click(getByLabelText('New'));
    fireEvent.click(getByLabelText('Open'));
    fireEvent.click(getByLabelText('Save'));
    expect(props.onNew).toHaveBeenCalledTimes(1);
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });
});

describe('CommandBar — EDIT segment', () => {
  it('hides undo/redo and Convert in IDLE', () => {
    const { queryByLabelText, queryByText } = render(<CommandBar {...makeProps()} />);
    expect(queryByLabelText('Undo')).toBeNull();
    expect(queryByLabelText('Redo')).toBeNull();
    expect(queryByText('Convert to DFA')).toBeNull();
  });

  it('hides undo/redo and Convert in SIMULATING', () => {
    const { queryByLabelText, queryByText } = render(
      <CommandBar {...makeProps({ appMode: 'SIMULATING' })} />
    );
    expect(queryByLabelText('Undo')).toBeNull();
    expect(queryByLabelText('Redo')).toBeNull();
    expect(queryByText('Convert to DFA')).toBeNull();
  });

  it('shows undo/redo + Convert in EDITING when canConvert', () => {
    const { getByLabelText, getByText } = render(
      <CommandBar {...makeProps({ appMode: 'EDITING' })} />
    );
    expect(getByLabelText('Undo')).toBeTruthy();
    expect(getByLabelText('Redo')).toBeTruthy();
    expect(getByText('Convert to DFA')).toBeTruthy();
  });

  it('omits Convert when canConvert is false (DFA)', () => {
    const { queryByText, getByLabelText } = render(
      <CommandBar {...makeProps({ appMode: 'EDITING', canConvert: false })} />
    );
    expect(getByLabelText('Undo')).toBeTruthy();
    expect(queryByText('Convert to DFA')).toBeNull();
  });

  it('disables undo/redo when their flags are false', () => {
    const { getByLabelText } = render(
      <CommandBar {...makeProps({ appMode: 'EDITING', canUndo: false, canRedo: false })} />
    );
    expect((getByLabelText('Undo') as HTMLButtonElement).disabled).toBe(true);
    expect((getByLabelText('Redo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('dispatches undo / redo / convert', () => {
    const props = makeProps({ appMode: 'EDITING' });
    const { getByLabelText, getByText } = render(<CommandBar {...props} />);
    fireEvent.click(getByLabelText('Undo'));
    fireEvent.click(getByLabelText('Redo'));
    fireEvent.click(getByText('Convert to DFA'));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onRedo).toHaveBeenCalledTimes(1);
    expect(props.onConvertToDfa).toHaveBeenCalledTimes(1);
  });
});

describe('CommandBar — ⋯ popover', () => {
  it('opens on click and exposes Save As', () => {
    const props = makeProps();
    const { getByLabelText, getByText } = render(<CommandBar {...props} />);
    fireEvent.click(getByLabelText('More file actions'));
    const saveAs = getByText('Save As…');
    expect(saveAs).toBeTruthy();
    fireEvent.click(saveAs);
    expect(props.onSaveAs).toHaveBeenCalledTimes(1);
  });

  it('renders empty-recents message', () => {
    const { getByLabelText, getByText } = render(<CommandBar {...makeProps()} />);
    fireEvent.click(getByLabelText('More file actions'));
    expect(getByText('No recent files')).toBeTruthy();
  });

  it('lists recent entries and dispatches open / forget', () => {
    const props = makeProps({
      recents: [
        {
          id: 'a',
          name: 'foo.json',
          savedAt: new Date().toISOString(),
          openedAt: new Date().toISOString(),
          sizeBytes: 0,
          snapshot: '',
        },
      ],
    });
    const { getByLabelText, getByText } = render(<CommandBar {...props} />);
    fireEvent.click(getByLabelText('More file actions'));
    const openBtn = getByText('foo.json');
    fireEvent.click(openBtn);
    expect(props.onOpenRecent).toHaveBeenCalledWith('a');

    // Re-open the popover (clicking a recent closes it).
    fireEvent.click(getByLabelText('More file actions'));
    fireEvent.click(getByLabelText('Forget foo.json'));
    expect(props.onForgetRecent).toHaveBeenCalledWith('a');
  });
});
