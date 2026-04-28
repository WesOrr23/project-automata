/**
 * MiniTransitionSVG
 *
 * Tiny preview of "the transition you're building": two circles + a curved
 * arrow. Each circle is clickable — clicking opens the picker for that slot.
 *
 * (Self-loop visualization deferred — always renders the pair graphic,
 * even when source === destination. The transition still works correctly;
 * it just looks the same as a regular transition in the preview.)
 *
 * Three jobs:
 *   1. Show the transition being constructed.
 *   2. Indicate which slot is currently being picked (pulsing ring).
 *   3. Be the click target for opening the state picker on each slot.
 */

import { forwardRef } from 'react';

const VIEW_W = 160;
const VIEW_H = 64;
const NODE_R = 18;
const NODE_LEFT_X = 28;
const NODE_RIGHT_X = VIEW_W - 28;
const NODE_Y = VIEW_H / 2;

type SlotKind = 'source' | 'destination';

type MiniTransitionSVGProp = {
  sourceLabel: string | null;
  destinationLabel: string | null;
  /** Symbol to display above the arrow (or empty). */
  symbol: string;
  /** Which slot is currently being picked (drives pulsing ring). */
  activeSlot: SlotKind | null;
  /** Anchor is `Element` rather than `HTMLElement` because the click
   *  target is an SVG `<g>` slot, not an HTML element. The consumer
   *  (TransitionCreator.openPickerForSlot) only calls
   *  .getBoundingClientRect() on the anchor — defined on Element —
   *  so the wider type is sufficient and avoids an `as unknown as
   *  HTMLElement` model-mismatch cast at the event.currentTarget
   *  pass-through. */
  onSlotClick: (slot: SlotKind, anchor: Element) => void;
};

export const MiniTransitionSVG = forwardRef<SVGSVGElement, MiniTransitionSVGProp>(
  function MiniTransitionSVG(
    { sourceLabel, destinationLabel, symbol, activeSlot, onSlotClick },
    ref
  ) {
    return (
      <svg
        ref={ref}
        className="mini-transition-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={VIEW_W}
        height={VIEW_H}
        role="img"
        aria-label="Transition preview"
      >
        <PairGraphic
          sourceLabel={sourceLabel}
          destinationLabel={destinationLabel}
          symbol={symbol}
          activeSlot={activeSlot}
          onSourceClick={(event) => onSlotClick('source', event.currentTarget)}
          onDestinationClick={(event) => onSlotClick('destination', event.currentTarget)}
        />
      </svg>
    );
  }
);

function PairGraphic({
  sourceLabel,
  destinationLabel,
  symbol,
  activeSlot,
  onSourceClick,
  onDestinationClick,
}: {
  sourceLabel: string | null;
  destinationLabel: string | null;
  symbol: string;
  activeSlot: SlotKind | null;
  onSourceClick: (event: React.MouseEvent<SVGGElement>) => void;
  onDestinationClick: (event: React.MouseEvent<SVGGElement>) => void;
}) {
  // Arrow path: gentle curve from right edge of source to left edge of destination.
  const arrowFromX = NODE_LEFT_X + NODE_R;
  const arrowToX = NODE_RIGHT_X - NODE_R;
  const midX = (arrowFromX + arrowToX) / 2;
  const arcY = NODE_Y - 14;
  const arrowPath = `M ${arrowFromX} ${NODE_Y} Q ${midX} ${arcY} ${arrowToX} ${NODE_Y}`;
  const labelX = midX;
  const labelY = arcY - 2;

  return (
    <>
      {/* Curved arrow */}
      <path d={arrowPath} className="mini-transition-arrow" fill="none" />
      {/* Arrowhead */}
      <Arrowhead x={arrowToX} y={NODE_Y} angleDeg={20} />
      {/* Symbol label above arrow */}
      {symbol !== '' && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          className="mini-transition-symbol"
        >
          {symbol}
        </text>
      )}

      <SlotCircle
        cx={NODE_LEFT_X}
        cy={NODE_Y}
        label={sourceLabel}
        isActive={activeSlot === 'source'}
        onClick={onSourceClick}
        ariaLabel="Source state"
      />
      <SlotCircle
        cx={NODE_RIGHT_X}
        cy={NODE_Y}
        label={destinationLabel}
        isActive={activeSlot === 'destination'}
        onClick={onDestinationClick}
        ariaLabel="Destination state"
      />
    </>
  );
}

function SlotCircle({
  cx,
  cy,
  label,
  isActive,
  onClick,
  ariaLabel,
}: {
  cx: number;
  cy: number;
  label: string | null;
  isActive: boolean;
  onClick: (event: React.MouseEvent<SVGGElement>) => void;
  ariaLabel: string;
}) {
  const className = [
    'mini-transition-slot',
    label === null ? 'mini-transition-slot-empty' : 'mini-transition-slot-filled',
    isActive ? 'mini-transition-slot-active' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <g
      className={className}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      <circle cx={cx} cy={cy} r={NODE_R} />
      <text x={cx} y={cy + 4} textAnchor="middle" className="mini-transition-label">
        {label ?? '?'}
      </text>
    </g>
  );
}

function Arrowhead({ x, y, angleDeg }: { x: number; y: number; angleDeg: number }) {
  // Geometry mirrors src/components/TransitionEdge.tsx so the mini
  // and canvas arrowheads read as the same vocabulary. Canvas uses
  // ARROWHEAD_SIZE=8 with a 30° base half-angle (Math.PI/6); we use
  // size=7 here because the mini SVG viewBox is tighter and 8 looks
  // chunky relative to the 14px slot circles, but the proportions
  // match.
  const size = 7;
  const baseHalfAngleDeg = 30;
  const cos = Math.cos((baseHalfAngleDeg * Math.PI) / 180);
  const sin = Math.sin((baseHalfAngleDeg * Math.PI) / 180);
  // Triangle in local coords with tip at (0,0) and base behind it.
  const baseX = -size * cos;
  const baseY1 = -size * sin;
  const baseY2 = size * sin;
  return (
    <polygon
      points={`0,0 ${baseX},${baseY1} ${baseX},${baseY2}`}
      transform={`translate(${x} ${y}) rotate(${angleDeg})`}
      className="mini-transition-arrowhead"
    />
  );
}
