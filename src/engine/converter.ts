/**
 * NFA → DFA conversion via subset construction (powerset construction).
 *
 * Algorithm: eager construction over reachable subsets only.
 *  - Start with S0 = ε-closure({nfa.startState}).
 *  - Worklist: for each subset S and each non-ε symbol a in alphabet,
 *    compute T = ε-closure(union of move(s, a) for s in S). Add edge
 *    S --a--> T. Enqueue T if unseen.
 *  - When move(S, a) = ∅, route to a single shared trap state with
 *    self-loops on every symbol. Result is always a *complete* DFA
 *    (passes isComplete()), so it's immediately runnable.
 *
 * Returns the resulting DFA + a `subsetMap` keyed by new DFA state ID
 * mapping to the original NFA states it represents. The UI uses this
 * to generate display labels like `{q0,q2,q5}`.
 *
 * Safety: capped at 1000 generated subsets to prevent pathological
 * NFAs from spinning the layout engine.
 */

import { Automaton, Transition } from './types';
import { Result, ok, err } from './result';
import { epsilonClosure } from './utils';
import { minimizeDfa } from './minimizer';

const MAX_SUBSETS = 1000;

export type ConversionOutcome = {
  /** The resulting (complete) DFA. */
  dfa: Automaton;
  /**
   * Map from new DFA state ID to the set of original NFA state IDs it
   * represents. The trap state (if present) maps to an empty set.
   */
  subsetMap: Map<number, ReadonlySet<number>>;
};

/**
 * Canonical key for a subset of NFA state IDs. Sorted-comma-joined so
 * different insertion orders produce the same key.
 */
function subsetKey(states: ReadonlySet<number>): string {
  return Array.from(states).sort((a, b) => a - b).join(',');
}

/**
 * Compute move(S, a): the union of every transition target from any
 * state in S on symbol a. Excludes ε-transitions (caller is expected
 * to ε-close the result).
 */
function move(
  states: ReadonlySet<number>,
  symbol: string,
  transitions: ReadonlyArray<Transition>
): Set<number> {
  const result = new Set<number>();
  for (const transition of transitions) {
    if (transition.symbol !== symbol) continue;
    if (!states.has(transition.from)) continue;
    for (const dest of transition.to) result.add(dest);
  }
  return result;
}

/**
 * Convert an NFA to its equivalent DFA via subset construction.
 *
 * Refuses to convert a DFA (returns 'conversion-requires-nfa') —
 * silently no-oping would mask user error. Empty alphabet is also
 * refused (no transitions are possible).
 */
export function convertNfaToDfa(nfa: Automaton): Result<ConversionOutcome> {
  if (nfa.type !== 'NFA') return err('conversion-requires-nfa');
  if (nfa.alphabet.size === 0) return err('conversion-empty-alphabet');

  const alphabet = Array.from(nfa.alphabet).sort();

  // Start subset = ε-closure of the NFA start state.
  const startSubset = epsilonClosure(new Set([nfa.startState]), nfa.transitions);

  // subsetMap (canonical key → new DFA state ID).
  const keyToId = new Map<string, number>();
  // Reverse: DFA state ID → original NFA states.
  const idToSubset = new Map<number, ReadonlySet<number>>();
  // DFA state ID → array of (symbol, destination DFA state ID).
  const dfaTransitions: Transition[] = [];
  const acceptStates = new Set<number>();

  let nextId = 0;
  function intern(subset: ReadonlySet<number>): number {
    const key = subsetKey(subset);
    const existing = keyToId.get(key);
    if (existing !== undefined) return existing;
    const id = nextId++;
    keyToId.set(key, id);
    idToSubset.set(id, subset);
    // Mark as accepting if the subset contains any NFA accept state.
    for (const stateId of subset) {
      if (nfa.acceptStates.has(stateId)) {
        acceptStates.add(id);
        break;
      }
    }
    return id;
  }

  const startId = intern(startSubset);

  // BFS over reachable subsets.
  const worklist: number[] = [startId];
  let trapId: number | null = null;

  while (worklist.length > 0) {
    if (nextId > MAX_SUBSETS) return err('conversion-too-large');
    const currentId = worklist.shift()!;
    const currentSubset = idToSubset.get(currentId)!;

    for (const symbol of alphabet) {
      const moved = move(currentSubset, symbol, nfa.transitions);
      const closed = moved.size === 0 ? moved : epsilonClosure(moved, nfa.transitions);

      let destId: number;
      if (closed.size === 0) {
        // Trap routing: lazily create the single shared trap state.
        if (trapId === null) {
          trapId = nextId++;
          keyToId.set('', trapId);
          idToSubset.set(trapId, new Set());
          // Self-loops on every symbol (added below after trap mint).
          for (const sym of alphabet) {
            dfaTransitions.push({
              from: trapId,
              to: new Set([trapId]),
              symbol: sym,
            });
          }
        }
        destId = trapId;
      } else {
        const wasNew = !keyToId.has(subsetKey(closed));
        destId = intern(closed);
        if (wasNew) worklist.push(destId);
      }

      dfaTransitions.push({
        from: currentId,
        to: new Set([destId]),
        symbol,
      });
    }
  }

  const states = new Set<number>();
  for (let i = 0; i < nextId; i++) states.add(i);

  const rawDfa: Automaton = {
    type: 'DFA',
    states,
    alphabet: new Set(alphabet),
    transitions: dfaTransitions,
    startState: startId,
    acceptStates,
    nextStateId: nextId,
  };

  // Auto-apply Hopcroft minimization. The pre-minimization DFA is what
  // a textbook subset construction produces; the user shouldn't have
  // to run a second button to get the minimal form. If/when we add a
  // step-through mode (showing each step of subset construction +
  // minimization separately), this auto-call moves into the UI layer.
  const minimized = minimizeDfa(rawDfa);
  if (!minimized.ok) return minimized;

  // Compose: each minimized state collapses one or more raw-DFA state
  // IDs (mergeMap), each of which represents an NFA subset (idToSubset).
  // Final subsetMap maps minimized state ID → union of underlying NFA
  // states across every collapsed raw state.
  const composedSubsetMap = new Map<number, ReadonlySet<number>>();
  for (const [newId, mergedRawIds] of minimized.value.mergeMap) {
    const union = new Set<number>();
    for (const rawId of mergedRawIds) {
      const subset = idToSubset.get(rawId);
      if (subset) for (const nfaId of subset) union.add(nfaId);
    }
    composedSubsetMap.set(newId, union);
  }

  return ok({ dfa: minimized.value.dfa, subsetMap: composedSubsetMap });
}

/** Exposed for tests + UI label generation. */
export const CONVERSION_MAX_SUBSETS = MAX_SUBSETS;
