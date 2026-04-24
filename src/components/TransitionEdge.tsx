/**
 * TransitionEdge Component
 *
 * Renders a transition arrow between two states using pre-computed
 * SVG path data from GraphViz. All edge geometry (splines, arrowhead
 * position, label placement) is computed by GraphViz's layout engine.
 */

type TransitionEdgeProp = {
  /** SVG path d attribute (cubic bezier spline from GraphViz) */
  pathData: string;

  /** Transition symbol (null represents ε-transition) */
  symbol: string | null;

  /** Position of the arrowhead tip */
  arrowheadPosition: { x: number; y: number };

  /** Arrowhead angle in radians (direction the arrow points) */
  arrowheadAngle: number;

  /** GraphViz-computed label position */
  labelPosition: { x: number; y: number };

  /** Whether this transition is the next one to be taken during simulation */
  isNextTransition?: boolean;

  /** Whether this transition is the active highlight target of a notification */
  isHighlighted?: boolean;
};

const STROKE_WIDTH = 2;
const ARROWHEAD_SIZE = 8;

export function TransitionEdge(props: TransitionEdgeProp) {
  const {
    pathData,
    symbol,
    arrowheadPosition,
    arrowheadAngle,
    labelPosition,
    isNextTransition = false,
    isHighlighted = false,
  } = props;

  // Highlight (notification target) wins over next-transition (simulation).
  let edgeColor = isNextTransition ? '#2563eb' : '#334155'; // --blue-600 : --text-body
  let edgeStrokeWidth = isNextTransition ? 3 : STROKE_WIDTH;
  if (isHighlighted) {
    edgeColor = '#dc2626'; // --error-stroke
    edgeStrokeWidth = 3;
  }
  const highlightClass = isHighlighted ? 'pulse-canvas pulse-canvas-error' : undefined;

  // Calculate arrowhead triangle points from angle
  const arrowheadAngle1 = arrowheadAngle + Math.PI - Math.PI / 6;
  const arrowheadAngle2 = arrowheadAngle + Math.PI + Math.PI / 6;

  const arrowheadPoint1X = arrowheadPosition.x + ARROWHEAD_SIZE * Math.cos(arrowheadAngle1);
  const arrowheadPoint1Y = arrowheadPosition.y + ARROWHEAD_SIZE * Math.sin(arrowheadAngle1);
  const arrowheadPoint2X = arrowheadPosition.x + ARROWHEAD_SIZE * Math.cos(arrowheadAngle2);
  const arrowheadPoint2Y = arrowheadPosition.y + ARROWHEAD_SIZE * Math.sin(arrowheadAngle2);

  const displaySymbol = symbol === null ? 'ε' : symbol;

  return (
    <g>
      {/* Edge spline path */}
      <path
        d={pathData}
        fill="none"
        stroke={edgeColor}
        strokeWidth={edgeStrokeWidth}
        className={highlightClass}
      />

      {/* Arrowhead */}
      <polygon
        points={`${arrowheadPosition.x},${arrowheadPosition.y} ${arrowheadPoint1X},${arrowheadPoint1Y} ${arrowheadPoint2X},${arrowheadPoint2Y}`}
        fill={edgeColor}
      />

      {/* Symbol label */}
      <text
        x={labelPosition.x}
        y={labelPosition.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill={edgeColor}
        fontWeight={isNextTransition ? 'bold' : 'normal'}
        fontFamily="Arial, sans-serif"
      >
        {displaySymbol}
      </text>
    </g>
  );
}
