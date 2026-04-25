/**
 * useUndoRedoShortcuts
 *
 * Wires Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z (redo) into the global
 * keyboard scope. The handler delegates to the undo/redo functions the
 * caller threads in — the hook is stateless on its own, just a small
 * key-binding adapter.
 *
 * Browsers handle undo/redo natively for text fields, so the underlying
 * scope manager skips invocations while focus is in an input — no need
 * for a separate guard here.
 */

import { useKeyboardScope } from './useKeyboardScope';

export type UseUndoRedoShortcutsOptions = {
  undo: () => void;
  redo: () => void;
  /**
   * Whether the shortcut is currently active. Gate this on whichever
   * UI mode the application considers "editing" — the shortcut should
   * only fire when undo/redo is meaningful to the user. Defaults to
   * true for callers that don't care.
   */
  enabled?: boolean;
  /**
   * Reserved for future use — currently the handler always attempts the
   * undo/redo, and the underlying store no-ops when there's nothing to
   * pop. Threaded through so the hook can grow stricter gating without
   * a signature change.
   */
  canUndo?: boolean;
  canRedo?: boolean;
};

export function useUndoRedoShortcuts({ undo, redo, enabled = true }: UseUndoRedoShortcutsOptions): void {
  useKeyboardScope({
    id: 'app-undo-redo',
    active: enabled,
    capture: false,
    onKey: (event) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) return false;
      if (event.key.toLowerCase() !== 'z') return false;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return true;
    },
  });
}
