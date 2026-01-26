/**
 * AutomatonCanvas Component
 *
 * Main container that orchestrates the rendering of the entire automaton.
 * Takes the engine Automaton and UI metadata, extracts granular values,
 * and renders all child components (states, transitions, start arrow).
 */

import { Automaton } from '../engine/types';
import { AutomatonUI } from '../ui-state/types';
import { StateNode } from './StateNode';
import { TransitionEdge } from './TransitionEdge';
import { StartStateArrow } from './StartStateArrow';

type AutomatonCanvasProp = {
  /** The automaton data from the engine layer */
  automaton: Automaton;

  /** UI metadata (positions, labels) for visual rendering */
  automatonUI: AutomatonUI;
};

/**
 * Visual constants
 */
const STATE_RADIUS = 30;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export function AutomatonCanvas({
  automaton,
  automatonUI,
}: AutomatonCanvasProp) {
  return (
    <svg
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{ border: '1px solid #ccc' }}
    >
      {/* Layer 1: Transition edges (background) */}
      {automaton.transitions.flatMap((transition, transitionIndex) => {
        const fromState = automatonUI.states.get(transition.from);

        // Skip if source state UI data is missing
        if (!fromState) {
          return [];
        }

        // For NFA-compatibility: iterate over ALL destination states in the 'to' Set
        // DFA: transition.to will have exactly 1 element
        // NFA: transition.to can have multiple elements
        return Array.from(transition.to).map((toStateId) => {
          const toState = automatonUI.states.get(toStateId);

          // Skip if destination state UI data is missing
          if (!toState) {
            return null;
          }

          return (
            <TransitionEdge
              key={`transition-${transitionIndex}-to-${toStateId}`}
              fromX={fromState.position.x}
              fromY={fromState.position.y}
              toX={toState.position.x}
              toY={toState.position.y}
              symbol={transition.symbol}
              stateRadius={STATE_RADIUS}
            />
          );
        });
      })}

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
      {automaton.startState !== null && (
        (() => {
          const startStateUI = automatonUI.states.get(automaton.startState);
          if (!startStateUI) {
            return null;
          }

          return (
            <StartStateArrow
              targetX={startStateUI.position.x}
              targetY={startStateUI.position.y}
              stateRadius={STATE_RADIUS}
            />
          );
        })()
      )}
    </svg>
  );
}
