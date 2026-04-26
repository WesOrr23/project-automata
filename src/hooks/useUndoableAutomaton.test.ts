/**
 * @vitest-environment jsdom
 *
 * Tests for the undo/redo snapshot-stack hook.
 *
 * Uses `renderHook` + `act` so React state updates flush synchronously
 * between assertions. We exercise the hook as consumers will: by calling
 * its returned functions and checking the returned values.
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  createAutomaton,
  addState,
  addAcceptState,
} from '../engine/automaton';
import { Automaton } from '../engine/types';
import {
  useUndoableAutomaton,
  HISTORY_CAP,
  Snapshot,
} from './useUndoableAutomaton';

function initialSnapshot(): Snapshot {
  return {
    automaton: createAutomaton('DFA', new Set(['0', '1'])),
    epsilonSymbol: 'e',
  };
}

/** Convenience: add one state and return the new automaton. */
function withOneMoreState(automaton: Automaton): Automaton {
  return addState(automaton).automaton;
}

describe('useUndoableAutomaton', () => {
  it('returns the initial snapshot with canUndo and canRedo both false', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));

    expect(result.current.automaton.type).toBe('DFA');
    expect(result.current.epsilonSymbol).toBe('e');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('setAutomaton with a changed reference pushes onto the undo stack', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
    const baselineStateCount = result.current.automaton.states.size;

    act(() => {
      result.current.setAutomaton(withOneMoreState);
    });

    expect(result.current.automaton.states.size).toBe(baselineStateCount + 1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('setAutomaton returning the same reference is a no-op (no push)', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));

    act(() => {
      result.current.setAutomaton((previous) => previous);
    });

    expect(result.current.canUndo).toBe(false);
  });

  it('undo restores the prior automaton', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
    const baselineStateCount = result.current.automaton.states.size;

    act(() => {
      result.current.setAutomaton(withOneMoreState);
    });
    expect(result.current.automaton.states.size).toBe(baselineStateCount + 1);

    act(() => {
      result.current.undo();
    });

    expect(result.current.automaton.states.size).toBe(baselineStateCount);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo re-applies an un-done edit', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
    const baselineStateCount = result.current.automaton.states.size;

    act(() => {
      result.current.setAutomaton(withOneMoreState);
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });

    expect(result.current.automaton.states.size).toBe(baselineStateCount + 1);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('a new edit after undo clears the redo stack', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));

    act(() => {
      result.current.setAutomaton(withOneMoreState);
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.setAutomaton((previous) => {
        // addAcceptState now returns Result; unwrap synchronously since
        // the test owns every input and an err here would be a regression.
        const acceptResult = addAcceptState(withOneMoreState(previous), 0);
        if (!acceptResult.ok) throw new Error(`unexpected err: ${acceptResult.error}`);
        return acceptResult.value;
      });
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('caps the undo stack at HISTORY_CAP entries (FIFO eviction)', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
    const baselineStateCount = result.current.automaton.states.size;

    // Push HISTORY_CAP + 5 edits. The oldest 5 should be evicted.
    // Each edit is its own act() so React flushes the state commit before
    // the next updater reads currentRef. Batching multiple setAutomaton
    // calls inside one act() would have them all read the same starting
    // snapshot — fine in production (edits are always separate events)
    // but confusing inside a loop here.
    for (let i = 0; i < HISTORY_CAP + 5; i += 1) {
      act(() => {
        result.current.setAutomaton(withOneMoreState);
      });
    }

    expect(result.current.automaton.states.size).toBe(
      baselineStateCount + HISTORY_CAP + 5
    );

    // Undo HISTORY_CAP times. Each restores one state-count-smaller snapshot.
    // After all undos, the earliest snapshot in the stack was pushed for the
    // edit at index 5 (the first 5 were evicted). That snapshot was the
    // pre-edit state at that point, which had baseline + 5 states.
    for (let i = 0; i < HISTORY_CAP; i += 1) {
      act(() => {
        result.current.undo();
      });
    }

    expect(result.current.automaton.states.size).toBe(baselineStateCount + 5);
    expect(result.current.canUndo).toBe(false);
  });

  it('clearHistory empties both stacks and leaves current state intact', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));

    act(() => {
      result.current.setAutomaton(withOneMoreState);
    });
    act(() => {
      result.current.setAutomaton(withOneMoreState);
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    const snapshotBefore = result.current.automaton;

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.automaton).toBe(snapshotBefore);
  });

  it('setEpsilonSymbol with a new value pushes onto the undo stack', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));

    act(() => {
      result.current.setEpsilonSymbol('E');
    });

    expect(result.current.epsilonSymbol).toBe('E');
    expect(result.current.canUndo).toBe(true);
  });

  it('setEpsilonSymbol with the same value is a no-op', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));

    act(() => {
      result.current.setEpsilonSymbol('e');
    });

    expect(result.current.canUndo).toBe(false);
  });

  it('interleaved automaton + epsilon edits undo in reverse order', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
    const baselineStateCount = result.current.automaton.states.size;

    // Edit 1: add a state
    act(() => {
      result.current.setAutomaton(withOneMoreState);
    });
    // Edit 2: change epsilon
    act(() => {
      result.current.setEpsilonSymbol('x');
    });
    // Edit 3: add another state
    act(() => {
      result.current.setAutomaton(withOneMoreState);
    });

    expect(result.current.automaton.states.size).toBe(baselineStateCount + 2);
    expect(result.current.epsilonSymbol).toBe('x');

    // Undo edit 3 — state count drops, epsilon unchanged
    act(() => {
      result.current.undo();
    });
    expect(result.current.automaton.states.size).toBe(baselineStateCount + 1);
    expect(result.current.epsilonSymbol).toBe('x');

    // Undo edit 2 — epsilon reverts, state count unchanged
    act(() => {
      result.current.undo();
    });
    expect(result.current.automaton.states.size).toBe(baselineStateCount + 1);
    expect(result.current.epsilonSymbol).toBe('e');

    // Undo edit 1 — back to origin
    act(() => {
      result.current.undo();
    });
    expect(result.current.automaton.states.size).toBe(baselineStateCount);
    expect(result.current.epsilonSymbol).toBe('e');
    expect(result.current.canUndo).toBe(false);
  });

  it('undo with an empty stack is a safe no-op', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
    const baselineStateCount = result.current.automaton.states.size;

    act(() => {
      result.current.undo();
    });

    expect(result.current.automaton.states.size).toBe(baselineStateCount);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('redo with an empty stack is a safe no-op', () => {
    const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));

    act(() => {
      result.current.redo();
    });

    expect(result.current.canRedo).toBe(false);
  });

  describe('dirty tracking + replaceSnapshot + markSaved', () => {
    it('starts clean (isDirty: false)', () => {
      const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
      expect(result.current.isDirty).toBe(false);
    });

    it('becomes dirty on the first edit', () => {
      const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
      act(() => result.current.setAutomaton(withOneMoreState));
      expect(result.current.isDirty).toBe(true);
    });

    it('becomes clean again after markSaved', () => {
      const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
      act(() => result.current.setAutomaton(withOneMoreState));
      expect(result.current.isDirty).toBe(true);
      act(() => result.current.markSaved());
      expect(result.current.isDirty).toBe(false);
    });

    it('stays clean when undo returns to a saved snapshot', () => {
      const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
      // Initial = saved baseline.
      act(() => result.current.setAutomaton(withOneMoreState));
      expect(result.current.isDirty).toBe(true);
      // Undo back to the (initial = saved) baseline.
      act(() => result.current.undo());
      expect(result.current.isDirty).toBe(false);
    });

    it('becomes dirty again after redoing past the saved snapshot', () => {
      const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
      act(() => result.current.setAutomaton(withOneMoreState));
      act(() => result.current.markSaved());
      act(() => result.current.undo());           // back to initial; dirty (drifted from saved)
      expect(result.current.isDirty).toBe(true);
      act(() => result.current.redo());           // forward to saved snapshot; clean
      expect(result.current.isDirty).toBe(false);
    });

    it('replaceSnapshot wipes history and resets dirty', () => {
      const { result } = renderHook(() => useUndoableAutomaton(initialSnapshot()));
      act(() => result.current.setAutomaton(withOneMoreState));
      act(() => result.current.setAutomaton(withOneMoreState));
      expect(result.current.canUndo).toBe(true);
      const fresh: Snapshot = {
        automaton: createAutomaton('NFA', new Set(['a', 'b'])),
        epsilonSymbol: 'ε',
      };
      act(() => result.current.replaceSnapshot(fresh));
      expect(result.current.automaton.type).toBe('NFA');
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.isDirty).toBe(false);
    });
  });
});
