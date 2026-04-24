/**
 * useNotifications hook
 *
 * Thin wrapper around `useContext(NotificationContext)` that throws a helpful
 * error if called outside the provider. Components should always import this
 * instead of touching the context directly.
 *
 * @example
 *   const { notify } = useNotifications();
 *   notify({ severity: 'error', title: 'Something broke' });
 */

import { useContext } from 'react';
import { NotificationContext, type NotificationContextValue } from './NotificationContext';

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (value === null) {
    throw new Error(
      'useNotifications must be used within a <NotificationProvider>. ' +
        'Wrap your app (usually in main.tsx) with <NotificationProvider>.'
    );
  }
  return value;
}
