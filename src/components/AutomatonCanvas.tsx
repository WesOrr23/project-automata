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

  /** State IDs currently active during simulation */
  activeStateIds?: Set<number>;

  /** Result status for highlighting the final state after simulation */
  resultStatus?: 'accepted' | 'rejected' | null;

  /** The next transition to be taken (for edge highlighting) */
  nextTransition?: { fromStateId: number; toStateId: number; symbol: string } | null;

  /** State ID currently highlighted by an active notification target */
  highlightedStateId?: number | null;

  /** Transition currently highlighted by an active notification target */
  highlightedTransition?: { from: number; to: number; symbol: string | null } | null;

  /**
   * When set to 'state', state nodes become clickable for picking
   * (used by TransitionCreator while filling source/destination slots).
   */
  pickMode?: 'state' | null;

  /** Called when the user clicks a state node while pickMode === 'state'. */
  onPickState?: (stateId: number) => void;

  /**
   * Called when the user clicks an existing transition edge on the canvas.
   * Loads it into the creator form for editing/deletion.
   */
  onEdgeClick?: (transition: { from: number; to: number; symbol: string | null }) => void;
};

export function AutomatonCanvas({
  automaton,
  automatonUI,
  activeStateIds,
  resultStatus,
  nextTransition,
  highlightedStateId,
  highlightedTransition,
  pickMode,
  onPickState,
  onEdgeClick,
}: AutomatonCanvasProp) {
  // The start-state arrow extends LEFT of the start-state circle by ~50px,
  // which is outside GraphViz's computed bounding box. Extend the SVG
  // viewBox left so the arrow has room to render. We also widen the SVG
  // element by the same amount so layout still reserves the space.
  const START_ARROW_RESERVE = 70;
  const viewWidth = automatonUI.boundingBox.width + START_ARROW_RESERVE;
  const viewHeight = automatonUI.boundingBox.height;
  return (
    <svg
      width={viewWidth}
      height={viewHeight}
      viewBox={`${-START_ARROW_RESERVE} 0 ${viewWidth} ${viewHeight}`}
      style={{ display: 'block' }}
    >
      {/* Layer 1: Transition edges (background) */}
      {automatonUI.transitions.map((transition, index) => {
        const isNextTransition = nextTransition !== null
          && nextTransition !== undefined
          && transition.fromStateId === nextTransition.fromStateId
          && transition.toStateId === nextTransition.toStateId
          && transition.symbol === nextTransition.symbol;

        const isHighlighted =
          highlightedTransition !== null
          && highlightedTransition !== undefined
          && transition.fromStateId === highlightedTransition.from
          && transition.toStateId === highlightedTransition.to
          && transition.symbol === highlightedTransition.symbol;

        return (
          <TransitionEdge
            key={`transition-${index}`}
            pathData={transition.pathData}
            symbol={transition.symbol}
            arrowheadPosition={transition.arrowheadPosition}
            arrowheadAngle={transition.arrowheadAngle}
            labelPosition={transition.labelPosition}
            isNextTransition={isNextTransition}
            isHighlighted={isHighlighted}
            onEdgeClick={
              onEdgeClick
                ? () =>
                    onEdgeClick({
                      from: transition.fromStateId,
                      to: transition.toStateId,
                      symbol: transition.symbol,
                    })
                : undefined
            }
          />
        );
      })}

      {/* Layer 2: State nodes (foreground) */}
      {Array.from(automatonUI.states.values()).map((stateUI) => {
        const isStart = automaton.startState === stateUI.id;
        const isAccept = automaton.acceptStates.has(stateUI.id);
        const isActive = activeStateIds?.has(stateUI.id) ?? false;
        // Only show result status on the active (current) state
        const stateResultStatus = isActive ? (resultStatus ?? null) : null;

        const isHighlighted = stateUI.id === highlightedStateId;
        const isPickable = pickMode === 'state';

        return (
          <StateNode
            key={`state-${stateUI.id}`}
            stateId={stateUI.id}
            label={stateUI.label}
            x={stateUI.position.x}
            y={stateUI.position.y}
            isStart={isStart}
            isAccept={isAccept}
            isActive={isActive}
            resultStatus={stateResultStatus}
            isHighlighted={isHighlighted}
            isPickable={isPickable}
            onPick={isPickable && onPickState ? () => onPickState(stateUI.id) : undefined}
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
