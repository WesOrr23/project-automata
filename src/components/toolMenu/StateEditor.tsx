/**
 * StateEditor Component
 *
 * Form-based controls for managing states:
 * - Add state button
 * - List of existing states with start/accept toggles and delete buttons
 */

import { Plus, Trash2, CircleDot, CircleCheck, Circle } from 'lucide-react';
import { createDefaultLabel } from '../../ui-state/types';

type StateEditorProp = {
  states: Set<number>;
  startState: number;
  acceptStates: Set<number>;
  onAddState: () => void;
  onRemoveState: (stateId: number) => void;
  onSetStartState: (stateId: number) => void;
  onToggleAcceptState: (stateId: number) => void;
};

export function StateEditor({
  states,
  startState,
  acceptStates,
  onAddState,
  onRemoveState,
  onSetStartState,
  onToggleAcceptState,
}: StateEditorProp) {
  const sortedIds = Array.from(states).sort((a, b) => a - b);
  const canDelete = states.size > 1;

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
          return (
            <div key={stateId} className="editor-row">
              <span className="editor-row-label">{createDefaultLabel(stateId)}</span>

              {/* Start toggle */}
              <button
                className={`editor-row-action ${isStart ? 'active' : ''}`}
                onClick={() => onSetStartState(stateId)}
                aria-label={`Set ${createDefaultLabel(stateId)} as start state`}
                title="Start state"
                disabled={isStart}
              >
                <CircleDot size={14} />
              </button>

              {/* Accept toggle */}
              <button
                className={`editor-row-action ${isAccept ? 'active' : ''}`}
                onClick={() => onToggleAcceptState(stateId)}
                aria-label={`Toggle accept state for ${createDefaultLabel(stateId)}`}
                title={isAccept ? 'Accept state (click to unset)' : 'Mark as accept state'}
              >
                {isAccept ? <CircleCheck size={14} /> : <Circle size={14} />}
              </button>

              {/* Delete */}
              <button
                className="editor-row-action danger"
                onClick={() => onRemoveState(stateId)}
                aria-label={`Delete ${createDefaultLabel(stateId)}`}
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
