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

  /** Whether this state is active during simulation */
  isActive?: boolean;

  /** Result status for final state highlighting after simulation completes */
  resultStatus?: 'accepted' | 'rejected' | null;

  /** Whether this state is the active highlight target of a notification */
  isHighlighted?: boolean;

  /**
   * Whether the canvas is in "pick a state" mode. Drives the cursor and
   * hover affordance so the user knows the state node is clickable.
   */
  isPickable?: boolean;

  /** Called when the state is clicked while pickable. */
  onPick?: () => void;
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
  isActive = false,
  resultStatus = null,
  isHighlighted = false,
  isPickable = false,
  onPick,
}: StateNodeProp) {
  // Determine fill and stroke colors based on simulation state
  // Priority: resultStatus > isActive > default
  // Colors sourced from CSS custom properties (design tokens)
  // SVG doesn't inherit CSS vars, so we use the raw values that match index.css
  let fillColor = 'white';
  let strokeColor = '#334155'; // --text-body (slate-700)

  if (resultStatus === 'accepted') {
    fillColor = '#dcfce7'; // --success-fill
    strokeColor = '#16a34a'; // --success-stroke
  } else if (resultStatus === 'rejected') {
    fillColor = '#fee2e2'; // --error-fill
    strokeColor = '#dc2626'; // --error-stroke
  } else if (isActive) {
    fillColor = '#bfdbfe'; // --blue-200
    strokeColor = '#2563eb'; // --blue-600
  }

  // When this state is the active highlight target, override stroke to the
  // notification severity color and run the pulse animation.
  if (isHighlighted) {
    strokeColor = '#dc2626'; // --error-stroke
  }

  const highlightClass = isHighlighted ? 'pulse-canvas pulse-canvas-error' : undefined;

  // Combined classes: highlight pulse (notification) + pickable affordance.
  const groupClassNames = [
    isPickable ? 'state-node-pickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <g
      data-state-id={stateId}
      className={groupClassNames}
      onClick={isPickable ? onPick : undefined}
      role={isPickable ? 'button' : undefined}
      tabIndex={isPickable ? 0 : undefined}
      onKeyDown={
        isPickable && onPick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPick();
              }
            }
          : undefined
      }
      style={isPickable ? { cursor: 'pointer' } : undefined}
    >
      {/* Outer circle (always present) */}
      <circle
        cx={x}
        cy={y}
        r={STATE_RADIUS}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        className={highlightClass}
      />

      {/* Inner circle (only for accept states) */}
      {isAccept && (
        <circle
          cx={x}
          cy={y}
          r={STATE_RADIUS - INNER_CIRCLE_OFFSET}
          fill="none"
          stroke={strokeColor}
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
        fill="#0f172a"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}
