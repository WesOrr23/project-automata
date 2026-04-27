/**
 * useOnboarding — first-launch detection + tutorial-button entry point.
 *
 * Uses a versioned localStorage key (`automata-onboarding-v1`). If the
 * key is null on mount, the tour shows automatically. Any dismissal
 * path writes the key. The `show()` method re-opens the tour
 * regardless of the flag (used by the "Show tour" item in the
 * CommandBar's ⋯ overflow).
 *
 * Versioned key so a major redesign can re-trigger for everyone by
 * bumping to `-v2`. Old key becomes dead.
 */

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'automata-onboarding-v1';

function readSeen(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function writeSeen(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, 'seen');
  } catch {
    // localStorage might be disabled (private browsing on Safari);
    // tour just shows again next mount. Acceptable.
  }
}

export type UseOnboardingResult = {
  visible: boolean;
  dismiss: () => void;
  show: () => void;
};

export function useOnboarding(): UseOnboardingResult {
  // Lazy initializer so we read localStorage exactly once on mount.
  const [visible, setVisible] = useState<boolean>(() => !readSeen());

  const dismiss = useCallback(() => {
    writeSeen();
    setVisible(false);
  }, []);

  const show = useCallback(() => {
    setVisible(true);
  }, []);

  return { visible, dismiss, show };
}

/** Exposed for tests + debugging. */
export const ONBOARDING_STORAGE_KEY = STORAGE_KEY;
