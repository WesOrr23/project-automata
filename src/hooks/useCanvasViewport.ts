/**
 * useCanvasViewport
 *
 * Owns the canvas zoom + pan state for the AutomatonCanvas SVG. The hook
 * exposes:
 *
 *  - A `transform` string suitable for an SVG `<g>` wrapping the canvas
 *    content (state nodes, edges, start arrow). The transform is
 *    `translate(panX, panY) scale(scale)` — translate-then-scale matches
 *    "anchor the world at the current pan offset, then zoom" semantics.
 *  - Pointer / wheel handlers to attach to the SVG element. Wheel does
 *    pan-by-delta (or zoom-toward-cursor when `ctrlKey` is set, which
 *    captures both Cmd+wheel and trackpad pinch). Drag does pan, but
 *    skips drags that originated on a state node or transition edge so
 *    those gestures stay free for clicks.
 *  - Programmatic `zoomIn`, `zoomOut`, `reset`, `fitToContent` controls
 *    for buttons / keyboard shortcuts. These keep the viewport center
 *    stable so the user doesn't lose their place when zooming.
 *
 * State shape is `{ scale, panX, panY }` — three plain numbers, fully
 * derivable from the wheel/pointer input stream. No imperative SVG
 * matrix manipulation; React owns the values, the SVG just renders them.
 *
 * Scale is clamped to [0.25, 4.0]. Pan is clamped so at least a portion
 * of the content stays inside the viewport (so the user can park the
 * canvas off-center but can't lose it entirely).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4.0;
const ZOOM_STEP = 1.25;
const PAN_STEP = 10;
const PAN_STEP_LARGE = 50;
const FIT_PADDING = 40;
/** Duration the `isAnimating` flag stays true after a button-driven
 * action, so the consumer can apply a CSS / Framer transition for the
 * resulting transform change. Wheel/pinch/drag are NOT button-driven —
 * they keep the flag false so each input sample renders instantly. */
const BUTTON_ANIMATION_MS = 300;

export type CanvasViewport = {
  scale: number;
  panX: number;
  panY: number;
};

const DEFAULT_VIEWPORT: CanvasViewport = { scale: 1, panX: 0, panY: 0 };

export type UseCanvasViewportArgs = {
  /**
   * The natural-content size of the SVG (i.e. the un-zoomed bounding
   * box used by AutomatonCanvas's base viewBox). Needed for
   * `fitToContent` and pan clamping.
   */
  contentBoundingBox: { width: number; height: number } | null;
  /**
   * The visible CSS-pixel size of the SVG element. Needed for
   * `fitToContent` and zoom-toward-center math.
   */
  viewportSize: { width: number; height: number } | null;
};

export type UseCanvasViewportResult = {
  viewport: CanvasViewport;
  /** SVG transform string for the wrapping content `<g>`. */
  transform: string;
  handlers: {
    onWheel: (event: React.WheelEvent<SVGSVGElement>) => void;
    onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  };
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  fitToContent: () => void;
  panBy: (deltaX: number, deltaY: number) => void;
  /** True when zoomIn is a no-op (already at MAX_SCALE). */
  atMaxScale: boolean;
  /** True when zoomOut is a no-op (already at MIN_SCALE). */
  atMinScale: boolean;
  /**
   * True for ~300ms after a button-driven action (zoomIn, zoomOut,
   * reset, fitToContent, or keyboard equivalents). Consumer should
   * apply a transform transition while this is true so the view eases
   * to its new state instead of snapping. Wheel/pinch/drag don't set
   * this — they're already smooth from the user's input cadence.
   */
  isAnimating: boolean;
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Clamp pan so the scaled content can be parked partly off-screen but
 * not lost. The content is allowed to slide until only a thin margin
 * remains visible inside the viewport — generous enough to support
 * deliberate off-center parking while still preventing "where did my
 * graph go?" accidents.
 */
function clampPan(
  panX: number,
  panY: number,
  scale: number,
  contentBoundingBox: { width: number; height: number } | null,
  viewportSize: { width: number; height: number } | null
): { panX: number; panY: number } {
  if (contentBoundingBox === null || viewportSize === null) {
    return { panX, panY };
  }
  const scaledWidth = contentBoundingBox.width * scale;
  const scaledHeight = contentBoundingBox.height * scale;
  // Allow the content to slide until only ~80px remains in view (or
  // half its size, whichever is smaller — for tiny content keep at
  // least half visible).
  const minVisible = 80;
  const marginX = Math.min(scaledWidth - minVisible, scaledWidth / 2);
  const marginY = Math.min(scaledHeight - minVisible, scaledHeight / 2);
  // panX range: [viewportWidth - scaledWidth - marginX, marginX]
  // (panX is the world-origin's x in viewport pixels; high panX pushes
  // content right.)
  const minPanX = viewportSize.width - scaledWidth - marginX;
  const maxPanX = marginX;
  const minPanY = viewportSize.height - scaledHeight - marginY;
  const maxPanY = marginY;
  return {
    panX: clamp(panX, Math.min(minPanX, maxPanX), Math.max(minPanX, maxPanX)),
    panY: clamp(panY, Math.min(minPanY, maxPanY), Math.max(minPanY, maxPanY)),
  };
}

export function useCanvasViewport(
  args: UseCanvasViewportArgs
): UseCanvasViewportResult {
  const { contentBoundingBox, viewportSize } = args;
  const [viewport, setViewport] = useState<CanvasViewport>(DEFAULT_VIEWPORT);
  const [isAnimating, setIsAnimating] = useState(false);

  // Drag state lives in a ref — it doesn't drive renders, just bookkeeping
  // for the in-progress pan gesture.
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  // Refs for the latest sizes so callbacks captured by event listeners
  // always read fresh values without re-binding handlers every render.
  const contentBoxRef = useRef(contentBoundingBox);
  contentBoxRef.current = contentBoundingBox;
  const viewportSizeRef = useRef(viewportSize);
  viewportSizeRef.current = viewportSize;

  // Mutable timer ref so successive button presses extend (rather than
  // stack) the animation window.
  const animationTimerRef = useRef<number | null>(null);
  const triggerAnimation = useCallback(() => {
    setIsAnimating(true);
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
    }
    animationTimerRef.current = window.setTimeout(() => {
      setIsAnimating(false);
      animationTimerRef.current = null;
    }, BUTTON_ANIMATION_MS);
  }, []);
  // Clean up on unmount so the timer doesn't try to setState on a dead
  // component.
  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setViewport((current) => {
      const clamped = clampPan(
        current.panX + deltaX,
        current.panY + deltaY,
        current.scale,
        contentBoxRef.current,
        viewportSizeRef.current
      );
      if (clamped.panX === current.panX && clamped.panY === current.panY) {
        return current;
      }
      return { ...current, panX: clamped.panX, panY: clamped.panY };
    });
  }, []);

  const zoomIn = useCallback(() => {
    triggerAnimation();
    const size = viewportSizeRef.current;
    const anchorX = size ? size.width / 2 : 0;
    const anchorY = size ? size.height / 2 : 0;
    setViewport((current) => {
      const newScale = clamp(current.scale * ZOOM_STEP, MIN_SCALE, MAX_SCALE);
      if (newScale === current.scale) return current;
      const worldX = (anchorX - current.panX) / current.scale;
      const worldY = (anchorY - current.panY) / current.scale;
      const newPanX = anchorX - worldX * newScale;
      const newPanY = anchorY - worldY * newScale;
      const clamped = clampPan(
        newPanX,
        newPanY,
        newScale,
        contentBoxRef.current,
        viewportSizeRef.current
      );
      return { scale: newScale, panX: clamped.panX, panY: clamped.panY };
    });
  }, [triggerAnimation]);

  const zoomOut = useCallback(() => {
    triggerAnimation();
    const size = viewportSizeRef.current;
    const anchorX = size ? size.width / 2 : 0;
    const anchorY = size ? size.height / 2 : 0;
    setViewport((current) => {
      const newScale = clamp(current.scale / ZOOM_STEP, MIN_SCALE, MAX_SCALE);
      if (newScale === current.scale) return current;
      const worldX = (anchorX - current.panX) / current.scale;
      const worldY = (anchorY - current.panY) / current.scale;
      const newPanX = anchorX - worldX * newScale;
      const newPanY = anchorY - worldY * newScale;
      const clamped = clampPan(
        newPanX,
        newPanY,
        newScale,
        contentBoxRef.current,
        viewportSizeRef.current
      );
      return { scale: newScale, panX: clamped.panX, panY: clamped.panY };
    });
  }, [triggerAnimation]);

  const reset = useCallback(() => {
    triggerAnimation();
    setViewport(DEFAULT_VIEWPORT);
  }, [triggerAnimation]);

  /**
   * Fit the content bounding box inside the viewport with a small
   * padding. Picks the smaller of the two axis-fit ratios so the entire
   * content is visible (no cropping). Then centers the result.
   */
  const fitToContent = useCallback(() => {
    triggerAnimation();
    const content = contentBoxRef.current;
    const view = viewportSizeRef.current;
    if (content === null || view === null) return;
    if (content.width <= 0 || content.height <= 0) return;
    if (view.width <= 0 || view.height <= 0) return;
    const availableWidth = Math.max(view.width - FIT_PADDING * 2, 1);
    const availableHeight = Math.max(view.height - FIT_PADDING * 2, 1);
    const scaleX = availableWidth / content.width;
    const scaleY = availableHeight / content.height;
    const targetScale = clamp(
      Math.min(scaleX, scaleY),
      MIN_SCALE,
      MAX_SCALE
    );
    const scaledWidth = content.width * targetScale;
    const scaledHeight = content.height * targetScale;
    const panX = (view.width - scaledWidth) / 2;
    const panY = (view.height - scaledHeight) / 2;
    setViewport({ scale: targetScale, panX, panY });
  }, [triggerAnimation]);

  /**
   * Wheel handler. The browser sets `ctrlKey` for trackpad pinch as
   * well as Ctrl/Cmd+wheel — that's the cross-browser convention for
   * "this is a zoom gesture, not a scroll gesture." Otherwise it's a
   * two-axis pan (deltaX/deltaY).
   */
  const onWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      // preventDefault keeps the page from scrolling under us. We can
      // call it freely here since the SVG isn't a scroll container.
      event.preventDefault();
      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      if (event.ctrlKey) {
        // Pinch / Cmd+wheel: zoom toward cursor. Use exponential
        // scaling on deltaY so the gesture feels uniform regardless
        // of speed; small delta = small zoom, large delta = large.
        const zoomFactor = Math.exp(-event.deltaY / 100);
        setViewport((current) => {
          const newScale = clamp(current.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
          if (newScale === current.scale) return current;
          const worldX = (cursorX - current.panX) / current.scale;
          const worldY = (cursorY - current.panY) / current.scale;
          const newPanX = cursorX - worldX * newScale;
          const newPanY = cursorY - worldY * newScale;
          const clamped = clampPan(
            newPanX,
            newPanY,
            newScale,
            contentBoxRef.current,
            viewportSizeRef.current
          );
          return { scale: newScale, panX: clamped.panX, panY: clamped.panY };
        });
      } else {
        // Two-finger scroll = pan. Negate so the content moves with
        // the gesture (drag your fingers right → content slides
        // right, matching native scroll feel).
        panBy(-event.deltaX, -event.deltaY);
      }
    },
    [panBy]
  );

  /**
   * Pointer-down on empty canvas starts a pan gesture. We skip drags
   * that originated on a state node or transition edge so those
   * gestures stay free for clicks (drag-on-state would otherwise pan
   * AND register as a click, which is jarring).
   */
  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      if (target !== null) {
        // Walk up from the click target looking for an interactive
        // group. If we find one, this isn't an empty-canvas drag —
        // bail and let the node/edge handle the click.
        if (target.closest('[data-state-id]')) return;
        if (target.closest('.transition-edge-clickable')) return;
      }
      dragRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      // setPointerCapture so we keep getting events even if the cursor
      // leaves the SVG mid-drag.
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    []
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (drag === null) return;
      if (drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.lastX;
      const deltaY = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      panBy(deltaX, deltaY);
    },
    [panBy]
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (drag === null) return;
      if (drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Already released (e.g. element unmounted) — nothing to do.
      }
    },
    []
  );

  const transform = `translate(${viewport.panX} ${viewport.panY}) scale(${viewport.scale})`;

  return {
    viewport,
    transform,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
    zoomIn,
    zoomOut,
    reset,
    fitToContent,
    panBy,
    atMaxScale: viewport.scale >= MAX_SCALE,
    atMinScale: viewport.scale <= MIN_SCALE,
    isAnimating,
  };
}

/** Exposed for tests + keyboard shortcut handler. */
export const VIEWPORT_PAN_STEP = PAN_STEP;
export const VIEWPORT_PAN_STEP_LARGE = PAN_STEP_LARGE;
