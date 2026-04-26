/**
 * useFileShortcuts — keyboard bindings for file operations.
 *
 *   ⌘S / Ctrl+S        → save
 *   ⌘⇧S / Ctrl+Shift+S → saveAs
 *   ⌘O / Ctrl+O        → open
 *   ⌘N / Ctrl+N        → new
 *
 * Scoped via useKeyboardScope so it cooperates with other handlers
 * (popovers etc.) on the stack. Gated on `enabled` — same pattern as
 * useUndoRedoShortcuts; the file ops only matter in EDIT mode.
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
      if (key === 'n') {
        event.preventDefault();
        onNew();
        return true;
      }
      return false;
    },
  });
}
