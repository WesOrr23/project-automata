/**
 * DFA transformation operations beyond the create/edit primitives in
 * automaton.ts. Currently houses:
 *
 *  - complementDfa: flip accept-states on a complete DFA so the
 *    resulting DFA accepts exactly the strings the original rejects.
 *
 * Convention: every function here returns Result<Automaton> and refuses
 * preconditions explicitly (e.g. NFA → 'complement-requires-dfa') so
 * the UI can route to a typed errorMessage instead of guessing.
 */

import { Automaton, Transition } from './types';
import { Result, ok, err } from './result';
import { isComplete } from './validator';

/**
 * Build the complement of a complete DFA: same states, same alphabet,
 * same transitions, but acceptStates ← states − acceptStates.
 *
 * Why "complete" matters: an incomplete DFA effectively rejects on
 * missing transitions (dead-end). Flipping accept states would treat
 * those dead-ends as accepting, which is not the language complement
 * the user expects. Caller should add a trap state first or run on a
 * complete DFA (e.g. one produced by Convert NFA→DFA, which guarantees
 * completeness).
 */
export function complementDfa(dfa: Automaton): Result<Automaton> {
  if (dfa.type !== 'DFA') return err('complement-requires-dfa');
  if (!isComplete(dfa)) return err('complement-requires-complete-dfa');

  const newAcceptStates = new Set<number>();
  for (const stateId of dfa.states) {
    if (!dfa.acceptStates.has(stateId)) newAcceptStates.add(stateId);
  }

  // Clone transitions defensively — the engine treats Automaton as
  // immutable, but downstream UI code that snapshots references
  // shouldn't see shared mutable Sets.
  const transitions: Transition[] = dfa.transitions.map((t) => ({
    from: t.from,
    to: new Set(t.to),
    symbol: t.symbol,
  }));

  return ok({
    type: 'DFA',
    states: new Set(dfa.states),
    alphabet: new Set(dfa.alphabet),
    transitions,
    startState: dfa.startState,
    acceptStates: newAcceptStates,
    nextStateId: dfa.nextStateId,
  });
}
