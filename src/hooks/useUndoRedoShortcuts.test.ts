/**
 * @vitest-environment jsdom
 *
 * Tests the contract: pressing Cmd/Ctrl+Z calls undo(), Cmd/Ctrl+Shift+Z
 * calls redo(), and other keys are ignored. Text-input filtering is the
 * scope-manager's responsibility (covered by useKeyboardScope.test.ts);
 * this hook just wires keys to callbacks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUndoRedoShortcuts } from './useUndoRedoShortcuts';
import { __resetKeyboardScopeForTests } from './useKeyboardScope';

function dispatch(key: string, init: KeyboardEventInit = {}) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  );
}

beforeEach(() => {
  __resetKeyboardScopeForTests();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  document.body.innerHTML = '';
});

describe('useUndoRedoShortcuts', () => {
  it('Cmd+Z calls undo', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoRedoShortcuts({ undo, redo }));
    dispatch('z', { metaKey: true });
    expect(undo).toHaveBeenCalledOnce();
    expect(redo).not.toHaveBeenCalled();
  });

  it('Ctrl+Z calls undo (Win/Linux)', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoRedoShortcuts({ undo, redo }));
    dispatch('z', { ctrlKey: true });
    expect(undo).toHaveBeenCalledOnce();
  });

  it('Cmd+Shift+Z calls redo', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoRedoShortcuts({ undo, redo }));
    dispatch('z', { metaKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
  });

  it('plain z (no modifier) is ignored', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoRedoShortcuts({ undo, redo }));
    dispatch('z');
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it('does not fire while focus is in a text input (scope-manager filter)', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    renderHook(() => useUndoRedoShortcuts({ undo, redo }));
    dispatch('z', { metaKey: true });
    expect(undo).not.toHaveBeenCalled();
  });
});
