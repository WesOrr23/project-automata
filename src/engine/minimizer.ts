/**
 * DFA minimization via Hopcroft's algorithm.
 *
 * Two phases:
 *
 *  1. Trim — drop states unreachable from the start state. Subset
 *     construction already produces only reachable subsets, but a
 *     stand-alone caller could feed us a DFA with disconnected pieces.
 *
 *  2. Hopcroft partition refinement — partition states into equivalence
 *     classes where two states are equivalent iff they accept the same
 *     language from that point. Initial partition: {accept, non-accept}.
 *     Repeatedly split any class that distinguishes its members (members
 *     transition to different classes on some symbol). Until no further
 *     refinement is possible.
 *
 * Result: a new DFA with one state per equivalence class, renumbered
 * from 0. A `mergeMap` records which original state IDs collapsed into
 * each new state — used by the UI's subset-label pipeline so the
 * minimized DFA still shows readable labels tied to the source automaton.
 *
 * Precondition: input must be a complete DFA (every (state, symbol)
 * has a transition). The conversion path always satisfies this; a
 * stand-alone call on an incomplete DFA returns 'minimize-incomplete-dfa'.
 */

import { Automaton, Transition } from './types';
import { Result, ok, err } from './result';

export type MinimizeOutcome = {
  dfa: Automaton;
  /**
   * Map from new (minimized) state ID to the set of original DFA state
   * IDs that collapsed into it. For a DFA where no states merged, every
   * entry is a singleton set; the map's keys are still renumbered from
   * zero if any unreachable states were trimmed.
   */
  mergeMap: Map<number, ReadonlySet<number>>;
};

/**
 * Compute the set of states reachable from start by any sequence of
 * transitions. Skips ε since DFAs don't have them; if this is called
 * on something that does, the ε-edges are simply ignored.
 */
function reachableFromStart(dfa: Automaton): Set<number> {
  const visited = new Set<number>([dfa.startState]);
  const stack: number[] = [dfa.startState];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const transition of dfa.transitions) {
      if (transition.from !== current) continue;
      if (transition.symbol === null) continue;
      for (const dest of transition.to) {
        if (!visited.has(dest)) {
          visited.add(dest);
          stack.push(dest);
        }
      }
    }
  }
  return visited;
}

/**
 * Build a quick (state, symbol) → destination lookup. Assumes complete
 * DFA — caller must have validated.
 */
function buildTransitionLookup(
  dfa: Automaton
): Map<number, Map<string, number>> {
  const lookup = new Map<number, Map<string, number>>();
  for (const stateId of dfa.states) lookup.set(stateId, new Map());
  for (const transition of dfa.transitions) {
    if (transition.symbol === null) continue;
    const destination = transition.to.values().next().value;
    if (destination === undefined) continue;
    lookup.get(transition.from)!.set(transition.symbol, destination);
  }
  return lookup;
}

/** Returns true iff every (state, symbol) pair has a transition. */
function isCompleteOver(
  states: Set<number>,
  alphabet: Set<string>,
  lookup: Map<number, Map<string, number>>
): boolean {
  for (const state of states) {
    const row = lookup.get(state);
    if (!row) return false;
    for (const symbol of alphabet) {
      if (!row.has(symbol)) return false;
    }
  }
  return true;
}

export function minimizeDfa(dfa: Automaton): Result<MinimizeOutcome> {
  if (dfa.type !== 'DFA') return err('minimize-requires-dfa');

  const lookup = buildTransitionLookup(dfa);
  const reachable = reachableFromStart(dfa);
  if (!isCompleteOver(reachable, dfa.alphabet, lookup)) {
    return err('minimize-incomplete-dfa');
  }

  // Initial partition: {accept ∩ reachable, non-accept ∩ reachable}.
  // Skip an empty class (e.g. when there are no accept states reachable).
  const accept = new Set<number>();
  const nonAccept = new Set<number>();
  for (const stateId of reachable) {
    if (dfa.acceptStates.has(stateId)) accept.add(stateId);
    else nonAccept.add(stateId);
  }
  const partitions: Set<number>[] = [];
  if (accept.size > 0) partitions.push(accept);
  if (nonAccept.size > 0) partitions.push(nonAccept);

  // Worklist: start with all current partitions (the simpler variant of
  // Hopcroft; uses slightly more work than the smaller-half-only
  // optimization but is dramatically easier to read and still O(n log n)
  // for the inputs we'll see).
  const worklist: Set<number>[] = partitions.map((p) => new Set(p));

  // Helper: which partition does a given state belong to (by reference)?
  function partitionOf(stateId: number): Set<number> | null {
    for (const partition of partitions) {
      if (partition.has(stateId)) return partition;
    }
    return null;
  }

  while (worklist.length > 0) {
    const splitter = worklist.shift()!;
    for (const symbol of dfa.alphabet) {
      // X = states whose transition on `symbol` lands in splitter.
      const X = new Set<number>();
      for (const stateId of reachable) {
        const dest = lookup.get(stateId)!.get(symbol);
        if (dest !== undefined && splitter.has(dest)) X.add(stateId);
      }
      if (X.size === 0) continue;

      // For each existing partition Y that is split by X, replace Y
      // with two halves. Iterate over a snapshot of partitions since we
      // mutate the list.
      const snapshot = [...partitions];
      for (const Y of snapshot) {
        const intersect = new Set<number>();
        const remainder = new Set<number>();
        for (const stateId of Y) {
          if (X.has(stateId)) intersect.add(stateId);
          else remainder.add(stateId);
        }
        if (intersect.size === 0 || remainder.size === 0) continue;

        // Replace Y with the two halves in the partition list.
        const indexOfY = partitions.indexOf(Y);
        partitions.splice(indexOfY, 1, intersect, remainder);

        // If Y was on the worklist, replace; else add the smaller half
        // (Hopcroft's optimization that keeps the runtime O(n log n)).
        const indexOnWorklist = worklist.indexOf(Y);
        if (indexOnWorklist >= 0) {
          worklist.splice(indexOnWorklist, 1, intersect, remainder);
        } else {
          worklist.push(intersect.size <= remainder.size ? intersect : remainder);
        }
      }
    }
  }

  // Rebuild the DFA from the final partitions. Renumber from 0 in the
  // order partitions are encountered. The partition containing the
  // original start state becomes the new start state.
  const oldToNew = new Map<number, number>();
  const mergeMap = new Map<number, ReadonlySet<number>>();
  partitions.forEach((partition, newId) => {
    mergeMap.set(newId, new Set(partition));
    for (const old of partition) oldToNew.set(old, newId);
  });

  const startPartition = partitionOf(dfa.startState);
  if (startPartition === null) return err('state-not-found');
  const startId = partitions.indexOf(startPartition);

  const newAcceptStates = new Set<number>();
  for (const [newId, members] of mergeMap) {
    for (const member of members) {
      if (dfa.acceptStates.has(member)) {
        newAcceptStates.add(newId);
        break;
      }
    }
  }

  const seenEdge = new Set<string>();
  const newTransitions: Transition[] = [];
  for (const partition of partitions) {
    // Pick any representative — all members have the same outgoing
    // class for every symbol by construction.
    const representative = partition.values().next().value as number;
    const fromNew = oldToNew.get(representative)!;
    for (const symbol of dfa.alphabet) {
      const oldDest = lookup.get(representative)!.get(symbol);
      if (oldDest === undefined) continue;
      const toNew = oldToNew.get(oldDest);
      if (toNew === undefined) continue;
      const edgeKey = `${fromNew}|${symbol}|${toNew}`;
      if (seenEdge.has(edgeKey)) continue;
      seenEdge.add(edgeKey);
      newTransitions.push({
        from: fromNew,
        to: new Set([toNew]),
        symbol,
      });
    }
  }

  const newStates = new Set<number>();
  for (let i = 0; i < partitions.length; i++) newStates.add(i);

  const minimized: Automaton = {
    type: 'DFA',
    states: newStates,
    alphabet: new Set(dfa.alphabet),
    transitions: newTransitions,
    startState: startId,
    acceptStates: newAcceptStates,
    nextStateId: partitions.length,
  };

  return ok({ dfa: minimized, mergeMap });
}
