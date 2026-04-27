/**
 * DFA equivalence checking via product construction.
 *
 * Algorithm: BFS over the product DFA (a × b). Each visited node is
 * a pair (qa, qb). A pair is a "diff" pair iff exactly one of qa∈A.accept,
 * qb∈B.accept holds — i.e. the two automatons disagree on accept-ness at
 * this point. If BFS reaches a diff pair, A and B are NOT equivalent and
 * the path string traversed is a counterexample (a string A accepts and
 * B rejects, or vice versa). If BFS exhausts the reachable product
 * states without finding a diff, A and B ARE equivalent.
 *
 * BFS guarantees the SHORTEST counterexample by construction.
 *
 * Returns also the counterexample's accepting side ('a' or 'b'), so the
 * UI can phrase the result accurately ("A accepts but B rejects" vs.
 * the other way around).
 *
 * Preconditions: both must be complete DFAs over the same alphabet.
 * Otherwise the product would have undefined transitions or the
 * alphabets wouldn't compose.
 */

import { Automaton } from './types';
import { Result, ok, err } from './result';
import { isComplete } from './validator';

export type EquivalenceOutcome =
  | { equivalent: true; counterexample: null }
  | {
      equivalent: false;
      counterexample: string;
      /** Which side accepts the counterexample. The OTHER side rejects. */
      acceptingSide: 'a' | 'b';
    };

/**
 * Quick (state, symbol) → destination lookup over a complete DFA.
 * Caller must have validated completeness.
 */
function transitionLookup(dfa: Automaton): Map<number, Map<string, number>> {
  const out = new Map<number, Map<string, number>>();
  for (const stateId of dfa.states) out.set(stateId, new Map());
  for (const t of dfa.transitions) {
    if (t.symbol === null) continue;
    const dest = t.to.values().next().value;
    if (dest === undefined) continue;
    out.get(t.from)!.set(t.symbol, dest);
  }
  return out;
}

export function areEquivalent(
  a: Automaton,
  b: Automaton
): Result<EquivalenceOutcome> {
  if (a.type !== 'DFA' || b.type !== 'DFA') {
    return err('equivalence-requires-dfa');
  }
  if (!isComplete(a) || !isComplete(b)) {
    return err('equivalence-requires-complete-dfa');
  }
  // Symmetric-difference check on the alphabets. Required because the
  // product construction needs the same symbol set on both sides; a
  // symbol present on one but missing on the other has no defined
  // transition in the product.
  if (a.alphabet.size !== b.alphabet.size) {
    return err('equivalence-alphabet-mismatch');
  }
  for (const sym of a.alphabet) {
    if (!b.alphabet.has(sym)) return err('equivalence-alphabet-mismatch');
  }

  const alphabet = Array.from(a.alphabet).sort();
  const lookupA = transitionLookup(a);
  const lookupB = transitionLookup(b);

  type PairKey = string;
  const key = (qa: number, qb: number): PairKey => `${qa},${qb}`;
  // For each visited pair, store the parent pair + the symbol used to
  // reach it. Reconstruct the counterexample by walking back to the
  // start.
  type Crumb = { fromKey: PairKey; symbol: string };
  const visited = new Map<PairKey, Crumb | null>();

  const startKey = key(a.startState, b.startState);
  visited.set(startKey, null);

  // Test the start pair before the BFS loop — if A accepts ε and B
  // doesn't (or vice versa), the empty string is the counterexample.
  function isDiff(qa: number, qb: number): boolean {
    return a.acceptStates.has(qa) !== b.acceptStates.has(qb);
  }
  function acceptingSideOf(qa: number, _qb: number): 'a' | 'b' {
    // Diff guarantees exactly one accepts; if A accepts at qa, side is
    // 'a', otherwise B's qb is the accepting one.
    return a.acceptStates.has(qa) ? 'a' : 'b';
  }

  if (isDiff(a.startState, b.startState)) {
    return ok({
      equivalent: false,
      counterexample: '',
      acceptingSide: acceptingSideOf(a.startState, b.startState),
    });
  }

  // BFS.
  const queue: Array<{ qa: number; qb: number; pairKey: PairKey }> = [
    { qa: a.startState, qb: b.startState, pairKey: startKey },
  ];
  while (queue.length > 0) {
    const { qa, qb, pairKey } = queue.shift()!;
    for (const symbol of alphabet) {
      const nextQa = lookupA.get(qa)!.get(symbol);
      const nextQb = lookupB.get(qb)!.get(symbol);
      if (nextQa === undefined || nextQb === undefined) {
        // Should be impossible after isComplete check; defensive.
        continue;
      }
      const nextKey = key(nextQa, nextQb);
      if (visited.has(nextKey)) continue;
      visited.set(nextKey, { fromKey: pairKey, symbol });
      if (isDiff(nextQa, nextQb)) {
        // Reconstruct path: walk back through visited's crumb chain.
        const symbols: string[] = [];
        let cursor: PairKey = nextKey;
        while (true) {
          const crumb = visited.get(cursor);
          if (!crumb) break;
          symbols.push(crumb.symbol);
          cursor = crumb.fromKey;
        }
        symbols.reverse();
        return ok({
          equivalent: false,
          counterexample: symbols.join(''),
          acceptingSide: acceptingSideOf(nextQa, nextQb),
        });
      }
      queue.push({ qa: nextQa, qb: nextQb, pairKey: nextKey });
    }
  }

  return ok({ equivalent: true, counterexample: null });
}
