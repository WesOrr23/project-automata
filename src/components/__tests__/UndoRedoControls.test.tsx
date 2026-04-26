/**
 * @vitest-environment jsdom
 *
 * RTL tests for UndoRedoControls. Covers visibility gating, click
 * dispatch, and disabled-state per button.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { UndoRedoControls } from '../UndoRedoControls';

function defaultProps() {
  return {
    visible: true,
    canUndo: true,
    canRedo: true,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  };
}

describe('UndoRedoControls', () => {
  it('renders nothing when not visible', () => {
    const props = { ...defaultProps(), visible: false };
    const { queryByLabelText } = render(<UndoRedoControls {...props} />);
    expect(queryByLabelText('Undo')).toBeNull();
    expect(queryByLabelText('Redo')).toBeNull();
  });

  it('renders both buttons when visible', () => {
    const { getByLabelText } = render(<UndoRedoControls {...defaultProps()} />);
    expect(getByLabelText('Undo')).toBeTruthy();
    expect(getByLabelText('Redo')).toBeTruthy();
  });

  it('Undo click invokes onUndo', () => {
    const props = defaultProps();
    const { getByLabelText } = render(<UndoRedoControls {...props} />);
    fireEvent.click(getByLabelText('Undo'));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
    expect(props.onRedo).not.toHaveBeenCalled();
  });

  it('Redo click invokes onRedo', () => {
    const props = defaultProps();
    const { getByLabelText } = render(<UndoRedoControls {...props} />);
    fireEvent.click(getByLabelText('Redo'));
    expect(props.onRedo).toHaveBeenCalledTimes(1);
    expect(props.onUndo).not.toHaveBeenCalled();
  });

  it('Undo is disabled when canUndo is false', () => {
    const props = { ...defaultProps(), canUndo: false };
    const { getByLabelText } = render(<UndoRedoControls {...props} />);
    const button = getByLabelText('Undo') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(props.onUndo).not.toHaveBeenCalled();
  });

  it('Redo is disabled when canRedo is false', () => {
    const props = { ...defaultProps(), canRedo: false };
    const { getByLabelText } = render(<UndoRedoControls {...props} />);
    const button = getByLabelText('Redo') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(props.onRedo).not.toHaveBeenCalled();
  });
});
