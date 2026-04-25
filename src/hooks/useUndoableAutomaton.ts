/**
 * useUndoableAutomaton Hook
 *
 * Snapshot-stack undo/redo over the atomic unit of editor state:
 * { automaton, epsilonSymbol }. Replaces a bare useState<Automaton> +
 * useState<string> pair at the top of App.tsx.
 *
 * Architecture:
 * - One useState holds the current snapshot. Changes to it drive re-renders.
 * - Two useRefs hold the undo / redo stacks. They aren't rendered directly,
 *   so keeping them in refs avoids forcing a full Snapshot copy into state.
 * - canUndo / canRedo are derived from stack lengths on every render; cheap
 *   (length lookup), and always correct after any mutation.
 *
 * No-op semantics:
 * - `setAutomaton(updater)` computes `next = updater(current.automaton)`.
 *   If `next === current.automaton` (reference equality), the update is a
 *   no-op — nothing gets pushed, nothing re-renders.
 * - Callers that produce a *new* reference with identical contents (e.g.
 *   `new Set([...prev, x])` when `x` was already in prev) should
 *   short-circuit themselves before calling setAutomaton.
 *
 * Cap:
 * - Undo stack is capped at HISTORY_CAP entries. Oldest is evicted (FIFO)
 *   when a push would exceed the cap. Redo stack is uncapped (it can only
 *   grow as large as the undo stack itself).
 *
 * ε-symbol:
 * - Folded into the snapshot so one undo action = one user-visible state
 *   restoration. Avoids the coordination bugs of two parallel stacks.
 */

import { useState, useRef, useCallback } from 'react';
import { Automaton } from '../engine/types';

export const HISTORY_CAP = 50;

export type Snapshot = {
  automaton: Automaton;
  epsilonSymbol: string;
};

export type UseUndoableAutomatonResult = {
  automaton: Automaton;
  epsilonSymbol: string;
  setAutomaton: (updater: (previous: Automaton) => Automaton) => void;
  setEpsilonSymbol: (next: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
};

export function useUndoableAutomaton(
  initial: Snapshot | (() => Snapshot)
): UseUndoableAutomatonResult {
  const [current, setCurrent] = useState<Snapshot>(initial);
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);

  // Keep a ref to the current snapshot so the imperative setters can read
  // it synchronously. React state alone would show the stale value inside
  // a single tick if two setters were called in sequence.
  const currentRef = useRef(current);
  currentRef.current = current;

  const pushCurrentOntoUndo = useCallback(() => {
    const stack = undoStackRef.current;
    stack.push(currentRef.current);
    // FIFO eviction: drop the oldest entry. shift() is O(n) but n <= 50,
    // so the cost is negligible and the code stays obvious.
    if (stack.length > HISTORY_CAP) stack.shift();
  }, []);

  const setAutomaton = useCallback(
    (updater: (previous: Automaton) => Automaton) => {
      const previousSnapshot = currentRef.current;
      const nextAutomaton = updater(previousSnapshot.automaton);
      if (nextAutomaton === previousSnapshot.automaton) return;
      pushCurrentOntoUndo();
      redoStackRef.current = [];
      setCurrent({
        automaton: nextAutomaton,
        epsilonSymbol: previousSnapshot.epsilonSymbol,
      });
    },
    [pushCurrentOntoUndo]
  );

  const setEpsilonSymbol = useCallback(
    (next: string) => {
      const previousSnapshot = currentRef.current;
      if (next === previousSnapshot.epsilonSymbol) return;
      pushCurrentOntoUndo();
      redoStackRef.current = [];
      setCurrent({
        automaton: previousSnapshot.automaton,
        epsilonSymbol: next,
      });
    },
    [pushCurrentOntoUndo]
  );

  const undo = useCallback(() => {
    const undoStack = undoStackRef.current;
    if (undoStack.length === 0) return;
    const previous = undoStack.pop()!;
    redoStackRef.current.push(currentRef.current);
    setCurrent(previous);
  }, []);

  const redo = useCallback(() => {
    const redoStack = redoStackRef.current;
    if (redoStack.length === 0) return;
    const next = redoStack.pop()!;
    undoStackRef.current.push(currentRef.current);
    setCurrent(next);
  }, []);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    // Force re-render so canUndo/canRedo update. The snapshot itself is
    // unchanged but consumers need to see the new false/false flags.
    setCurrent((snapshot) => ({ ...snapshot }));
  }, []);

  return {
    automaton: current.automaton,
    epsilonSymbol: current.epsilonSymbol,
    setAutomaton,
    setEpsilonSymbol,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    clearHistory,
  };
}
