/**
 * @vitest-environment jsdom
 *
 * Tests for the notification store. We exercise the hook through React's
 * test renderer so we get realistic state updates (including timers).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { NotificationProvider } from './NotificationContext';
import { useNotifications } from './useNotifications';
import { HIGHLIGHT_DURATION_MS, DEFAULT_AUTO_DISMISS_MS } from './types';

function wrapper({ children }: { children: ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}

describe('NotificationProvider + useNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('throws when useNotifications is called outside the provider', () => {
    // renderHook without wrapper to ensure the error fires.
    expect(() => renderHook(() => useNotifications())).toThrow(
      /must be used within a <NotificationProvider>/
    );
  });

  it('starts with an empty stack and no highlight', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    expect(result.current.notifications).toEqual([]);
    expect(result.current.highlightedTarget).toBeNull();
  });

  it('notify() appends to the stack and returns an id', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.notify({ severity: 'error', title: 'broken' });
    });
    expect(id).toBeTruthy();
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]?.title).toBe('broken');
    expect(result.current.notifications[0]?.id).toBe(id);
  });

  it('notify() activates the target highlight and clears it after the duration', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.notify({
        severity: 'error',
        title: 'pulse me',
        target: { kind: 'state', stateId: 7 },
      });
    });
    expect(result.current.highlightedTarget).toEqual({ kind: 'state', stateId: 7 });
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION_MS + 50);
    });
    expect(result.current.highlightedTarget).toBeNull();
  });

  it('a second notification with a target preempts the first highlight', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.notify({
        severity: 'warning',
        title: 'first',
        target: { kind: 'state', stateId: 1 },
      });
    });
    expect(result.current.highlightedTarget).toEqual({ kind: 'state', stateId: 1 });
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.notify({
        severity: 'warning',
        title: 'second',
        target: { kind: 'alphabet', symbol: 'a' },
      });
    });
    expect(result.current.highlightedTarget).toEqual({ kind: 'alphabet', symbol: 'a' });
  });

  it('dismiss() removes the notification by id and cancels its auto-dismiss timer', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.notify({ severity: 'success', title: 'done' });
    });
    expect(result.current.notifications).toHaveLength(1);
    act(() => {
      result.current.dismiss(id);
    });
    expect(result.current.notifications).toHaveLength(0);
  });

  it('auto-dismisses non-error notifications using the default timing', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.notify({ severity: 'success', title: 'done' });
    });
    expect(result.current.notifications).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime((DEFAULT_AUTO_DISMISS_MS.success ?? 0) + 50);
    });
    expect(result.current.notifications).toHaveLength(0);
  });

  it('errors are sticky by default — no auto-dismiss', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.notify({ severity: 'error', title: 'broken' });
    });
    act(() => {
      // Run all pending timers (would dismiss anything time-based).
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.notifications).toHaveLength(1);
  });

  it('respects an explicit autoDismissMs override', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.notify({ severity: 'error', title: 'short error', autoDismissMs: 500 });
    });
    expect(result.current.notifications).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(550);
    });
    expect(result.current.notifications).toHaveLength(0);
  });

  it('rehighlight() reactivates the target on a stacked notification', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.notify({
        severity: 'error',
        title: 'edge',
        target: { kind: 'transition', from: 0, to: 1, symbol: '0' },
      });
    });
    // Let the highlight fade
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_DURATION_MS + 50);
    });
    expect(result.current.highlightedTarget).toBeNull();
    // Click again
    act(() => {
      result.current.rehighlight(id);
    });
    expect(result.current.highlightedTarget).toEqual({
      kind: 'transition',
      from: 0,
      to: 1,
      symbol: '0',
    });
  });

  it('rehighlight() on a missing id is a no-op (no crash)', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });
    act(() => {
      result.current.rehighlight('does-not-exist');
    });
    expect(result.current.highlightedTarget).toBeNull();
  });
});
