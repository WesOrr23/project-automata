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
import { motion } from 'motion/react';
import { AlertCircle, Info, CheckCircle, AlertTriangle, X } from 'lucide-react';
import type { Notification } from './types';

type NotificationToastProp = {
  notification: Notification;
  onDismiss: () => void;
  onClick: () => void;
  /** Called when the pointer enters the toast — provider pauses the
   *  auto-dismiss timer so the user has time to read. */
  onPause?: () => void;
  /** Called when the pointer leaves — provider re-arms the timer with
   *  whatever time was remaining when it was paused. */
  onResume?: () => void;
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
  onPause,
  onResume,
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
    // motion.div + AnimatePresence in the parent gives the toast a
    // graceful exit (slide right + fade) when dismissed by user click,
    // auto-timer, or stack churn — instead of snapping out of the DOM.
    // `layout` lets the surviving toasts ease into the gap a dismissed
    // sibling leaves behind, rather than jumping up.
    <motion.div
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
      className={`notification-toast notification-toast-${notification.severity}`}
      role={notification.severity === 'error' || notification.severity === 'warning' ? 'alert' : 'status'}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
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
    </motion.div>
  );
}
