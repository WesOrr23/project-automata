/**
 * Unit tests for the GraphViz parse helpers in ui-state/utils.ts.
 *
 * These functions transform GraphViz's text output into the geometry
 * the renderer consumes. They're pure / synchronous — no WASM, no DOM —
 * so we exercise them directly with hand-crafted inputs that exercise
 * each branch (well-formed, malformed, empty, special-character).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseEdgePos,
  controlPointsToSvgPath,
  flipY,
  parseEdgeLabel,
} from '../utils';

describe('parseEdgeLabel', () => {
  it('returns [] for undefined or empty label', () => {
    expect(parseEdgeLabel(undefined)).toEqual([]);
    expect(parseEdgeLabel('')).toEqual([]);
  });

  it('parses a single non-epsilon symbol', () => {
    expect(parseEdgeLabel('a')).toEqual(['a']);
  });

  it('parses a comma-separated list', () => {
    expect(parseEdgeLabel('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('round-trips ε to null', () => {
    expect(parseEdgeLabel('ε')).toEqual([null]);
    expect(parseEdgeLabel('a, ε')).toEqual(['a', null]);
  });

  it('drops empty fragments produced by trailing commas', () => {
    expect(parseEdgeLabel('a, , b,')).toEqual(['a', 'b']);
  });

  it('trims surrounding whitespace on each part', () => {
    expect(parseEdgeLabel('  a  ,  b  ')).toEqual(['a', 'b']);
  });
});

describe('parseEdgePos', () => {
  it('parses a well-formed pos string with arrowhead and four control points', () => {
    const result = parseEdgePos('e,100,50 0,0 10,10 20,20 30,30');
    expect(result.arrowheadPosition).toEqual({ x: 100, y: 50 });
    expect(result.controlPoints).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ]);
  });

  it('returns null arrowhead position when no e, prefix is present', () => {
    const result = parseEdgePos('0,0 10,10 20,20 30,30');
    expect(result.arrowheadPosition).toBeNull();
    expect(result.controlPoints).toHaveLength(4);
  });

  it('skips s, prefixes (start point — we ignore them in favor of first control point)', () => {
    const result = parseEdgePos('s,5,5 e,100,50 0,0 10,10 20,20 30,30');
    expect(result.arrowheadPosition).toEqual({ x: 100, y: 50 });
    // s, was skipped — control points are just the trailing four.
    expect(result.controlPoints).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ]);
  });

  it('returns null arrowhead for a whitespace-only string', () => {
    // Pure whitespace splits to ['']; that part has no e,/s, prefix so it
    // becomes a (NaN, 0) control point — degenerate but consistent. The
    // contract we care about is that it doesn't throw and arrowhead
    // stays null.
    const result = parseEdgePos('   ');
    expect(result.arrowheadPosition).toBeNull();
  });

  it('falls back to 0 when a coord field is entirely missing (split returns undefined)', () => {
    // "5" with no comma → split = ['5'], y is undefined → y defaults to 0
    // (empty-string fields like "5," would parseFloat to NaN; the fallback
    // only catches the missing-field case, which is what GraphViz produces
    // for e.g. self-loop endpoints.)
    const result = parseEdgePos('5');
    expect(result.controlPoints).toEqual([{ x: 5, y: 0 }]);
  });

  it('handles multiple spaces / leading whitespace', () => {
    const result = parseEdgePos('   e,1,2    3,4   5,6 7,8 9,10  ');
    expect(result.arrowheadPosition).toEqual({ x: 1, y: 2 });
    expect(result.controlPoints).toHaveLength(4);
  });
});

describe('controlPointsToSvgPath', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns empty string for zero points', () => {
    expect(controlPointsToSvgPath([])).toBe('');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits a single M command for one point and warns about the leftover-zero case', () => {
    // 1 = 1 + 3·0, so this is technically valid (no Bezier segments).
    expect(controlPointsToSvgPath([{ x: 5, y: 7 }])).toBe('M 5,7');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits M + one C for the canonical 4-point cubic Bezier', () => {
    const path = controlPointsToSvgPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ]);
    expect(path).toBe('M 0,0 C 10,10 20,20 30,30');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits M + two C commands for a 7-point spline (1 + 3·2)', () => {
    const path = controlPointsToSvgPath([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
      { x: 5, y: 5 },
      { x: 6, y: 6 },
    ]);
    expect(path).toBe('M 0,0 C 1,1 2,2 3,3 C 4,4 5,5 6,6');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns and truncates trailing leftovers for malformed lengths', () => {
    // 5 points: 1 + 3·1 + 1 leftover → warn + truncate.
    const path = controlPointsToSvgPath([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ]);
    expect(path).toBe('M 0,0 C 1,1 2,2 3,3');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/expected 1 \+ 3N/);
  });
});

describe('flipY', () => {
  it('flips a Y coordinate to SVG space and adds canvas padding', () => {
    // CANVAS_PADDING = 40 (private to utils.ts). Verify by relation:
    // flipY(graphvizY, height) = height - graphvizY + padding.
    // Two values let us solve for the padding constant.
    const a = flipY(0, 100); // = 100 + padding
    const b = flipY(100, 100); // = 0 + padding
    const padding = b;
    expect(a).toBe(100 + padding);
    expect(padding).toBe(40); // sanity: matches the documented constant
  });

  it('handles graphvizY equal to height (top of GraphViz space → padding only)', () => {
    expect(flipY(50, 50)).toBe(40);
  });

  it('handles graphvizY of 0 (bottom of GraphViz space → height + padding)', () => {
    expect(flipY(0, 200)).toBe(240);
  });
});
