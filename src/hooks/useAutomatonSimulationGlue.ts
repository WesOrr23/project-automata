/**
 * useAutomatonSimulationGlue
 *
 * Two effects that keep the simulation and the test-input string in sync
 * with structural changes to the automaton:
 *
 *  1. Whenever the `automaton` reference changes (i.e. the user edited
 *     it), reset the simulation. We skip the first render so opening the
 *     app doesn't reset a not-yet-initialized sim.
 *
 *  2. Whenever the alphabet changes, filter the input string down to
 *     symbols that still exist. Without this the user can keep a stale
 *     test string after deleting one of its symbols, which simulation
 *     would then fail on for an opaque-looking reason.
 *
 * The hook owns nothing; it's a pure side-effect coordinator. Pulled out
 * of App.tsx because it's a self-contained pair of related effects with a
 * clear contract that's easier to reason about (and test) in isolation.
 */

import { useEffect, useRef } from 'react';
import { Automaton } from '../engine/types';

export type UseAutomatonSimulationGlueOptions = {
  automaton: Automaton;
  /** Reset the simulation. Called on every non-initial automaton change. */
  resetSimulation: () => void;
  /** Current input string. Read on every alphabet change. */
  inputString: string;
  /** Update the input string. Called only when filtering would change it. */
  setInputString: (next: string) => void;
};

export function useAutomatonSimulationGlue({
  automaton,
  resetSimulation,
  inputString,
  setInputString,
}: UseAutomatonSimulationGlueOptions): void {
  // Guard against the StrictMode-double-mount + initial-paint resetting a
  // simulation that doesn't exist yet. The flag flips to false the first
  // time the effect runs, so subsequent automaton changes are treated as
  // genuine user edits.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    resetSimulation();
    // resetSimulation intentionally NOT in deps: it's a stable reference
    // from useSimulation but listing it would re-invoke the reset on
    // every render where the surrounding component re-creates its
    // closure. Tracking automaton alone is the user-visible contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automaton]);

  // Filter input against the current alphabet. We read inputString from a
  // ref-of-latest rather than including it in deps, otherwise this effect
  // would run on every keystroke and re-filter even when the alphabet
  // hasn't moved. Using a ref keeps it strictly alphabet-driven.
  const inputStringRef = useRef(inputString);
  inputStringRef.current = inputString;
  useEffect(() => {
    const filtered = [...inputStringRef.current]
      .filter((ch) => automaton.alphabet.has(ch))
      .join('');
    if (filtered === inputStringRef.current) return;
    setInputString(filtered);
    // setInputString comes from a useState setter, which is stable; not
    // included in deps for the same reason as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automaton.alphabet]);
}
