/**
 * Tests for the simulation reducer (useSimulation hook)
 *
 * Tests the pure reducer function directly without React.
 * This verifies all state machine transitions and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  createAutomaton,
  addState,
  addTransition,
  addAcceptState,
} from '../engine/automaton';
import { isAccepted as engineIsAccepted } from '../engine/simulator';
import { Simulation } from '../engine/types';
import type { Result } from '../engine/result';

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got err: ${result.error}`);
  return result.value;
}
import {
  simulationReducer,
  initialState,
  SimulationState,
  SIMULATION_HISTORY_CAP,
} from './useSimulation';

// Helper: Create a simple DFA that accepts strings ending in "01"
// Same as the one in simulator.test.ts for consistency
function createEndsWith01DFA() {
  let dfa = createAutomaton('DFA', new Set(['0', '1']));

  const { automaton: dfa1, stateId: state1 } = addState(dfa);
  const { automaton: dfa2, stateId: state2 } = addState(dfa1);

  dfa = expectOk(addAcceptState(dfa2, state2));

  dfa = expectOk(addTransition(dfa, 0, new Set([state1]), '0'));
  dfa = expectOk(addTransition(dfa, 0, new Set([0]), '1'));
  dfa = expectOk(addTransition(dfa, state1, new Set([state1]), '0'));
  dfa = expectOk(addTransition(dfa, state1, new Set([state2]), '1'));
  dfa = expectOk(addTransition(dfa, state2, new Set([state1]), '0'));
  dfa = expectOk(addTransition(dfa, state2, new Set([0]), '1'));

  return { dfa, q0: 0, q1: state1, q2: state2 };
}

/** Get the current simulation from reducer state */
function getSimulation(state: SimulationState): Simulation | null {
  if (state.historyIndex < 0 || state.history.length === 0) return null;
  return state.history[state.historyIndex]!;
}

describe('simulationReducer', () => {
  describe('initialize', () => {
    it('creates a simulation and sets status to idle', () => {
      const { dfa } = createEndsWith01DFA();

      const state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });

      const simulation = getSimulation(state);
      expect(simulation).not.toBeNull();
      expect(state.status).toBe('idle');
      expect(simulation!.input).toBe('01');
      expect(simulation!.remainingInput).toBe('01');
    });

    it('sets status to finished for empty input', () => {
      const { dfa } = createEndsWith01DFA();

      const state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '',
      });

      expect(getSimulation(state)).not.toBeNull();
      expect(state.status).toBe('finished');
    });

    it('resets a running simulation when re-initialized', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '0101',
      });
      state = simulationReducer(state, { type: 'run' });
      expect(state.status).toBe('running');

      state = simulationReducer(state, {
        type: 'initialize',
        automaton: dfa,
        input: '10',
      });

      expect(state.status).toBe('idle');
      expect(getSimulation(state)!.input).toBe('10');
    });
  });

  describe('step', () => {
    it('advances simulation by one symbol', () => {
      const { dfa, q1 } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });

      state = simulationReducer(state, { type: 'step' });

      const simulation = getSimulation(state)!;
      expect(simulation.remainingInput).toBe('1');
      expect(simulation.currentStates).toEqual(new Set([q1]));
      expect(state.status).toBe('idle');
    });

    it('sets status to finished when input is exhausted', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '0',
      });

      state = simulationReducer(state, { type: 'step' });

      expect(getSimulation(state)!.remainingInput).toBe('');
      expect(state.status).toBe('finished');
    });

    it('is a no-op when simulation is null', () => {
      const state = simulationReducer(initialState, { type: 'step' });
      expect(state).toBe(initialState);
    });

    it('is a no-op when status is finished', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '0',
      });
      state = simulationReducer(state, { type: 'step' });
      expect(state.status).toBe('finished');

      const stateAfterStep = simulationReducer(state, { type: 'step' });
      expect(stateAfterStep).toBe(state);
    });

    it('is a no-op when status is running', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });

      const stateAfterStep = simulationReducer(state, { type: 'step' });
      expect(stateAfterStep).toBe(state);
    });

    it('preserves paused status when stepping while paused', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });
      state = simulationReducer(state, { type: 'pause' });
      expect(state.status).toBe('paused');

      state = simulationReducer(state, { type: 'step' });
      expect(state.status).toBe('paused');
      expect(getSimulation(state)!.remainingInput).toBe('1');
    });
  });

  describe('stepBack', () => {
    it('goes back one step in history', () => {
      const { dfa, q0, q1 } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q0]));

      state = simulationReducer(state, { type: 'step' });
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q1]));

      state = simulationReducer(state, { type: 'stepBack' });
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q0]));
      expect(state.status).toBe('idle');
    });

    it('is a no-op at the beginning of history', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });

      const stateAfterBack = simulationReducer(state, { type: 'stepBack' });
      expect(stateAfterBack).toBe(state);
    });

    it('is a no-op when running', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });
      state = simulationReducer(state, { type: 'autoStep' });

      const stateAfterBack = simulationReducer(state, { type: 'stepBack' });
      expect(stateAfterBack).toBe(state);
    });

    it('transitions from finished to idle when stepping back', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '0',
      });
      state = simulationReducer(state, { type: 'step' });
      expect(state.status).toBe('finished');

      state = simulationReducer(state, { type: 'stepBack' });
      expect(state.status).toBe('idle');
    });

    it('preserves paused status when stepping back', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });
      state = simulationReducer(state, { type: 'autoStep' });
      state = simulationReducer(state, { type: 'pause' });

      state = simulationReducer(state, { type: 'stepBack' });
      expect(state.status).toBe('paused');
    });

    it('stepping forward after back truncates forward history', () => {
      const { dfa, q0, q1 } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });

      // Step forward twice
      state = simulationReducer(state, { type: 'step' });
      state = simulationReducer(state, { type: 'step' });
      expect(state.history.length).toBe(3); // initial + 2 steps

      // Step back once
      state = simulationReducer(state, { type: 'stepBack' });
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q1]));

      // Step back again
      state = simulationReducer(state, { type: 'stepBack' });
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q0]));

      // Step forward — should truncate the old forward history
      state = simulationReducer(state, { type: 'step' });
      expect(state.history.length).toBe(2); // initial + 1 new step
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q1]));
    });
  });

  describe('autoStep', () => {
    it('advances simulation during running status', () => {
      const { dfa, q1 } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });

      state = simulationReducer(state, { type: 'autoStep' });

      const simulation = getSimulation(state)!;
      expect(simulation.remainingInput).toBe('1');
      expect(simulation.currentStates).toEqual(new Set([q1]));
      expect(state.status).toBe('running');
    });

    it('transitions to finished when input is exhausted', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '0',
      });
      state = simulationReducer(state, { type: 'run' });

      state = simulationReducer(state, { type: 'autoStep' });

      expect(state.status).toBe('finished');
    });

    it('is a no-op when status is not running', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });

      const stateAfterAutoStep = simulationReducer(state, { type: 'autoStep' });
      expect(stateAfterAutoStep).toBe(state);
    });
  });

  describe('run', () => {
    it('sets status to running', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });

      state = simulationReducer(state, { type: 'run' });
      expect(state.status).toBe('running');
    });

    it('can resume from paused', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });
      state = simulationReducer(state, { type: 'pause' });

      state = simulationReducer(state, { type: 'run' });
      expect(state.status).toBe('running');
    });

    it('is a no-op when simulation is null', () => {
      const state = simulationReducer(initialState, { type: 'run' });
      expect(state).toBe(initialState);
    });

    it('is a no-op when status is finished', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '0',
      });
      state = simulationReducer(state, { type: 'step' });
      expect(state.status).toBe('finished');

      const stateAfterRun = simulationReducer(state, { type: 'run' });
      expect(stateAfterRun).toBe(state);
    });
  });

  describe('pause', () => {
    it('pauses a running simulation', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });

      state = simulationReducer(state, { type: 'pause' });
      expect(state.status).toBe('paused');
    });

    it('is a no-op when not running', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });

      const stateAfterPause = simulationReducer(state, { type: 'pause' });
      expect(stateAfterPause).toBe(state);
    });
  });

  describe('reset', () => {
    it('clears simulation and sets status to idle', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'step' });

      state = simulationReducer(state, { type: 'reset' });

      expect(getSimulation(state)).toBeNull();
      expect(state.status).toBe('idle');
    });

    it('resets from running status', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });

      state = simulationReducer(state, { type: 'reset' });

      expect(getSimulation(state)).toBeNull();
      expect(state.status).toBe('idle');
    });

    it('preserves speed setting', () => {
      let state = simulationReducer(initialState, {
        type: 'setSpeed',
        speed: 200,
      });

      state = simulationReducer(state, { type: 'reset' });
      expect(state.speed).toBe(200);
    });
  });

  describe('setSpeed', () => {
    it('updates speed', () => {
      const state = simulationReducer(initialState, {
        type: 'setSpeed',
        speed: 300,
      });

      expect(state.speed).toBe(300);
    });

    it('clamps speed to minimum', () => {
      const state = simulationReducer(initialState, {
        type: 'setSpeed',
        speed: 10,
      });

      expect(state.speed).toBe(200);
    });

    it('clamps speed to maximum', () => {
      const state = simulationReducer(initialState, {
        type: 'setSpeed',
        speed: 5000,
      });

      expect(state.speed).toBe(3000);
    });
  });

  describe('history cap', () => {
    it('refuses to advance past SIMULATION_HISTORY_CAP via step', () => {
      const { dfa } = createEndsWith01DFA();
      const longInput = '0'.repeat(SIMULATION_HISTORY_CAP + 50);

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: longInput,
      });

      // Step until we hit the cap.
      for (let i = 0; i < SIMULATION_HISTORY_CAP + 10; i++) {
        state = simulationReducer(state, { type: 'step' });
      }

      // History never exceeds the cap.
      expect(state.history.length).toBe(SIMULATION_HISTORY_CAP);
      // We are not finished — input is still remaining.
      expect(getSimulation(state)!.remainingInput.length).toBeGreaterThan(0);
      // Further step is a no-op.
      const stateAfterExtraStep = simulationReducer(state, { type: 'step' });
      expect(stateAfterExtraStep).toBe(state);
    });

    it('autoStep transitions to paused when the cap is hit', () => {
      const { dfa } = createEndsWith01DFA();
      const longInput = '0'.repeat(SIMULATION_HISTORY_CAP + 50);

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: longInput,
      });
      state = simulationReducer(state, { type: 'run' });

      // Drive the auto-step loop until the cap halts it.
      for (let i = 0; i < SIMULATION_HISTORY_CAP + 5; i++) {
        state = simulationReducer(state, { type: 'autoStep' });
        if (state.status !== 'running') break;
      }

      expect(state.history.length).toBe(SIMULATION_HISTORY_CAP);
      expect(state.status).toBe('paused');
    });

    it('stepBack still works at the cap', () => {
      const { dfa } = createEndsWith01DFA();
      const longInput = '0'.repeat(SIMULATION_HISTORY_CAP + 50);

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: longInput,
      });
      for (let i = 0; i < SIMULATION_HISTORY_CAP; i++) {
        state = simulationReducer(state, { type: 'step' });
      }
      expect(state.history.length).toBe(SIMULATION_HISTORY_CAP);

      const indexBefore = state.historyIndex;
      state = simulationReducer(state, { type: 'stepBack' });
      expect(state.historyIndex).toBe(indexBefore - 1);
    });

    it('reset clears the cap so stepping resumes', () => {
      const { dfa } = createEndsWith01DFA();
      const longInput = '0'.repeat(SIMULATION_HISTORY_CAP + 50);

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: longInput,
      });
      for (let i = 0; i < SIMULATION_HISTORY_CAP + 5; i++) {
        state = simulationReducer(state, { type: 'step' });
      }
      expect(state.history.length).toBe(SIMULATION_HISTORY_CAP);

      state = simulationReducer(state, { type: 'reset' });
      state = simulationReducer(state, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'step' });
      expect(state.history.length).toBe(2);
    });
  });

  describe('full simulation walkthrough', () => {
    it('correctly simulates accepting string "01"', () => {
      const { dfa, q0, q1, q2 } = createEndsWith01DFA();

      // Initialize
      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q0]));

      // Step 1: process '0' → q0 to q1
      state = simulationReducer(state, { type: 'step' });
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q1]));
      expect(state.status).toBe('idle');

      // Step 2: process '1' → q1 to q2 (accept)
      state = simulationReducer(state, { type: 'step' });
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q2]));
      expect(state.status).toBe('finished');

      // Verify accepted
      expect(engineIsAccepted(getSimulation(state)!)).toBe(true);
    });

    it('correctly simulates rejecting string "10"', () => {
      const { dfa } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '10',
      });

      // Step through both symbols
      state = simulationReducer(state, { type: 'step' });
      state = simulationReducer(state, { type: 'step' });

      expect(state.status).toBe('finished');
      expect(engineIsAccepted(getSimulation(state)!)).toBe(false);
    });

    it('simulates full auto-step run', () => {
      const { dfa, q2 } = createEndsWith01DFA();

      let state = simulationReducer(initialState, {
        type: 'initialize',
        automaton: dfa,
        input: '01',
      });
      state = simulationReducer(state, { type: 'run' });

      // Auto-step 1
      state = simulationReducer(state, { type: 'autoStep' });
      expect(state.status).toBe('running');

      // Auto-step 2
      state = simulationReducer(state, { type: 'autoStep' });
      expect(state.status).toBe('finished');
      expect(getSimulation(state)!.currentStates).toEqual(new Set([q2]));
    });
  });
});
