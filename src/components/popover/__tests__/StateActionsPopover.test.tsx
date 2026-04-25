/**
 * @vitest-environment jsdom
 *
 * Tests for StateActionsPopover. Covers the four action buttons, the
 * keyboard shortcuts wired through useKeyboardScope, and focus
 * restoration on unmount.
 *
 * The popover dispatches its keyboard handlers via a document-level
 * keydown listener (managed by the keyboard-scope hook). We trigger
 * those by dispatching KeyboardEvents on `document` directly.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { StateActionsPopover } from '../StateActionsPopover';

function defaultProps() {
  return {
    stateLabel: 'q0',
    isStartState: false,
    isAcceptState: false,
    canDelete: true,
    anchorRect: new DOMRect(100, 100, 40, 40),
    onSetStart: vi.fn(),
    onToggleAccept: vi.fn(),
    onCreateTransition: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('StateActionsPopover', () => {
  it('renders the four action buttons', () => {
    const props = defaultProps();
    const { getByText } = render(<StateActionsPopover {...props} />);
    // Set as start, Set as accept, New transition, Delete.
    expect(getByText('Set as start')).toBeTruthy();
    expect(getByText('Set as accept')).toBeTruthy();
    expect(getByText('New transition')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
  });

  it('shows "Start state" (disabled) when this state is already the start', () => {
    const props = { ...defaultProps(), isStartState: true };
    const { getByText } = render(<StateActionsPopover {...props} />);
    const button = getByText('Start state').closest('button');
    expect(button?.disabled).toBe(true);
  });

  it('shows "Unset accept" when this state is an accept state', () => {
    const props = { ...defaultProps(), isAcceptState: true };
    const { getByText } = render(<StateActionsPopover {...props} />);
    expect(getByText('Unset accept')).toBeTruthy();
  });

  it('disables Delete when canDelete is false', () => {
    const props = { ...defaultProps(), canDelete: false };
    const { getByText } = render(<StateActionsPopover {...props} />);
    const button = getByText('Delete').closest('button');
    expect(button?.disabled).toBe(true);
  });

  it('Esc calls onClose', () => {
    const props = defaultProps();
    render(<StateActionsPopover {...props} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('Space triggers onCreateTransition (the "default" action)', () => {
    const props = defaultProps();
    render(<StateActionsPopover {...props} />);
    fireEvent.keyDown(document, { key: ' ' });
    expect(props.onCreateTransition).toHaveBeenCalledTimes(1);
  });

  it('Del triggers onDelete when canDelete is true', () => {
    const props = defaultProps();
    render(<StateActionsPopover {...props} />);
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('Backspace also triggers onDelete (companion shortcut)', () => {
    const props = defaultProps();
    render(<StateActionsPopover {...props} />);
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('Del does NOT trigger onDelete when canDelete is false', () => {
    const props = { ...defaultProps(), canDelete: false };
    render(<StateActionsPopover {...props} />);
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('clicking Set as start calls onSetStart', () => {
    const props = defaultProps();
    const { getByText } = render(<StateActionsPopover {...props} />);
    fireEvent.click(getByText('Set as start'));
    expect(props.onSetStart).toHaveBeenCalledTimes(1);
  });

  it('clicking Set as accept calls onToggleAccept', () => {
    const props = defaultProps();
    const { getByText } = render(<StateActionsPopover {...props} />);
    fireEvent.click(getByText('Set as accept'));
    expect(props.onToggleAccept).toHaveBeenCalledTimes(1);
  });

  it('mousedown outside the popover triggers onClose', () => {
    const props = defaultProps();
    render(<StateActionsPopover {...props} />);
    // Dispatch on the body (outside the popover root).
    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('mousedown inside the popover does not trigger onClose', () => {
    const props = defaultProps();
    const { container } = render(<StateActionsPopover {...props} />);
    const popover = container.querySelector('.state-actions-popover');
    expect(popover).not.toBeNull();
    fireEvent.mouseDown(popover!);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the previously-focused element on unmount', () => {
    // Set up a focusable element outside the popover; focus it.
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const props = defaultProps();
    const { unmount } = render(<StateActionsPopover {...props} />);
    // Mount steals focus to the popover root; that's expected.
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });
});
