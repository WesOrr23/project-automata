/**
 * TransitionEdge Component
 *
 * Renders a transition arrow between two states.
 * Supports three rendering modes:
 * - Self-loops: Curved path above the state
 * - Straight arrows: Direct line between different states
 * - Curved arrows: For bidirectional edges (future)
 */

type TransitionEdgeProp = {
  /** X coordinate of the source state center */
  fromX: number;

  /** Y coordinate of the source state center */
  fromY: number;

  /** X coordinate of the destination state center */
  toX: number;

  /** Y coordinate of the destination state center */
  toY: number;

  /** Transition symbol (null represents ε-transition) */
  symbol: string | null;

  /** Radius of state circles (to calculate edge intersections) */
  stateRadius: number;

  /** Source state ID (needed to detect self-loops) */
  fromStateId: number;

  /** Destination state ID (needed to detect self-loops) */
  toStateId: number;

  /** Whether this transition is part of a bidirectional pair (optional) */
  isBidirectional?: boolean;
};

/**
 * Visual constants for transition arrows
 */
const STROKE_WIDTH = 2;
const ARROWHEAD_SIZE = 8;
const LABEL_OFFSET = 15; // Distance of label from arrow line

/**
 * Configuration for self-loop appearance
 */
const SELF_LOOP_CONFIG = {
  loopRadius: 25,              // Radius of the loop curve (pixels)
  loopOffsetAngle: -90,        // Position loop at top of state (degrees)
  labelOffsetY: -45,           // Label position above loop (pixels)
};

/**
 * Configuration for curved bidirectional arrows
 */
const CURVED_ARROW_CONFIG = {
  curveOffset: 20,  // Distance to curve away from straight line (pixels)
};

export function TransitionEdge(props: TransitionEdgeProp) {
  const isSelfLoop = props.fromStateId === props.toStateId;

  if (isSelfLoop) {
    return renderSelfLoop(props);
  }

  if (props.isBidirectional) {
    return renderCurvedArrow(props);
  }

  return renderStraightArrow(props);
}

/**
 * Render a self-loop (transition from a state to itself)
 * Uses a curved SVG path positioned above the state
 */
function renderSelfLoop(props: TransitionEdgeProp) {
  const { fromX, fromY, symbol, stateRadius } = props;
  const { loopRadius, loopOffsetAngle, labelOffsetY } = SELF_LOOP_CONFIG;

  // Convert angle from degrees to radians
  const angleRadians = (loopOffsetAngle * Math.PI) / 180;

  // Calculate start point on state circle edge
  const startX = fromX + stateRadius * Math.cos(angleRadians - 0.3);
  const startY = fromY + stateRadius * Math.sin(angleRadians - 0.3);

  // Calculate end point on state circle edge
  const endX = fromX + stateRadius * Math.cos(angleRadians + 0.3);
  const endY = fromY + stateRadius * Math.sin(angleRadians + 0.3);

  // Control point for curve (positioned above state)
  const controlPointX = fromX;
  const controlPointY = fromY - stateRadius - loopRadius;

  // Create SVG path using quadratic bezier curve
  const pathData = `M ${startX} ${startY} Q ${controlPointX} ${controlPointY}, ${endX} ${endY}`;

  // Calculate arrowhead angle at end point (tangent to curve)
  const arrowheadAngle = Math.atan2(endY - controlPointY, endX - controlPointX);

  // Calculate arrowhead triangle points
  const arrowheadAngle1 = arrowheadAngle + Math.PI - Math.PI / 6;
  const arrowheadAngle2 = arrowheadAngle + Math.PI + Math.PI / 6;

  const arrowheadPoint1X = endX + ARROWHEAD_SIZE * Math.cos(arrowheadAngle1);
  const arrowheadPoint1Y = endY + ARROWHEAD_SIZE * Math.sin(arrowheadAngle1);
  const arrowheadPoint2X = endX + ARROWHEAD_SIZE * Math.cos(arrowheadAngle2);
  const arrowheadPoint2Y = endY + ARROWHEAD_SIZE * Math.sin(arrowheadAngle2);

  const displaySymbol = symbol === null ? 'ε' : symbol;

  return (
    <g>
      {/* Self-loop path */}
      <path
        d={pathData}
        fill="none"
        stroke="black"
        strokeWidth={STROKE_WIDTH}
      />

      {/* Arrowhead */}
      <polygon
        points={`${endX},${endY} ${arrowheadPoint1X},${arrowheadPoint1Y} ${arrowheadPoint2X},${arrowheadPoint2Y}`}
        fill="black"
      />

      {/* Label positioned above loop */}
      <text
        x={fromX}
        y={fromY + labelOffsetY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill="black"
        fontFamily="Arial, sans-serif"
      >
        {displaySymbol}
      </text>
    </g>
  );
}

/**
 * Render a curved arrow for bidirectional transitions
 * Uses quadratic bezier with perpendicular offset to prevent overlap
 */
function renderCurvedArrow(props: TransitionEdgeProp) {
  const { fromX, fromY, toX, toY, symbol, stateRadius } = props;
  const { curveOffset } = CURVED_ARROW_CONFIG;

  // Calculate angle from source to destination
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Calculate midpoint between state centers
  const midpointX = (fromX + toX) / 2;
  const midpointY = (fromY + toY) / 2;

  // Calculate perpendicular angle (90 degrees offset)
  const perpendicularAngle = angle + Math.PI / 2;

  // Calculate control point offset perpendicular to line
  const controlPointX = midpointX + curveOffset * Math.cos(perpendicularAngle);
  const controlPointY = midpointY + curveOffset * Math.sin(perpendicularAngle);

  // Calculate start point on source circle edge
  const startX = fromX + stateRadius * Math.cos(angle);
  const startY = fromY + stateRadius * Math.sin(angle);

  // Calculate end point on destination circle edge
  const endX = toX - stateRadius * Math.cos(angle);
  const endY = toY - stateRadius * Math.sin(angle);

  // Create SVG path using quadratic bezier curve
  const pathData = `M ${startX} ${startY} Q ${controlPointX} ${controlPointY}, ${endX} ${endY}`;

  // Calculate arrowhead angle at end point (tangent to curve)
  const arrowheadAngle = Math.atan2(
    endY - controlPointY,
    endX - controlPointX
  );

  // Calculate arrowhead triangle points
  const arrowheadAngle1 = arrowheadAngle + Math.PI - Math.PI / 6;
  const arrowheadAngle2 = arrowheadAngle + Math.PI + Math.PI / 6;

  const arrowheadPoint1X = endX + ARROWHEAD_SIZE * Math.cos(arrowheadAngle1);
  const arrowheadPoint1Y = endY + ARROWHEAD_SIZE * Math.sin(arrowheadAngle1);
  const arrowheadPoint2X = endX + ARROWHEAD_SIZE * Math.cos(arrowheadAngle2);
  const arrowheadPoint2Y = endY + ARROWHEAD_SIZE * Math.sin(arrowheadAngle2);

  const displaySymbol = symbol === null ? 'ε' : symbol;

  return (
    <g>
      {/* Curved arrow path */}
      <path
        d={pathData}
        fill="none"
        stroke="black"
        strokeWidth={STROKE_WIDTH}
      />

      {/* Arrowhead */}
      <polygon
        points={`${endX},${endY} ${arrowheadPoint1X},${arrowheadPoint1Y} ${arrowheadPoint2X},${arrowheadPoint2Y}`}
        fill="black"
      />

      {/* Label positioned at control point (naturally offset from line) */}
      <text
        x={controlPointX}
        y={controlPointY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill="black"
        fontFamily="Arial, sans-serif"
      >
        {displaySymbol}
      </text>
    </g>
  );
}

/**
 * Render a straight arrow between two different states
 * This is the original logic from Iteration 2
 */
function renderStraightArrow(props: TransitionEdgeProp) {
  const { fromX, fromY, toX, toY, symbol, stateRadius } = props;
  // Calculate angle from source to destination
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Calculate start point (edge of source circle)
  const startX = fromX + stateRadius * Math.cos(angle);
  const startY = fromY + stateRadius * Math.sin(angle);

  // Calculate end point (edge of destination circle)
  const endX = toX - stateRadius * Math.cos(angle);
  const endY = toY - stateRadius * Math.sin(angle);

  // Calculate midpoint for label
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Calculate label position (offset perpendicular to arrow)
  const perpAngle = angle + Math.PI / 2;
  const labelX = midX + LABEL_OFFSET * Math.cos(perpAngle);
  const labelY = midY + LABEL_OFFSET * Math.sin(perpAngle);

  // TODO: Revisit documentation for arrowhead calculation for better readability/clarity
  // Calculate arrowhead points
  const arrowheadAngle1 = angle + Math.PI - Math.PI / 6; // 150 degrees
  const arrowheadAngle2 = angle + Math.PI + Math.PI / 6; // 210 degrees
  const arrowheadPoint1X = endX + ARROWHEAD_SIZE * Math.cos(arrowheadAngle1);
  const arrowheadPoint1Y = endY + ARROWHEAD_SIZE * Math.sin(arrowheadAngle1);
  const arrowheadPoint2X = endX + ARROWHEAD_SIZE * Math.cos(arrowheadAngle2);
  const arrowheadPoint2Y = endY + ARROWHEAD_SIZE * Math.sin(arrowheadAngle2);

  // Display symbol (ε for null)
  const displaySymbol = symbol === null ? 'ε' : symbol;

  return (
    <g>
      {/* Arrow line */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="black"
        strokeWidth={STROKE_WIDTH}
      />

      {/* Arrowhead */}
      <polygon
        points={`${endX},${endY} ${arrowheadPoint1X},${arrowheadPoint1Y} ${arrowheadPoint2X},${arrowheadPoint2Y}`}
        fill="black"
      />

      {/* Symbol label */}
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill="black"
        fontFamily="Arial, sans-serif"
      >
        {displaySymbol}
      </text>
    </g>
  );
}
