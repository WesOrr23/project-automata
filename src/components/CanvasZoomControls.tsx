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

import { Plus, Minus, Maximize2, LocateFixed } from 'lucide-react';
import { motion } from 'motion/react';

type CanvasZoomControlsProp = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToContent: () => void;
  /** Translate the FA to the visible-region center at current scale. */
  centerToContent: () => void;
  /** True when the FA's bbox center matches the visible center at the
   *  current scale. Drives the middle button's two-stage behavior:
   *  off-center → click recenters; centered → click fits. */
  isCentered: boolean;
  atMaxScale: boolean;
  atMinScale: boolean;
  /** Current raw viewport scale. */
  scale: number;
  /** The scale at which fitToContent would land. Display percent is
   *  computed as `(scale / fitScale) * 100`, so 100% means "fits the
   *  visible region with padding," not "GraphViz's natural pixel
   *  size" (which is meaningless to the user). null when sizes
   *  aren't yet measurable; in that case we fall back to the raw
   *  scale percentage. */
  fitScale?: number | null;
};

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modifierGlyph = isMac ? '\u2318' : 'Ctrl';

export function CanvasZoomControls({
  zoomIn,
  zoomOut,
  fitToContent,
  centerToContent,
  isCentered,
  atMaxScale,
  atMinScale,
  scale,
  fitScale,
}: CanvasZoomControlsProp) {
  // Display percent: scale relative to fit. 100% = fit-to-content.
  // Fallback to raw scale percentage when fitScale isn't ready yet
  // (very early mount, before viewport sizes are measured).
  const percent =
    fitScale && fitScale > 0
      ? Math.round((scale / fitScale) * 100)
      : Math.round(scale * 100);
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
      {/* Middle button: two-stage. At rest shows current zoom %.
          On hover, swaps (CSS crossfade) to the action icon for the
          NEXT click:
            - FA off-center → "recenter" icon; click translates the
              FA to the visible-region center (no scale change).
            - FA already centered → "fit" icon; click does the
              full fit-to-view (scale + center).
          Letting the user re-center without losing zoom level is the
          common case when they've panned to inspect a corner; the
          fit-to-view stage is then one extra click away once the
          recenter is done. */}
      <button
        type="button"
        className="canvas-zoom-button canvas-zoom-fit"
        onClick={isCentered ? fitToContent : centerToContent}
        title={isCentered ? 'Fit to view (F)' : 'Recenter'}
        aria-label={
          isCentered
            ? `Fit to view (current: ${percent}%)`
            : `Recenter (current: ${percent}%)`
        }
      >
        <span className="canvas-zoom-fit-percent">{percent}%</span>
        <span className="canvas-zoom-fit-icon">
          {isCentered ? (
            <Maximize2 size={15} strokeWidth={2.25} />
          ) : (
            <LocateFixed size={15} strokeWidth={2.25} />
          )}
        </span>
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
