/**
 * useSettings — React-hook adapter over the settings store.
 *
 * Subscribes on mount, unsubscribes on unmount, and re-renders the
 * caller whenever any setting changes. Returns the current settings
 * snapshot plus an updater bound to the store. Cheap — many
 * components can use it without any React Context plumbing.
 *
 * Why not Context? The settings change rarely (user must open the
 * modal and toggle), and the singleton-with-listeners pattern keeps
 * non-React consumers (the side-effect appliers in store.ts) on the
 * same code path as React consumers.
 */

import { useSyncExternalStore } from 'react';
import {
  getSettings,
  subscribe,
  updateSetting,
  resetSettings,
} from './store';
import type { Settings } from './types';

export function useSettings(): {
  settings: Readonly<Settings>;
  update: typeof updateSetting;
  reset: typeof resetSettings;
} {
  const settings = useSyncExternalStore(subscribe, getSettings, getSettings);
  return { settings, update: updateSetting, reset: resetSettings };
}
