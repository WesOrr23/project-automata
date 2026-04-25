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
import type { EdgePreview } from './transitionEditor/creationReducer';

type AutomatonCanvasProp = {
  /** The automaton data from the engine layer */
  automaton: Automaton;

  /** UI metadata (positions, labels, edge paths) for visual rendering */
  automatonUI: AutomatonUI;

  /** State IDs currently active during simulation */
  activeStateIds?: Set<number>;

  /** Result status for highlighting the final state after simulation */
  resultStatus?: 'accepted' | 'rejected' | null;

  /**
   * Every transition that will fire on the next step. For DFAs there's
   * at most one; for NFAs there can be 0..N. All matching edges glow
   * blue so the user sees parallel branches about to fire.
   */
  nextTransitions?: ReadonlyArray<{
    fromStateId: number;
    toStateId: number;
    symbol: string;
  }>;

  /** State IDs whose branches died on the most recent step — pulse red. */
  dyingStateIds?: ReadonlySet<number>;

  /**
   * Transitions that fired on the most recent step (symbol-driven and
   * ε-closure). Drives a one-shot per-step pulse on the matching edges.
   */
  firedTransitions?: ReadonlyArray<{
    from: number;
    to: number;
    symbol: string | null;
  }>;

  /**
   * Current simulation step index. Threaded into edge keys so the
   * just-fired animation re-runs on every step rather than getting
   * stuck on the first fire.
   */
  simulationStepIndex?: number;

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
   * Called when the user clicks a state node while NOT in pick mode
   * (typically: edit-mode state actions popover).
   */
  onStateClick?: (stateId: number, anchorEl: SVGGElement) => void;

  /**
   * Called when the user clicks an existing transition edge on the canvas.
   * Loads it into the creator form for editing/deletion. For consolidated
   * edges (multiple symbols sharing the same from→to), the entire group
   * is loaded — `symbols` carries every symbol on the rendered edge.
   */
  onEdgeClick?: (transition: {
    from: number;
    to: number;
    symbols: ReadonlyArray<string | null>;
  }) => void;

  /**
   * Per-edge highlights for the in-progress transition edit. Each entry
   * recolors and pulses the matching transition (blue for additions,
   * purple for modifications, red for deletions). The canvas matches by
   * (from, to, symbol). For modifications with a symbol change, the entry
   * also carries the original symbol so the label renders both.
   */
  edgePreviews?: ReadonlyArray<EdgePreview>;

  /**
   * State IDs currently selected as the source / destination of the
   * in-progress transition edit. The canvas draws a pulsing halo of
   * `creationStateKind` color around them — the same blue/purple language
   * used for the edge preview, so the user sees "these are the states in
   * play."
   */
  creationSourceId?: number | null;
  creationDestinationId?: number | null;
  creationStateKind?: 'add' | 'modify' | null;
};

export function AutomatonCanvas({
  automaton,
  automatonUI,
  activeStateIds,
  resultStatus,
  nextTransitions,
  dyingStateIds,
  firedTransitions,
  simulationStepIndex,
  highlightedStateId,
  highlightedTransition,
  pickMode,
  onPickState,
  onStateClick,
  onEdgeClick,
  edgePreviews,
  creationSourceId,
  creationDestinationId,
  creationStateKind,
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
        // A consolidated edge matches the simulation's "next transition"
        // set if any (currentState, symbol → dest) tuple matches one of
        // its underlying symbols. Multiple matches → still one highlight.
        const isNextTransition = nextTransitions !== undefined
          && nextTransitions.some(
            (next) =>
              next.fromStateId === transition.fromStateId &&
              next.toStateId === transition.toStateId &&
              transition.symbols.some((s) => s === next.symbol)
          );

        const isHighlighted =
          highlightedTransition !== null
          && highlightedTransition !== undefined
          && transition.fromStateId === highlightedTransition.from
          && transition.toStateId === highlightedTransition.to
          && transition.symbols.some((s) => s === highlightedTransition.symbol);

        // Match against active edge previews. With consolidation, a
        // preview entry can match an edge that contains its symbol
        // among many. If multiple previews match (e.g. consolidated
        // edge with two symbols both being modified), pick the first;
        // they should agree on kind in practice.
        const matchingPreview = edgePreviews?.find(
          (preview) =>
            preview.from === transition.fromStateId &&
            preview.to === transition.toStateId &&
            transition.symbols.some((s) => s === preview.symbol)
        ) ?? null;

        // Did any of this consolidated edge's symbols just fire on
        // the most recent simulation step?
        const justFired = firedTransitions?.some(
          (fired) =>
            fired.from === transition.fromStateId &&
            fired.to === transition.toStateId &&
            transition.symbols.some((s) => s === fired.symbol)
        ) ?? false;

        // When fired, include the step index in the React key so the
        // element remounts on every step that fires it — that's what
        // restarts the CSS animation. Non-fired edges keep stable
        // keys so they don't churn.
        const edgeKey = justFired
          ? `transition-${index}-step-${simulationStepIndex ?? 0}`
          : `transition-${index}`;

        return (
          <TransitionEdge
            key={edgeKey}
            pathData={transition.pathData}
            symbols={transition.symbols}
            arrowheadPosition={transition.arrowheadPosition}
            arrowheadAngle={transition.arrowheadAngle}
            labelPosition={transition.labelPosition}
            isNextTransition={isNextTransition}
            isHighlighted={isHighlighted}
            justFired={justFired}
            previewKind={matchingPreview?.kind}
            previewOldSymbol={matchingPreview?.oldSymbol}
            onEdgeClick={
              onEdgeClick
                ? () =>
                    onEdgeClick({
                      from: transition.fromStateId,
                      to: transition.toStateId,
                      symbols: transition.symbols,
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
        // For accepted results, only the branches that actually landed
        // in an accept state get the green coloring — that's the answer
        // to "why did this accept?". Other still-active branches stay
        // blue (alive but not why we accepted). Rejected colors every
        // surviving branch red.
        const stateResultStatus = !isActive
          ? null
          : resultStatus === 'accepted' && !isAccept
            ? null
            : resultStatus ?? null;

        const isHighlighted = stateUI.id === highlightedStateId;
        const isDying = dyingStateIds?.has(stateUI.id) ?? false;
        const isCreationParticipant =
          (creationSourceId !== null && creationSourceId !== undefined && stateUI.id === creationSourceId) ||
          (creationDestinationId !== null && creationDestinationId !== undefined && stateUI.id === creationDestinationId);
        const stateCreationKind =
          isCreationParticipant && creationStateKind ? creationStateKind : null;
        const isPickMode = pickMode === 'state';
        // Pick mode wins; otherwise fall back to onStateClick (state actions).
        const interactive = isPickMode
          ? Boolean(onPickState)
          : Boolean(onStateClick);
        const interactionStyle = isPickMode ? 'pick' : 'select';
        const handleClick = isPickMode
          ? onPickState
            ? () => onPickState(stateUI.id)
            : undefined
          : onStateClick
            ? (anchorEl: SVGGElement) => onStateClick(stateUI.id, anchorEl)
            : undefined;

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
            isDying={isDying}
            creationKind={stateCreationKind}
            isInteractive={interactive}
            interactionStyle={interactionStyle}
            onClick={handleClick}
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
