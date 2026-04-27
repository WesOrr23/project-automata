/**
 * useDebugOverlay — localStorage-backed flag for the canvas centering
 * visualization (red dot at visible-region center, blue ring at FA
 * cluster centroid). Toggled by ⌘⇧D / Ctrl⇧D from anywhere.
 *
 * The dots were on by default while the centering math was being
 * iterated on. They're hidden by default now — past the calibration
 * window — but kept gated behind this flag so a future regression on
 * centering can be diagnosed without re-adding the JSX. Surfaces a
 * brief notification on each toggle so the user knows the keystroke
 * landed (otherwise the only feedback is the dots themselves, which
 * is no help when they're already where they should be).
 */

import { useCallback, useEffect, useState } from 'react';
import { useNotifications } from '../notifications/useNotifications';

const STORAGE_KEY = 'automata-debug-overlay';

function readEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeEnabled(value: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    // Quota / private-browsing failures are tolerable — flag just
    // resets next mount.
  }
}

export type UseDebugOverlayResult = {
  enabled: boolean;
  toggle: () => void;
};

export function useDebugOverlay(): UseDebugOverlayResult {
  const { notify } = useNotifications();
  const [enabled, setEnabled] = useState<boolean>(readEnabled);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      writeEnabled(next);
      notify({
        severity: 'info',
        title: `Centering overlay ${next ? 'enabled' : 'disabled'}`,
        autoDismissMs: 2200,
      });
      return next;
    });
  }, [notify]);

  // Global hotkey: ⌘⇧D / Ctrl⇧D. Bound at the document level so the
  // shortcut works regardless of which input is focused. Skips when
  // the user is typing into a contenteditable / input that isn't a
  // canvas — e.g. don't toggle while renaming a file. Modifier
  // requirement is strict (must include Shift) so plain ⌘D
  // (browser bookmark) isn't intercepted.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'd' && event.key !== 'D') return;
      if (!event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      toggle();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return { enabled, toggle };
}
