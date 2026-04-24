/**
 * NotificationToast Component
 *
 * One toast in the global notification stack. Displays:
 * - Severity icon + colored stripe on the left
 * - Title (always visible)
 * - Optional detail (collapsed by default; click toggles)
 * - Dismiss button (always visible on the right)
 *
 * Keyboard:
 * - Tab focuses the toast.
 * - Enter or Space toggles the detail expansion.
 * - Escape, Delete, Backspace dismiss the toast.
 */

import { useState } from 'react';
import { AlertCircle, Info, CheckCircle, AlertTriangle, X } from 'lucide-react';
import type { Notification } from './types';

type NotificationToastProp = {
  notification: Notification;
  onDismiss: () => void;
  onClick: () => void;
};

const SEVERITY_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
} as const;

export function NotificationToast({
  notification,
  onDismiss,
  onClick,
}: NotificationToastProp) {
  const [expanded, setExpanded] = useState(false);
  const Icon = SEVERITY_ICONS[notification.severity];
  const hasDetail = !!notification.detail;

  function handleToggle() {
    onClick(); // Re-highlight target.
    if (hasDetail) setExpanded((current) => !current);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    } else if (event.key === 'Escape' || event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onDismiss();
    }
  }

  return (
    <div
      className={`notification-toast notification-toast-${notification.severity}`}
      role={notification.severity === 'error' || notification.severity === 'warning' ? 'alert' : 'status'}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      aria-expanded={hasDetail ? expanded : undefined}
    >
      <div className="notification-toast-icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <div className="notification-toast-body">
        <div className="notification-toast-title">{notification.title}</div>
        {hasDetail && expanded && (
          <div className="notification-toast-detail">{notification.detail}</div>
        )}
      </div>
      <button
        className="notification-toast-dismiss"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
