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
  /**
   * Raw user input for the symbol field. May contain a single symbol
   * (`a`), the configured ε character (`e`), or a comma-separated list
   * (`a, b, e`). Parsed at commit time by the consumer (which has the
   * alphabet + reserved-ε symbol on hand).
   */
  symbol: string;
  /**
   * If the form is currently bound to an existing edge (the user clicked
   * one on the canvas), this is the consolidated group it came from.
   * `symbols` carries every symbol on that visual edge — so editing a
   * consolidated edge lets the user re-enter the whole comma-separated
   * list. null when authoring a new transition.
   */
  editingExisting: {
    from: number;
    to: number;
    symbols: ReadonlyArray<string | null>;
  } | null;
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
      transition: {
        from: number;
        to: number;
        symbols: ReadonlyArray<string | null>;
      };
      /**
       * The character that represents ε in the symbol input. Used to format
       * the loaded symbols back into a comma-separated text the user can edit.
       * Threaded through the action so the reducer stays free of any UI config
       * dependency.
       */
      epsilonSymbol: string;
    }
  // Initiate a brand-new transition with source pre-filled (used by the
  // state-actions popover's Space shortcut). Equivalent to a reset followed
  // by sourcePicked, but expressed atomically so callers don't have to
  // sequence two dispatches.
  | { type: 'startTransitionFrom'; stateId: number };

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
        symbol: formatSymbolsForInput(
          action.transition.symbols,
          action.epsilonSymbol
        ),
        editingExisting: action.transition,
      };

    case 'startTransitionFrom':
      return {
        phase: 'picking-destination',
        source: action.stateId,
        destination: null,
        symbol: '',
        editingExisting: null,
      };
  }
}

/**
 * Render a symbol list back into the comma-separated text that goes in
 * the symbol input. ε (null) is rendered as the configured reserved
 * character (e.g. `e`). Sorted so two equivalent groups render the same
 * way regardless of insertion order.
 */
export function formatSymbolsForInput(
  symbols: ReadonlyArray<string | null>,
  epsilonSymbol: string
): string {
  const parts: string[] = [];
  const literals = symbols
    .filter((s): s is string => s !== null)
    .sort();
  parts.push(...literals);
  if (symbols.some((s) => s === null)) {
    parts.push(epsilonSymbol);
  }
  return parts.join(', ');
}

/**
 * Parse the raw symbol input into a list of canonical engine symbols.
 *
 * - Tokens are comma-separated, trimmed.
 * - The configured ε character maps to `null` (engine ε-transition).
 * - Other tokens must be a single character that's in the alphabet.
 *
 * Returns either a sorted-deduplicated symbol list (success) or a list
 * of error messages, one per invalid token.
 */
export type ParsedSymbols =
  | { ok: true; symbols: Array<string | null> }
  | { ok: false; errors: string[] };

export function parseSymbolInput(
  input: string,
  alphabet: ReadonlySet<string>,
  epsilonSymbol: string
): ParsedSymbols {
  const tokens = input.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return { ok: false, errors: ['Type a symbol from the alphabet.'] };
  }

  const result = new Set<string | null>();
  const errors: string[] = [];
  for (const token of tokens) {
    if (token === epsilonSymbol) {
      result.add(null);
      continue;
    }
    if (token.length !== 1) {
      errors.push(`'${token}' must be a single character`);
      continue;
    }
    if (!alphabet.has(token)) {
      errors.push(`'${token}' is not in the alphabet`);
      continue;
    }
    result.add(token);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, symbols: Array.from(result) };
}

/** True when the form has all three slots filled with a parseable symbol list. */
export function isReady(
  state: CreationState,
  alphabet: ReadonlySet<string>,
  epsilonSymbol: string
): boolean {
  if (state.source === null || state.destination === null) return false;
  const parsed = parseSymbolInput(state.symbol, alphabet, epsilonSymbol);
  return parsed.ok && parsed.symbols.length > 0;
}

/**
 * When in edit mode, has the user modified any of the three slots away
 * from the original? Used to flip the action button between Delete and
 * Modify. Compares parsed symbols as a set so reordering or whitespace
 * differences don't count as "modified."
 */
export function isModified(
  state: CreationState,
  alphabet: ReadonlySet<string>,
  epsilonSymbol: string
): boolean {
  if (state.editingExisting === null) return false;
  if (state.source !== state.editingExisting.from) return true;
  if (state.destination !== state.editingExisting.to) return true;

  const parsed = parseSymbolInput(state.symbol, alphabet, epsilonSymbol);
  if (!parsed.ok) return true; // user typed something invalid → counts as modified
  const newSet = new Set<string | null>(parsed.symbols);
  const oldSet = new Set<string | null>(state.editingExisting.symbols);
  if (newSet.size !== oldSet.size) return true;
  for (const value of newSet) {
    if (!oldSet.has(value)) return true;
  }
  return false;
}

/**
 * The current "mode" of the action button — drives label and color.
 */
export type ActionMode = 'create' | 'delete' | 'modify';

export function actionMode(
  state: CreationState,
  alphabet: ReadonlySet<string>,
  epsilonSymbol: string
): ActionMode {
  if (state.editingExisting === null) return 'create';
  return isModified(state, alphabet, epsilonSymbol) ? 'modify' : 'delete';
}

/**
 * The label shown on the primary action button.
 */
export function actionButtonLabel(
  state: CreationState,
  alphabet: ReadonlySet<string>,
  epsilonSymbol: string
): string {
  switch (actionMode(state, alphabet, epsilonSymbol)) {
    case 'delete':
      return 'Delete';
    case 'modify':
      return 'Modify';
    case 'create':
      return 'Add';
  }
}

/**
 * The visual "kind" to use when highlighting the source/destination state
 * nodes on the canvas while the form is in flight. Mirrors the kind of
 * the in-progress edge: blue when a new edge is being introduced (create
 * or structural modify), purple when an existing edge is being changed
 * in place (symbol-only modify, or just-loaded delete mode).
 *
 * Returns 'add' as a sane default when source/dest are still empty so
 * callers can use the value unconditionally; the caller is expected to
 * gate visibility on the corresponding state ID actually being set.
 */
export function creationStateKind(state: CreationState): 'add' | 'modify' {
  if (state.editingExisting === null) return 'add';
  const original = state.editingExisting;
  if (state.source !== original.from || state.destination !== original.to) {
    return 'add';
  }
  return 'modify';
}
