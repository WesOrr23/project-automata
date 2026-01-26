/**
 * StateNode Component
 *
 * Renders a single state in the automaton as an SVG circle.
 * Accept states are rendered with a double circle (concentric circles).
 */

type StateNodeProp = {
  /** Numeric ID of the state (from engine layer) */
  stateId: number;

  /** Display label for the state (e.g., "q0", "q1") */
  label: string;

  /** X coordinate on the SVG canvas */
  x: number;

  /** Y coordinate on the SVG canvas */
  y: number;

  /** Whether this is the start state (reserved for future use) */
  isStart: boolean;

  /** Whether this is an accept state (renders double circle) */
  isAccept: boolean;

  /** Whether this state is active during simulation (reserved for future use) */
  isActive?: boolean;
};

/**
 * Visual constants for state rendering
 */
const STATE_RADIUS = 30;
const INNER_CIRCLE_OFFSET = 6; // Distance between outer and inner circles for accept states
const STROKE_WIDTH = 2;

export function StateNode({
  stateId,
  label,
  x,
  y,
    isStart: _isStart,
  isAccept,
  isActive: _isActive = false,
}: StateNodeProp) {
  return (
    <g data-state-id={stateId}>
      {/* Outer circle (always present) */}
      <circle
        cx={x}
        cy={y}
        r={STATE_RADIUS}
        fill="white"
        stroke="black"
        strokeWidth={STROKE_WIDTH}
      />

      {/* Inner circle (only for accept states) */}
      {isAccept && (
        <circle
          cx={x}
          cy={y}
          r={STATE_RADIUS - INNER_CIRCLE_OFFSET}
          fill="none"
          stroke="black"
          strokeWidth={STROKE_WIDTH}
        />
      )}

      {/* State label */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14px"
        fill="black"
        fontFamily="Arial, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}
