/**
 * useFileShortcuts — keyboard bindings for file operations.
 *
 *   ⌘S / Ctrl+S         → save
 *   ⌘⇧S / Ctrl+Shift+S  → saveAs
 *   ⌘O / Ctrl+O         → open
 *   ⌘⌥N / Ctrl+Alt+N    → new
 *
 * Note on New: Chrome / Safari / Firefox all reserve ⌘N (Ctrl+N) for
 * "open a new browser window" and the spec doesn't let pages
 * preventDefault it. We use ⌘⌥N (Cmd+Option+N on Mac, Ctrl+Alt+N on
 * Windows/Linux) — same convention Adobe / Figma use for "new from
 * blank" so it's not entirely unfamiliar.
 *
 * Scoped via useKeyboardScope so it cooperates with other handlers
 * (popovers etc.) on the stack.
 */

import { useKeyboardScope } from './useKeyboardScope';

type UseFileShortcutsArgs = {
  enabled: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onNew: () => void;
};

export function useFileShortcuts({
  enabled,
  onSave,
  onSaveAs,
  onOpen,
  onNew,
}: UseFileShortcutsArgs): void {
  useKeyboardScope({
    id: 'file-shortcuts',
    active: enabled,
    capture: false,
    // Cmd+S etc. should fire even while focus is inside the symbol or
    // alphabet input — those modifiers are universally a "do file
    // operation" intent regardless of focus.
    inTextInputs: true,
    onKey: (event) => {
      // The shortcut belongs to the document, not to focus inside an
      // input — but for typing into the symbol input, Cmd+S should
      // still save. The browser tries to save the page as HTML at
      // ⌘S; we always want to override that, so preventDefault is
      // unconditional.
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return false;
      const key = event.key.toLowerCase();
      if (key === 's' && !event.shiftKey) {
        event.preventDefault();
        onSave();
        return true;
      }
      if (key === 's' && event.shiftKey) {
        event.preventDefault();
        onSaveAs();
        return true;
      }
      if (key === 'o') {
        event.preventDefault();
        onOpen();
        return true;
      }
      // ⌘⌥N (alt-modified) for new — bare ⌘N is browser-reserved.
      if (key === 'n' && event.altKey) {
        event.preventDefault();
        onNew();
        return true;
      }
      return false;
    },
  });
}
