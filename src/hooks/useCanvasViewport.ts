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

export type ViewportInset = {
  /** Pixels of overlay chrome covering the LEFT edge of the SVG (e.g.
   *  the tool menu's right edge). Centering math treats this region
   *  as not-visible: content is centered in (svgWidth - left - right). */
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const ZERO_INSET: ViewportInset = { left: 0, right: 0, top: 0, bottom: 0 };

export type UseCanvasViewportArgs = {
  /**
   * The natural-content size of the SVG (i.e. the un-zoomed bounding
   * box used by AutomatonCanvas's base viewBox). Needed for
   * `fitToContent` and pan clamping.
   */
  contentBoundingBox: { width: number; height: number } | null;
  /**
   * Where the content's TOP-LEFT sits in unscaled coordinates relative
   * to the transform origin (panX, panY). AutomatonCanvas wraps its
   * content in `<g transform="translate(-70 0)">` to make room for the
   * start arrow that extends LEFT of state q0; that means the visible
   * content's leftmost edge is at world x = -70, not 0. Centering math
   * needs to know this so 'centered' actually centers the visual
   * bounding box, not the unshifted origin. Defaults to {x:0, y:0}.
   */
  contentOrigin?: { x: number; y: number } | undefined;
  /**
   * The visible CSS-pixel size of the SVG element. Needed for
   * `fitToContent` and zoom-toward-center math.
   */
  viewportSize: { width: number; height: number } | null;
  /**
   * Optional: pixels of overlay chrome (tool menu, command bar, etc.)
   * that visually occlude part of the SVG. Centering operations
   * (initial-center, reset, fitToContent) target the user-visible
   * region — viewport minus inset — instead of the geometric SVG
   * center. Zoom-toward-cursor and pan-clamp continue to use the full
   * SVG box (those gestures want the cursor's true screen position).
   */
  viewportInset?: ViewportInset | undefined;
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
 * Clamp viewport ("centroid in viewport" policy): the geometric center
 * of the scaled content's bounding box must stay within the visible
 * viewport. That gives the user:
 *
 *  - Generous freedom to pan (range = viewport size on each axis at
 *    any scale; predictable feel regardless of how zoomed).
 *  - A guarantee that the FA can't be lost: at minimum, the half of
 *    the bounding box opposite the pan direction is always visible.
 *  - Room to inspect corners at high zoom: content edges may extend
 *    arbitrarily beyond the viewport so long as the centroid stays in.
 *
 * Math: with scaledWidth W and viewport width V, the centroid x-pos
 * on screen is `panX + W/2`. Constraint `0 ≤ panX + W/2 ≤ V` gives
 * `panX ∈ [-W/2, V - W/2]`. Symmetric for Y.
 *
 * Returns the input unchanged when already in policy (caller can use
 * reference equality to skip re-renders).
 *
 * History: an earlier attempt ("centered slack") locked pan to center
 * whenever scaled content was smaller than viewport — which broke
 * drag-pan at default zoom for any small/medium FA. Centroid policy
 * fixes that while still preventing "where did it go" accidents.
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
  const halfScaledWidth = (contentBoundingBox.width * scale) / 2;
  const halfScaledHeight = (contentBoundingBox.height * scale) / 2;

  const minPanX = -halfScaledWidth;
  const maxPanX = viewportSize.width - halfScaledWidth;
  const minPanY = -halfScaledHeight;
  const maxPanY = viewportSize.height - halfScaledHeight;

  const nextPanX = clamp(panX, minPanX, maxPanX);
  const nextPanY = clamp(panY, minPanY, maxPanY);

  if (nextPanX === panX && nextPanY === panY) return viewport;
  return { scale, panX: nextPanX, panY: nextPanY };
}

export function useCanvasViewport(
  args: UseCanvasViewportArgs
): UseCanvasViewportResult {
  const { contentBoundingBox, viewportSize, viewportInset, contentOrigin } = args;
  const inset: ViewportInset = viewportInset ?? ZERO_INSET;
  const origin = contentOrigin ?? { x: 0, y: 0 };
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
  const insetRef = useRef(inset);
  insetRef.current = inset;
  const originRef = useRef(origin);
  originRef.current = origin;

  // Track whether we've performed the initial-center pass. Without
  // this, the very first render ships the user a content-at-top-left
  // viewport (because DEFAULT_VIEWPORT is panX/Y = 0). The first time
  // sizes are measurable, we shift to "scale 1, content centered" so
  // the page lands looking like a `1:1` reset rather than slammed
  // against the corner.
  const didInitialCenterRef = useRef(false);

  // Track the inset value from the previous render so we can detect
  // when overlay chrome (menu, command bar) has shifted, and slide the
  // pan to preserve the FA's RELATIVE position in the visible region.
  // Initialized below in the effect so the very first render doesn't
  // see a phantom "delta" against an empty default.
  const prevInsetRef = useRef<ViewportInset | null>(null);

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

  // Center content within the user-VISIBLE region (SVG box minus the
  // overlay chrome inset), not the geometric SVG center. With the menu
  // floating over the left edge, geometric center = "behind the menu";
  // the user expects "centered" to mean centered in what they can see.
  //
  // `origin` accounts for an inner SVG transform (e.g.
  // `translate(-70 0)` for the start-arrow reserve): the visible
  // content's left edge sits at `panX + origin.x * scale` rather than
  // at panX, so we subtract that offset before centering.
  function centerInVisibleRegion(
    content: { width: number; height: number },
    view: { width: number; height: number },
    insetArg: ViewportInset,
    originArg: { x: number; y: number },
    scale: number
  ): { panX: number; panY: number } {
    const visibleW = Math.max(view.width - insetArg.left - insetArg.right, 1);
    const visibleH = Math.max(view.height - insetArg.top - insetArg.bottom, 1);
    const scaledW = content.width * scale;
    const scaledH = content.height * scale;
    return {
      panX: insetArg.left + (visibleW - scaledW) / 2 - originArg.x * scale,
      panY: insetArg.top + (visibleH - scaledH) / 2 - originArg.y * scale,
    };
  }

  // First time both sizes are measurable, center the content in the
  // VISIBLE region at the default scale. Runs at most once — after the
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
    const { panX, panY } = centerInVisibleRegion(contentBoundingBox, viewportSize, inset, origin, 1);
    setViewport({ scale: 1, panX, panY });
    prevInsetRef.current = inset;
  // Initial-center should only depend on FIRST availability of sizes.
  // Inset changes after initial-center are handled by the inset-shift
  // effect below (which preserves the FA's relative position rather
  // than re-centering it from scratch).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentBoundingBox, viewportSize]);

  // Whenever the visible region shifts (overlay chrome resizes — menu
  // expanded/collapsed/opened, command bar grew, etc.), slide the pan
  // by the same delta so the FA's RELATIVE position inside the visible
  // region stays fixed. If the user had the FA centered at the visible
  // mid-line, it stays at the mid-line of the new visible region; if
  // they had panned it to a corner, it stays at the same corner of
  // the new visible region.
  //
  // The pan shift is instant (state set), but the canvas-content-
  // animating CSS class is triggered for the same window so the
  // visible transform interpolates over 300ms — staying roughly in
  // sync with the menu's own animation.
  useEffect(() => {
    if (prevInsetRef.current === null) {
      prevInsetRef.current = inset;
      return;
    }
    const prev = prevInsetRef.current;
    const dx = inset.left - prev.left;
    const dy = inset.top - prev.top;
    // Right/bottom inset changes also affect the visible center; we
    // shift by half the delta on those axes since the visible region's
    // CENTER is what we're tracking, not its left/top corner. (Left/
    // top deltas already shift the corner directly.)
    const dxRight = inset.right - prev.right;
    const dyBottom = inset.bottom - prev.bottom;
    if (dx === 0 && dy === 0 && dxRight === 0 && dyBottom === 0) return;
    prevInsetRef.current = inset;
    triggerAnimation();
    setViewport((current) => {
      // Visible-region center x = inset.left + (W - inset.left - inset.right) / 2
      //                         = (inset.left - inset.right) / 2 + W/2
      // So Δcenter_x = (Δleft - Δright) / 2. To keep the FA visually
      // anchored to the visible center, panX must grow by Δcenter_x.
      const centerShiftX = (dx - dxRight) / 2;
      const centerShiftY = (dy - dyBottom) / 2;
      const next: CanvasViewport = {
        scale: current.scale,
        panX: current.panX + centerShiftX,
        panY: current.panY + centerShiftY,
      };
      return clampViewport(next, contentBoxRef.current, viewportSizeRef.current);
    });
  }, [inset, triggerAnimation]);

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
    // be" — centered in the visible region. Same centering as
    // fitToContent, just without the scale-to-fit step.
    const content = contentBoxRef.current;
    const view = viewportSizeRef.current;
    if (content === null || view === null) {
      setViewport(DEFAULT_VIEWPORT);
      return;
    }
    const { panX, panY } = centerInVisibleRegion(content, view, insetRef.current, originRef.current, 1);
    setViewport({ scale: 1, panX, panY });
  }, [triggerAnimation]);

  /**
   * Fit the content bounding box inside the visible region with a small
   * padding. Picks the smaller of the two axis-fit ratios so the entire
   * content is visible (no cropping). Then centers the result in the
   * visible region (excluding inset chrome).
   */
  const fitToContent = useCallback(() => {
    triggerAnimation();
    const content = contentBoxRef.current;
    const view = viewportSizeRef.current;
    const insetVal = insetRef.current;
    if (content === null || view === null) return;
    if (content.width <= 0 || content.height <= 0) return;
    if (view.width <= 0 || view.height <= 0) return;
    const visibleW = Math.max(view.width - insetVal.left - insetVal.right, 1);
    const visibleH = Math.max(view.height - insetVal.top - insetVal.bottom, 1);
    const availableWidth = Math.max(visibleW - FIT_PADDING * 2, 1);
    const availableHeight = Math.max(visibleH - FIT_PADDING * 2, 1);
    const scaleX = availableWidth / content.width;
    const scaleY = availableHeight / content.height;
    const targetScale = clamp(
      Math.min(scaleX, scaleY),
      MIN_SCALE,
      MAX_SCALE
    );
    const { panX, panY } = centerInVisibleRegion(content, view, insetVal, originRef.current, targetScale);
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
