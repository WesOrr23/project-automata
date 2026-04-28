/**
 * StartStateArrow Component
 *
 * Renders an arrow pointing to the start state from the left.
 * The arrow points to the edge of the state circle, not the center.
 *
 * The three primitives (line length, head gap, head size) live in
 * `ui-state/constants.ts` so layout-side code (the AutomatonCanvas
 * inner-group translate, the GraphViz phantom-node width) can derive
 * matching reserve values from a single source. See
 * `START_ARROW_VISUAL_WIDTH` for the derived total.
 */

import {
  START_ARROW_LINE_LENGTH,
  START_ARROW_HEAD_GAP,
  START_ARROW_HEAD_SIZE,
} from '../ui-state/constants';

type StartStateArrowProp = {
  /** X coordinate of the target state center */
  targetX: number;

  /** Y coordinate of the target state center */
  targetY: number;

  /** Radius of the state circle (to calculate edge intersection) */
  stateRadius: number;
};

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
  const baseX = tipX - START_ARROW_HEAD_SIZE;
  const lineEndX = baseX - START_ARROW_HEAD_GAP;
  const endY = targetY;
  const startX = lineEndX - START_ARROW_LINE_LENGTH;
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
        points={`${tipX},${endY} ${baseX},${endY - START_ARROW_HEAD_SIZE / 2} ${baseX},${endY + START_ARROW_HEAD_SIZE / 2}`}
        fill="black"
      />
    </g>
  );
}
