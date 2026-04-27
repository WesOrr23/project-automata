/**
 * NotificationContext
 *
 * React Context + Provider that owns the global notification store.
 *
 * Design:
 * - The store is an array of Notifications, ordered by createdAt (newest last).
 * - A single `highlightedTarget` tracks the most-recently-activated target; it
 *   clears itself after HIGHLIGHT_DURATION_MS via a ref-stored timeout.
 * - Auto-dismiss is handled via per-notification setTimeout registered when
 *   the notification enters the store.
 *
 * Consumers use `useNotifications()` (defined in useNotifications.ts) rather
 * than `useContext` directly — the hook provides a cleaner API and a friendly
 * error when used outside the provider.
 */

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_AUTO_DISMISS_MS,
  HIGHLIGHT_DURATION_MS,
  type Notification,
  type NotificationTarget,
  type NotifyInput,
} from './types';

export type NotificationContextValue = {
  /** The current notification stack, oldest first. */
  notifications: Notification[];
  /** The target whose highlight is currently active, or null. */
  highlightedTarget: NotificationTarget | null;
  /** Create a new notification. Returns the generated id. */
  notify: (input: NotifyInput) => string;
  /** Remove a notification from the stack. */
  dismiss: (id: string) => void;
  /**
   * Re-activate the highlight for a notification's target. Used when the user
   * clicks a stacked notification to remind themselves what it referred to.
   */
  rehighlight: (id: string) => void;
  /**
   * Pause the auto-dismiss countdown for `id` (e.g. while the user
   * hovers the toast). Saves the remaining time so resumeDismiss can
   * pick up where it left off. No-op if the notification has no
   * auto-dismiss timer or is already paused.
   */
  pauseDismiss: (id: string) => void;
  /**
   * Resume a previously-paused auto-dismiss countdown. Re-arms the
   * timer with whatever time was remaining when paused. No-op if the
   * notification has no timer or isn't paused.
   */
  resumeDismiss: (id: string) => void;
};

export const NotificationContext = createContext<NotificationContextValue | null>(null);

type NotificationProviderProp = {
  children: ReactNode;
};

/**
 * Helper — generate a collision-resistant id. Prefer the platform UUID when
 * available; fall back to a random string for environments without it (older
 * test runners, non-secure contexts).
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function NotificationProvider({ children }: NotificationProviderProp) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [highlightedTarget, setHighlightedTarget] = useState<NotificationTarget | null>(null);

  // Tracks active timeouts so we can clean them up on unmount / overwrite.
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-notification dismiss state: the live timer (or null when paused),
  // how much of the original autoDismissMs is still left, and when the
  // current timer started (so a pause can subtract elapsed time). Lives
  // in a ref because it's bookkeeping for native timers, not React state.
  type DismissEntry = {
    timer: ReturnType<typeof setTimeout> | null;
    remainingMs: number;
    startedAt: number | null;
  };
  const dismissEntriesRef = useRef<Map<string, DismissEntry>>(new Map());

  // Schedule a timeout that clears the highlight after HIGHLIGHT_DURATION_MS.
  // Replaces any prior highlight timeout so the most recent activation wins.
  const activateHighlight = useCallback((target: NotificationTarget | undefined) => {
    if (!target) return;
    if (highlightTimeoutRef.current !== null) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedTarget(target);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTarget(null);
      highlightTimeoutRef.current = null;
    }, HIGHLIGHT_DURATION_MS);
  }, []);

  const dismiss = useCallback((id: string) => {
    const entry = dismissEntriesRef.current.get(id);
    if (entry !== undefined) {
      if (entry.timer !== null) clearTimeout(entry.timer);
      dismissEntriesRef.current.delete(id);
    }
    setNotifications((previous) => previous.filter((notification) => notification.id !== id));
  }, []);

  const pauseDismiss = useCallback((id: string) => {
    const entry = dismissEntriesRef.current.get(id);
    if (!entry || entry.timer === null || entry.startedAt === null) return;
    clearTimeout(entry.timer);
    entry.remainingMs = Math.max(0, entry.remainingMs - (Date.now() - entry.startedAt));
    entry.timer = null;
    entry.startedAt = null;
  }, []);

  const resumeDismiss = useCallback((id: string) => {
    const entry = dismissEntriesRef.current.get(id);
    if (!entry || entry.timer !== null) return;
    entry.startedAt = Date.now();
    entry.timer = setTimeout(() => dismiss(id), entry.remainingMs);
  }, [dismiss]);

  const notify = useCallback(
    (input: NotifyInput): string => {
      const id = generateId();
      const autoDismissMs =
        input.autoDismissMs !== undefined
          ? input.autoDismissMs
          : DEFAULT_AUTO_DISMISS_MS[input.severity];

      // Conditional spread keeps `detail` / `target` omit-only so
      // exactOptionalPropertyTypes isn't undermined: a missing key on the
      // input becomes a missing key on the stored Notification, never the
      // explicit `undefined` value the flag is meant to police.
      const notification: Notification = {
        id,
        severity: input.severity,
        title: input.title,
        ...(input.detail !== undefined && { detail: input.detail }),
        ...(input.target !== undefined && { target: input.target }),
        createdAt: Date.now(),
        autoDismissMs,
      };

      setNotifications((previous) => [...previous, notification]);
      activateHighlight(input.target);

      if (autoDismissMs !== null) {
        const startedAt = Date.now();
        const timer = setTimeout(() => {
          dismiss(id);
        }, autoDismissMs);
        dismissEntriesRef.current.set(id, {
          timer,
          remainingMs: autoDismissMs,
          startedAt,
        });
      }

      return id;
    },
    [activateHighlight, dismiss]
  );

  const rehighlight = useCallback(
    (id: string) => {
      const notification = notifications.find((n) => n.id === id);
      if (notification) {
        activateHighlight(notification.target);
      }
    },
    [notifications, activateHighlight]
  );

  // Clean up all pending timers on unmount.
  useEffect(() => {
    const entries = dismissEntriesRef.current;
    return () => {
      if (highlightTimeoutRef.current !== null) clearTimeout(highlightTimeoutRef.current);
      entries.forEach((entry) => {
        if (entry.timer !== null) clearTimeout(entry.timer);
      });
      entries.clear();
    };
  }, []);

  const value: NotificationContextValue = {
    notifications,
    highlightedTarget,
    notify,
    dismiss,
    rehighlight,
    pauseDismiss,
    resumeDismiss,
  };

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}
