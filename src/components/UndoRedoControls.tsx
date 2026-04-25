/**
 * UndoRedoControls
 *
 * Two small circular icon-only buttons, centered at the top of the
 * viewport, overlaid on the canvas area. Tooltips show the keyboard
 * shortcut using the host platform's modifier (⌘ on Mac, Ctrl elsewhere).
 *
 * Intentionally dumb: receives canUndo/canRedo flags and the two click
 * handlers, renders them. All history logic lives in useUndoableAutomaton.
 */

import { Undo2, Redo2 } from 'lucide-react';

type UndoRedoControlsProp = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

// Cheap platform detection. navigator.platform is deprecated in theory but
// still populated in every current browser; the result is only used to pick
// an emoji in a tooltip, so the failure mode if it's wrong is cosmetic.
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modifierGlyph = isMac ? '\u2318' : 'Ctrl';
const shiftGlyph = isMac ? '\u21e7' : 'Shift+';

export function UndoRedoControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: UndoRedoControlsProp) {
  return (
    <div className="undo-redo-controls" role="toolbar" aria-label="History">
      <button
        type="button"
        className="undo-redo-button"
        onClick={onUndo}
        disabled={!canUndo}
        title={`Undo (${modifierGlyph}Z)`}
        aria-label="Undo"
      >
        <Undo2 size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="undo-redo-button"
        onClick={onRedo}
        disabled={!canRedo}
        title={`Redo (${modifierGlyph}${shiftGlyph}Z)`}
        aria-label="Redo"
      >
        <Redo2 size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
