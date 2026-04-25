/**
 * useAutomatonLayout
 *
 * Owns the GraphViz layout pipeline that turns an `Automaton` into an
 * `AutomatonUI` (node positions + edge spline paths + display labels).
 *
 * Why a hook:
 * - Layout is async (GraphViz is a wasm wasm-call) and debounced (so a
 *   burst of edits doesn't trigger a layout per keystroke).
 * - A version counter discards stale promises — if layout N-1 resolves
 *   after N, the older result is dropped on the floor.
 * - All of the above is mechanical glue that App.tsx doesn't need to read.
 *
 * Contract:
 * - Pass any `Automaton` (the caller may pass a preview-spliced automaton
 *   so in-progress edits show up on the canvas with full GraphViz routing).
 * - Receive the latest `automatonUI` plus `isLoading` (true between an
 *   automaton change and the layout resolving for it).
 *
 * The hook intentionally relabels states post-layout so the canvas always
 * uses sequential display labels (q0, q1, q2…) regardless of the engine's
 * underlying numeric IDs.
 */

import { useEffect, useRef, useState } from 'react';
import { Automaton } from '../engine/types';
import { AutomatonUI, computeDisplayLabels } from '../ui-state/types';
import { computeLayout } from '../ui-state/utils';

const LAYOUT_DEBOUNCE_MS = 120;

export type UseAutomatonLayoutResult = {
  automatonUI: AutomatonUI | null;
  isLoading: boolean;
};

export function useAutomatonLayout(automaton: Automaton): UseAutomatonLayoutResult {
  const [automatonUI, setAutomatonUI] = useState<AutomatonUI | null>(null);
  // Loading flag flips true the moment the input changes and false once a
  // matching layout commits. Useful for UI shimmer / "Loading..." caption.
  const [isLoading, setIsLoading] = useState(true);
  // Monotonic version counter. Each effect run increments it; the resolver
  // checks `version === versionRef.current` before committing — older
  // promises silently lose the race.
  const versionRef = useRef(0);

  useEffect(() => {
    const version = ++versionRef.current;
    setIsLoading(true);
    const timer = setTimeout(() => {
      computeLayout(automaton).then((layout) => {
        if (version !== versionRef.current) return;
        const labels = computeDisplayLabels(automaton.states);
        const relabeled: AutomatonUI = {
          ...layout,
          states: new Map(
            Array.from(layout.states.entries()).map(([id, stateUI]) => [
              id,
              { ...stateUI, label: labels.get(id) ?? stateUI.label },
            ])
          ),
        };
        setAutomatonUI(relabeled);
        setIsLoading(false);
      });
    }, LAYOUT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [automaton]);

  return { automatonUI, isLoading };
}
