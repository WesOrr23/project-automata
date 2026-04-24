/**
 * TransitionCreator
 *
 * The visual transition editor that replaces the table.
 *
 * Layout:
 *   [ MiniTransitionSVG (clickable circles) ]
 *   [ Symbol input ]
 *   [ Action button — label progresses with state ]
 *   [ Temporary: existing transitions list with delete buttons ]   ← Phase 1 only
 *
 * Each circle in the SVG opens StatePickerPopover (Phase 1) — Phase 2 will
 * add canvas-click as a second input path.
 *
 * The reducer in creationReducer.ts owns all the state machine logic;
 * this component is the view + commit wiring.
 */

import { useReducer, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Automaton } from '../../engine/types';
import {
  creationReducer,
  INITIAL_CREATION_STATE,
  isReady,
  actionButtonLabel,
} from './creationReducer';
import { MiniTransitionSVG } from './MiniTransitionSVG';
import { StatePickerPopover, type PickerOption } from '../popover/StatePickerPopover';

type TransitionCreatorProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  /** Set or remove a transition. `to === null` means delete. */
  onSetTransition: (from: number, symbol: string, to: number | null) => void;
};

export function TransitionCreator({
  automaton,
  displayLabels,
  onSetTransition,
}: TransitionCreatorProp) {
  const [state, dispatch] = useReducer(creationReducer, INITIAL_CREATION_STATE);

  // Picker state — which slot the popover is currently filling, plus the
  // anchor rect for positioning. Null when no popover is open.
  const [pickerSlot, setPickerSlot] = useState<'source' | 'destination' | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);

  const symbolInputRef = useRef<HTMLSelectElement>(null);

  const sortedStates = Array.from(automaton.states).sort((a, b) => a - b);
  const sortedAlphabet = Array.from(automaton.alphabet).sort();

  function labelFor(stateId: number): string {
    return displayLabels.get(stateId) ?? `q${stateId}`;
  }

  const stateOptions: PickerOption[] = sortedStates.map((id) => ({
    value: String(id),
    label: labelFor(id),
  }));

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
    // After picking destination, focus the symbol input so the user can
    // immediately type the symbol.
    if (pickerSlot === 'destination' || (pickerSlot === 'source' && state.destination !== null)) {
      // The setTimeout lets the dispatch settle so the input is enabled.
      setTimeout(() => symbolInputRef.current?.focus(), 0);
    }
  }

  function handleAction() {
    if (state.editingExisting) {
      // Delete branch
      onSetTransition(
        state.editingExisting.from,
        state.editingExisting.symbol,
        null
      );
      dispatch({ type: 'reset' });
      return;
    }
    if (!isReady(state)) return;
    if (state.source === null || state.destination === null) return;
    onSetTransition(state.source, state.symbol, state.destination);
    dispatch({ type: 'reset' });
  }

  function handleSymbolKeyDown(event: React.KeyboardEvent<HTMLSelectElement>) {
    if (event.key === 'Enter' && isReady(state)) {
      handleAction();
    }
  }

  // Existing transitions list (TEMPORARY — Phase 3 replaces this with
  // canvas-click-to-edit).
  const sortedTransitions = [...automaton.transitions].sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return (a.symbol ?? '').localeCompare(b.symbol ?? '');
  });

  const isSelfLoop =
    state.source !== null &&
    state.destination !== null &&
    state.source === state.destination;

  const sourceLabel = state.source !== null ? labelFor(state.source) : null;
  const destinationLabel =
    state.destination !== null ? labelFor(state.destination) : null;

  const actionDisabled = state.editingExisting === null && !isReady(state);

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
              isSelfLoop={isSelfLoop}
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

          <label className="transition-creator-symbol-row">
            <span className="caption">Symbol</span>
            <select
              className="editor-select"
              value={state.symbol}
              onChange={(event) =>
                dispatch({ type: 'symbolChanged', symbol: event.target.value })
              }
              onKeyDown={handleSymbolKeyDown}
              ref={symbolInputRef}
            >
              <option value="">—</option>
              {sortedAlphabet.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={`btn ${state.editingExisting ? 'btn-danger' : 'btn-primary'}`}
            disabled={actionDisabled}
            onClick={handleAction}
            style={{ width: '100%' }}
          >
            {actionButtonLabel(state)}
          </button>

          {state.editingExisting !== null && (
            <button
              type="button"
              className="btn"
              onClick={() => dispatch({ type: 'reset' })}
              style={{ width: '100%' }}
            >
              Cancel
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

      {/*
       * Temporary list of existing transitions (Phase 3 removes this and
       * replaces it with canvas-click-to-edit).
       */}
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
