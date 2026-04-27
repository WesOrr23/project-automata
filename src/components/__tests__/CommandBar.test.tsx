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
    onOpen: vi.fn().mockResolvedValue(undefined),
    onSave: vi.fn().mockResolvedValue(undefined),
    onSaveAs: vi.fn().mockResolvedValue(undefined),
    onOpenRecent: vi.fn(),
    onForgetRecent: vi.fn(),
    onRenameCurrent: vi.fn(),
    canUndo: true,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    operationsCategories: [],
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
  it('hides undo/redo in IDLE', () => {
    const { queryByLabelText } = render(<CommandBar {...makeProps()} />);
    expect(queryByLabelText('Undo')).toBeNull();
    expect(queryByLabelText('Redo')).toBeNull();
  });

  it('hides undo/redo in SIMULATING', () => {
    const { queryByLabelText } = render(
      <CommandBar {...makeProps({ appMode: 'SIMULATING' })} />
    );
    expect(queryByLabelText('Undo')).toBeNull();
    expect(queryByLabelText('Redo')).toBeNull();
  });

  it('shows undo/redo in EDITING', () => {
    const { getByLabelText } = render(
      <CommandBar {...makeProps({ appMode: 'EDITING' })} />
    );
    expect(getByLabelText('Undo')).toBeTruthy();
    expect(getByLabelText('Redo')).toBeTruthy();
  });

  it('disables undo/redo when their flags are false', () => {
    const { getByLabelText } = render(
      <CommandBar {...makeProps({ appMode: 'EDITING', canUndo: false, canRedo: false })} />
    );
    expect((getByLabelText('Undo') as HTMLButtonElement).disabled).toBe(true);
    expect((getByLabelText('Redo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('dispatches undo / redo', () => {
    const props = makeProps({ appMode: 'EDITING' });
    const { getByLabelText } = render(<CommandBar {...props} />);
    fireEvent.click(getByLabelText('Undo'));
    fireEvent.click(getByLabelText('Redo'));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onRedo).toHaveBeenCalledTimes(1);
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

});

describe('CommandBar — Recents popover (own button)', () => {
  it('renders empty-recents message', () => {
    const { getByLabelText, getByText } = render(<CommandBar {...makeProps()} />);
    fireEvent.click(getByLabelText('Recents'));
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
    fireEvent.click(getByLabelText('Recents'));
    const openBtn = getByText('foo.json');
    fireEvent.click(openBtn);
    expect(props.onOpenRecent).toHaveBeenCalledWith('a');

    // Re-open the popover (clicking a recent closes it).
    fireEvent.click(getByLabelText('Recents'));
    fireEvent.click(getByLabelText('Forget foo.json'));
    expect(props.onForgetRecent).toHaveBeenCalledWith('a');
  });
});

describe('CommandBar — inline rename', () => {
  it('clicking the filename swaps to a text input', () => {
    const { getByText, getByLabelText } = render(
      <CommandBar {...makeProps({ currentName: 'sample.json' })} />
    );
    fireEvent.click(getByText('sample.json'));
    const input = getByLabelText('Rename file') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('sample.json');
  });

  it('Enter commits via onRenameCurrent', () => {
    const props = makeProps({ currentName: 'old.json' });
    const { getByText, getByLabelText } = render(<CommandBar {...props} />);
    fireEvent.click(getByText('old.json'));
    const input = getByLabelText('Rename file') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new.json' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRenameCurrent).toHaveBeenCalledWith('new.json');
  });

  it('Escape discards (does not call onRenameCurrent)', () => {
    const props = makeProps({ currentName: 'old.json' });
    const { getByText, getByLabelText } = render(<CommandBar {...props} />);
    fireEvent.click(getByText('old.json'));
    const input = getByLabelText('Rename file') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new.json' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onRenameCurrent).not.toHaveBeenCalled();
  });

  it('empty rename is discarded', () => {
    const props = makeProps({ currentName: 'old.json' });
    const { getByText, getByLabelText } = render(<CommandBar {...props} />);
    fireEvent.click(getByText('old.json'));
    const input = getByLabelText('Rename file') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRenameCurrent).not.toHaveBeenCalled();
  });
});

describe('CommandBar — Operations menu in EDIT segment', () => {
  it('renders the Operations button only in EDITING', () => {
    const cats = [{ id: 'c', label: 'Conv', items: [{ id: 'x', label: 'X', enabled: true, onClick: vi.fn() }] }];
    const idleRender = render(<CommandBar {...makeProps({ operationsCategories: cats })} />);
    expect(idleRender.queryByLabelText('Operations')).toBeNull();
    idleRender.unmount();
    const editRender = render(<CommandBar {...makeProps({ appMode: 'EDITING', operationsCategories: cats })} />);
    expect(editRender.getByLabelText('Operations')).toBeTruthy();
  });

  it('clicking Operations opens a popover with the categories', () => {
    const onClick = vi.fn();
    const cats = [{ id: 'c', label: 'Conversions', items: [{ id: 'x', label: 'Convert', enabled: true, onClick }] }];
    const { getByLabelText, getByText } = render(
      <CommandBar {...makeProps({ appMode: 'EDITING', operationsCategories: cats })} />
    );
    fireEvent.click(getByLabelText('Operations'));
    expect(getByText('Conversions')).toBeTruthy();
    fireEvent.click(getByText('Convert'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
