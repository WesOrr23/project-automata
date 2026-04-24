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

import { Dispatch } from 'react';
import { Automaton } from '../../engine/types';
import { AlphabetEditor } from './AlphabetEditor';
import { StateEditor } from './StateEditor';
import { TransitionCreator } from '../transitionEditor/TransitionCreator';
import type {
  CreationState,
  CreationAction,
} from '../transitionEditor/creationReducer';

type EditPanelProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  highlightedStateId: number | null;
  highlightedSymbol: string | null;
  /** Lifted creation form state (so the canvas can dispatch into it). */
  creationState: CreationState;
  creationDispatch: Dispatch<CreationAction>;
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
  highlightedSymbol,
  creationState,
  creationDispatch,
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

      <TransitionCreator
        automaton={automaton}
        displayLabels={displayLabels}
        creationState={creationState}
        creationDispatch={creationDispatch}
        onSetTransition={onSetTransition}
      />
    </>
  );
}
