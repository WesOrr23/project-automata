/**
 * CanvasZoomControls
 *
 * Bottom-right corner stack of three buttons: zoom in, zoom out,
 * fit-to-content. Always visible — zoom is canvas-wide, not gated
 * on a mode. Visual language matches CommandBar (pill, blur,
 * shadow). The earlier `1:1` button was removed: in this app
 * GraphViz lays out at arbitrary pixel units so "scale = 1.0" has
 * no inherent meaning to the user; Fit-to-view does what 1:1 was
 * supposed to do (show me the whole thing optimally).
 */

import { Plus, Minus, Maximize2 } from 'lucide-react';
import { motion } from 'motion/react';

type CanvasZoomControlsProp = {
  zoomIn: () => void;
  zoomOut: () => void;
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
        onClick={fitToContent}
        title="Fit to view (F)"
        aria-label="Fit to view"
      >
        <Maximize2 size={15} strokeWidth={2.25} />
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
    </motion.div>
  );
}
