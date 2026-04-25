/**
 * useSimulation Hook
 *
 * Manages DFA simulation state for the UI layer.
 * Wraps the engine's Simulation type with React state management,
 * status tracking, history for step-back, and an auto-step timer.
 *
 * Architecture:
 * - Pure reducer function (simulationReducer) handles all state transitions
 * - useEffect manages the auto-step timer when status is 'running'
 * - Derived values (currentStateIds, stepIndex, etc.) are computed each render
 * - History array stores every Simulation snapshot for backward navigation
 *
 * Status state machine:
 *   idle → step → idle (or finished)
 *   idle → run → running
 *   running → auto-step exhausts input → finished
 *   running → pause → paused
 *   paused → step → paused (or finished)
 *   paused → run → running
 *   paused → stepBack → paused (or idle if back to start)
 *   idle → stepBack → idle (if history exists)
 *   ANY → reset → idle
 *   ANY → initialize → idle
 */

import { useReducer, useEffect, useCallback } from 'react';
import { Automaton, Simulation } from '../engine/types';
import {
  createSimulation,
  step as engineStep,
  isFinished as engineIsFinished,
  isAccepted as engineIsAccepted,
} from '../engine/simulator';
import { getTransition } from '../engine/automaton';
import {
  SIMULATION_SPEED_MIN,
  SIMULATION_SPEED_MAX,
  SIMULATION_SPEED_DEFAULT,
} from '../ui-state/constants';

// --- Types ---

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'finished';

export type SimulationState = {
  /** History of simulation snapshots (index 0 = initial, last = current) */
  history: Simulation[];
  /** Current position in the history array */
  historyIndex: number;
  status: SimulationStatus;
  speed: number;
};

export type SimulationAction =
  | { type: 'initialize'; automaton: Automaton; input: string }
  | { type: 'step' }
  | { type: 'stepBack' }
  | { type: 'jumpTo'; index: number; automaton?: Automaton; input?: string }
  | { type: 'autoStep' }
  | { type: 'run' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'setSpeed'; speed: number };

// --- Reducer ---

export const initialState: SimulationState = {
  history: [],
  historyIndex: -1,
  status: 'idle',
  speed: SIMULATION_SPEED_DEFAULT,
};

/** Get the current simulation from state, or null if none. */
function currentSimulation(state: SimulationState): Simulation | null {
  if (state.historyIndex < 0 || state.history.length === 0) return null;
  return state.history[state.historyIndex]!;
}

/**
 * Pure reducer for simulation state transitions.
 * Exported for direct testing without React.
 */
export function simulationReducer(
  state: SimulationState,
  action: SimulationAction
): SimulationState {
  switch (action.type) {
    case 'initialize': {
      const simulation = createSimulation(action.automaton, action.input);
      const status = engineIsFinished(simulation) ? 'finished' : 'idle';
      return { ...state, history: [simulation], historyIndex: 0, status };
    }

    case 'step': {
      const simulation = currentSimulation(state);
      if (simulation === null) return state;
      if (state.status === 'finished' || state.status === 'running') return state;

      const newSimulation = engineStep(simulation);
      const isNowFinished = engineIsFinished(newSimulation);

      // Truncate any forward history (if we stepped back then step forward again)
      const newHistory = [...state.history.slice(0, state.historyIndex + 1), newSimulation];

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        status: isNowFinished ? 'finished' : state.status,
      };
    }

    case 'stepBack': {
      if (state.historyIndex <= 0) return state;
      if (state.status === 'running') return state;

      const newIndex = state.historyIndex - 1;
      const newStatus = state.status === 'finished' ? 'idle' : state.status;

      return {
        ...state,
        historyIndex: newIndex,
        status: newStatus,
      };
    }

    case 'jumpTo': {
      if (state.status === 'running') return state;
      if (action.index < 0) return state;

      // Auto-initialize if no simulation exists (or finished) and automaton/input provided
      let workingState = state;
      if ((currentSimulation(state) === null || state.status === 'finished')
          && action.automaton && action.input) {
        const newSimulation = createSimulation(action.automaton, action.input);
        workingState = { ...state, history: [newSimulation], historyIndex: 0, status: 'idle' };
      }

      const simulation = currentSimulation(workingState);
      if (simulation === null) return state;

      // Backward jump — index exists in history
      if (action.index < workingState.history.length) {
        const targetSimulation = workingState.history[action.index]!;
        const isNowFinished = engineIsFinished(targetSimulation);

        return {
          ...workingState,
          historyIndex: action.index,
          status: isNowFinished ? 'finished' : 'idle',
        };
      }

      // Forward jump — step forward from current history end to reach target
      let latestSimulation = workingState.history[workingState.history.length - 1]!;
      const newHistory = [...workingState.history];

      while (newHistory.length - 1 < action.index && !engineIsFinished(latestSimulation)) {
        latestSimulation = engineStep(latestSimulation);
        newHistory.push(latestSimulation);
      }

      const targetIndex = Math.min(action.index, newHistory.length - 1);
      const targetSimulation = newHistory[targetIndex]!;
      const isNowFinished = engineIsFinished(targetSimulation);

      return {
        ...workingState,
        history: newHistory,
        historyIndex: targetIndex,
        status: isNowFinished ? 'finished' : 'idle',
      };
    }

    case 'autoStep': {
      const simulation = currentSimulation(state);
      if (simulation === null || state.status !== 'running') return state;

      const newSimulation = engineStep(simulation);
      const isNowFinished = engineIsFinished(newSimulation);

      const newHistory = [...state.history.slice(0, state.historyIndex + 1), newSimulation];

      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        status: isNowFinished ? 'finished' : 'running',
      };
    }

    case 'run': {
      const simulation = currentSimulation(state);
      if (simulation === null) return state;
      if (state.status === 'finished') return state;

      return { ...state, status: 'running' };
    }

    case 'pause': {
      if (state.status !== 'running') return state;

      return { ...state, status: 'paused' };
    }

    case 'reset': {
      return { ...state, history: [], historyIndex: -1, status: 'idle' };
    }

    case 'setSpeed': {
      const clampedSpeed = Math.max(SIMULATION_SPEED_MIN, Math.min(SIMULATION_SPEED_MAX, action.speed));
      return { ...state, speed: clampedSpeed };
    }
  }
}

// --- Hook ---

export function useSimulation(automaton: Automaton) {
  const [state, dispatch] = useReducer(simulationReducer, initialState);

  const simulation = currentSimulation(state);

  // Auto-step timer: schedules the next step when status is 'running'
  useEffect(() => {
    if (state.status !== 'running' || simulation === null) return;

    const timerId = setTimeout(() => {
      dispatch({ type: 'autoStep' });
    }, state.speed);

    return () => clearTimeout(timerId);
  }, [state.status, simulation, state.speed]);

  // Derived values
  const currentStateIds: Set<number> = simulation?.currentStates ?? new Set();
  const stepIndex: number = state.historyIndex;
  const consumedCount: number = simulation
    ? simulation.input.length - simulation.remainingInput.length
    : 0;
  const accepted: boolean | null =
    state.status === 'finished' && simulation
      ? engineIsAccepted(simulation)
      : null;

  // Every possible "next transition" — every (state, symbol → dest) edge
  // that will fire on the next step. For DFAs there's at most one; for
  // NFAs there can be 0..N (one per active state per matching dest).
  // Empty if the simulation is finished or every active branch has no
  // outgoing transition for the next symbol.
  const nextTransitions: ReadonlyArray<{
    fromStateId: number;
    toStateId: number;
    symbol: string;
  }> = (() => {
    if (simulation === null || engineIsFinished(simulation)) return [];
    if (simulation.currentStates.size === 0) return [];
    const nextSymbol = simulation.remainingInput[0]!;
    const result: Array<{ fromStateId: number; toStateId: number; symbol: string }> = [];
    for (const currentState of simulation.currentStates) {
      const transitions = getTransition(automaton, currentState, nextSymbol);
      for (const transition of transitions) {
        for (const dest of transition.to) {
          result.push({
            fromStateId: currentState,
            toStateId: dest,
            symbol: nextSymbol,
          });
        }
      }
    }
    return result;
  })();

  // Dying state IDs from the most recent step — drives the branch-death
  // pulse. Only populated immediately after a step that killed branches;
  // step-back returns to a previous step (which may or may not have its
  // own dying set from when it originally happened).
  const dyingStateIds: ReadonlySet<number> =
    simulation?.steps[simulation.steps.length - 1]?.dyingStateIds ?? new Set();

  // Edges that just fired (symbol-driven + ε-closure). Drives the per-
  // step edge pulse so the user sees which arrows were taken on this
  // step. Empty for the initial step unless ε-edges were followed to
  // reach the start active set.
  const firedTransitions: ReadonlyArray<{
    from: number;
    to: number;
    symbol: string | null;
  }> = simulation?.steps[simulation.steps.length - 1]?.firedTransitions ?? [];

  // Actions
  const initialize = useCallback(
    (input: string) => dispatch({ type: 'initialize', automaton, input }),
    [automaton]
  );
  const stepForward = useCallback(() => dispatch({ type: 'step' }), []);
  const stepBack = useCallback(() => dispatch({ type: 'stepBack' }), []);
  const jumpTo = useCallback(
    (index: number, input?: string) =>
      dispatch({ type: 'jumpTo', index, automaton, input }),
    [automaton]
  );
  const run = useCallback(() => dispatch({ type: 'run' }), []);
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  const setSpeed = useCallback(
    (speed: number) => dispatch({ type: 'setSpeed', speed }),
    []
  );

  return {
    // State
    simulation,
    status: state.status,
    speed: state.speed,
    historyIndex: state.historyIndex,
    canStepBack: state.historyIndex > 0 && state.status !== 'running',

    // Derived
    currentStateIds,
    stepIndex,
    consumedCount,
    accepted,
    nextTransitions,
    dyingStateIds,
    firedTransitions,

    // Actions
    initialize,
    stepForward,
    stepBack,
    jumpTo,
    run,
    pause,
    reset,
    setSpeed,
  };
}
