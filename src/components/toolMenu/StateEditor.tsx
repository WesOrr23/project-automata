/**
 * StateEditor Component
 *
 * Form-based controls for managing states:
 * - Add state button
 * - List of existing states with start/accept toggles and delete buttons
 *
 * Display labels are computed upstream (see computeDisplayLabels) so the user
 * sees contiguous q0/q1/q2 regardless of underlying engine IDs.
 */

import { Plus, Trash2, CircleDot, CircleCheck, Circle } from 'lucide-react';

type StateEditorProp = {
  states: Set<number>;
  startState: number;
  acceptStates: Set<number>;
  displayLabels: Map<number, string>;
  highlightedStateId: number | null;
  onAddState: () => void;
  onRemoveState: (stateId: number) => void;
  onSetStartState: (stateId: number) => void;
  onToggleAcceptState: (stateId: number) => void;
};

export function StateEditor({
  states,
  startState,
  acceptStates,
  displayLabels,
  highlightedStateId,
  onAddState,
  onRemoveState,
  onSetStartState,
  onToggleAcceptState,
}: StateEditorProp) {
  const sortedIds = Array.from(states).sort((a, b) => a - b);
  const canDelete = states.size > 1;

  function labelFor(stateId: number): string {
    return displayLabels.get(stateId) ?? `q${stateId}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div className="editor-section-header">
        <span className="label">States</span>
        <button
          className="btn"
          onClick={onAddState}
          style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-sm)' }}
          aria-label="Add state"
        >
          <Plus size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Add
        </button>
      </div>

      <div className="editor-list">
        {sortedIds.map((stateId) => {
          const isStart = stateId === startState;
          const isAccept = acceptStates.has(stateId);
          const label = labelFor(stateId);
          const isHighlighted = stateId === highlightedStateId;
          return (
            <div
              key={stateId}
              className={`editor-row show-actions-on-hover ${isHighlighted ? 'pulse-error' : ''}`}
            >
              <span className="editor-row-label">{label}</span>

              {/* Start toggle */}
              <button
                className={`editor-row-action ${isStart ? 'active' : ''}`}
                onClick={() => onSetStartState(stateId)}
                aria-label={`Set ${label} as start state`}
                title="Start state"
                disabled={isStart}
              >
                <CircleDot size={14} />
              </button>

              {/* Accept toggle */}
              <button
                className={`editor-row-action ${isAccept ? 'active' : ''}`}
                onClick={() => onToggleAcceptState(stateId)}
                aria-label={`Toggle accept state for ${label}`}
                title={isAccept ? 'Accept state (click to unset)' : 'Mark as accept state'}
              >
                {isAccept ? <CircleCheck size={14} /> : <Circle size={14} />}
              </button>

              {/* Delete */}
              <button
                className="editor-row-action danger hide-unless-hover"
                onClick={() => onRemoveState(stateId)}
                aria-label={`Delete ${label}${canDelete ? '' : ' (cannot delete last state)'}`}
                title={canDelete ? 'Delete state' : 'Cannot delete last state'}
                disabled={!canDelete}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
