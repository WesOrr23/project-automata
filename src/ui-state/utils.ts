/**
 * UI Utilities
 *
 * Utility functions for the UI layer, including automatic graph layout.
 * Uses GraphViz (via @hpcc-js/wasm-graphviz) for both node positioning
 * AND edge routing - GraphViz computes spline paths that avoid overlaps.
 */

import { Graphviz } from '@hpcc-js/wasm-graphviz';
import { Automaton } from '../engine/types';
import { AutomatonUI, StateUI, TransitionUI, createDefaultLabel } from './types';
import { STATE_RADIUS } from './constants';

/**
 * Padding around the graph in the SVG canvas (pixels)
 */
const CANVAS_PADDING = 40;

/**
 * Node size in inches for GraphViz (72 points per inch)
 * Converts our pixel-based STATE_RADIUS to GraphViz's inch-based sizing
 */
const NODE_SIZE_INCHES = (STATE_RADIUS * 2) / 72;

/**
 * Convert an Automaton to a DOT language string for GraphViz
 *
 * Maps engine states to DOT nodes and engine transitions to DOT edges.
 * Each transition destination gets its own edge (GraphViz handles
 * routing multiple edges between the same nodes).
 *
 * @param automaton - The engine automaton to convert
 * @returns DOT language string
 */
/** Name of the invisible phantom node that reserves layout space for the
 *  start-state arrow. Prefixed with `_` so it sorts away from real states
 *  and is easy to recognize when filtering layout output. */
const START_PHANTOM_NAME = '_start';

/**
 * Inverse of joinSymbols: split GraphViz's edge label back into the
 * underlying symbol list. 'ε' round-trips to null; commas separate
 * multiple symbols. Returns an empty array for missing/empty labels
 * (the caller treats edges with no symbols as ill-formed and can choose
 * to drop them).
 */
export function parseEdgeLabel(rawLabel: string | undefined): Array<string | null> {
  if (rawLabel === undefined || rawLabel === '') return [];
  return rawLabel
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => (part === 'ε' ? null : part));
}

/**
 * Render a list of symbols as a comma-joined edge label. ε goes last
 * (visually separated from the alphabet symbols) and the rest are
 * sorted alphabetically for stability.
 */
function joinSymbols(symbols: ReadonlyArray<string | null>): string {
  const named = symbols.filter((s): s is string => s !== null).sort();
  const hasEpsilon = symbols.some((s) => s === null);
  if (hasEpsilon) named.push('ε');
  return named.join(', ');
}

function automatonToDot(automaton: Automaton): string {
  const lines: string[] = [];
  lines.push('digraph {');
  lines.push('  rankdir=LR;');
  lines.push(`  node [shape=circle, fixedsize=true, width=${NODE_SIZE_INCHES.toFixed(4)}, height=${NODE_SIZE_INCHES.toFixed(4)}];`);

  // Add nodes with display labels
  automaton.states.forEach((stateId) => {
    const label = createDefaultLabel(stateId);
    lines.push(`  ${stateId} [label="${label}"];`);
  });

  // Edge consolidation: group every engine transition by its
  // (from, to) endpoint pair and emit ONE DOT edge per group with a
  // comma-joined label. This is what makes "q0 -a-> q1" and "q0 -b-> q1"
  // render as a single arrow labeled "a, b" instead of two parallel
  // arrows GraphViz has to space apart.
  //
  // Multi-destination NFA transitions (one record with `to` size > 1)
  // expand into multiple groups — different `to` values are different
  // visual edges.
  const groups = new Map<string, ReadonlyArray<string | null>>();
  function addToGroup(from: number, to: number, symbol: string | null) {
    const key = `${from}->${to}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, [symbol]);
    } else {
      groups.set(key, [...existing, symbol]);
    }
  }
  automaton.transitions.forEach((transition) => {
    transition.to.forEach((destinationStateId) => {
      addToGroup(transition.from, destinationStateId, transition.symbol);
    });
  });

  for (const [key, symbols] of groups) {
    const [fromStr, toStr] = key.split('->');
    const label = joinSymbols(symbols);
    lines.push(`  ${fromStr} -> ${toStr} [label="${label}"];`);
  }

  // Reserve horizontal layout space for the separately-rendered start
  // arrow. Without this, GraphViz happily places the start state in the
  // middle of a row, then our arrow draws over whatever's to its left.
  // The phantom is style=invis (renders nothing) but participates in
  // layout — it pushes the start state into a column to its right and
  // expands the bounding box to include the arrow's reserved area.
  // Width chosen to comfortably hold ARROW_LENGTH (50px) + arrowhead
  // (~8px) at GraphViz's 72-DPI scale.
  // (startState is non-nullable per the engine type — createAutomaton
  // always seeds state 0 and removeState reassigns rather than clearing.)
  lines.push(`  ${START_PHANTOM_NAME} [shape=point, width=0.85, fixedsize=true, style=invis];`);
  lines.push(`  ${START_PHANTOM_NAME} -> ${automaton.startState} [style=invis];`);

  // Without further constraints, isolated states (those with no incoming
  // transitions and not the start state) are free to land in the
  // phantom's leftmost rank — exactly where the start arrow is drawn,
  // causing the arrow to overlap them. Push every such isolated state
  // rightward via an invisible phantom→state edge so the start arrow's
  // column is reserved for the start state alone.
  const statesWithIncoming = new Set<number>();
  automaton.transitions.forEach((transition) => {
    transition.to.forEach((destinationStateId) => {
      statesWithIncoming.add(destinationStateId);
    });
  });
  automaton.states.forEach((stateId) => {
    if (stateId === automaton.startState) return;
    if (statesWithIncoming.has(stateId)) return;
    lines.push(`  ${START_PHANTOM_NAME} -> ${stateId} [style=invis];`);
  });

  lines.push('}');
  return lines.join('\n');
}

/**
 * Parsed result from a GraphViz edge pos string
 */
type ParsedEdgePos = {
  /** Arrowhead tip position (from "e,x,y" prefix) */
  arrowheadPosition: { x: number; y: number } | null;
  /** B-spline control points (first is start, rest in groups of 3 for cubic bezier) */
  controlPoints: { x: number; y: number }[];
};

/**
 * Parse a GraphViz edge pos string into arrowhead position and control points
 *
 * GraphViz pos format: "e,endX,endY startX,startY cp1X,cp1Y cp2X,cp2Y ..."
 * - "e,x,y" prefix = arrowhead tip position
 * - "s,x,y" prefix = start point (rare, we skip it)
 * - Remaining "x,y" pairs = B-spline control points
 *
 * @param posString - Raw pos string from GraphViz json output
 * @returns Parsed arrowhead position and control points
 */
export function parseEdgePos(posString: string): ParsedEdgePos {
  const parts = posString.trim().split(/\s+/);
  let arrowheadPosition: { x: number; y: number } | null = null;
  const controlPoints: { x: number; y: number }[] = [];

  for (const part of parts) {
    if (part.startsWith('e,')) {
      const coords = part.substring(2).split(',');
      arrowheadPosition = {
        x: parseFloat(coords[0] ?? '0'),
        y: parseFloat(coords[1] ?? '0'),
      };
    } else if (part.startsWith('s,')) {
      // Start point prefix - we use the first control point instead
      continue;
    } else {
      const coords = part.split(',');
      controlPoints.push({
        x: parseFloat(coords[0] ?? '0'),
        y: parseFloat(coords[1] ?? '0'),
      });
    }
  }

  return { arrowheadPosition, controlPoints };
}

/**
 * Convert B-spline control points to an SVG path d attribute
 *
 * The first point becomes an M (moveTo) command. Remaining points
 * are grouped in threes for C (cubic bezier) commands.
 *
 * @param points - B-spline control points from GraphViz
 * @returns SVG path d attribute string
 */
export function controlPointsToSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';

  const startPoint = points[0]!;
  let path = `M ${startPoint.x},${startPoint.y}`;

  // GraphViz emits a B-spline as one start point + N cubic Bezier
  // segments of 3 control points each, so we expect points.length to be
  // 1 + 3 × N. If it isn't (malformed output), the loop below silently
  // truncates the leftover 1 or 2 trailing points — warn so a partial
  // arrow on screen has a console trail back to here.
  const remainder = (points.length - 1) % 3;
  if (remainder !== 0) {
    console.warn(
      `controlPointsToSvgPath: expected 1 + 3N points, got ${points.length} ` +
        `(${remainder} trailing point${remainder === 1 ? '' : 's'} dropped)`
    );
  }

  // Remaining points come in groups of 3 for cubic Bezier segments
  for (let i = 1; i + 2 <= points.length - 1; i += 3) {
    const cp1 = points[i]!;
    const cp2 = points[i + 1]!;
    const cp3 = points[i + 2]!;
    path += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${cp3.x},${cp3.y}`;
  }

  return path;
}

/**
 * Flip a Y coordinate from GraphViz space (origin bottom-left, Y up)
 * to SVG space (origin top-left, Y down)
 *
 * @param graphvizY - Y coordinate in GraphViz space
 * @param boundingBoxHeight - Height of the GraphViz bounding box
 * @returns Y coordinate in SVG space (with padding applied)
 */
export function flipY(graphvizY: number, boundingBoxHeight: number): number {
  return boundingBoxHeight - graphvizY + CANVAS_PADDING;
}

/**
 * Apply coordinate transformation to a point (add padding, flip Y)
 */
function transformPoint(
  point: { x: number; y: number },
  boundingBoxHeight: number
): { x: number; y: number } {
  return {
    x: point.x + CANVAS_PADDING,
    y: flipY(point.y, boundingBoxHeight),
  };
}

/**
 * Transform control points and build SVG path with coordinate conversion
 *
 * @param controlPoints - Raw control points from GraphViz
 * @param boundingBoxHeight - For Y-axis flip
 * @returns SVG path d attribute with transformed coordinates
 */
function buildTransformedPath(
  controlPoints: { x: number; y: number }[],
  boundingBoxHeight: number
): string {
  const transformed = controlPoints.map((point) =>
    transformPoint(point, boundingBoxHeight)
  );
  return controlPointsToSvgPath(transformed);
}

/**
 * Compute arrowhead angle from the last spline segment direction
 *
 * The angle points from the last control point toward the arrowhead tip,
 * giving the direction the arrow should face.
 *
 * @param lastControlPoint - Final point of the B-spline
 * @param arrowheadPosition - Arrowhead tip position
 * @returns Angle in radians
 */
function computeArrowheadAngle(
  lastControlPoint: { x: number; y: number },
  arrowheadPosition: { x: number; y: number }
): number {
  return Math.atan2(
    arrowheadPosition.y - lastControlPoint.y,
    arrowheadPosition.x - lastControlPoint.x
  );
}

/**
 * Type definition for GraphViz json output node objects
 */
type GraphvizNode = {
  _gvid: number;
  name: string;
  pos: string;
};

/**
 * Type definition for GraphViz json output edge objects
 */
type GraphvizEdge = {
  _gvid: number;
  tail: number;
  head: number;
  pos: string;
  label?: string;
  lp?: string;
};

/**
 * Type definition for GraphViz json output root
 */
type GraphvizJson = {
  bb: string;
  objects: GraphvizNode[];
  edges: GraphvizEdge[];
};

/**
 * Parse GraphViz json output into AutomatonUI
 *
 * Extracts node positions, edge splines, arrowhead positions/angles,
 * and label positions from the GraphViz layout result.
 *
 * @param jsonString - Raw json string from GraphViz
 * @param automaton - The original automaton (for state metadata)
 * @returns Complete AutomatonUI with positions and transitions
 */
function parseGraphvizJson(
  jsonString: string,
  automaton: Automaton
): AutomatonUI {
  const rawJson = JSON.parse(jsonString);
  const jsonData: GraphvizJson = {
    ...rawJson,
    objects: rawJson.objects ?? [],
    edges: rawJson.edges ?? [],
  };

  // Parse bounding box: "x1,y1,x2,y2"
  const boundingBoxParts = jsonData.bb.split(',').map(Number);
  const boundingBoxWidth = boundingBoxParts[2] ?? 0;
  const boundingBoxHeight = boundingBoxParts[3] ?? 0;

  // Extract node positions
  const states = new Map<number, StateUI>();

  for (const node of jsonData.objects) {
    // The start-arrow phantom is part of the layout output but not a
    // real state — skip it so it doesn't show up as a rendered node.
    if (node.name === START_PHANTOM_NAME) continue;

    const stateId = parseInt(node.name);

    // Skip if this isn't a valid state (shouldn't happen, but be safe)
    if (!automaton.states.has(stateId)) continue;

    const nodePosParts = node.pos.split(',').map(Number);
    const graphvizX = nodePosParts[0] ?? 0;
    const graphvizY = nodePosParts[1] ?? 0;
    const position = transformPoint(
      { x: graphvizX, y: graphvizY },
      boundingBoxHeight
    );

    states.set(stateId, {
      id: stateId,
      position,
      label: createDefaultLabel(stateId),
    });
  }

  // Extract edge data
  const transitions: TransitionUI[] = [];

  for (const edge of jsonData.edges) {
    const tailNode = jsonData.objects[edge.tail];
    const headNode = jsonData.objects[edge.head];
    if (!tailNode || !headNode) continue;

    // Skip the phantom start-arrow edge — its only job was to influence
    // layout, and the actual visible arrow is drawn by StartStateArrow.
    if (tailNode.name === START_PHANTOM_NAME || headNode.name === START_PHANTOM_NAME) {
      continue;
    }

    const fromStateId = parseInt(tailNode.name);
    const toStateId = parseInt(headNode.name);

    // Parse the (possibly comma-joined) consolidated label back into a
    // symbol array. ε round-trips to null. Skip edges without a parseable
    // label — automatonToDot always emits one, so an empty label here
    // means GraphViz returned something we don't understand; better to
    // drop one edge than render an invented ε.
    const symbols = parseEdgeLabel(edge.label);
    if (symbols.length === 0) continue;

    // Parse edge spline
    const parsedPos = parseEdgePos(edge.pos);
    if (parsedPos.controlPoints.length === 0) continue;

    // Build SVG path with coordinate transformation
    const pathData = buildTransformedPath(
      parsedPos.controlPoints,
      boundingBoxHeight
    );

    // Get last control point for arrowhead angle calculation
    const lastRawControlPoint = parsedPos.controlPoints[parsedPos.controlPoints.length - 1]!;

    // Transform arrowhead position
    const rawArrowhead = parsedPos.arrowheadPosition ?? lastRawControlPoint;
    const arrowheadPosition = transformPoint(rawArrowhead, boundingBoxHeight);

    // Compute arrowhead angle (in transformed coordinate space)
    const lastControlPoint = transformPoint(lastRawControlPoint, boundingBoxHeight);
    const arrowheadAngle = computeArrowheadAngle(
      lastControlPoint,
      arrowheadPosition
    );

    // Parse label position from "lp" field, or fall back to edge midpoint
    let labelPosition: { x: number; y: number };
    if (edge.lp) {
      const labelPosParts = edge.lp.split(',').map(Number);
      const labelX = labelPosParts[0] ?? 0;
      const labelY = labelPosParts[1] ?? 0;
      labelPosition = transformPoint(
        { x: labelX, y: labelY },
        boundingBoxHeight
      );
    } else {
      // Fallback: midpoint of the spline
      const midIndex = Math.floor(parsedPos.controlPoints.length / 2);
      const midPoint = parsedPos.controlPoints[midIndex]!;
      labelPosition = transformPoint(midPoint, boundingBoxHeight);
    }

    transitions.push({
      fromStateId,
      toStateId,
      symbols,
      pathData,
      arrowheadPosition,
      arrowheadAngle,
      labelPosition,
    });
  }

  return {
    states,
    transitions,
    boundingBox: {
      width: boundingBoxWidth + 2 * CANVAS_PADDING,
      height: boundingBoxHeight + 2 * CANVAS_PADDING,
    },
  };
}

/**
 * Compute automatic layout for an automaton using GraphViz
 *
 * GraphViz computes both node positions AND edge spline routes.
 * This eliminates the need for manual edge geometry calculations -
 * all edge paths, arrowhead positions, and label positions are
 * pre-computed by GraphViz's layout engine.
 *
 * @param automaton - The engine automaton to lay out
 * @returns AutomatonUI with computed positions, edge paths, and labels
 *
 * @example
 * const dfa = createAutomaton('DFA', new Set(['0', '1']));
 * const automatonUI = await computeLayout(dfa);
 * // automatonUI.states has positions, automatonUI.transitions has edge paths
 */
export async function computeLayout(
  automaton: Automaton
): Promise<AutomatonUI> {
  // Load GraphViz WASM (singleton - cached after first load)
  const graphviz = await Graphviz.load();

  // Convert automaton to DOT format
  const dotString = automatonToDot(automaton);

  // Run GraphViz layout with json output (includes edge routing)
  const jsonString = graphviz.dot(dotString, 'json');

  // Parse json output into AutomatonUI
  return parseGraphvizJson(jsonString, automaton);
}
