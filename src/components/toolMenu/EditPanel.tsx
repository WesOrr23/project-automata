/**
 * EditPanel Component
 *
 * Form-based editor for the automaton:
 * - Alphabet (symbols)
 * - States (add, remove, start, accept)
 * - Transitions (add, remove)
 */

import { Automaton } from '../../engine/types';
import { AlphabetEditor } from './AlphabetEditor';
import { StateEditor } from './StateEditor';
import { TransitionEditor } from './TransitionEditor';

type EditPanelProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  error: string | null;
  onAlphabetAdd: (symbol: string) => void;
  onAlphabetRemove: (symbol: string) => void;
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
  displayLabels,
  error,
  onAlphabetAdd,
  onAlphabetRemove,
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
      <AlphabetEditor
        alphabet={automaton.alphabet}
        onAlphabetAdd={onAlphabetAdd}
        onAlphabetRemove={onAlphabetRemove}
      />

      <div className="divider" />

      <StateEditor
        states={automaton.states}
        startState={automaton.startState}
        acceptStates={automaton.acceptStates}
        displayLabels={displayLabels}
        onAddState={onAddState}
        onRemoveState={onRemoveState}
        onSetStartState={onSetStartState}
        onToggleAcceptState={onToggleAcceptState}
      />

      <div className="divider" />

      <TransitionEditor
        automaton={automaton}
        displayLabels={displayLabels}
        error={error}
        onAddTransition={onAddTransition}
        onRemoveTransition={onRemoveTransition}
        onDismissError={onDismissError}
      />
    </>
  );
}
