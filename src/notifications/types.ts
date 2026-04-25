/**
 * Notification types
 *
 * A notification is a piece of feedback shown to the user in the global
 * notification stack. Notifications carry a severity, a short title, an
 * optional detail paragraph, and an optional "target" that refers to a
 * specific automaton element (state, transition, or alphabet symbol) which
 * can be visually highlighted when the notification is thrown or clicked.
 */

/**
 * Severity level of a notification.
 *
 * - 'error'   — something the user tried to do failed (e.g. duplicate edge)
 * - 'warning' — something may cause issues but is not a hard failure
 * - 'info'    — neutral informational message
 * - 'success' — an action completed successfully
 */
export type NotificationSeverity = 'error' | 'warning' | 'info' | 'success';

/**
 * A reference to something in the automaton the user can be guided to.
 *
 * When a notification has a target, the UI briefly highlights the matching
 * element in both the canvas and the tool menu. Clicking the notification in
 * the stack re-activates the highlight.
 */
export type NotificationTarget =
  | { kind: 'state'; stateId: number }
  | { kind: 'transition'; from: number; to: number; symbol: string | null }
  | { kind: 'alphabet'; symbol: string };

/**
 * A notification in the global stack.
 *
 * `id` is a UUID generated at notify-time. `createdAt` is used to order the
 * stack and to compute auto-dismiss. If `autoDismissMs` is null the
 * notification is sticky (must be dismissed manually).
 */
export type Notification = {
  id: string;
  severity: NotificationSeverity;
  title: string;
  detail?: string;
  target?: NotificationTarget;
  createdAt: number;
  autoDismissMs: number | null;
};

/**
 * Input passed to `notify()`. Everything except title + severity is optional.
 * The store fills in the id, createdAt, and default auto-dismiss timing.
 */
export type NotifyInput = {
  severity: NotificationSeverity;
  title: string;
  detail?: string;
  target?: NotificationTarget;
  /** Override the default auto-dismiss for this severity. Null = sticky. */
  autoDismissMs?: number | null;
};

/**
 * Default auto-dismiss timings per severity, in milliseconds.
 *
 * - Errors are sticky by default — they indicate something went wrong and
 *   the user should see it until they acknowledge.
 * - Warnings linger longer than info.
 * - Success fades fastest; it's just positive feedback.
 */
export const DEFAULT_AUTO_DISMISS_MS: Record<NotificationSeverity, number | null> = {
  error: null,
  warning: 10_000,
  info: 6_000,
  success: 4_000,
};

/**
 * How long a highlighted target stays visually active, in ms.
 * This is how long the canvas + menu pulse animations run.
 */
export const HIGHLIGHT_DURATION_MS = 2_000;
