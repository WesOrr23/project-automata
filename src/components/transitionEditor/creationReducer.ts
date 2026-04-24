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
      // otherwise return to idle (user is editing source on a complete form).
      return {
        ...state,
        source: action.stateId,
        phase: state.destination === null ? 'picking-destination' : 'idle',
        // Picking a fresh source breaks the "editing existing" link — the
        // user is now constructing a new transition.
        editingExisting: null,
      };

    case 'destinationPicked':
      return {
        ...state,
        destination: action.stateId,
        phase: 'idle',
        editingExisting: null,
      };

    case 'symbolChanged':
      return { ...state, symbol: action.symbol, editingExisting: null };

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
 * The label shown on the primary action button. Reflects what's missing
 * (or "Add"/"Delete" once the form is committable / bound to existing).
 */
export function actionButtonLabel(state: CreationState): string {
  if (state.editingExisting !== null) {
    return 'Delete transition';
  }
  if (state.source === null) return 'Pick source';
  if (state.destination === null) return 'Pick destination';
  if (state.symbol === '') return 'Type a symbol';
  return 'Add transition';
}
