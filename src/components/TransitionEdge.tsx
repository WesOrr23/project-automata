/**
 * TransitionEdge Component
 *
 * Renders a transition arrow between two states.
 * The arrow starts and ends at the state circle edges, not centers.
 * The symbol label is positioned at the midpoint of the arrow.
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
};

/**
 * Visual constants for transition arrows
 */
const STROKE_WIDTH = 2;
const ARROWHEAD_SIZE = 8;
const LABEL_OFFSET = 15; // Distance of label from arrow line

export function TransitionEdge({
  fromX,
  fromY,
  toX,
  toY,
  symbol,
  stateRadius,
}: TransitionEdgeProp) {
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
  const arrowAngle1 = angle + Math.PI - Math.PI / 6; // 150 degrees
  const arrowAngle2 = angle + Math.PI + Math.PI / 6; // 210 degrees
  const arrowPoint1X = endX + ARROWHEAD_SIZE * Math.cos(arrowAngle1);
  const arrowPoint1Y = endY + ARROWHEAD_SIZE * Math.sin(arrowAngle1);
  const arrowPoint2X = endX + ARROWHEAD_SIZE * Math.cos(arrowAngle2);
  const arrowPoint2Y = endY + ARROWHEAD_SIZE * Math.sin(arrowAngle2);

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
        points={`${endX},${endY} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
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
