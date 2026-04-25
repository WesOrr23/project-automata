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
        symbol: action.transition.symbol,
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
 */
export function computePreview<T extends TransitionLike>(
  automaton: AutomatonLike<T>,
  state: CreationState
): { transitions: ReadonlyArray<T>; edges: EdgePreview[] } {
  const noPreview = { transitions: automaton.transitions, edges: [] as EdgePreview[] };
  const mode = actionMode(state);

  // Delete mode: an existing transition is loaded but unchanged. Visually
  // we treat this as 'modify' (purple) — the user has *selected* the edge
  // for editing, not committed to deleting it. The action button still
  // says "Delete" (driven by actionMode), so the option is discoverable;
  // pulsing red would prematurely imply destruction.
  if (mode === 'delete' && state.editingExisting !== null) {
    return {
      transitions: automaton.transitions,
      edges: [
        {
          from: state.editingExisting.from,
          to: state.editingExisting.to,
          symbol: state.editingExisting.symbol,
          kind: 'modify',
        },
      ],
    };
  }

  // Add and modify both require a fully-populated, valid form to preview.
  if (
    state.source === null ||
    state.destination === null ||
    state.symbol === '' ||
    !automaton.alphabet.has(state.symbol)
  ) {
    return noPreview;
  }

  // The would-be new edge as a transition record (Set of one destination
  // — same shape as engine transitions, NFA-compatible).
  // Cast to T because we don't know which exact T the caller passed; the
  // structural shape is compatible.
  const newTransition = {
    from: state.source,
    to: new Set([state.destination]),
    symbol: state.symbol,
  } as unknown as T;

  if (mode === 'modify' && state.editingExisting !== null) {
    const original = state.editingExisting;
    const symbolOnly =
      state.source === original.from && state.destination === original.to;

    // Symbol-only modify: source and destination are unchanged, only the
    // symbol differs. The edge geometry stays put — it really IS the same
    // edge with a new label, so a single purple pulse + an old/new label
    // diff is the right read.
    if (symbolOnly) {
      const withoutOriginal = automaton.transitions.filter(
        (transition) =>
          !(transition.from === original.from && transition.symbol === original.symbol)
      );

      // A different existing edge with the same NEW (from, symbol) is being
      // silently overwritten. Keep it in the preview so the canvas shows
      // it (red) alongside the modified edge (purple).
      const conflict = withoutOriginal.find(
        (transition) =>
          transition.from === state.source &&
          transition.symbol === state.symbol &&
          !(transition.to.size === 1 && transition.to.has(state.destination!))
      );

      const previewTransitions = [...withoutOriginal, newTransition];

      const edges: EdgePreview[] = [
        {
          from: state.source,
          to: state.destination,
          symbol: state.symbol,
          kind: 'modify',
          oldSymbol: original.symbol,
        },
      ];
      if (conflict !== undefined) {
        const dest = Array.from(conflict.to)[0];
        if (dest !== undefined) {
          edges.push({
            from: conflict.from,
            to: dest,
            symbol: conflict.symbol,
            kind: 'delete',
          });
        }
      }
      return { transitions: previewTransitions, edges };
    }

    // Structural modify: the source or destination changed. Visually this
    // is two distinct edges — the original geometry goes away and a new
    // edge appears elsewhere — so a single purple pulse misrepresents
    // what's happening. Show the original as red (delete) and the new as
    // blue (add), the same vocabulary as a from-scratch creation that
    // happens to evict an existing edge.
    //
    // Keep the original in the preview transition list so GraphViz lays
    // it out and the canvas can color it red.
    const conflict = automaton.transitions.find(
      (transition) =>
        transition.from === state.source &&
        transition.symbol === state.symbol &&
        !(transition.from === original.from && transition.symbol === original.symbol) &&
        !(transition.to.size === 1 && transition.to.has(state.destination!))
    );

    const previewTransitions = [...automaton.transitions, newTransition];

    const edges: EdgePreview[] = [
      {
        from: state.source,
        to: state.destination,
        symbol: state.symbol,
        kind: 'add',
      },
      {
        from: original.from,
        to: original.to,
        symbol: original.symbol,
        kind: 'delete',
      },
    ];
    if (conflict !== undefined) {
      const dest = Array.from(conflict.to)[0];
      if (dest !== undefined) {
        edges.push({
          from: conflict.from,
          to: dest,
          symbol: conflict.symbol,
          kind: 'delete',
        });
      }
    }
    return { transitions: previewTransitions, edges };
  }

  // Create mode (no editingExisting).
  // No-op exact duplicate → don't preview, don't pulse.
  const exactDuplicate = automaton.transitions.some(
    (transition) =>
      transition.from === state.source &&
      transition.symbol === state.symbol &&
      transition.to.size === 1 &&
      transition.to.has(state.destination!)
  );
  if (exactDuplicate) return noPreview;

  // Conflict (same from+symbol, different to) — kept in preview as the
  // going-away edge.
  const conflict = automaton.transitions.find(
    (transition) =>
      transition.from === state.source &&
      transition.symbol === state.symbol &&
      !(transition.to.size === 1 && transition.to.has(state.destination!))
  );

  const previewTransitions = [...automaton.transitions, newTransition];

  const edges: EdgePreview[] = [
    {
      from: state.source,
      to: state.destination,
      symbol: state.symbol,
      kind: 'add',
    },
  ];
  if (conflict !== undefined) {
    const dest = Array.from(conflict.to)[0];
    if (dest !== undefined) {
      edges.push({
        from: conflict.from,
        to: dest,
        symbol: conflict.symbol,
        kind: 'delete',
      });
    }
  }
  return { transitions: previewTransitions, edges };
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
