/**
 * EditPanel Component
 *
 * Form-based editor for the automaton:
 * - State management (add, remove, set start, toggle accept)
 * - Transition management (add, remove)
 */

import { Automaton } from '../../engine/types';
import { StateEditor } from './StateEditor';
import { TransitionEditor } from './TransitionEditor';

type EditPanelProp = {
  automaton: Automaton;
  error: string | null;
  onAddState: () => void;
  onRemoveState: (stateId: number) => void;
  onSetStartState: (stateId: number) => void;
  onToggleAcceptState: (stateId: number) => void;
  onAddTransition: (from: number, to: number, symbol: string) => string | null;
  onRemoveTransition: (from: number, to: number, symbol: string | null) => void;
  onDismissError: () => void;
};

export function EditPanel({
  automaton,
  error,
  onAddState,
  onRemoveState,
  onSetStartState,
  onToggleAcceptState,
  onAddTransition,
  onRemoveTransition,
  onDismissError,
}: EditPanelProp) {
  return (
    <>
      <StateEditor
        states={automaton.states}
        startState={automaton.startState}
        acceptStates={automaton.acceptStates}
        onAddState={onAddState}
        onRemoveState={onRemoveState}
        onSetStartState={onSetStartState}
        onToggleAcceptState={onToggleAcceptState}
      />

      <div className="divider" />

      <TransitionEditor
        automaton={automaton}
        onAddTransition={onAddTransition}
        onRemoveTransition={onRemoveTransition}
      />

      {error && (
        <div
          className="editor-validation-banner"
          onClick={onDismissError}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          title="Click to dismiss"
        >
          {error}
        </div>
      )}
    </>
  );
}
