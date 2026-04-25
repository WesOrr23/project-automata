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
  parseSymbolInput,
  type ActionMode,
  type CreationAction,
  type CreationState,
  type ParsedSymbols,
} from './creationReducer';
import { getOverwriteSummary } from '../../engine/preview';
import { MiniTransitionSVG } from './MiniTransitionSVG';
import { StatePickerPopover, type PickerOption } from '../popover/StatePickerPopover';
import { useKeyboardScope } from '../../hooks/useKeyboardScope';

type TransitionCreatorProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  creationState: CreationState;
  creationDispatch: Dispatch<CreationAction>;
  /** The reserved character that means "ε" in the symbol input. */
  epsilonSymbol: string;
  /** Apply a batch transition edit (removes + adds in one update). */
  onApplyTransitionEdit: (
    removes: ReadonlyArray<{ from: number; to: number; symbol: string | null }>,
    adds: ReadonlyArray<{ from: number; to: number; symbol: string | null }>
  ) => void;
};

/**
 * Contextual instructions shown below the form. Reflect the current state
 * machine state — tell the user what to do next.
 */
function instructionFor(
  state: CreationState,
  parsed: ParsedSymbols,
  mode: ActionMode,
  overwrite: { count: number; first: { from: number; to: number; symbol: string | null } | null },
  labelFor: (id: number) => string,
  epsilonSymbol: string
): string {
  // Overwrite warning takes precedence over the "ready" message — the user
  // needs to know they're about to clobber existing transitions.
  if (overwrite.count > 0 && overwrite.first !== null) {
    const verb = mode === 'modify' ? 'Modify' : 'Add';
    const sym = overwrite.first.symbol === null ? epsilonSymbol : overwrite.first.symbol;
    const triple = `${labelFor(overwrite.first.from)} → ${sym} → ${labelFor(overwrite.first.to)}`;
    if (overwrite.count === 1) {
      return `${verb} will replace ${triple} (highlighted on the canvas).`;
    }
    return `${verb} will replace ${overwrite.count} transitions (e.g. ${triple}).`;
  }
  if (mode === 'modify') {
    if (!parsed.ok) return parsed.errors[0] ?? 'Invalid symbol input.';
    return 'Click Modify to apply your changes (or Cancel to discard).';
  }
  if (mode === 'delete') {
    return 'Editing this transition. Change a slot to modify, or click Delete to remove it.';
  }
  // create mode
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
  if (!parsed.ok) {
    return parsed.errors[0] ?? 'Invalid symbol input.';
  }
  return 'Click Add (or press Enter) to create the transition.';
}

export function TransitionCreator({
  automaton,
  displayLabels,
  creationState: state,
  creationDispatch: dispatch,
  epsilonSymbol,
  onApplyTransitionEdit,
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
  useKeyboardScope({
    id: 'transition-creator-escape',
    active: true,
    capture: false,
    onKey: (event) => {
      if (event.key !== 'Escape') return false;
      setPickerSlot(null);
      setPickerAnchor(null);
      dispatch({ type: 'reset' });
      return true;
    },
  });

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

  const parsed = parseSymbolInput(state.symbol, automaton.alphabet, epsilonSymbol);
  const ready = isReady(state, automaton.alphabet, epsilonSymbol);
  const mode = actionMode(state, automaton.alphabet, epsilonSymbol);
  const buttonLabel = actionButtonLabel(state, automaton.alphabet, epsilonSymbol);

  // Overwrite summary for the instruction text — only meaningful in DFA
  // mode (NFAs don't overwrite same (from, symbol) pairs, they accumulate
  // destinations). The canvas red-pulses are driven independently by
  // computePreview's delete-kind edges.
  const overwrite = getOverwriteSummary(
    automaton,
    state.source,
    state.destination,
    parsed.ok ? parsed.symbols : [],
    state.editingExisting,
    automaton.type === 'NFA'
  );

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
    // Delete mode: remove every symbol on the loaded edge group.
    if (mode === 'delete') {
      if (state.editingExisting === null) return;
      const removes = state.editingExisting.symbols.map((symbol) => ({
        from: state.editingExisting!.from,
        to: state.editingExisting!.to,
        symbol,
      }));
      onApplyTransitionEdit(removes, []);
      dispatch({ type: 'reset' });
      return;
    }

    if (!ready || state.source === null || state.destination === null) return;
    if (!parsed.ok) return;
    const newSource = state.source;
    const newDestination = state.destination;

    if (mode === 'modify' && state.editingExisting !== null) {
      // Modify: remove the entire original group, add the new symbols at
      // the new (from, to). Treats the consolidated edge as one unit.
      const removes = state.editingExisting.symbols.map((symbol) => ({
        from: state.editingExisting!.from,
        to: state.editingExisting!.to,
        symbol,
      }));
      const adds = parsed.symbols.map((symbol) => ({
        from: newSource,
        to: newDestination,
        symbol,
      }));
      onApplyTransitionEdit(removes, adds);
      dispatch({ type: 'reset' });
      return;
    }

    // Create: add each parsed symbol as a new transition. NFA mode
    // unions destinations; DFA mode replaces conflicts (handled by
    // the parent via the type check inside onApplyTransitionEdit).
    const adds = parsed.symbols.map((symbol) => ({
      from: newSource,
      to: newDestination,
      symbol,
    }));
    onApplyTransitionEdit([], adds);
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
  // by pressing Enter. The scope manager handles the text-input filter
  // (Enter inside the symbol input is processed by handleSymbolKeyDown
  // directly on the input). Capturing scopes layered above (e.g. an open
  // state-actions popover) preempt this scope automatically — no explicit
  // querySelector check needed. Also skipped in delete mode
  // (loaded-but-unchanged) — see handleSymbolKeyDown for the reasoning.
  useKeyboardScope({
    id: 'transition-creator-enter',
    active: true,
    capture: false,
    onKey: (event) => {
      if (event.key !== 'Enter') return false;
      if (modeRef.current === 'delete') return false;
      handleActionRef.current();
      return true;
    },
  });

  // (No global Del shortcut for transition deletion — was unreliable in
  // browser testing. The Delete button on the form is the canonical path
  // to remove a loaded transition. Kept simple intentionally.)

  // Type-to-modify: when an existing transition is loaded and the user
  // presses a single printable character that's in the alphabet, dispatch
  // it as the new symbol and move focus into the input. This lets the
  // user "click an edge, type a new symbol" without an intermediate click,
  // while leaving Del free to delete (no auto-focused input swallowing
  // characters first). Transparent — passes through if the key isn't a
  // valid alphabet symbol (e.g. arrow keys, modifiers).
  useKeyboardScope({
    id: 'transition-creator-type-to-modify',
    active: state.editingExisting !== null,
    capture: false,
    onKey: (event) => {
      if (event.key.length !== 1) return false; // only single-char printable keys
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      if (!automaton.alphabet.has(event.key)) return false;
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'symbolChanged', symbol: event.key });
      // Focus after dispatch so the user can keep editing (e.g. backspace
      // to clear, then re-type). The symbolChanged dispatch happens first
      // so React renders the new value before focus lands.
      symbolInputRef.current?.focus();
      return true;
    },
  });

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
      // Build the set of symbols that already have a transition from the
      // currently-selected source state. Symbols on the loaded edge group
      // (in modify mode) are treated as available so the user can keep
      // them without a misleading fallback.
      const definedSymbols = new Set<string>();
      const editingSymbols = new Set<string | null>(
        state.editingExisting !== null && state.editingExisting.from === state.source
          ? state.editingExisting.symbols
          : []
      );
      for (const transition of automaton.transitions) {
        if (transition.from !== state.source) continue;
        if (transition.symbol === null) continue;
        if (editingSymbols.has(transition.symbol)) continue;
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
                state.symbol !== '' && !parsed.ok ? 'invalid' : ''
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
            {instructionFor(state, parsed, mode, overwrite, labelFor, epsilonSymbol)}
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
