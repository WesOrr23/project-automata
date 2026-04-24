/**
 * MiniTransitionSVG
 *
 * Tiny preview of "the transition you're building": two circles + a curved
 * arrow, OR (when source === destination) one circle with a self-loop.
 * Each circle is clickable — clicking opens the picker for that slot.
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
  /** Whether to render as a self-loop (source === destination, both filled). */
  isSelfLoop: boolean;
  /** Which slot is currently being picked (drives pulsing ring). */
  activeSlot: SlotKind | null;
  onSlotClick: (slot: SlotKind, anchor: HTMLElement) => void;
};

export const MiniTransitionSVG = forwardRef<SVGSVGElement, MiniTransitionSVGProp>(
  function MiniTransitionSVG(
    {
      sourceLabel,
      destinationLabel,
      symbol,
      isSelfLoop,
      activeSlot,
      onSlotClick,
    },
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
        {isSelfLoop ? (
          <SelfLoopGraphic
            label={sourceLabel}
            symbol={symbol}
            onClick={(event) => onSlotClick('source', event.currentTarget as unknown as HTMLElement)}
            isActive={activeSlot !== null}
          />
        ) : (
          <PairGraphic
            sourceLabel={sourceLabel}
            destinationLabel={destinationLabel}
            symbol={symbol}
            activeSlot={activeSlot}
            onSourceClick={(event) =>
              onSlotClick('source', event.currentTarget as unknown as HTMLElement)
            }
            onDestinationClick={(event) =>
              onSlotClick('destination', event.currentTarget as unknown as HTMLElement)
            }
          />
        )}
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

function SelfLoopGraphic({
  label,
  symbol,
  onClick,
  isActive,
}: {
  label: string | null;
  symbol: string;
  onClick: (event: React.MouseEvent<SVGGElement>) => void;
  isActive: boolean;
}) {
  const cx = VIEW_W / 2;
  const cy = NODE_Y;
  // Loop arc above the circle
  const loopRadius = 12;
  const loopStartX = cx - 8;
  const loopEndX = cx + 8;
  const loopApexY = cy - NODE_R - loopRadius;
  const loopPath = `M ${loopStartX} ${cy - NODE_R} Q ${cx} ${loopApexY - 6} ${loopEndX} ${cy - NODE_R}`;

  return (
    <>
      <path d={loopPath} className="mini-transition-arrow" fill="none" />
      <Arrowhead x={loopEndX} y={cy - NODE_R} angleDeg={70} />
      {symbol !== '' && (
        <text
          x={cx}
          y={loopApexY - 8}
          textAnchor="middle"
          className="mini-transition-symbol"
        >
          {symbol}
        </text>
      )}
      <SlotCircle
        cx={cx}
        cy={cy}
        label={label}
        isActive={isActive}
        onClick={onClick}
        ariaLabel="State (self-loop)"
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
  const size = 5;
  return (
    <polygon
      points={`0,0 -${size * 1.6},-${size * 0.6} -${size * 1.6},${size * 0.6}`}
      transform={`translate(${x} ${y}) rotate(${angleDeg})`}
      className="mini-transition-arrowhead"
    />
  );
}
