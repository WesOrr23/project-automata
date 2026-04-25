/**
 * UndoRedoControls
 *
 * Two small circular icon-only buttons, centered at the top of the
 * viewport, overlaid on the canvas area. Tooltips show the keyboard
 * shortcut using the host platform's modifier (⌘ on Mac, Ctrl elsewhere).
 *
 * `visible` gates render via AnimatePresence so the toolbar fades + slides
 * in/out instead of snapping into existence. Intentionally dumb beyond
 * that — receives canUndo/canRedo flags and the two click handlers,
 * renders them. All history logic lives in useUndoableAutomaton.
 */

import { Undo2, Redo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type UndoRedoControlsProp = {
  visible: boolean;
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
  visible,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: UndoRedoControlsProp) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="undo-redo-controls"
          role="toolbar"
          aria-label="History"
          // Fade + tiny slide-down on enter, reverse on exit. Slightly faster
          // than the panel's 0.3s — toolbar appearance shouldn't compete
          // with the menu's primary motion.
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
