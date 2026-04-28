/**
 * useGlobalShortcuts — keyboard bindings that work in every stage.
 *
 *   F     → fit-to-view (recenter the canvas around the FA)
 *   ?     → open the onboarding tour (Shift+/)
 *   Esc   → collapse the tool menu (only when it's OPEN on a tab —
 *           does NOT fire while a popover or modal owns Esc)
 *
 * "Global" relative to stages — still scoped via useKeyboardScope
 * so typing into a text input doesn't trigger them, and the
 * onboarding tour / batch-test modal / etc. can preempt via their
 * capture-true scopes.
 *
 * F is a one-key fit-to-view convention (Photoshop, Figma, GraphViz
 * preview tools); ? for help is a Stripe/Linear/GitHub convention;
 * Esc-to-collapse-menu is the only-key approach decided after
 * rejecting click-outside-to-collapse (which would conflict with
 * canvas pan).
 */

import { useKeyboardScope } from './useKeyboardScope';

type UseGlobalShortcutsArgs = {
  onFit: () => void;
  onShowTour: () => void;
  /** Whether the tool menu is currently OPEN on a tab. Used to gate
   *  the Esc-collapse handler so Esc remains free for other scopes
   *  when the menu is already collapsed/expanded. */
  menuIsOpen: boolean;
  /** Called when Esc fires while menu is open. App should collapse
   *  the menu (back to COLLAPSED, not EXPANDED). */
  onCollapseMenu: () => void;
};

export function useGlobalShortcuts({
  onFit,
  onShowTour,
  menuIsOpen,
  onCollapseMenu,
}: UseGlobalShortcutsArgs): void {
  useKeyboardScope({
    id: 'global-shortcuts',
    active: true,
    capture: false,
    inTextInputs: false,
    onKey: (event) => {
      // Esc collapses an open menu. Comes first so a closing menu
      // doesn't also trigger a second handler. Modal/popover scopes
      // sit above this one with capture:true, so this Esc only fires
      // when nothing else owns it.
      if (event.key === 'Escape' && menuIsOpen) {
        event.preventDefault();
        onCollapseMenu();
        return true;
      }
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
