/**
 * DFA simulation engine
 *
 * Executes DFA on input strings and tracks execution history
 *
 * Key functions:
 * - createSimulation(): Create a new simulation from automaton and input
 * - step(): Execute one transition (returns new Simulation)
 * - isFinished(): Check if simulation is complete
 * - isAccepted(): Check if simulation ended in accept state
 * - runSimulation(): Run entire simulation to completion
 */

import type { Automaton, Simulation, SimulationStep } from './types';
import { getTransition } from './automaton';
import { isRunnable } from './validator';

/**
 * Create a new simulation for the given automaton and input
 *
 * @param automaton - The DFA to simulate
 * @param input - Input string to process
 * @returns A new Simulation ready to step through
 * @throws Error if automaton is not runnable or is NFA
 *
 * @example
 * const sim = createSimulation(dfa, '101');
 * while (!isFinished(sim)) {
 *   sim = step(sim);
 * }
 * console.log('Accepted:', isAccepted(sim));
 */
export function createSimulation(
  automaton: Automaton,
  input: string
): Simulation {
  // DFA type guard
  if (automaton.type === 'NFA') {
    throw new Error('NFA simulation not yet supported');
  }

  // Validate automaton is runnable
  if (!isRunnable(automaton)) {
    throw new Error('Automaton is not runnable (check with isRunnable())');
  }

  // Create initial step (before processing any input)
  const initialStep: SimulationStep = {
    currentState: automaton.startState,
    symbolProcessed: null,
    remainingInput: input,
  };

  return {
    automaton,
    currentStates: new Set([automaton.startState]),
    remainingInput: input,
    steps: [initialStep],
    input,
  };
}

/**
 * Execute a single simulation step
 *
 * Processes the next symbol from remainingInput and transitions to the next state
 *
 * @param simulation - The current simulation state
 * @returns A new Simulation with the next state
 * @throws Error if simulation is already finished or transition doesn't exist
 *
 * @example
 * let sim = createSimulation(dfa, '01');
 * sim = step(sim); // Process '0'
 * sim = step(sim); // Process '1'
 */
export function step(simulation: Simulation): Simulation {
  if (isFinished(simulation)) {
    throw new Error('Simulation is already finished (no remaining input)');
  }

  const { automaton, currentStates, remainingInput } = simulation;
  const symbol = remainingInput[0]!;
  const newRemainingInput = remainingInput.slice(1);

  // DFA: single current state
  const currentState = Array.from(currentStates)[0]!;

  // Validate symbol is in alphabet
  if (!automaton.alphabet.has(symbol)) {
    throw new Error(`Symbol '${symbol}' is not in the alphabet`);
  }

  // Find the transition for (currentState, symbol)
  const transitions = getTransition(automaton, currentState, symbol);

  if (transitions.length === 0) {
    throw new Error(
      `No transition from state ${currentState} on symbol '${symbol}'`
    );
  }

  // DFA has exactly one destination
  const transition = transitions[0]!;
  const nextState = Array.from(transition.to)[0]!;

  // Record this step
  const newStep: SimulationStep = {
    currentState: nextState,
    symbolProcessed: symbol,
    remainingInput: newRemainingInput,
  };

  return {
    ...simulation,
    currentStates: new Set([nextState]),
    remainingInput: newRemainingInput,
    steps: [...simulation.steps, newStep],
  };
}

/**
 * Check if simulation is complete (no more input to process)
 *
 * @param simulation - The simulation to check
 * @returns true if all input has been processed
 */
export function isFinished(simulation: Simulation): boolean {
  return simulation.remainingInput.length === 0;
}

/**
 * Check if simulation ended in an accept state
 *
 * Only meaningful if simulation is finished - will return false if
 * there's remaining input even if currently in an accept state
 *
 * @param simulation - The simulation to check
 * @returns true if finished AND current state is an accept state
 */
export function isAccepted(simulation: Simulation): boolean {
  if (!isFinished(simulation)) {
    return false;
  }

  const { automaton, currentStates } = simulation;

  // DFA: check if the single current state is an accept state
  for (const state of currentStates) {
    if (automaton.acceptStates.has(state)) {
      return true;
    }
  }

  return false;
}

/**
 * Run the entire simulation to completion
 *
 * Convenience function that creates a simulation and steps through
 * all input symbols
 *
 * @param automaton - The DFA to execute
 * @param input - Input string to process
 * @returns Completed Simulation with full execution history
 * @throws Error if automaton is invalid or input contains invalid symbols
 *
 * @example
 * const sim = runSimulation(dfa, '101');
 * console.log('Accepted:', isAccepted(sim));
 * console.log('Steps:', sim.steps);
 */
export function runSimulation(
  automaton: Automaton,
  input: string
): Simulation {
  let simulation = createSimulation(automaton, input);

  while (!isFinished(simulation)) {
    simulation = step(simulation);
  }

  return simulation;
}

/**
 * Check if the DFA accepts an input string
 * Convenience wrapper around runSimulation() + isAccepted()
 *
 * @param automaton - The DFA to execute
 * @param input - Input string to test
 * @returns true if input is accepted, false otherwise
 * @throws Error if automaton is invalid
 *
 * @example
 * if (accepts(dfa, '101')) {
 *   console.log('Input accepted!');
 * }
 */
export function accepts(
  automaton: Automaton,
  input: string
): boolean {
  const simulation = runSimulation(automaton, input);
  return isAccepted(simulation);
}

/**
 * Get the final state after processing input
 * Useful for testing or debugging
 *
 * @param automaton - The DFA to execute
 * @param input - Input string to process
 * @returns Final state ID after processing input
 * @throws Error if automaton is invalid
 *
 * @example
 * const finalState = getFinalState(dfa, '101');
 * console.log('Ended in state:', finalState);
 */
export function getFinalState(
  automaton: Automaton,
  input: string
): number {
  const simulation = runSimulation(automaton, input);
  // DFA: single current state
  return Array.from(simulation.currentStates)[0]!;
}

/**
 * Get a human-readable trace of the execution
 *
 * @param simulation - Simulation to trace (can be in-progress or finished)
 * @returns Array of strings describing each step
 *
 * @example
 * const sim = runSimulation(dfa, '101');
 * const trace = getExecutionTrace(sim);
 * trace.forEach(line => console.log(line));
 * // Output:
 * // Start: q0 | Remaining: "101"
 * // Read '1': q0 → q1 | Remaining: "01"
 * // Read '0': q1 → q2 | Remaining: "1"
 * // Read '1': q2 → q0 | Remaining: ""
 * // Result: REJECTED
 */
export function getExecutionTrace(simulation: Simulation): string[] {
  const trace: string[] = [];

  for (let i = 0; i < simulation.steps.length; i++) {
    const stepData = simulation.steps[i]!;

    if (stepData.symbolProcessed === null) {
      // Initial state
      trace.push(
        `Start: q${stepData.currentState} | Remaining: "${stepData.remainingInput}"`
      );
    } else {
      // Regular step
      const prevState = simulation.steps[i - 1]!.currentState;
      trace.push(
        `Read '${stepData.symbolProcessed}': q${prevState} → q${stepData.currentState} | Remaining: "${stepData.remainingInput}"`
      );
    }
  }

  // Add result if simulation is finished
  if (isFinished(simulation)) {
    trace.push(`Result: ${isAccepted(simulation) ? 'ACCEPTED' : 'REJECTED'}`);
  }

  return trace;
}
