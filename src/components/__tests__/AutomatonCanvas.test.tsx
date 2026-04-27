/**
 * @vitest-environment jsdom
 *
 * Tests for AutomatonCanvas. The component renders SVG and consumes a
 * pre-computed AutomatonUI (positions + spline geometry) — we hand-build
 * a small fixture rather than calling the real layout hook so the tests
 * stay synchronous and don't depend on the GraphViz WASM module.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AutomatonCanvas } from '../AutomatonCanvas';
import type { Automaton } from '../../engine/types';
import type { AutomatonUI } from '../../ui-state/types';

/**
 * Minimal 2-state, 1-transition fixture: q0 --a--> q1, q0 is start, q1 is accept.
 * Geometry values are arbitrary — the canvas only forwards them.
 */
function makeFixture(): { automaton: Automaton; automatonUI: AutomatonUI } {
  const automaton: Automaton = {
    type: 'DFA',
    states: new Set([0, 1]),
    alphabet: new Set(['a']),
    transitions: [{ from: 0, to: new Set([1]), symbol: 'a' }],
    startState: 0,
    acceptStates: new Set([1]),
    nextStateId: 2,
  };
  const automatonUI: AutomatonUI = {
    states: new Map([
      [0, { id: 0, position: { x: 100, y: 100 }, label: 'q0' }],
      [1, { id: 1, position: { x: 300, y: 100 }, label: 'q1' }],
    ]),
    transitions: [
      {
        fromStateId: 0,
        toStateId: 1,
        symbols: ['a'],
        pathData: 'M 100,100 C 150,80 250,80 300,100',
        arrowheadPosition: { x: 300, y: 100 },
        arrowheadAngle: 0,
        labelPosition: { x: 200, y: 80 },
      },
    ],
    boundingBox: { width: 400, height: 200 },
  };
  return { automaton, automatonUI };
}

describe('AutomatonCanvas', () => {
  it('renders one StateNode per engine state', () => {
    const { automaton, automatonUI } = makeFixture();
    const { container } = render(
      <AutomatonCanvas automaton={automaton} automatonUI={automatonUI} />
    );
    // StateNode tags every <g> with data-state-id, which is the most
    // reliable hook for tests.
    const stateGroups = container.querySelectorAll('g[data-state-id]');
    expect(stateGroups).toHaveLength(2);
  });

  it('renders the transition edge path', () => {
    const { automaton, automatonUI } = makeFixture();
    const { container } = render(
      <AutomatonCanvas automaton={automaton} automatonUI={automatonUI} />
    );
    // Each edge contributes at least one visible <path d=...>. There may
    // also be a transparent click-target path when onEdgeClick is wired,
    // but no edge handler here means just the visible spline.
    const paths = container.querySelectorAll('path[d]');
    expect(paths.length).toBeGreaterThanOrEqual(1);
    const firstPath = paths[0];
    expect(firstPath?.getAttribute('d')).toContain('M 100,100');
  });

  it('marks accept states with a second (inner) circle', () => {
    const { automaton, automatonUI } = makeFixture();
    const { container } = render(
      <AutomatonCanvas automaton={automaton} automatonUI={automatonUI} />
    );
    // Non-accept (q0) → 1 circle. Accept (q1) → 2 circles. Total = 3.
    // Scope to state-node descendants so the debug center markers
    // (red visible-center dot + blue FA-center ring) don't inflate
    // the count.
    const circles = container.querySelectorAll('[data-state-id] circle');
    expect(circles).toHaveLength(3);
  });

  it('calls onStateClick with the state ID when a state is clicked', () => {
    const { automaton, automatonUI } = makeFixture();
    const onStateClick = vi.fn();
    const { container } = render(
      <AutomatonCanvas
        automaton={automaton}
        automatonUI={automatonUI}
        onStateClick={onStateClick}
      />
    );
    const q1Group = container.querySelector('g[data-state-id="1"]') as SVGGElement;
    expect(q1Group).not.toBeNull();
    fireEvent.click(q1Group);
    expect(onStateClick).toHaveBeenCalledTimes(1);
    expect(onStateClick.mock.calls[0]?.[0]).toBe(1);
  });

  it('calls onPickState (not onStateClick) when pickMode is "state"', () => {
    const { automaton, automatonUI } = makeFixture();
    const onStateClick = vi.fn();
    const onPickState = vi.fn();
    const { container } = render(
      <AutomatonCanvas
        automaton={automaton}
        automatonUI={automatonUI}
        pickMode="state"
        onPickState={onPickState}
        onStateClick={onStateClick}
      />
    );
    const q0Group = container.querySelector('g[data-state-id="0"]') as SVGGElement;
    fireEvent.click(q0Group);
    expect(onPickState).toHaveBeenCalledWith(0);
    expect(onStateClick).not.toHaveBeenCalled();
  });

  it('applies the pickable affordance class when pickMode is "state"', () => {
    const { automaton, automatonUI } = makeFixture();
    const { container } = render(
      <AutomatonCanvas
        automaton={automaton}
        automatonUI={automatonUI}
        pickMode="state"
        onPickState={() => {}}
      />
    );
    const q0Group = container.querySelector('g[data-state-id="0"]');
    expect(q0Group?.getAttribute('class')).toContain('state-node-pickable');
  });

  it('calls onEdgeClick with from/to/symbols when an edge is clicked', () => {
    const { automaton, automatonUI } = makeFixture();
    const onEdgeClick = vi.fn();
    const { container } = render(
      <AutomatonCanvas
        automaton={automaton}
        automatonUI={automatonUI}
        onEdgeClick={onEdgeClick}
      />
    );
    // Edge groups carry the transition-edge-clickable class when wired.
    const edgeGroup = container.querySelector('g.transition-edge-clickable') as SVGGElement;
    expect(edgeGroup).not.toBeNull();
    fireEvent.click(edgeGroup);
    expect(onEdgeClick).toHaveBeenCalledTimes(1);
    expect(onEdgeClick.mock.calls[0]?.[0]).toEqual({
      from: 0,
      to: 1,
      symbols: ['a'],
    });
  });

  it('colors the active simulation state differently from idle states', () => {
    const { automaton, automatonUI } = makeFixture();
    const { container, rerender } = render(
      <AutomatonCanvas automaton={automaton} automatonUI={automatonUI} />
    );
    // q0 idle → default white fill.
    const q0OuterCircleIdle = container.querySelector(
      'g[data-state-id="0"] circle'
    );
    const idleFill = q0OuterCircleIdle?.getAttribute('fill');

    rerender(
      <AutomatonCanvas
        automaton={automaton}
        automatonUI={automatonUI}
        activeStateIds={new Set([0])}
      />
    );
    const q0OuterCircleActive = container.querySelector(
      'g[data-state-id="0"] circle'
    );
    const activeFill = q0OuterCircleActive?.getAttribute('fill');
    expect(activeFill).not.toBe(idleFill);
  });
});
