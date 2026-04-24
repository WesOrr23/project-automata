/**
 * TransitionCreator
 *
 * Visual transition editor.
 *
 * Layout:
 *   [ MiniTransitionSVG (clickable circles) ]
 *   [ Symbol input | Add button ]      ← horizontal row
 *   [ Contextual step instructions ]
 *   [ Temporary: existing transitions list with delete buttons ]   ← Phase 1
 *
 * Behaviour:
 * - Click either circle in the SVG → opens StatePickerPopover for that
 *   slot. Pick a state to fill it.
 * - Type a single character in the symbol box. Validated against the
 *   alphabet — Add stays disabled if the symbol isn't in the alphabet.
 * - Press Add (or Enter while in the symbol field) to commit. Form
 *   resets afterwards.
 * - When the form is bound to an existing transition (set by
 *   loadExisting — used in Phase 3), Add becomes Delete.
 */

import { Dispatch, useEffect, useRef, useState } from 'react';
import { Automaton } from '../../engine/types';
import {
  actionButtonLabel,
  actionMode,
  isReady,
  type CreationAction,
  type CreationState,
} from './creationReducer';
import { MiniTransitionSVG } from './MiniTransitionSVG';
import { StatePickerPopover, type PickerOption } from '../popover/StatePickerPopover';

type TransitionCreatorProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  creationState: CreationState;
  creationDispatch: Dispatch<CreationAction>;
  onSetTransition: (from: number, symbol: string, to: number | null) => void;
  onReplaceTransition: (
    oldFrom: number,
    oldSymbol: string,
    newFrom: number,
    newSymbol: string,
    newTo: number
  ) => void;
};

/**
 * Contextual instructions shown below the form. Reflect the current state
 * machine state — tell the user what to do next.
 */
function instructionFor(state: CreationState, symbolValid: boolean): string {
  const mode = actionMode(state);
  if (mode === 'modify') {
    if (!symbolValid) return `'${state.symbol}' is not in the alphabet.`;
    return 'Click Modify to apply your changes (or Cancel to discard).';
  }
  if (mode === 'delete') {
    return 'Editing this transition. Change a slot to modify, or click Delete.';
  }
  // create mode
  if (state.source === null && state.destination === null && state.symbol === '') {
    return 'Click a circle to pick a state, or click an existing edge to edit it.';
  }
  if (state.source === null) {
    return 'Click the left circle to pick the source state.';
  }
  if (state.destination === null) {
    return 'Click the right circle to pick the destination state.';
  }
  if (state.symbol === '') {
    return 'Type a symbol from the alphabet.';
  }
  if (!symbolValid) {
    return `'${state.symbol}' is not in the alphabet.`;
  }
  return 'Click Add to create the transition.';
}

export function TransitionCreator({
  automaton,
  displayLabels,
  creationState: state,
  creationDispatch: dispatch,
  onSetTransition,
  onReplaceTransition,
}: TransitionCreatorProp) {
  const [pickerSlot, setPickerSlot] = useState<'source' | 'destination' | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);

  const symbolInputRef = useRef<HTMLInputElement>(null);

  // If the parent dispatched a phase change to non-picking (e.g. via a
  // canvas click), close the popover too. Keeps popup-mode and canvas-mode
  // consistent.
  useEffect(() => {
    if (state.phase !== 'picking-source' && state.phase !== 'picking-destination') {
      setPickerSlot(null);
      setPickerAnchor(null);
    }
  }, [state.phase]);

  // Escape — global abort. Closes the popover (if open) and resets the
  // form to its initial state. The popover has its own Escape listener
  // for closing itself; this one resets the underlying state machine.
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setPickerSlot(null);
      setPickerAnchor(null);
      dispatch({ type: 'reset' });
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dispatch]);

  // Auto-focus the symbol input when both source + destination are filled
  // (so the user lands directly in the symbol field after the second pick,
  // whether picked via popover or via canvas).
  useEffect(() => {
    if (
      state.source !== null &&
      state.destination !== null &&
      state.symbol === '' &&
      state.editingExisting === null
    ) {
      symbolInputRef.current?.focus();
    }
  }, [state.source, state.destination, state.symbol, state.editingExisting]);

  const sortedStates = Array.from(automaton.states).sort((a, b) => a - b);
  const sortedAlphabet = Array.from(automaton.alphabet).sort();

  function labelFor(stateId: number): string {
    return displayLabels.get(stateId) ?? `q${stateId}`;
  }

  const stateOptions: PickerOption[] = sortedStates.map((id) => ({
    value: String(id),
    label: labelFor(id),
  }));

  const symbolValid = state.symbol === '' || automaton.alphabet.has(state.symbol);
  const ready = isReady(state) && symbolValid;
  const mode = actionMode(state);
  const buttonLabel = actionButtonLabel(state);

  function openPickerForSlot(slot: 'source' | 'destination', anchorEl: HTMLElement) {
    setPickerSlot(slot);
    setPickerAnchor(anchorEl.getBoundingClientRect());
    dispatch({
      type: slot === 'source' ? 'pickSourceSlot' : 'pickDestinationSlot',
    });
  }

  function closePicker() {
    setPickerSlot(null);
    setPickerAnchor(null);
    dispatch({ type: 'cancel' });
  }

  function handlePick(value: string) {
    const stateId = Number(value);
    if (pickerSlot === 'source') {
      dispatch({ type: 'sourcePicked', stateId });
    } else if (pickerSlot === 'destination') {
      dispatch({ type: 'destinationPicked', stateId });
    }
    setPickerSlot(null);
    setPickerAnchor(null);
    // Focus the symbol input automatically when both slots are filled —
    // handled by the useEffect above so it works for both popover picks
    // and canvas picks.
  }

  function handleAction() {
    if (mode === 'delete') {
      if (state.editingExisting === null) return;
      onSetTransition(
        state.editingExisting.from,
        state.editingExisting.symbol,
        null
      );
      dispatch({ type: 'reset' });
      return;
    }
    if (!ready || state.source === null || state.destination === null) return;
    if (mode === 'modify' && state.editingExisting !== null) {
      onReplaceTransition(
        state.editingExisting.from,
        state.editingExisting.symbol,
        state.source,
        state.symbol,
        state.destination
      );
      dispatch({ type: 'reset' });
      return;
    }
    // create
    onSetTransition(state.source, state.symbol, state.destination);
    dispatch({ type: 'reset' });
  }

  function handleSymbolKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && ready) {
      handleAction();
    }
  }

  const sourceLabel = state.source !== null ? labelFor(state.source) : null;
  const destinationLabel =
    state.destination !== null ? labelFor(state.destination) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span className="label">Transitions</span>

      {sortedAlphabet.length === 0 ? (
        <p className="caption">Add symbols to the alphabet above first.</p>
      ) : (
        <div className="transition-creator">
          <div className="transition-creator-svg-wrap">
            <MiniTransitionSVG
              sourceLabel={sourceLabel}
              destinationLabel={destinationLabel}
              symbol={state.symbol}
              activeSlot={
                state.phase === 'picking-source'
                  ? 'source'
                  : state.phase === 'picking-destination'
                    ? 'destination'
                    : null
              }
              onSlotClick={openPickerForSlot}
            />
          </div>

          <div className="transition-creator-action-row">
            <input
              ref={symbolInputRef}
              type="text"
              className={`glass-input transition-creator-symbol-input ${
                state.symbol !== '' && !symbolValid ? 'invalid' : ''
              }`}
              value={state.symbol}
              onChange={(event) =>
                dispatch({
                  type: 'symbolChanged',
                  symbol: event.target.value,
                })
              }
              onKeyDown={handleSymbolKeyDown}
              placeholder="Symbol"
              maxLength={1}
              aria-label="Transition symbol"
            />
            <button
              type="button"
              className={
                mode === 'delete'
                  ? 'btn btn-danger'
                  : mode === 'modify'
                    ? 'btn btn-warning'
                    : 'btn btn-primary'
              }
              disabled={mode === 'delete' ? false : !ready}
              onClick={handleAction}
            >
              {buttonLabel}
            </button>
          </div>

          <p className="transition-creator-instruction">
            {instructionFor(state, symbolValid)}
          </p>

          {state.editingExisting !== null && (
            <button
              type="button"
              className="btn"
              onClick={() => dispatch({ type: 'reset' })}
              style={{ width: '100%' }}
            >
              Cancel edit
            </button>
          )}
        </div>
      )}

      {/* Show the popover only while the picker's slot is the one
          actively being picked. If a canvas click filled this slot
          (advancing state.phase past it), the popover auto-dismisses
          on the next render even though pickerSlot hasn't been cleared
          locally yet. */}
      {pickerSlot !== null &&
        pickerAnchor !== null &&
        ((pickerSlot === 'source' && state.phase === 'picking-source') ||
          (pickerSlot === 'destination' && state.phase === 'picking-destination')) && (
        <StatePickerPopover
          options={stateOptions}
          selectedValue={
            pickerSlot === 'source'
              ? state.source !== null
                ? String(state.source)
                : null
              : state.destination !== null
                ? String(state.destination)
                : null
          }
          anchorRect={pickerAnchor}
          onPick={handlePick}
          onClose={closePicker}
        />
      )}

    </div>
  );
}
