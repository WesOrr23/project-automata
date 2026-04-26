/**
 * CanvasZoomControls
 *
 * Bottom-right corner stack of four buttons that drive the canvas
 * viewport: zoom in, zoom out, fit-to-content, reset to 100%. Always
 * visible — no hover-to-reveal — because the controls are part of the
 * canvas's primary interaction surface, not a secondary panel.
 *
 * The buttons mirror the visual language of UndoRedoControls (same
 * pill-on-a-card shape, same subtle shadow, same hover/active tints)
 * but are stacked vertically so they don't compete with the top-center
 * undo toolbar or the right-side notification stack.
 */

import { Plus, Minus, Maximize2 } from 'lucide-react';
import { motion } from 'motion/react';

type CanvasZoomControlsProp = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  fitToContent: () => void;
  atMaxScale: boolean;
  atMinScale: boolean;
};

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modifierGlyph = isMac ? '\u2318' : 'Ctrl';

export function CanvasZoomControls({
  zoomIn,
  zoomOut,
  reset,
  fitToContent,
  atMaxScale,
  atMinScale,
}: CanvasZoomControlsProp) {
  return (
    // `layout` enables Framer's automatic position-change animation:
    // when a sibling in the parent stack mounts/unmounts (canvas-tip
    // appearing/disappearing), this element's CSS-driven position
    // changes are animated rather than snapping.
    <motion.div
      layout="position"
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="canvas-zoom-controls"
      role="toolbar"
      aria-label="Canvas zoom"
    >
      <button
        type="button"
        className="canvas-zoom-button"
        onClick={zoomIn}
        disabled={atMaxScale}
        title={`Zoom in (${modifierGlyph}+)`}
        aria-label="Zoom in"
      >
        <Plus size={16} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className="canvas-zoom-button"
        onClick={zoomOut}
        disabled={atMinScale}
        title={`Zoom out (${modifierGlyph}-)`}
        aria-label="Zoom out"
      >
        <Minus size={16} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className="canvas-zoom-button"
        onClick={fitToContent}
        title="Fit to view (F)"
        aria-label="Fit to view"
      >
        <Maximize2 size={15} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className="canvas-zoom-button canvas-zoom-button-text"
        onClick={reset}
        title={`Reset zoom (${modifierGlyph}0)`}
        aria-label="Reset zoom"
      >
        1:1
      </button>
    </motion.div>
  );
}
