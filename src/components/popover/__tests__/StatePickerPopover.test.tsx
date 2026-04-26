/**
 * @vitest-environment jsdom
 *
 * RTL tests for StatePickerPopover. Covers option rendering, selection
 * dispatch, click-outside close, Esc close, and arrow-key navigation +
 * Enter confirm.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { StatePickerPopover, type PickerOption } from '../StatePickerPopover';

const OPTIONS: PickerOption[] = [
  { value: '0', label: 'q0' },
  { value: '1', label: 'q1' },
  { value: '2', label: 'q2' },
];

function defaultProps() {
  return {
    options: OPTIONS,
    selectedValue: null as string | null,
    anchorRect: new DOMRect(100, 100, 40, 40),
    onPick: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('StatePickerPopover', () => {
  it('renders one option per state', () => {
    const { getByText } = render(<StatePickerPopover {...defaultProps()} />);
    expect(getByText('q0')).toBeTruthy();
    expect(getByText('q1')).toBeTruthy();
    expect(getByText('q2')).toBeTruthy();
  });

  it('clicking an option invokes onPick with the value', () => {
    const props = defaultProps();
    const { getByText } = render(<StatePickerPopover {...props} />);
    fireEvent.click(getByText('q1'));
    expect(props.onPick).toHaveBeenCalledWith('1');
  });

  it('marks the selected option with aria-selected=true', () => {
    const props = { ...defaultProps(), selectedValue: '1' };
    const { getByText } = render(<StatePickerPopover {...props} />);
    const button = getByText('q1').closest('button');
    expect(button?.getAttribute('aria-selected')).toBe('true');
    expect(getByText('q0').closest('button')?.getAttribute('aria-selected')).toBe('false');
  });

  it('Esc invokes onClose (via keyboard scope)', () => {
    const props = defaultProps();
    render(<StatePickerPopover {...props} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking outside the popover invokes onClose', () => {
    const props = defaultProps();
    render(<StatePickerPopover {...props} />);
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    fireEvent.mouseDown(outside);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the popover does NOT invoke onClose', () => {
    const props = defaultProps();
    const { getByText } = render(<StatePickerPopover {...props} />);
    // mousedown inside an option shouldn't trigger the outside handler.
    fireEvent.mouseDown(getByText('q0'));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('clicking on a .state-node-pickable does NOT invoke onClose (canvas-pick path)', () => {
    const props = defaultProps();
    render(<StatePickerPopover {...props} />);
    const pickable = document.createElement('div');
    pickable.className = 'state-node-pickable';
    document.body.appendChild(pickable);
    fireEvent.mouseDown(pickable);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('ArrowDown moves the highlight, Enter confirms', () => {
    const props = defaultProps();
    const { container } = render(<StatePickerPopover {...props} />);
    const listbox = container.querySelector('[role="listbox"]') as HTMLDivElement;
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    // Started at index 0 (no selectedValue) → ArrowDown → index 1 → Enter picks q1.
    expect(props.onPick).toHaveBeenCalledWith('1');
  });

  it('ArrowUp from the top wraps to the bottom', () => {
    const props = defaultProps();
    const { container } = render(<StatePickerPopover {...props} />);
    const listbox = container.querySelector('[role="listbox"]') as HTMLDivElement;
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(props.onPick).toHaveBeenCalledWith('2');
  });

  it('Home jumps to the first option, End jumps to the last', () => {
    const props = { ...defaultProps(), selectedValue: '1' };
    const { container } = render(<StatePickerPopover {...props} />);
    const listbox = container.querySelector('[role="listbox"]') as HTMLDivElement;
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(props.onPick).toHaveBeenCalledWith('2');
    fireEvent.keyDown(listbox, { key: 'Home' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(props.onPick).toHaveBeenLastCalledWith('0');
  });

  it('Space confirms the highlighted option (alias for Enter)', () => {
    const props = { ...defaultProps(), selectedValue: '2' };
    const { container } = render(<StatePickerPopover {...props} />);
    const listbox = container.querySelector('[role="listbox"]') as HTMLDivElement;
    fireEvent.keyDown(listbox, { key: ' ' });
    expect(props.onPick).toHaveBeenCalledWith('2');
  });
});
