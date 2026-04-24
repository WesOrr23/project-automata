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
import { Trash2 } from 'lucide-react';
import { Automaton } from '../../engine/types';
import {
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
};

/**
 * Contextual instructions shown below the form. Reflect the current state
 * machine state — tell the user what to do next.
 */
function instructionFor(state: CreationState, symbolValid: boolean): string {
  if (state.editingExisting !== null) {
    return 'Editing this transition. Change any slot or click Delete.';
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
  const showDelete = state.editingExisting !== null;

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
    if (showDelete && state.editingExisting !== null) {
      onSetTransition(
        state.editingExisting.from,
        state.editingExisting.symbol,
        null
      );
      dispatch({ type: 'reset' });
      return;
    }
    if (!ready) return;
    if (state.source === null || state.destination === null) return;
    onSetTransition(state.source, state.symbol, state.destination);
    dispatch({ type: 'reset' });
  }

  function handleSymbolKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && ready) {
      handleAction();
    }
  }

  // Existing transitions list — TEMPORARY (Phase 3 removes).
  const sortedTransitions = [...automaton.transitions].sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return (a.symbol ?? '').localeCompare(b.symbol ?? '');
  });

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
            {showDelete ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleAction}
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!ready}
                onClick={handleAction}
              >
                Add
              </button>
            )}
          </div>

          <p className="transition-creator-instruction">
            {instructionFor(state, symbolValid)}
          </p>

          {showDelete && (
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

      {pickerSlot !== null && pickerAnchor !== null && (
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

      {/* Temporary current-transitions list — Phase 3 removes. */}
      {sortedTransitions.length > 0 && (
        <div className="transition-creator-temp-list">
          <span className="caption">Current transitions (click trash to delete)</span>
          {sortedTransitions.map((t, index) => {
            const dest = Array.from(t.to)[0];
            if (dest === undefined) return null;
            return (
              <div
                key={`${t.from}-${t.symbol}-${index}`}
                className="transition-creator-temp-row"
              >
                <span>
                  {labelFor(t.from)} →{' '}
                  <span style={{ color: 'var(--blue-600)' }}>
                    {t.symbol === null ? 'ε' : t.symbol}
                  </span>{' '}
                  → {labelFor(dest)}
                </span>
                <button
                  className="editor-row-action danger"
                  onClick={() => onSetTransition(t.from, t.symbol ?? '', null)}
                  aria-label={`Delete transition ${labelFor(t.from)} ${t.symbol ?? 'ε'} ${labelFor(dest)}`}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
