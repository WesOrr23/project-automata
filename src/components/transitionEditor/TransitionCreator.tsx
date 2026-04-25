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
  findOverwriteTarget,
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
function instructionFor(
  state: CreationState,
  symbolValid: boolean,
  overwriteLabel: string | null
): string {
  const mode = actionMode(state);
  // Overwrite warning takes precedence over the "ready" message — the user
  // needs to know they're about to clobber an existing transition.
  if (overwriteLabel !== null && symbolValid) {
    const verb = mode === 'modify' ? 'Modify' : 'Add';
    return `${verb} will replace ${overwriteLabel} (highlighted on the canvas).`;
  }
  if (mode === 'modify') {
    if (!symbolValid) return `'${state.symbol}' is not in the alphabet.`;
    return 'Click Modify to apply your changes (or Cancel to discard).';
  }
  if (mode === 'delete') {
    return 'Editing this transition. Change a slot to modify, or click Delete to remove it.';
  }
  // create mode
  // The actively-pulsing slot (and the open picker, if any) already show
  // the user where to act; the directional prose ("Click the right circle…")
  // is redundant in that case. Nudge toward the canvas-pick option instead,
  // which isn't visually obvious.
  if (state.phase === 'picking-source' || state.phase === 'picking-destination') {
    return 'Click any state on the canvas to fill the highlighted slot.';
  }
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
  return 'Click Add (or press Enter) to create the transition.';
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

  // Escape — closes the local picker popover and resets the form. The
  // earlier "no-op when loaded-unchanged" behavior was paired with a Del
  // shortcut for deletion; without that shortcut, Escape needs to be a
  // reliable way to back out of any state, including "I just clicked an
  // edge but actually didn't want to do anything." The reset is cheap;
  // only the picker popover actually loses anything from the early-out.
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

  // Compute "would overwrite" for the instruction text. The canvas
  // highlight is wired separately by the parent (App.tsx) which has the
  // same data and computes the same value.
  const overwriteTarget = findOverwriteTarget(state, automaton.transitions);
  const overwriteLabel = overwriteTarget
    ? `${labelFor(overwriteTarget.from)} → ${overwriteTarget.symbol} → ${labelFor(overwriteTarget.to)}`
    : null;

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

  // Keep refs to the latest handleAction and mode so the document-level
  // keydown listeners below can call them without needing them in their
  // deps (which would re-attach listeners every render and is hard to do
  // right because handleAction closes over many values).
  const handleActionRef = useRef(handleAction);
  handleActionRef.current = handleAction;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  function handleSymbolKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    // Loaded-but-unchanged: Enter is a no-op. The user clicked the edge
    // to inspect or modify it, not to delete — only Del / the Delete
    // button should remove an unchanged loaded edge.
    if (mode === 'delete') return;
    if (ready) handleAction();
  }

  // Global Enter — commit the form regardless of focus, so the user can
  // click out of the symbol input (e.g. onto the canvas) and still confirm
  // by pressing Enter. Skip if focus is in some other input (e.g. the new-
  // symbol field above) or if the state-actions popover is open. Also
  // skipped in delete mode (loaded-but-unchanged) — see handleSymbolKeyDown
  // for the reasoning.
  useEffect(() => {
    function onEnter(event: KeyboardEvent) {
      if (event.key !== 'Enter') return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        // Enter inside the symbol input is handled by handleSymbolKeyDown;
        // Enter inside other inputs (alphabet field, etc.) shouldn't trigger
        // a transition commit.
        return;
      }
      if (document.querySelector('.state-actions-popover')) return;
      if (modeRef.current === 'delete') return;
      handleActionRef.current();
    }
    document.addEventListener('keydown', onEnter);
    return () => document.removeEventListener('keydown', onEnter);
  }, []);

  // (No global Del shortcut for transition deletion — was unreliable in
  // browser testing. The Delete button on the form is the canonical path
  // to remove a loaded transition. Kept simple intentionally.)

  // Type-to-modify: when an existing transition is loaded and the user
  // presses a single printable character that's in the alphabet, dispatch
  // it as the new symbol and move focus into the input. This lets the
  // user "click an edge, type a new symbol" without an intermediate click,
  // while leaving Del free to delete (no auto-focused input swallowing
  // characters first).
  useEffect(() => {
    function onChar(event: KeyboardEvent) {
      if (state.editingExisting === null) return;
      if (event.key.length !== 1) return; // only single-char printable keys
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      if (document.querySelector('.state-actions-popover')) return;
      if (!automaton.alphabet.has(event.key)) return;

      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'symbolChanged', symbol: event.key });
      // Focus after dispatch so the user can keep editing (e.g. backspace
      // to clear, then re-type). The symbolChanged dispatch happens first
      // so React renders the new value before focus lands.
      symbolInputRef.current?.focus();
    }
    document.addEventListener('keydown', onChar);
    return () => document.removeEventListener('keydown', onChar);
  }, [state.editingExisting, automaton.alphabet, dispatch]);

  const sourceLabel = state.source !== null ? labelFor(state.source) : null;
  const destinationLabel =
    state.destination !== null ? labelFor(state.destination) : null;

  // Placeholder hints at what to type next. Once a source state is
  // selected, narrow it to symbols *not yet* defined for that state —
  // those are the transitions the user is most likely to be filling in.
  // When everything is defined (or no source is picked yet), fall back
  // to the full alphabet (or "Symbol" once the list overflows).
  //
  // In edit mode, the original transition's symbol is treated as
  // "available" so the user can keep it without seeing a misleading
  // empty / fallback placeholder.
  const symbolPlaceholder = (() => {
    if (sortedAlphabet.length === 0) return 'Symbol';
    let candidates: string[];
    if (state.source === null) {
      candidates = sortedAlphabet;
    } else {
      const definedSymbols = new Set<string>();
      for (const transition of automaton.transitions) {
        if (transition.from !== state.source) continue;
        if (transition.symbol === null) continue;
        if (
          state.editingExisting !== null &&
          transition.from === state.editingExisting.from &&
          transition.symbol === state.editingExisting.symbol
        ) {
          continue;
        }
        definedSymbols.add(transition.symbol);
      }
      candidates = sortedAlphabet.filter((symbol) => !definedSymbols.has(symbol));
    }
    if (candidates.length === 0) return 'Symbol';
    if (candidates.length <= 4) return candidates.join(', ');
    return `${candidates.slice(0, 3).join(', ')}, …`;
  })();

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
              placeholder={symbolPlaceholder}
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
            {instructionFor(state, symbolValid, overwriteLabel)}
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
