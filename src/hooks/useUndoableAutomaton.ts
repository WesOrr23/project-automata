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
 * - canUndo / canRedo are real useState booleans, kept in lockstep with the
 *   ref'd stacks. Every operation that mutates a stack ALSO calls the
 *   matching flag setter — that's the hook's invariant.
 *
 * Hook contract (invariant):
 * - Any code that mutates `undoStackRef.current` MUST call `setCanUndo` with
 *   the new "is non-empty?" value (or rely on a helper that does).
 * - Any code that mutates `redoStackRef.current` MUST call `setCanRedo` the
 *   same way.
 * - Without this, the flags drift out of sync with the stacks. The previous
 *   incarnation of this hook derived the flags from `stack.length` on every
 *   render and relied on `setCurrent` to trigger a render after every stack
 *   mutation — that worked but was implicit and forced `clearHistory` to
 *   push a same-content snapshot just to provoke a re-render. Explicit flag
 *   state makes the dependency obvious and removes the hack.
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
  /** Free-form description / notes about this FA. Persisted in the
   *  save file's metadata. Empty string means "no description." */
  description: string;
};

export type UseUndoableAutomatonResult = {
  automaton: Automaton;
  epsilonSymbol: string;
  description: string;
  setAutomaton: (updater: (previous: Automaton) => Automaton) => void;
  setEpsilonSymbol: (next: string) => void;
  setDescription: (next: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  /**
   * Replace the entire snapshot (e.g. when loading a file). Resets
   * history (the loaded automaton becomes the new "saved" baseline,
   * so neither undo to the previous edits nor dirty-flag is sensible).
   */
  replaceSnapshot: (snapshot: Snapshot) => void;
  /**
   * Record the current snapshot as the "saved" reference. The hook's
   * `isDirty` flag becomes true whenever the current snapshot reference
   * diverges from this. Call after a successful save or a fresh load.
   */
  markSaved: () => void;
  /** True iff the current snapshot reference !== the last markSaved snapshot. */
  isDirty: boolean;
};

export function useUndoableAutomaton(
  initial: Snapshot | (() => Snapshot)
): UseUndoableAutomatonResult {
  const [current, setCurrent] = useState<Snapshot>(initial);
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Saved-snapshot reference for dirty tracking. Initialized to the
  // first current snapshot so a freshly-mounted hook is "clean."
  // Updated by markSaved() on save and by replaceSnapshot() on load.
  const savedSnapshotRef = useRef<Snapshot>(current);
  const [isDirty, setIsDirty] = useState(false);

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
    setCanUndo(true);
  }, []);

  const clearRedoStack = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    redoStackRef.current = [];
    setCanRedo(false);
  }, []);

  // Helper: update isDirty based on a new current snapshot reference.
  // Comparing against savedSnapshotRef.current — if they match, clean.
  const refreshDirty = useCallback((nextSnapshot: Snapshot) => {
    setIsDirty(nextSnapshot !== savedSnapshotRef.current);
  }, []);

  const setAutomaton = useCallback(
    (updater: (previous: Automaton) => Automaton) => {
      const previousSnapshot = currentRef.current;
      const nextAutomaton = updater(previousSnapshot.automaton);
      if (nextAutomaton === previousSnapshot.automaton) return;
      pushCurrentOntoUndo();
      clearRedoStack();
      const nextSnapshot: Snapshot = {
        ...previousSnapshot,
        automaton: nextAutomaton,
      };
      setCurrent(nextSnapshot);
      refreshDirty(nextSnapshot);
    },
    [pushCurrentOntoUndo, clearRedoStack, refreshDirty]
  );

  const setEpsilonSymbol = useCallback(
    (next: string) => {
      const previousSnapshot = currentRef.current;
      if (next === previousSnapshot.epsilonSymbol) return;
      pushCurrentOntoUndo();
      clearRedoStack();
      const nextSnapshot: Snapshot = {
        ...previousSnapshot,
        epsilonSymbol: next,
      };
      setCurrent(nextSnapshot);
      refreshDirty(nextSnapshot);
    },
    [pushCurrentOntoUndo, clearRedoStack, refreshDirty]
  );

  const setDescription = useCallback(
    (next: string) => {
      const previousSnapshot = currentRef.current;
      if (next === previousSnapshot.description) return;
      pushCurrentOntoUndo();
      clearRedoStack();
      const nextSnapshot: Snapshot = {
        ...previousSnapshot,
        description: next,
      };
      setCurrent(nextSnapshot);
      refreshDirty(nextSnapshot);
    },
    [pushCurrentOntoUndo, clearRedoStack, refreshDirty]
  );

  const undo = useCallback(() => {
    const undoStack = undoStackRef.current;
    if (undoStack.length === 0) return;
    const previous = undoStack.pop()!;
    redoStackRef.current.push(currentRef.current);
    setCanUndo(undoStack.length > 0);
    setCanRedo(true);
    setCurrent(previous);
    refreshDirty(previous);
  }, [refreshDirty]);

  const redo = useCallback(() => {
    const redoStack = redoStackRef.current;
    if (redoStack.length === 0) return;
    const next = redoStack.pop()!;
    undoStackRef.current.push(currentRef.current);
    setCanRedo(redoStack.length > 0);
    setCanUndo(true);
    setCurrent(next);
    refreshDirty(next);
  }, [refreshDirty]);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  const replaceSnapshot = useCallback((snapshot: Snapshot) => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setCurrent(snapshot);
    savedSnapshotRef.current = snapshot;
    setIsDirty(false);
  }, []);

  const markSaved = useCallback(() => {
    savedSnapshotRef.current = currentRef.current;
    setIsDirty(false);
  }, []);

  return {
    automaton: current.automaton,
    epsilonSymbol: current.epsilonSymbol,
    description: current.description,
    setAutomaton,
    setEpsilonSymbol,
    setDescription,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    replaceSnapshot,
    markSaved,
    isDirty,
  };
}
