/**
 * useGlobalShortcuts — keyboard bindings that work in every stage.
 *
 *   F  → fit-to-view (recenter the canvas around the FA)
 *   ?  → open the onboarding tour (Shift+/)
 *
 * "Global" relative to stages — still scoped via useKeyboardScope
 * so typing into a text input doesn't trigger them, and the
 * onboarding tour can preempt them.
 *
 * Both keys are deliberately simple (no modifiers). F is a one-key
 * fit-to-view convention (Photoshop, Figma, GraphViz preview tools);
 * ? for help is a Stripe/Linear/GitHub convention.
 */

import { useKeyboardScope } from './useKeyboardScope';

type UseGlobalShortcutsArgs = {
  onFit: () => void;
  onShowTour: () => void;
};

export function useGlobalShortcuts({ onFit, onShowTour }: UseGlobalShortcutsArgs): void {
  useKeyboardScope({
    id: 'global-shortcuts',
    active: true,
    capture: false,
    inTextInputs: false,
    onKey: (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return false;
      // ? is Shift+/ on US layouts. event.key resolves to '?' across
      // layouts when shift+/ is the chord, so test the key directly.
      if (event.key === '?') {
        event.preventDefault();
        onShowTour();
        return true;
      }
      // F is bare-letter, case-insensitive.
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        onFit();
        return true;
      }
      return false;
    },
  });
}
