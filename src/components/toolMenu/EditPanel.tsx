/**
 * EditPanel Component
 *
 * Form-based editor for the automaton:
 * - Alphabet (symbols)
 * - States (add, remove, start, accept)
 * - Transitions (add, remove)
 *
 * Highlight props (from notification system) are passed through to the
 * matching child editor so the user can see which row is being referenced.
 */

import { Automaton } from '../../engine/types';
import { AlphabetEditor } from './AlphabetEditor';
import { StateEditor } from './StateEditor';
import { TransitionEditor } from './TransitionEditor';

type EditPanelProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  highlightedStateId: number | null;
  highlightedTransition: { from: number; to: number; symbol: string | null } | null;
  highlightedSymbol: string | null;
  onAlphabetAdd: (symbol: string) => void;
  onAlphabetRemove: (symbol: string) => void;
  onAddState: () => void;
  onRemoveState: (stateId: number) => void;
  onSetStartState: (stateId: number) => void;
  onToggleAcceptState: (stateId: number) => void;
  onSetTransition: (from: number, symbol: string, to: number | null) => void;
};

export function EditPanel({
  automaton,
  displayLabels,
  highlightedStateId,
  highlightedTransition,
  highlightedSymbol,
  onAlphabetAdd,
  onAlphabetRemove,
  onAddState,
  onRemoveState,
  onSetStartState,
  onToggleAcceptState,
  onSetTransition,
}: EditPanelProp) {
  return (
    <>
      <AlphabetEditor
        alphabet={automaton.alphabet}
        highlightedSymbol={highlightedSymbol}
        onAlphabetAdd={onAlphabetAdd}
        onAlphabetRemove={onAlphabetRemove}
      />

      <div className="divider" />

      <StateEditor
        states={automaton.states}
        startState={automaton.startState}
        acceptStates={automaton.acceptStates}
        displayLabels={displayLabels}
        highlightedStateId={highlightedStateId}
        onAddState={onAddState}
        onRemoveState={onRemoveState}
        onSetStartState={onSetStartState}
        onToggleAcceptState={onToggleAcceptState}
      />

      <div className="divider" />

      <TransitionEditor
        automaton={automaton}
        displayLabels={displayLabels}
        highlightedTransition={highlightedTransition}
        onSetTransition={onSetTransition}
      />
    </>
  );
}
