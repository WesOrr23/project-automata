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
  // Calculate start and end points. Arrow comes from the left.
  //   - tipX  = where the arrowhead's tip sits (touches the circle edge).
  //   - baseX = where the arrowhead's flat base sits (one ARROWHEAD_SIZE
  //             back from the tip). The line stops here, NOT at the tip,
  //             so the line's 2px stroke can't poke past the polygon's
  //             narrowing-to-a-point silhouette near the tip.
  const tipX = targetX - stateRadius;
  const baseX = tipX - ARROWHEAD_SIZE;
  const endY = targetY;
  const startX = baseX - ARROW_LENGTH;
  const startY = targetY;

  return (
    // The `start-arrow-breath` class drives a subtle opacity breathing
    // (0.85 ↔ 1.0 over 2s) at idle — see index.css. Applied to the group
    // so both the line and arrowhead breathe together as one mark.
    <g className="start-arrow-breath">
      {/* Arrow line — stops at the arrowhead's base. */}
      <line
        x1={startX}
        y1={startY}
        x2={baseX}
        y2={endY}
        stroke="black"
        strokeWidth={2}
      />

      {/* Arrowhead — triangle pointing right. Tip touches the circle. */}
      <polygon
        points={`${tipX},${endY} ${baseX},${endY - ARROWHEAD_SIZE / 2} ${baseX},${endY + ARROWHEAD_SIZE / 2}`}
        fill="black"
      />
    </g>
  );
}
