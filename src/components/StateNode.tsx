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
   * Whether this state's branch died on the most recent simulation
   * step. Triggers a one-shot fade-to-red animation so the user sees
   * the branch winding down. Independent of isActive (a dying state
   * is no longer in the active set by definition).
   */
  isDying?: boolean;

  /**
   * If this state is currently selected as the source or destination of
   * the in-progress transition edit, the kind of action — drives a
   * pulsing halo color (blue for add, purple for modify). Null/undefined
   * leaves the state alone.
   */
  creationKind?: 'add' | 'modify' | null;

  /**
   * Whether the state is currently interactive (clickable). Drives the
   * cursor and hover affordance.
   */
  isInteractive?: boolean;

  /**
   * Visual emphasis variant — 'pick' shows a pulsing ring (used while
   * the canvas is in pick mode for the creator form), 'select' shows
   * a quieter affordance (used for state-action clicks in edit mode).
   */
  interactionStyle?: 'pick' | 'select';

  /** Called when the state is clicked. The DOM element is passed for
   * popover anchoring purposes (state-action popover). */
  onClick?: (anchorEl: SVGGElement) => void;
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
  isDying = false,
  creationKind = null,
  isInteractive = false,
  interactionStyle = 'select',
  onClick,
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

  // Override stroke when this state is participating in something the
  // canvas wants to draw attention to — either a notification target
  // (red), the source/destination of the in-progress transition edit
  // (blue/purple), or a freshly-died simulation branch (red fade).
  // Notification highlight wins if multiple are true at once;
  // dying takes priority over creation since the simulation visual
  // is more time-sensitive.
  let strokeWidth = STROKE_WIDTH;
  let strokeClass: string | undefined;
  if (creationKind !== null) {
    strokeColor = creationKind === 'add' ? '#2563eb' : '#7c3aed';
    strokeWidth = 3;
    strokeClass = `pulse-canvas pulse-canvas-${creationKind}`;
  }
  if (isDying) {
    // Light red fill so the eye reads "this branch died" all at once,
    // not "blue (active) but with a red outline". Matches the rejected
    // result-status fill so the death visual ties to the broader
    // "this branch failed" vocabulary.
    fillColor = '#fee2e2'; // --error-fill
    strokeColor = '#dc2626';
    strokeWidth = 3;
    strokeClass = 'state-dying';
  }
  if (isHighlighted) {
    strokeColor = '#dc2626'; // --error-stroke
    strokeWidth = 3;
    strokeClass = 'pulse-canvas pulse-canvas-error';
  }

  // Combined classes for visual affordance.
  const groupClassNames = [
    isInteractive && interactionStyle === 'pick' ? 'state-node-pickable' : '',
    isInteractive && interactionStyle === 'select' ? 'state-node-selectable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <g
      data-state-id={stateId}
      className={groupClassNames}
      onClick={
        isInteractive && onClick
          ? (event) => onClick(event.currentTarget)
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive && onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick(event.currentTarget);
              }
            }
          : undefined
      }
      style={isInteractive ? { cursor: 'pointer' } : undefined}
    >
      {/* Outer circle (always present). Stroke pulses when this state is
       * participating in a notification highlight or the in-progress
       * transition edit; otherwise renders with the default stroke. */}
      <circle
        cx={x}
        cy={y}
        r={STATE_RADIUS}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        className={strokeClass}
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
