/**
 * NotificationStack Component
 *
 * Fixed-position container in the top-right corner of the viewport. Renders
 * the active notifications (newest at the top) as toasts.
 *
 * No state of its own — pure consumer of `useNotifications()`.
 *
 * Mount once, near the root of the component tree (App.tsx). Toasts appear
 * regardless of which tab is open or what the user is doing.
 */

import { AnimatePresence } from 'motion/react';
import { useNotifications } from './useNotifications';
import { NotificationToast } from './NotificationToast';

export function NotificationStack() {
  const { notifications, dismiss, rehighlight, pauseDismiss, resumeDismiss } = useNotifications();

  // Newest first in the visual stack: render the array reversed so the most
  // recent notification is at the top of the column.
  const orderedTopFirst = [...notifications].reverse();

  return (
    // The stack stays mounted even when empty so AnimatePresence can run
    // exit animations on the last toast leaving (otherwise its parent
    // would unmount before the exit could play). The container is
    // pointer-events: none in CSS, so an empty stack doesn't intercept
    // anything.
    <div
      className="notification-stack"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {orderedTopFirst.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => dismiss(notification.id)}
            onClick={() => rehighlight(notification.id)}
            onPause={() => pauseDismiss(notification.id)}
            onResume={() => resumeDismiss(notification.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
