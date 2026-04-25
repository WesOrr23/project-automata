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
 * One edge that the canvas should highlight as part of the live preview.
 *
 * Kinds:
 *   - 'add'    → blue: a brand-new edge the commit will introduce
 *   - 'modify' → purple: an existing edge the commit will replace (kept in
 *                preview at the new location/symbol)
 *   - 'delete' → red: an existing edge the commit will remove (either the
 *                bare loaded edge in delete mode, or the silently-overwritten
 *                edge when add/modify collides with same source + symbol)
 *
 * For modify with a symbol change, oldSymbol carries the prior symbol so
 * the canvas can render the label as <old struck-red> <new blue>.
 */
export type EdgePreview = {
  from: number;
  to: number;
  symbol: string | null;
  kind: 'add' | 'modify' | 'delete';
  oldSymbol?: string;
};

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

/**
 * Lightweight transition shape — both the engine's `Transition` and any
 * preview-only edges fit this. Kept loose so this module stays free of
 * an engine import dependency in the type signature.
 */
type TransitionLike = {
  from: number;
  to: ReadonlySet<number>;
  symbol: string | null;
};

type AutomatonLike<T extends TransitionLike = TransitionLike> = {
  transitions: ReadonlyArray<T>;
  alphabet: ReadonlySet<string>;
};

/**
 * True iff `transition` is the same engine transition that the form is
 * currently editing — i.e. it lives at the original (from, *) location and
 * carries one of the symbols originally loaded into the form.
 *
 * Used by the conflict-detection branch of computePreview: when scanning for
 * "another transition with the same (from, symbol) but different destination"
 * we must NOT count the original being edited as a conflict, since the form
 * would replace it on commit.
 */
function isOriginalEdge(
  transition: TransitionLike,
  editingExisting: CreationState['editingExisting'],
  symbol: string | null
): boolean {
  if (editingExisting === null) return false;
  return (
    transition.from === editingExisting.from &&
    editingExisting.symbols.includes(symbol)
  );
}

/**
 * Build a "what the canvas should look like with the in-progress edit
 * applied" view. Returns:
 *   - transitions: the transition list to lay out (may include speculative
 *     additions and edges scheduled for deletion, kept around so GraphViz
 *     gives them geometry we can highlight).
 *   - edges: the per-edge highlight metadata the canvas applies on top.
 *
 * The intent is "show, don't tell" — the user sees the consequence of
 * pressing the action button before they press it. Going-away edges stay
 * visible (red) so the user understands what's being lost; new/modified
 * edges show in their post-commit position (blue/purple).
 *
 * `parsed` and `mode` come from the caller (which has the alphabet +
 * reserved-ε symbol on hand). `isNFA` determines overwrite semantics —
 * NFAs don't overwrite same `(from, symbol)` pairs, they accumulate
 * destinations.
 */
export function computePreview<T extends TransitionLike>(
  automaton: AutomatonLike<T>,
  state: CreationState,
  mode: ActionMode,
  parsed: ParsedSymbols,
  isNFA: boolean
): { transitions: ReadonlyArray<T>; edges: EdgePreview[] } {
  const noPreview = { transitions: automaton.transitions, edges: [] as EdgePreview[] };

  // Delete mode (loaded, no changes): each symbol on the loaded edge
  // gets a 'modify' (purple) highlight. The canvas consolidates them
  // into one visual pulse via symbols.some matching.
  if (mode === 'delete' && state.editingExisting !== null) {
    const edges: EdgePreview[] = state.editingExisting.symbols.map((symbol) => ({
      from: state.editingExisting!.from,
      to: state.editingExisting!.to,
      symbol,
      kind: 'modify',
    }));
    return { transitions: automaton.transitions, edges };
  }

  // Add / modify both need a fully-populated, valid form to preview.
  if (
    state.source === null ||
    state.destination === null ||
    !parsed.ok ||
    parsed.symbols.length === 0
  ) {
    return noPreview;
  }
  const newSource = state.source;
  const newDestination = state.destination;

  // Special-case the symbol-only single-symbol modify (the common case
  // that fueled the iter-7 "old struck-red, new blue" label). Source +
  // destination unchanged, exactly one symbol on each side, and the
  // value differs. This stays visually compact — one purple edge with
  // the diffed label — instead of an add/delete pair.
  if (
    mode === 'modify' &&
    state.editingExisting !== null &&
    state.editingExisting.from === newSource &&
    state.editingExisting.to === newDestination &&
    state.editingExisting.symbols.length === 1 &&
    parsed.symbols.length === 1 &&
    state.editingExisting.symbols[0] !== parsed.symbols[0]
  ) {
    const original = state.editingExisting;
    const oldSymbol = original.symbols[0]!;
    const newSymbol = parsed.symbols[0]!;
    const withoutOriginal = automaton.transitions.filter(
      (transition) =>
        !(transition.from === original.from && transition.symbol === oldSymbol)
    );
    const newTransition = {
      from: newSource,
      to: new Set([newDestination]),
      symbol: newSymbol,
    } as unknown as T;
    const conflict = !isNFA
      ? withoutOriginal.find(
          (transition) =>
            transition.from === newSource &&
            transition.symbol === newSymbol &&
            !(transition.to.size === 1 && transition.to.has(newDestination))
        )
      : undefined;
    const transitions = [...withoutOriginal, newTransition];
    const edges: EdgePreview[] = [
      {
        from: newSource,
        to: newDestination,
        symbol: newSymbol,
        kind: 'modify',
        oldSymbol: oldSymbol === null ? undefined : oldSymbol,
      },
    ];
    if (conflict !== undefined) {
      const conflictDest = Array.from(conflict.to)[0];
      if (conflictDest !== undefined) {
        edges.push({
          from: conflict.from,
          to: conflictDest,
          symbol: conflict.symbol,
          kind: 'delete',
        });
      }
    }
    return { transitions, edges };
  }

  // General case (multi-symbol or structural modify or add):
  // diff the new symbol set against the original. Each new symbol is
  // an add; each removed symbol is a delete; symbols present in both
  // produce no preview (unchanged).
  const newSymbols = new Set<string | null>(parsed.symbols);
  const oldSymbols = new Set<string | null>(
    state.editingExisting?.symbols ?? []
  );
  const isStructural =
    state.editingExisting !== null &&
    (state.editingExisting.from !== newSource ||
      state.editingExisting.to !== newDestination);

  const edges: EdgePreview[] = [];
  const previewTransitions: T[] = [...automaton.transitions];

  // Removed symbols → delete previews on the original (from, to).
  // Structural modify: every old symbol moves out (whole group goes red).
  // Otherwise: only symbols not in the new set go red.
  if (state.editingExisting !== null) {
    const original = state.editingExisting;
    for (const symbol of original.symbols) {
      const removed = isStructural || !newSymbols.has(symbol);
      if (!removed) continue;
      edges.push({
        from: original.from,
        to: original.to,
        symbol,
        kind: 'delete',
      });
      // For non-structural removal we additionally drop the engine
      // transition from the preview so GraphViz lays out the post-commit
      // shape. Structural modify keeps the original around (red) so the
      // user can see what's being moved away.
      if (!isStructural) {
        for (let i = 0; i < previewTransitions.length; i++) {
          const t = previewTransitions[i]!;
          if (t.from !== original.from) continue;
          if (t.symbol !== symbol) continue;
          if (!t.to.has(original.to)) continue;
          if (t.to.size === 1) {
            previewTransitions.splice(i, 1);
            i--;
          } else {
            const newTo = new Set(t.to);
            newTo.delete(original.to);
            previewTransitions[i] = { ...t, to: newTo } as T;
          }
          break;
        }
      }
    }
  }

  // Added symbols → add previews on the new (from, to). Structural
  // modify: every new symbol is "added" at the new location. Otherwise:
  // only symbols not in the old set count as added.
  for (const symbol of parsed.symbols) {
    const added = isStructural || !oldSymbols.has(symbol);
    if (!added) continue;

    // No-op duplicate (already exists exactly): don't preview, don't pulse.
    const exactDuplicate = automaton.transitions.some(
      (transition) =>
        transition.from === newSource &&
        transition.symbol === symbol &&
        transition.to.has(newDestination)
    );
    if (exactDuplicate && !isStructural) continue;

    // DFA mode only: another existing transition with same (from, symbol)
    // but different destination is an overwrite — show it as going-away red.
    if (!isNFA) {
      const conflict = automaton.transitions.find(
        (transition) =>
          transition.from === newSource &&
          transition.symbol === symbol &&
          !(transition.to.size === 1 && transition.to.has(newDestination)) &&
          // Don't double-count the editingExisting original — already handled above.
          !isOriginalEdge(transition, state.editingExisting, symbol)
      );
      if (conflict !== undefined) {
        const conflictDest = Array.from(conflict.to)[0];
        if (conflictDest !== undefined) {
          edges.push({
            from: conflict.from,
            to: conflictDest,
            symbol: conflict.symbol,
            kind: 'delete',
          });
        }
      }
    }

    previewTransitions.push({
      from: newSource,
      to: new Set([newDestination]),
      symbol,
    } as unknown as T);

    edges.push({
      from: newSource,
      to: newDestination,
      symbol,
      kind: 'add',
    });
  }

  if (edges.length === 0) return noPreview;
  return { transitions: previewTransitions, edges };
}

/**
 * Summarize the transitions that committing the form would silently
 * overwrite. Drives the orange-ish warning text below the form ("Add
 * will replace q0 → 0 → q1"). NFA mode never overwrites — same
 * (from, symbol) just adds another destination — so this returns
 * `{ count: 0, first: null }` there.
 *
 * Returns the count of overwrites and the first one (for the prose
 * rendering); the canvas highlights are driven independently by
 * computePreview's delete-kind edges.
 */
export function getOverwriteSummary(
  state: CreationState,
  transitions: ReadonlyArray<{ from: number; to: ReadonlySet<number>; symbol: string | null }>,
  parsed: ParsedSymbols,
  isNFA: boolean
): { count: number; first: { from: number; to: number; symbol: string | null } | null } {
  if (isNFA) return { count: 0, first: null };
  if (state.source === null || state.destination === null) return { count: 0, first: null };
  if (!parsed.ok) return { count: 0, first: null };

  const editingSet =
    state.editingExisting !== null && state.editingExisting.from === state.source
      ? new Set(state.editingExisting.symbols)
      : new Set<string | null>();

  let count = 0;
  let first: { from: number; to: number; symbol: string | null } | null = null;
  for (const symbol of parsed.symbols) {
    // Symbols already on the loaded edge group are being replaced as part
    // of the modify, not silently overwritten.
    if (editingSet.has(symbol)) continue;
    for (const transition of transitions) {
      if (transition.from !== state.source) continue;
      if (transition.symbol !== symbol) continue;
      // Exact-duplicate: same (from, symbol, dest) → no-op, not an overwrite.
      if (transition.to.size === 1 && transition.to.has(state.destination)) continue;
      const dest = Array.from(transition.to)[0];
      if (dest === undefined) continue;
      count++;
      if (first === null) {
        first = { from: transition.from, to: dest, symbol };
      }
      break; // count this symbol once
    }
  }
  return { count, first };
}
