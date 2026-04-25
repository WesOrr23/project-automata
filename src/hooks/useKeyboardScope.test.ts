/**
 * @vitest-environment jsdom
 *
 * Tests for the stack-based keyboard scope manager.
 *
 * The stack is module-level singleton state, so each test resets it via
 * __resetKeyboardScopeForTests() in beforeEach. We exercise the hook with
 * renderHook + dispatch synthetic KeyboardEvents on document.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useKeyboardScope,
  isTextInputFocused,
  __resetKeyboardScopeForTests,
} from './useKeyboardScope';

function dispatchKey(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  document.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  __resetKeyboardScopeForTests();
  // Ensure no lingering focused inputs from previous tests.
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  document.body.innerHTML = '';
});

describe('useKeyboardScope — stack ordering', () => {
  it('top-of-stack scope receives the event before lower scopes', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    renderHook(() =>
      useKeyboardScope({ id: 'lower', active: true, capture: false, onKey: lower })
    );
    renderHook(() =>
      useKeyboardScope({ id: 'upper', active: true, capture: false, onKey: upper })
    );
    dispatchKey('a');
    expect(upper).toHaveBeenCalledOnce();
    // Both should run because neither captured nor consumed.
    expect(lower).toHaveBeenCalledOnce();
    // Order: upper first.
    const upperCallOrder = upper.mock.invocationCallOrder[0]!;
    const lowerCallOrder = lower.mock.invocationCallOrder[0]!;
    expect(upperCallOrder).toBeLessThan(lowerCallOrder);
  });

  it('a scope unmount removes it from the stack', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardScope({ id: 'transient', active: true, onKey: handler })
    );
    unmount();
    dispatchKey('a');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useKeyboardScope — capture vs transparent', () => {
  it('capture: true blocks lower scopes even when handler does nothing', () => {
    const lower = vi.fn();
    const upper = vi.fn(); // returns undefined => not consumed, but capture=true
    renderHook(() =>
      useKeyboardScope({ id: 'lower', active: true, capture: false, onKey: lower })
    );
    renderHook(() =>
      useKeyboardScope({ id: 'upper-modal', active: true, capture: true, onKey: upper })
    );
    dispatchKey('Escape');
    expect(upper).toHaveBeenCalledOnce();
    expect(lower).not.toHaveBeenCalled();
  });

  it('transparent scope passes through when handler returns falsy', () => {
    const lower = vi.fn();
    const upper = vi.fn(() => false);
    renderHook(() =>
      useKeyboardScope({ id: 'lower', active: true, capture: false, onKey: lower })
    );
    renderHook(() =>
      useKeyboardScope({ id: 'upper', active: true, capture: false, onKey: upper })
    );
    dispatchKey('a');
    expect(upper).toHaveBeenCalledOnce();
    expect(lower).toHaveBeenCalledOnce();
  });

  it('transparent scope stops propagation when handler returns true', () => {
    const lower = vi.fn();
    const upper = vi.fn(() => true);
    renderHook(() =>
      useKeyboardScope({ id: 'lower', active: true, capture: false, onKey: lower })
    );
    renderHook(() =>
      useKeyboardScope({ id: 'upper', active: true, capture: false, onKey: upper })
    );
    dispatchKey('a');
    expect(upper).toHaveBeenCalledOnce();
    expect(lower).not.toHaveBeenCalled();
  });

  it('preventDefault inside a transparent handler counts as consumption', () => {
    const lower = vi.fn();
    const upper = vi.fn((event: KeyboardEvent) => {
      event.preventDefault();
    });
    renderHook(() =>
      useKeyboardScope({ id: 'lower', active: true, onKey: lower })
    );
    renderHook(() =>
      useKeyboardScope({ id: 'upper', active: true, onKey: upper })
    );
    dispatchKey('a');
    expect(upper).toHaveBeenCalledOnce();
    expect(lower).not.toHaveBeenCalled();
  });
});

describe('useKeyboardScope — text-input filtering', () => {
  it('skips scopes by default when focus is in an <input>', () => {
    const handler = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(isTextInputFocused()).toBe(true);

    renderHook(() => useKeyboardScope({ id: 'app', active: true, onKey: handler }));
    dispatchKey('z');
    expect(handler).not.toHaveBeenCalled();
  });

  it('opts in to text inputs when inTextInputs: true', () => {
    const handler = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() =>
      useKeyboardScope({
        id: 'inline',
        active: true,
        inTextInputs: true,
        onKey: handler,
      })
    );
    dispatchKey('Enter');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('a capturing scope still blocks lower scopes while in a text input, even though it is itself skipped', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useKeyboardScope({ id: 'lower', active: true, onKey: lower }));
    renderHook(() =>
      useKeyboardScope({ id: 'upper-modal', active: true, capture: true, onKey: upper })
    );
    dispatchKey('a');
    // upper has inTextInputs: false → skipped; but its capture=true still
    // owns the slot, so lower must not fire either.
    expect(upper).not.toHaveBeenCalled();
    expect(lower).not.toHaveBeenCalled();
  });
});

describe('useKeyboardScope — activation lifecycle', () => {
  it('inactive scopes do not receive events', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardScope({ id: 'idle', active: false, onKey: handler })
    );
    dispatchKey('a');
    expect(handler).not.toHaveBeenCalled();
  });

  it('toggling active true → false unregisters the scope', () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ active }) =>
        useKeyboardScope({ id: 'toggleable', active, onKey: handler }),
      { initialProps: { active: true } }
    );
    dispatchKey('a');
    expect(handler).toHaveBeenCalledOnce();
    act(() => {
      rerender({ active: false });
    });
    dispatchKey('a');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('latest handler closure is used after a re-render (no stale onKey)', () => {
    let captured = '';
    const { rerender } = renderHook(
      ({ marker }: { marker: string }) =>
        useKeyboardScope({
          id: 'latest',
          active: true,
          onKey: () => {
            captured = marker;
          },
        }),
      { initialProps: { marker: 'first' } }
    );
    dispatchKey('a');
    expect(captured).toBe('first');
    rerender({ marker: 'second' });
    dispatchKey('a');
    expect(captured).toBe('second');
  });
});
