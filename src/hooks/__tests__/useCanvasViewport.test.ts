/**
 * @vitest-environment jsdom
 *
 * Unit tests for useCanvasViewport. Focused on the value contracts —
 * scale clamping, anchor-stable zoom math, fit-to-content arithmetic,
 * and pan gesture state. The DOM event handlers are exercised via
 * synthetic React-event shapes (we only depend on a few fields each).
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCanvasViewport,
  clampViewport,
  MIN_SCALE,
  MAX_SCALE,
} from '../useCanvasViewport';

const STANDARD_BOX = { width: 800, height: 600 };
const STANDARD_VIEWPORT = { width: 1000, height: 800 };

function setupHook(args?: {
  contentBoundingBox?: { width: number; height: number } | null;
  viewportSize?: { width: number; height: number } | null;
}) {
  // Default sizes to null so tests start at the untouched default
  // viewport ({ scale: 1, panX: 0, panY: 0 }) — providing sizes from
  // render 0 triggers the hook's initial-center pass and shifts the
  // pan to whatever centers the content. Tests that exercise
  // size-dependent behavior (fitToContent, wheel-toward-cursor,
  // pan clamping) opt in by passing STANDARD_BOX / STANDARD_VIEWPORT
  // explicitly.
  const contentBoundingBox =
    args && 'contentBoundingBox' in args ? args.contentBoundingBox ?? null : null;
  const viewportSize =
    args && 'viewportSize' in args ? args.viewportSize ?? null : null;
  return renderHook(() =>
    useCanvasViewport({ contentBoundingBox, viewportSize })
  );
}

describe('useCanvasViewport', () => {
  it('with both sizes available from render 0, auto-centers content (1:1 starting state)', () => {
    // contentBox 800x600 in viewport 1000x800 → centered at (100, 100).
    const { result } = setupHook({
      contentBoundingBox: STANDARD_BOX,
      viewportSize: STANDARD_VIEWPORT,
    });
    expect(result.current.viewport.scale).toBe(1);
    expect(result.current.viewport.panX).toBe(100);
    expect(result.current.viewport.panY).toBe(100);
  });

  it('starts at scale=1 / pan=0,0 when sizes are unknown', () => {
    const { result } = setupHook();
    expect(result.current.viewport).toEqual({ scale: 1, panX: 0, panY: 0 });
    expect(result.current.atMaxScale).toBe(false);
    expect(result.current.atMinScale).toBe(false);
  });

  it('zoomIn multiplies scale by 1.25 and stays clamped at MAX_SCALE', () => {
    const { result } = setupHook();
    act(() => result.current.zoomIn());
    expect(result.current.viewport.scale).toBeCloseTo(1.25);

    // Hammer it well past the cap.
    for (let i = 0; i < 30; i++) {
      act(() => result.current.zoomIn());
    }
    expect(result.current.viewport.scale).toBe(MAX_SCALE);
    expect(result.current.atMaxScale).toBe(true);
  });

  it('zoomOut divides scale by 1.25 and stays clamped at MIN_SCALE', () => {
    const { result } = setupHook();
    act(() => result.current.zoomOut());
    expect(result.current.viewport.scale).toBeCloseTo(0.8);

    for (let i = 0; i < 30; i++) {
      act(() => result.current.zoomOut());
    }
    expect(result.current.viewport.scale).toBe(MIN_SCALE);
    expect(result.current.atMinScale).toBe(true);
  });

  it('reset returns to defaults after any change', () => {
    const { result } = setupHook();
    act(() => result.current.zoomIn());
    act(() => result.current.panBy(50, 50));
    expect(result.current.viewport.scale).not.toBe(1);
    act(() => result.current.reset());
    expect(result.current.viewport).toEqual({ scale: 1, panX: 0, panY: 0 });
  });

  it('zoomIn keeps the viewport center stable (anchor invariant)', () => {
    const { result } = setupHook({ contentBoundingBox: STANDARD_BOX, viewportSize: STANDARD_VIEWPORT });
    const centerX = STANDARD_VIEWPORT.width / 2;
    const centerY = STANDARD_VIEWPORT.height / 2;

    // World point under the center before zoom.
    const before = result.current.viewport;
    const worldXBefore = (centerX - before.panX) / before.scale;
    const worldYBefore = (centerY - before.panY) / before.scale;

    act(() => result.current.zoomIn());

    // After zoom, the same world point should still sit under the center.
    const after = result.current.viewport;
    const worldXAfter = (centerX - after.panX) / after.scale;
    const worldYAfter = (centerY - after.panY) / after.scale;

    expect(worldXAfter).toBeCloseTo(worldXBefore, 5);
    expect(worldYAfter).toBeCloseTo(worldYBefore, 5);
  });

  it('wheel with ctrlKey zooms toward the cursor (anchor stable at cursor)', () => {
    const { result } = setupHook();
    const cursorX = 200;
    const cursorY = 150;

    const worldXBefore = (cursorX - result.current.viewport.panX) / result.current.viewport.scale;
    const worldYBefore = (cursorY - result.current.viewport.panY) / result.current.viewport.scale;

    // Build a fake SVG element + bounding rect so the handler's
    // getBoundingClientRect call returns a known origin.
    const svg = {
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 800 }),
    };
    act(() => {
      result.current.handlers.onWheel({
        currentTarget: svg as unknown as SVGSVGElement,
        clientX: cursorX,
        clientY: cursorY,
        deltaX: 0,
        deltaY: -100, // negative deltaY = zoom in (exp(1) ≈ 2.718x)
        ctrlKey: true,
        preventDefault: () => {},
      } as unknown as React.WheelEvent<SVGSVGElement>);
    });

    expect(result.current.viewport.scale).toBeGreaterThan(1);
    const worldXAfter = (cursorX - result.current.viewport.panX) / result.current.viewport.scale;
    const worldYAfter = (cursorY - result.current.viewport.panY) / result.current.viewport.scale;
    expect(worldXAfter).toBeCloseTo(worldXBefore, 5);
    expect(worldYAfter).toBeCloseTo(worldYBefore, 5);
  });

  it('wheel without ctrlKey pans by negated deltas', () => {
    const { result } = setupHook();
    const svg = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 800 }) };
    act(() => {
      result.current.handlers.onWheel({
        currentTarget: svg as unknown as SVGSVGElement,
        clientX: 0,
        clientY: 0,
        deltaX: 30,
        deltaY: 20,
        ctrlKey: false,
        preventDefault: () => {},
      } as unknown as React.WheelEvent<SVGSVGElement>);
    });
    // Pan handler negates deltas (gesture-aligned direction).
    expect(result.current.viewport.panX).toBe(-30);
    expect(result.current.viewport.panY).toBe(-20);
    expect(result.current.viewport.scale).toBe(1);
  });

  it('pointer drag on a non-interactive target pans by the cursor delta', () => {
    const { result } = setupHook();
    // A plain element, not nested under a [data-state-id] or
    // .transition-edge-clickable group → drag should engage.
    const target = document.createElement('div');
    document.body.appendChild(target);
    const svg = {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    };

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        target,
        currentTarget: svg as unknown as SVGSVGElement,
      } as unknown as React.PointerEvent<SVGSVGElement>);
    });

    act(() => {
      result.current.handlers.onPointerMove({
        pointerId: 1,
        clientX: 140,
        clientY: 125,
        currentTarget: svg as unknown as SVGSVGElement,
      } as unknown as React.PointerEvent<SVGSVGElement>);
    });

    expect(result.current.viewport.panX).toBe(40);
    expect(result.current.viewport.panY).toBe(25);

    act(() => {
      result.current.handlers.onPointerUp({
        pointerId: 1,
        currentTarget: svg as unknown as SVGSVGElement,
      } as unknown as React.PointerEvent<SVGSVGElement>);
    });
  });

  it('pointer down on a state-node target does NOT start a drag', () => {
    const { result } = setupHook();
    const node = document.createElement('div');
    node.setAttribute('data-state-id', '0');
    const inner = document.createElement('span');
    node.appendChild(inner);
    document.body.appendChild(node);
    const svg = {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    };

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        target: inner,
        currentTarget: svg as unknown as SVGSVGElement,
      } as unknown as React.PointerEvent<SVGSVGElement>);
    });
    // Subsequent move should NOT pan because the drag never engaged.
    act(() => {
      result.current.handlers.onPointerMove({
        pointerId: 1,
        clientX: 200,
        clientY: 200,
        currentTarget: svg as unknown as SVGSVGElement,
      } as unknown as React.PointerEvent<SVGSVGElement>);
    });
    expect(result.current.viewport).toEqual({ scale: 1, panX: 0, panY: 0 });
  });

  it('fitToContent scales content to fit viewport with padding and centers it', () => {
    // Content 800x600 in a 1000x800 viewport with 40px padding =>
    // scaleX = 920/800 = 1.15, scaleY = 720/600 = 1.2 → use min = 1.15.
    const { result } = setupHook({ contentBoundingBox: STANDARD_BOX, viewportSize: STANDARD_VIEWPORT });
    act(() => result.current.fitToContent());
    expect(result.current.viewport.scale).toBeCloseTo(1.15, 4);
    // Centering: (1000 - 800*1.15)/2 = (1000 - 920)/2 = 40
    expect(result.current.viewport.panX).toBeCloseTo(40, 4);
    // (800 - 600*1.15)/2 = (800 - 690)/2 = 55
    expect(result.current.viewport.panY).toBeCloseTo(55, 4);
  });

  it('fitToContent is a no-op if content or viewport is unknown', () => {
    const { result } = setupHook({ contentBoundingBox: null });
    act(() => result.current.fitToContent());
    expect(result.current.viewport).toEqual({ scale: 1, panX: 0, panY: 0 });
  });
});

describe('clampViewport (centered slack policy)', () => {
  const SMALL_BOX = { width: 400, height: 300 };
  const BIG_BOX = { width: 2000, height: 1500 };
  const VIEW = { width: 1000, height: 800 };

  it('returns the viewport unchanged when content or viewport is null', () => {
    const v = { scale: 1, panX: 50, panY: 50 };
    expect(clampViewport(v, null, VIEW)).toBe(v);
    expect(clampViewport(v, SMALL_BOX, null)).toBe(v);
  });

  it('returns the viewport unchanged when content has zero size', () => {
    const v = { scale: 1, panX: 50, panY: 50 };
    expect(clampViewport(v, { width: 0, height: 0 }, VIEW)).toBe(v);
  });

  it('centers and pan-locks small content (smaller than viewport on both axes)', () => {
    // 400x300 content in 1000x800 viewport at scale 1 → centered at (300,250).
    const v = { scale: 1, panX: 999, panY: -500 };
    const out = clampViewport(v, SMALL_BOX, VIEW);
    expect(out.scale).toBe(1);
    expect(out.panX).toBe(300);
    expect(out.panY).toBe(250);
  });

  it('clamps pan on large content so content always covers the viewport', () => {
    // 2000x1500 content in 1000x800 viewport at scale 1.
    // panX must be in [1000-2000, 0] = [-1000, 0]
    // panY must be in [800-1500, 0]  = [-700, 0]
    expect(clampViewport({ scale: 1, panX: 500, panY: 500 }, BIG_BOX, VIEW)).toEqual({
      scale: 1, panX: 0, panY: 0,
    });
    expect(clampViewport({ scale: 1, panX: -2000, panY: -2000 }, BIG_BOX, VIEW)).toEqual({
      scale: 1, panX: -1000, panY: -700,
    });
    // In-range stays put.
    expect(clampViewport({ scale: 1, panX: -300, panY: -200 }, BIG_BOX, VIEW)).toEqual({
      scale: 1, panX: -300, panY: -200,
    });
  });

  it('handles mixed axes: large in X, small in Y', () => {
    // 2000x300 content in 1000x800: X is large (clamp), Y is small (center).
    const out = clampViewport({ scale: 1, panX: -1500, panY: 999 }, { width: 2000, height: 300 }, VIEW);
    expect(out.panX).toBe(-1000);
    expect(out.panY).toBe(250); // (800 - 300) / 2
  });

  it('returns the same reference when no change is needed (no-op short-circuit)', () => {
    const v = { scale: 1, panX: -300, panY: -200 };
    const out = clampViewport(v, BIG_BOX, VIEW);
    expect(out).toBe(v);
  });

  it('respects the active scale when computing scaled extents', () => {
    // 400x300 content at scale 4 → 1600x1200 (now larger than 1000x800).
    // Both axes clamp to large-content rules.
    const out = clampViewport({ scale: 4, panX: 100, panY: 100 }, SMALL_BOX, VIEW);
    expect(out.scale).toBe(4);
    expect(out.panX).toBe(0);
    expect(out.panY).toBe(0);
  });
});
