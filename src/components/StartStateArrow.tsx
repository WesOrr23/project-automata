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
// Visible gap between the line's tail end and the arrowhead's base.
// Matches the breathing whitespace used by transition-edge arrowheads
// elsewhere in the canvas — the line should "point at" the head, not
// kiss it.
const ARROW_HEAD_GAP = 4;

export function StartStateArrow({
  targetX,
  targetY,
  stateRadius,
}: StartStateArrowProp) {
  // Calculate start and end points. Arrow comes from the left.
  //   - tipX     = where the arrowhead's tip sits (touches the circle).
  //   - baseX    = where the arrowhead's flat base sits.
  //   - lineEndX = where the line stops (one ARROW_HEAD_GAP back from
  //                the base). The visible gap reads as breathing room
  //                between the line and head, matching the transition
  //                edges' arrowhead spacing.
  const tipX = targetX - stateRadius;
  const baseX = tipX - ARROWHEAD_SIZE;
  const lineEndX = baseX - ARROW_HEAD_GAP;
  const endY = targetY;
  const startX = lineEndX - ARROW_LENGTH;
  const startY = targetY;

  return (
    // The `start-arrow-breath` class drives a subtle opacity breathing
    // (0.85 ↔ 1.0 over 2s) at idle — see index.css. Applied to the group
    // so both the line and arrowhead breathe together as one mark.
    <g className="start-arrow-breath">
      {/* Arrow line — stops one ARROW_HEAD_GAP before the arrowhead. */}
      <line
        x1={startX}
        y1={startY}
        x2={lineEndX}
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
