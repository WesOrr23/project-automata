/**
 * StartStateArrow Component
 *
 * Renders an arrow pointing to the start state from the left.
 * The arrow points to the edge of the state circle, not the center.
 */

type StartStateArrowProp = {
  /** X coordinate of the target state center */
  targetX: number;

  /** Y coordinate of the target state center */
  targetY: number;

  /** Radius of the state circle (to calculate edge intersection) */
  stateRadius: number;
};

/**
 * Visual constants for start arrow
 */
const ARROW_LENGTH = 50; // Length of the arrow line
const ARROWHEAD_SIZE = 8; // Size of the arrowhead triangle

export function StartStateArrow({
  targetX,
  targetY,
  stateRadius,
}: StartStateArrowProp) {
  // Calculate start and end points
  // Arrow comes from the left, so it's horizontal
  const endX = targetX - stateRadius; // Point at left edge of state circle
  const endY = targetY;
  const startX = endX - ARROW_LENGTH; // Start point 50px to the left
  const startY = targetY;

  return (
    <g>
      {/* Arrow line */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="black"
        strokeWidth={2}
      />

      {/* Arrowhead - triangle pointing right */}
      <polygon
        points={`${endX},${endY} ${endX - ARROWHEAD_SIZE},${endY - ARROWHEAD_SIZE / 2} ${endX - ARROWHEAD_SIZE},${endY + ARROWHEAD_SIZE / 2}`}
        fill="black"
      />
    </g>
  );
}
