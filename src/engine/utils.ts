/**
 * Engine utilities — pure functions over the Automaton model that don't
 * fit neatly into automaton/validator/simulator. Right now this is just
 * ε-closure, used by NFA simulation.
 */

import type { Transition } from './types';

/**
 * Compute the ε-closure of a set of states.
 *
 * The ε-closure of a state q is the set of all states reachable from q
 * by following zero or more ε-transitions. The ε-closure of a set is
 * the union of the closures of its members. Used in NFA simulation:
 * after the start state is set or after each step, every active state
 * is replaced by its closure so subsequent symbol-driven transitions
 * see all the states reachable "for free."
 *
 * Implemented as a BFS over ε-edges (transitions with `symbol === null`).
 * Pure — does not mutate the input set.
 *
 * For DFAs (no ε-transitions) this is a no-op: returns an equivalent
 * Set with the same members.
 *
 * @param states - The seed set of states.
 * @param transitions - All transitions in the automaton.
 * @returns A new Set containing every state reachable from `states` via
 *          zero or more ε-transitions (including the originals).
 */
export function epsilonClosure(
  states: ReadonlySet<number>,
  transitions: ReadonlyArray<Transition>
): Set<number> {
  const closure = new Set<number>(states);
  const stack: number[] = Array.from(states);

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const transition of transitions) {
      if (transition.from !== current) continue;
      if (transition.symbol !== null) continue;
      for (const dest of transition.to) {
        if (!closure.has(dest)) {
          closure.add(dest);
          stack.push(dest);
        }
      }
    }
  }

  return closure;
}

/**
 * Same as epsilonClosure, but also records every ε-transition that
 * was traversed during the BFS. Used by the simulator to drive the
 * per-step edge-fired pulse — without the trace, the visual would
 * miss every ε-edge that was actually followed at this step.
 *
 * The `fired` array can contain duplicates only if the underlying
 * transition list does (we don't dedupe). The closure itself is the
 * same Set epsilonClosure would return.
 */
export function epsilonClosureWithTrace(
  states: ReadonlySet<number>,
  transitions: ReadonlyArray<Transition>
): {
  closure: Set<number>;
  fired: Array<{ from: number; to: number; symbol: null }>;
} {
  const closure = new Set<number>(states);
  const fired: Array<{ from: number; to: number; symbol: null }> = [];
  const stack: number[] = Array.from(states);

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const transition of transitions) {
      if (transition.from !== current) continue;
      if (transition.symbol !== null) continue;
      for (const dest of transition.to) {
        if (!closure.has(dest)) {
          closure.add(dest);
          stack.push(dest);
          fired.push({ from: current, to: dest, symbol: null });
        }
      }
    }
  }

  return { closure, fired };
}
