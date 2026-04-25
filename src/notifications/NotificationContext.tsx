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
  const dismissTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    const timer = dismissTimeoutsRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      dismissTimeoutsRef.current.delete(id);
    }
    setNotifications((previous) => previous.filter((notification) => notification.id !== id));
  }, []);

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
        const timer = setTimeout(() => {
          dismiss(id);
        }, autoDismissMs);
        dismissTimeoutsRef.current.set(id, timer);
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
    return () => {
      if (highlightTimeoutRef.current !== null) clearTimeout(highlightTimeoutRef.current);
      dismissTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
      dismissTimeoutsRef.current.clear();
    };
  }, []);

  const value: NotificationContextValue = {
    notifications,
    highlightedTarget,
    notify,
    dismiss,
    rehighlight,
  };

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}
