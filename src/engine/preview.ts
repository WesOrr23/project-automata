/**
 * Preview computation for the in-flight transition edit.
 *
 * Lives in the engine layer because it operates on real `Automaton` /
 * `Transition` values and produces a real `Automaton` (with the pending
 * edit applied) plus a sidecar overlay list describing what changed.
 * The UI layer feeds this `Automaton` straight into layout — no spread,
 * no cast, no shape-shifting.
 *
 * The function takes primitive inputs (source id, destination id, symbol
 * list, mode, editingExisting reference, isNFA flag) rather than a
 * `CreationState`. That keeps the engine free of any UI-layer state-
 * machine type and makes the function trivially testable from a fixture.
 */

import { Automaton, Transition } from './types';

/**
 * One overlay entry that the canvas should highlight as part of the live
 * preview.
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
 *
 * `to` is intentionally a single number (not a `Set<number>` like
 * `Transition.to`): an overlay always targets one visual destination at a
 * time. Multiple destinations on the same `(from, symbol)` produce
 * multiple overlay entries.
 */
export type EdgeOverlayKind = 'add' | 'modify' | 'delete';

export type EdgeOverlay = {
  from: number;
  to: number;
  symbol: string | null;
  kind: EdgeOverlayKind;
  oldSymbol?: string;
};

export type PreviewMode = 'add' | 'modify' | 'delete';

/**
 * The original edge group the form is editing, if any. Same shape as
 * `CreationState['editingExisting']` but expressed without an import on
 * the UI layer — the engine just needs the identifying triple.
 */
export type PreviewEditingExisting = {
  from: number;
  to: number;
  symbols: ReadonlyArray<string | null>;
};

/**
 * True iff `transition` is the same engine transition that the form is
 * currently editing — i.e. it lives at the original `from` and carries one
 * of the symbols originally loaded into the form.
 *
 * Used by the conflict-detection branch of computePreview: when scanning for
 * "another transition with the same (from, symbol) but different destination"
 * we must NOT count the original being edited as a conflict, since the form
 * would replace it on commit.
 */
function isOriginalEdge(
  transition: Transition,
  editingExisting: PreviewEditingExisting | null,
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
 *   - automaton: the input automaton with the pending edit applied to its
 *     transitions list. May include speculative additions and edges
 *     scheduled for deletion (kept around so GraphViz gives them geometry
 *     we can highlight). When there's no preview, this is the input
 *     automaton reference unchanged.
 *   - overlays: the per-edge highlight metadata the canvas applies on top.
 *
 * The intent is "show, don't tell" — the user sees the consequence of
 * pressing the action button before they press it. Going-away edges stay
 * visible (red) so the user understands what's being lost; new/modified
 * edges show in their post-commit position (blue/purple).
 *
 * `isNFA` determines overwrite semantics — NFAs don't overwrite same
 * `(from, symbol)` pairs, they accumulate destinations.
 */
export function computePreview(
  automaton: Automaton,
  sourceId: number | null,
  destinationId: number | null,
  symbols: ReadonlyArray<string | null>,
  mode: PreviewMode,
  editingExisting: PreviewEditingExisting | null,
  isNFA: boolean
): { automaton: Automaton; overlays: EdgeOverlay[] } {
  const noPreview = { automaton, overlays: [] as EdgeOverlay[] };

  // Delete mode (loaded, no changes): each symbol on the loaded edge
  // gets a 'modify' (purple) highlight. The canvas consolidates them
  // into one visual pulse via symbols.some matching.
  if (mode === 'delete' && editingExisting !== null) {
    const overlays: EdgeOverlay[] = editingExisting.symbols.map((symbol) => ({
      from: editingExisting.from,
      to: editingExisting.to,
      symbol,
      kind: 'modify',
    }));
    return { automaton, overlays };
  }

  // Add / modify both need a fully-populated, valid form to preview.
  if (
    sourceId === null ||
    destinationId === null ||
    symbols.length === 0
  ) {
    return noPreview;
  }
  const newSource = sourceId;
  const newDestination = destinationId;

  // Special-case the symbol-only single-symbol modify (the common case
  // that fueled the iter-7 "old struck-red, new blue" label). Source +
  // destination unchanged, exactly one symbol on each side, and the
  // value differs. This stays visually compact — one purple edge with
  // the diffed label — instead of an add/delete pair.
  if (
    mode === 'modify' &&
    editingExisting !== null &&
    editingExisting.from === newSource &&
    editingExisting.to === newDestination &&
    editingExisting.symbols.length === 1 &&
    symbols.length === 1 &&
    editingExisting.symbols[0] !== symbols[0]
  ) {
    const original = editingExisting;
    const oldSymbol = original.symbols[0]!;
    const newSymbol = symbols[0]!;
    const withoutOriginal = automaton.transitions.filter(
      (transition) =>
        !(transition.from === original.from && transition.symbol === oldSymbol)
    );
    const newTransition: Transition = {
      from: newSource,
      to: new Set([newDestination]),
      symbol: newSymbol,
    };
    const conflict = !isNFA
      ? withoutOriginal.find(
          (transition) =>
            transition.from === newSource &&
            transition.symbol === newSymbol &&
            !(transition.to.size === 1 && transition.to.has(newDestination))
        )
      : undefined;
    const transitions = [...withoutOriginal, newTransition];
    const overlays: EdgeOverlay[] = [
      {
        from: newSource,
        to: newDestination,
        symbol: newSymbol,
        kind: 'modify',
        ...(oldSymbol !== null && { oldSymbol }),
      },
    ];
    if (conflict !== undefined) {
      const conflictDest = Array.from(conflict.to)[0];
      if (conflictDest !== undefined) {
        overlays.push({
          from: conflict.from,
          to: conflictDest,
          symbol: conflict.symbol,
          kind: 'delete',
        });
      }
    }
    return { automaton: { ...automaton, transitions }, overlays };
  }

  // General case (multi-symbol or structural modify or add):
  // diff the new symbol set against the original. Each new symbol is
  // an add; each removed symbol is a delete; symbols present in both
  // produce no preview (unchanged).
  const newSymbols = new Set<string | null>(symbols);
  const oldSymbols = new Set<string | null>(
    editingExisting?.symbols ?? []
  );
  const isStructural =
    editingExisting !== null &&
    (editingExisting.from !== newSource ||
      editingExisting.to !== newDestination);

  const overlays: EdgeOverlay[] = [];
  const previewTransitions: Transition[] = [...automaton.transitions];

  // Removed symbols → delete overlays on the original (from, to).
  // Structural modify: every old symbol moves out (whole group goes red).
  // Otherwise: only symbols not in the new set go red.
  if (editingExisting !== null) {
    const original = editingExisting;
    for (const symbol of original.symbols) {
      const removed = isStructural || !newSymbols.has(symbol);
      if (!removed) continue;
      overlays.push({
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
            previewTransitions[i] = { ...t, to: newTo };
          }
          break;
        }
      }
    }
  }

  // Added symbols → add overlays on the new (from, to). Structural
  // modify: every new symbol is "added" at the new location. Otherwise:
  // only symbols not in the old set count as added.
  for (const symbol of symbols) {
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
          !isOriginalEdge(transition, editingExisting, symbol)
      );
      if (conflict !== undefined) {
        const conflictDest = Array.from(conflict.to)[0];
        if (conflictDest !== undefined) {
          overlays.push({
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
    });

    overlays.push({
      from: newSource,
      to: newDestination,
      symbol,
      kind: 'add',
    });
  }

  if (overlays.length === 0) return noPreview;
  return { automaton: { ...automaton, transitions: previewTransitions }, overlays };
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
 * computePreview's delete-kind overlays.
 */
export function getOverwriteSummary(
  automaton: Automaton,
  sourceId: number | null,
  destinationId: number | null,
  symbols: ReadonlyArray<string | null>,
  editingExisting: PreviewEditingExisting | null,
  isNFA: boolean
): { count: number; first: { from: number; to: number; symbol: string | null } | null } {
  if (isNFA) return { count: 0, first: null };
  if (sourceId === null || destinationId === null) return { count: 0, first: null };
  if (symbols.length === 0) return { count: 0, first: null };

  const editingSet =
    editingExisting !== null && editingExisting.from === sourceId
      ? new Set(editingExisting.symbols)
      : new Set<string | null>();

  let count = 0;
  let first: { from: number; to: number; symbol: string | null } | null = null;
  for (const symbol of symbols) {
    // Symbols already on the loaded edge group are being replaced as part
    // of the modify, not silently overwritten.
    if (editingSet.has(symbol)) continue;
    for (const transition of automaton.transitions) {
      if (transition.from !== sourceId) continue;
      if (transition.symbol !== symbol) continue;
      // Exact-duplicate: same (from, symbol, dest) → no-op, not an overwrite.
      if (transition.to.size === 1 && transition.to.has(destinationId)) continue;
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
