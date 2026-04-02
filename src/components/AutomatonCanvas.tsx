/**
 * AutomatonCanvas Component
 *
 * Main container that orchestrates the rendering of the entire automaton.
 * Takes the engine Automaton and UI metadata (including pre-computed edge
 * paths from GraphViz), and renders all child components.
 */

import { Automaton } from '../engine/types';
import { AutomatonUI } from '../ui-state/types';
import { STATE_RADIUS } from '../ui-state/constants';
import { StateNode } from './StateNode';
import { TransitionEdge } from './TransitionEdge';
import { StartStateArrow } from './StartStateArrow';

type AutomatonCanvasProp = {
  /** The automaton data from the engine layer */
  automaton: Automaton;

  /** UI metadata (positions, labels, edge paths) for visual rendering */
  automatonUI: AutomatonUI;
};

export function AutomatonCanvas({
  automaton,
  automatonUI,
}: AutomatonCanvasProp) {
  return (
    <svg
      width={automatonUI.boundingBox.width}
      height={automatonUI.boundingBox.height}
      style={{ border: '1px solid #ccc' }}
    >
      {/* Layer 1: Transition edges (background) */}
      {automatonUI.transitions.map((transition, index) => (
        <TransitionEdge
          key={`transition-${index}`}
          pathData={transition.pathData}
          symbol={transition.symbol}
          arrowheadPosition={transition.arrowheadPosition}
          arrowheadAngle={transition.arrowheadAngle}
          labelPosition={transition.labelPosition}
        />
      ))}

      {/* Layer 2: State nodes (foreground) */}
      {Array.from(automatonUI.states.values()).map((stateUI) => {
        const isStart = automaton.startState === stateUI.id;
        const isAccept = automaton.acceptStates.has(stateUI.id);

        return (
          <StateNode
            key={`state-${stateUI.id}`}
            stateId={stateUI.id}
            label={stateUI.label}
            x={stateUI.position.x}
            y={stateUI.position.y}
            isStart={isStart}
            isAccept={isAccept}
          />
        );
      })}

      {/* Layer 3: Start state arrow (foreground) */}
      {automaton.startState !== null && (() => {
        const startStateUI = automatonUI.states.get(automaton.startState);
        if (!startStateUI) return null;

        return (
          <StartStateArrow
            targetX={startStateUI.position.x}
            targetY={startStateUI.position.y}
            stateRadius={STATE_RADIUS}
          />
        );
      })()}
    </svg>
  );
}
