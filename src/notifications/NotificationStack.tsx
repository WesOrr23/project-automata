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

import { useNotifications } from './useNotifications';
import { NotificationToast } from './NotificationToast';

export function NotificationStack() {
  const { notifications, dismiss, rehighlight } = useNotifications();

  if (notifications.length === 0) return null;

  // Newest first in the visual stack: render the array reversed so the most
  // recent notification is at the top of the column.
  const orderedTopFirst = [...notifications].reverse();

  return (
    <div
      className="notification-stack"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {orderedTopFirst.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => dismiss(notification.id)}
          onClick={() => rehighlight(notification.id)}
        />
      ))}
    </div>
  );
}
