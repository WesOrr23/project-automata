/**
 * Transition creation reducer
 *
 * State machine for the visual transition creator. The user fills three
 * slots (source state, destination state, symbol) in any order; the reducer
 * tracks what's filled and what slot is currently being picked.
 *
 * Phases:
 *   - 'idle'                  → nothing currently being picked
 *   - 'picking-source'        → source slot is the active target
 *   - 'picking-destination'   → destination slot is the active target
 *
 * The "phase" only describes which slot is being picked right now (drives
 * canvas/popover affordances). Whether the form is committable is a
 * derived predicate: source !== null && destination !== null && symbol !== ''.
 *
 * The reducer is a pure function — easy to test without React.
 */

export type CreationPhase = 'idle' | 'picking-source' | 'picking-destination';

export type CreationState = {
  phase: CreationPhase;
  source: number | null;
  destination: number | null;
  symbol: string;
  /**
   * If the form is currently bound to an existing transition (because the
   * user clicked an edge on the canvas), this is its identity. Used to
   * support the "delete" path. null when creating a new transition.
   */
  editingExisting: { from: number; to: number; symbol: string } | null;
};

export type CreationAction =
  | { type: 'pickSourceSlot' }            // user clicked source circle / Pick source
  | { type: 'pickDestinationSlot' }       // user clicked destination circle / Pick destination
  | { type: 'sourcePicked'; stateId: number }
  | { type: 'destinationPicked'; stateId: number }
  | { type: 'symbolChanged'; symbol: string }
  | { type: 'cancel' }                    // Escape — return to idle, keep filled slots
  | { type: 'reset' }                     // clear everything (e.g. after commit)
  | {
      type: 'loadExisting';
      transition: { from: number; to: number; symbol: string };
    };

export const INITIAL_CREATION_STATE: CreationState = {
  phase: 'idle',
  source: null,
  destination: null,
  symbol: '',
  editingExisting: null,
};

export function creationReducer(
  state: CreationState,
  action: CreationAction
): CreationState {
  switch (action.type) {
    case 'pickSourceSlot':
      return { ...state, phase: 'picking-source' };

    case 'pickDestinationSlot':
      return { ...state, phase: 'picking-destination' };

    case 'sourcePicked':
      // After picking source, advance to destination if it's still empty,
      // otherwise return to idle. editingExisting persists so we can detect
      // "modified vs original" downstream — only `reset` clears it.
      return {
        ...state,
        source: action.stateId,
        phase: state.destination === null ? 'picking-destination' : 'idle',
      };

    case 'destinationPicked':
      return {
        ...state,
        destination: action.stateId,
        phase: 'idle',
      };

    case 'symbolChanged':
      return { ...state, symbol: action.symbol };

    case 'cancel':
      return { ...state, phase: 'idle' };

    case 'reset':
      return INITIAL_CREATION_STATE;

    case 'loadExisting':
      return {
        phase: 'idle',
        source: action.transition.from,
        destination: action.transition.to,
        symbol: action.transition.symbol,
        editingExisting: action.transition,
      };
  }
}

/**
 * Is the form currently committable (all three slots filled)?
 */
export function isReady(state: CreationState): boolean {
  return state.source !== null && state.destination !== null && state.symbol !== '';
}

/**
 * When in edit mode (loaded from an existing transition), has the user
 * modified any of the three slots away from the original? Used to flip
 * the action button between Delete and Modify.
 */
export function isModified(state: CreationState): boolean {
  if (state.editingExisting === null) return false;
  return (
    state.source !== state.editingExisting.from ||
    state.destination !== state.editingExisting.to ||
    state.symbol !== state.editingExisting.symbol
  );
}

/**
 * The current "mode" of the action button — drives label and color.
 */
export type ActionMode = 'create' | 'delete' | 'modify';

export function actionMode(state: CreationState): ActionMode {
  if (state.editingExisting === null) return 'create';
  return isModified(state) ? 'modify' : 'delete';
}

/**
 * The label shown on the primary action button. (Used as instruction
 * text — see TransitionCreator's instructionFor for the contextual
 * prose; this is just the button.)
 */
export function actionButtonLabel(state: CreationState): string {
  switch (actionMode(state)) {
    case 'delete':
      return 'Delete';
    case 'modify':
      return 'Modify';
    case 'create':
      return 'Add';
  }
}

/**
 * If committing the current form would silently overwrite an existing
 * transition (same source + symbol, different destination), return that
 * existing transition. Returns null if commit would just add a new edge
 * or if no commit is possible.
 *
 * In edit mode, the existing transition that matches editingExisting
 * doesn't count as "overwrite" — that's the one being modified.
 */
export function findOverwriteTarget(
  state: CreationState,
  transitions: ReadonlyArray<{ from: number; to: ReadonlySet<number>; symbol: string | null }>
): { from: number; to: number; symbol: string } | null {
  if (state.source === null || state.symbol === '') return null;
  for (const transition of transitions) {
    if (transition.from !== state.source) continue;
    if (transition.symbol !== state.symbol) continue;
    // Skip the edit's original — it's getting replaced, not overwritten.
    if (
      state.editingExisting !== null &&
      transition.from === state.editingExisting.from &&
      transition.symbol === state.editingExisting.symbol
    ) {
      continue;
    }
    const dest = Array.from(transition.to)[0];
    if (dest === undefined) continue;
    // In create mode, if the existing destination matches what the user is
    // about to set, the commit is a true no-op — no warning.
    if (
      state.editingExisting === null &&
      state.destination !== null &&
      dest === state.destination
    ) {
      return null;
    }
    return { from: transition.from, to: dest, symbol: state.symbol };
  }
  return null;
}
