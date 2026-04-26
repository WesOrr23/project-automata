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
 * Scale is clamped to [0.25, 4.0]. Pan is clamped via the
 * "centered slack" policy: when the scaled content is smaller than the
 * viewport on an axis, it's centered and pan-locked on that axis; when
 * larger, the content always covers the viewport (no edge can recede
 * past the corresponding viewport edge). See `clampViewport` for the
 * full policy.
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
 * Clamp viewport ("centered slack" policy): per-axis,
 *
 *  - If the scaled content is *smaller than or equal to* the viewport on
 *    that axis, center the content on that axis and lock pan there.
 *    There is nothing to scroll to, so don't let the user drift the
 *    content off into empty space.
 *  - If the scaled content is *larger than* the viewport on that axis,
 *    allow pan but clamp so no content edge can cross past the
 *    corresponding viewport edge — i.e. the content fully covers (or
 *    over-covers) the viewport at all times. The user can pan to see
 *    any corner, but content never recedes past an edge.
 *
 * Returns a possibly-new viewport. Caller should check reference
 * equality if it cares about no-op cases (we return `viewport` unchanged
 * when nothing to clamp).
 */
export function clampViewport(
  viewport: CanvasViewport,
  contentBoundingBox: { width: number; height: number } | null,
  viewportSize: { width: number; height: number } | null
): CanvasViewport {
  if (contentBoundingBox === null || viewportSize === null) return viewport;
  if (contentBoundingBox.width <= 0 || contentBoundingBox.height <= 0) return viewport;
  if (viewportSize.width <= 0 || viewportSize.height <= 0) return viewport;

  const { scale, panX, panY } = viewport;
  const scaledWidth = contentBoundingBox.width * scale;
  const scaledHeight = contentBoundingBox.height * scale;

  // X axis.
  let nextPanX: number;
  if (scaledWidth <= viewportSize.width) {
    nextPanX = (viewportSize.width - scaledWidth) / 2;
  } else {
    // panX is the screen-pixel offset of world origin (x=0). Content's
    // left edge sits at panX; right edge at panX + scaledWidth. To keep
    // both in [0, viewportSize.width] coverage:
    //   panX <= 0  (content's left ≤ viewport's left)
    //   panX + scaledWidth >= viewportSize.width  (right ≥ right)
    // → panX in [viewportSize.width - scaledWidth, 0]
    const minPanX = viewportSize.width - scaledWidth;
    const maxPanX = 0;
    nextPanX = clamp(panX, minPanX, maxPanX);
  }

  // Y axis.
  let nextPanY: number;
  if (scaledHeight <= viewportSize.height) {
    nextPanY = (viewportSize.height - scaledHeight) / 2;
  } else {
    const minPanY = viewportSize.height - scaledHeight;
    const maxPanY = 0;
    nextPanY = clamp(panY, minPanY, maxPanY);
  }

  if (nextPanX === panX && nextPanY === panY) return viewport;
  return { scale, panX: nextPanX, panY: nextPanY };
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

  // Track whether we've performed the initial-center pass. Without
  // this, the very first render ships the user a content-at-top-left
  // viewport (because DEFAULT_VIEWPORT is panX/Y = 0). The first time
  // sizes are measurable, we shift to "scale 1, content centered" so
  // the page lands looking like a `1:1` reset rather than slammed
  // against the corner.
  const didInitialCenterRef = useRef(false);

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

  // First time both sizes are measurable, center the content in the
  // viewport at the default scale. Runs at most once — after the
  // first center, the user owns the viewport state.
  useEffect(() => {
    if (didInitialCenterRef.current) return;
    if (contentBoundingBox === null || viewportSize === null) return;
    if (
      contentBoundingBox.width <= 0 ||
      contentBoundingBox.height <= 0 ||
      viewportSize.width <= 0 ||
      viewportSize.height <= 0
    ) {
      return;
    }
    didInitialCenterRef.current = true;
    const panX = (viewportSize.width - contentBoundingBox.width) / 2;
    const panY = (viewportSize.height - contentBoundingBox.height) / 2;
    setViewport({ scale: 1, panX, panY });
  }, [contentBoundingBox, viewportSize]);

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setViewport((current) => {
      const requested: CanvasViewport = {
        scale: current.scale,
        panX: current.panX + deltaX,
        panY: current.panY + deltaY,
      };
      const clamped = clampViewport(
        requested,
        contentBoxRef.current,
        viewportSizeRef.current
      );
      if (clamped.panX === current.panX && clamped.panY === current.panY) {
        return current;
      }
      return clamped;
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
      return clampViewport(
        { scale: newScale, panX: newPanX, panY: newPanY },
        contentBoxRef.current,
        viewportSizeRef.current
      );
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
      return clampViewport(
        { scale: newScale, panX: newPanX, panY: newPanY },
        contentBoxRef.current,
        viewportSizeRef.current
      );
    });
  }, [triggerAnimation]);

  const reset = useCallback(() => {
    triggerAnimation();
    // "1:1" semantically means "100% scale, content where it should
    // be" — not "100% scale, content slammed against the top-left of
    // the viewport." Center the content in the viewport at scale 1
    // (same centering as fitToContent, just without the scale-to-fit
    // step). When sizes aren't yet measured, fall back to the
    // origin-anchored default.
    const content = contentBoxRef.current;
    const view = viewportSizeRef.current;
    if (content === null || view === null) {
      setViewport(DEFAULT_VIEWPORT);
      return;
    }
    const panX = (view.width - content.width) / 2;
    const panY = (view.height - content.height) / 2;
    setViewport({ scale: 1, panX, panY });
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
          return clampViewport(
            { scale: newScale, panX: newPanX, panY: newPanY },
            contentBoxRef.current,
            viewportSizeRef.current
          );
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

  // CSS transform syntax: requires units + commas (vs SVG attribute
  // syntax which uses bare numbers + spaces). The consumer applies
  // this via style.transform on a `<g>` element so that CSS
  // transitions can animate it; bare-number SVG syntax would be
  // silently rejected by the CSS engine and the transform would
  // never apply.
  const transform = `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.scale})`;

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
