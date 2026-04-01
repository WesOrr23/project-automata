/**
 * UI Utilities
 *
 * Utility functions for the UI layer, including automatic graph layout.
 * The UI layer owns positioning - these functions help calculate positions
 * automatically using dagre as a tool.
 */

import dagre from '@dagrejs/dagre';
import { Automaton } from '../engine/types';
import { AutomatonUI, StateUI, createDefaultLabel } from './types';
import { STATE_DIAMETER } from './constants';

/**
 * Configuration for dagre graph layout algorithm
 * Note: Property names match dagre's API (nodesep, ranksep, etc.)
 */
const LAYOUT_CONFIG = {
  rankdir: 'LR',           // Left-to-right layout (standard for DFAs)
  nodesep: 100,            // Horizontal spacing between nodes (pixels)
  ranksep: 150,            // Vertical spacing between ranks (pixels)
  marginx: 50,             // Canvas margin horizontal (pixels)
  marginy: 50,             // Canvas margin vertical (pixels)
};

/**
 * Compute automatic layout positions for an automaton using dagre.
 *
 * This is a pure function - given an automaton, it calculates optimal
 * positions for all states using a directed graph layout algorithm.
 * The UI layer owns positioning; dagre is just a tool to calculate them.
 *
 * @param automaton - The engine automaton to lay out
 * @returns AutomatonUI with computed positions and default labels
 *
 * @example
 * const dfa = createAutomaton('DFA', new Set(['0', '1']));
 * const automatonUI = computeLayout(dfa);
 * // automatonUI.states will have positions calculated by dagre
 */
export function computeLayout(automaton: Automaton): AutomatonUI {
  // Create new dagre graph instance (directed graph)
  const graph = new dagre.graphlib.Graph({ directed: true });

  // Configure graph layout algorithm
  graph.setGraph(LAYOUT_CONFIG);
  graph.setDefaultEdgeLabel(() => ({}));

  // Add all states as nodes to the graph
  // Create a new config object for each node (don't reuse)
  automaton.states.forEach((stateId) => {
    graph.setNode(stateId.toString(), {
      width: STATE_DIAMETER,
      height: STATE_DIAMETER,
    });
  });

  // Add all transitions as edges to the graph
  // Note: dagre automatically handles multiple edges between same nodes
  automaton.transitions.forEach((transition) => {
    transition.to.forEach((destinationStateId) => {
      graph.setEdge(
        transition.from.toString(),
        destinationStateId.toString()
      );
    });
  });

  // Run dagre layout algorithm (computes x, y positions)
  dagre.layout(graph);

  // Extract computed positions and create StateUI objects
  const states = new Map<number, StateUI>();

  automaton.states.forEach((stateId) => {
    const nodeData = graph.node(stateId.toString());

    states.set(stateId, {
      id: stateId,
      position: {
        x: nodeData.x,
        y: nodeData.y,
      },
      label: createDefaultLabel(stateId),
    });
  });

  return { states };
}
