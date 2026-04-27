/**
 * EditPanel Component
 *
 * Form-based editor for the automaton's interactively-constructed
 * pieces:
 * - States (add, remove, start, accept)
 * - Transitions (add, remove)
 *
 * Alphabet was moved to Define (it's part of the formal tuple, not
 * something you "construct"). A read-only strip stays here for
 * reference + a "+" jump-to-Define button so adding a missing symbol
 * mid-edit is one click instead of a tab hop.
 *
 * Highlight props (from notification system) are passed through to the
 * matching child editor so the user can see which row is being referenced.
 */

import { Dispatch } from 'react';
import { Automaton } from '../../engine/types';
import { AlphabetReadOnly } from './AlphabetReadOnly';
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
  /** The reserved character that means "ε" in the symbol input. */
  epsilonSymbol: string;
  /** Jump to Define and focus the alphabet input. Wired from App. */
  onJumpToAlphabet: () => void;
  onAddState: () => void;
  onRemoveState: (stateId: number) => void;
  onSetStartState: (stateId: number) => void;
  onToggleAcceptState: (stateId: number) => void;
  /** Apply a batch transition edit (removes + adds in one update). */
  onApplyTransitionEdit: (
    removes: ReadonlyArray<{ from: number; to: number; symbol: string | null }>,
    adds: ReadonlyArray<{ from: number; to: number; symbol: string | null }>
  ) => void;
};

export function EditPanel({
  automaton,
  displayLabels,
  highlightedStateId,
  highlightedSymbol,
  creationState,
  creationDispatch,
  epsilonSymbol,
  onJumpToAlphabet,
  onAddState,
  onRemoveState,
  onSetStartState,
  onToggleAcceptState,
  onApplyTransitionEdit,
}: EditPanelProp) {
  return (
    <>
      <AlphabetReadOnly
        alphabet={automaton.alphabet}
        highlightedSymbol={highlightedSymbol}
        onJumpToAlphabet={onJumpToAlphabet}
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
        epsilonSymbol={epsilonSymbol}
        onApplyTransitionEdit={onApplyTransitionEdit}
      />
    </>
  );
}
