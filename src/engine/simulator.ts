/**
 * Simulation engine — DFA and NFA.
 *
 * Both are represented uniformly as a set of currently-active states.
 * For DFAs that set always has size 1; for NFAs it can be 0 (every
 * branch died), 1, or many (parallel exploration). The step function
 * advances the active set by the input symbol and re-applies ε-closure.
 *
 * Key functions:
 * - createSimulation(): Create a new simulation from automaton and input
 * - step(): Execute one transition (returns new Simulation)
 * - isFinished(): Check if simulation is complete
 * - isAccepted(): Check if simulation ended in an accept state
 * - runSimulation(): Run entire simulation to completion
 */

import type { Automaton, Simulation, SimulationStep } from './types';
import { isComplete, hasStartState } from './validator';
import { epsilonClosure } from './utils';

/**
 * Create a new simulation for the given automaton and input.
 *
 * Validation is intentionally narrow here — just enough to keep `step`
 * from crashing. DFAs additionally require completeness so a
 * mid-simulation "no transition" doesn't surprise the caller; NFAs
 * tolerate missing transitions because branches dying is part of the
 * model.
 *
 * The initial active set is the ε-closure of `{startState}` so any
 * states reachable "for free" via ε-transitions are live from step 0.
 *
 * @throws Error if the automaton is missing structural prerequisites.
 */
export function createSimulation(
  automaton: Automaton,
  input: string
): Simulation {
  if (automaton.alphabet.size === 0) {
    throw new Error('Automaton is not runnable (empty alphabet)');
  }
  if (!hasStartState(automaton)) {
    throw new Error('Automaton is not runnable (no start state)');
  }
  if (automaton.type === 'DFA' && !isComplete(automaton)) {
    throw new Error('Automaton is not runnable (DFA is incomplete)');
  }

  const initialStates = epsilonClosure(
    new Set([automaton.startState]),
    automaton.transitions
  );

  const initialStep: SimulationStep = {
    currentStates: initialStates,
    symbolProcessed: null,
    remainingInput: input,
  };

  return {
    automaton,
    currentStates: initialStates,
    remainingInput: input,
    steps: [initialStep],
    input,
  };
}

/**
 * Execute a single simulation step.
 *
 * For each currently-active state, follows every transition that matches
 * the next input symbol; the union of destinations is then ε-closed to
 * produce the new active set. For DFAs this collapses to "look up the
 * one transition and replace the active state."
 *
 * @throws Error if the simulation is finished or the symbol isn't in the alphabet.
 *         Also throws on a DFA dead-end (no transition for the current state's
 *         symbol) — DFA mode treats that as a structural error since
 *         createSimulation already gates on completeness. NFA mode lets the
 *         active set go empty instead.
 */
export function step(simulation: Simulation): Simulation {
  if (isFinished(simulation)) {
    throw new Error('Simulation is already finished (no remaining input)');
  }

  const { automaton, currentStates, remainingInput } = simulation;
  const symbol = remainingInput[0]!;
  const newRemainingInput = remainingInput.slice(1);

  if (!automaton.alphabet.has(symbol)) {
    throw new Error(`Symbol '${symbol}' is not in the alphabet`);
  }

  // Collect every state reachable from the current set on this symbol.
  // We don't dedupe transitions; the destination Set takes care of that.
  const intermediate = new Set<number>();
  for (const state of currentStates) {
    for (const transition of automaton.transitions) {
      if (transition.from !== state) continue;
      if (transition.symbol !== symbol) continue;
      for (const dest of transition.to) {
        intermediate.add(dest);
      }
    }
  }

  // DFA invariant: a complete DFA always has a transition. If we got
  // nothing, something's wrong with the automaton or the simulation
  // input — surface it loudly rather than silently rejecting.
  if (automaton.type === 'DFA' && intermediate.size === 0) {
    const fromState = Array.from(currentStates)[0];
    throw new Error(
      `No transition from state ${fromState ?? '(none active)'} on symbol '${symbol}'`
    );
  }

  // ε-closure expands the new active set with every state reachable
  // for free via ε-transitions. For DFAs (no ε edges) this is a no-op.
  const nextStates = epsilonClosure(intermediate, automaton.transitions);

  const newStep: SimulationStep = {
    currentStates: nextStates,
    symbolProcessed: symbol,
    remainingInput: newRemainingInput,
  };

  return {
    ...simulation,
    currentStates: nextStates,
    remainingInput: newRemainingInput,
    steps: [...simulation.steps, newStep],
  };
}

/**
 * Check if simulation is complete (no more input to process).
 */
export function isFinished(simulation: Simulation): boolean {
  return simulation.remainingInput.length === 0;
}

/**
 * Check if simulation ended in an accept state.
 *
 * Only meaningful when the simulation is finished. For NFAs this is
 * "any active state is an accept state" — the standard non-deterministic
 * acceptance criterion: if any branch lands in an accept state, the
 * input is accepted.
 */
export function isAccepted(simulation: Simulation): boolean {
  if (!isFinished(simulation)) {
    return false;
  }

  const { automaton, currentStates } = simulation;
  for (const state of currentStates) {
    if (automaton.acceptStates.has(state)) {
      return true;
    }
  }

  return false;
}

/**
 * Run the entire simulation to completion.
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
 * Check if the automaton accepts an input string.
 */
export function accepts(
  automaton: Automaton,
  input: string
): boolean {
  const simulation = runSimulation(automaton, input);
  return isAccepted(simulation);
}

/**
 * Get the final state(s) after processing input.
 *
 * Returns the full active set so NFA callers can inspect every branch.
 * DFA callers will always see a single-element Set.
 */
export function getFinalStates(
  automaton: Automaton,
  input: string
): Set<number> {
  const simulation = runSimulation(automaton, input);
  return simulation.currentStates;
}

/**
 * Get a human-readable trace of the execution.
 *
 * For DFAs, lines look like `Read '0': q0 → q1`. For NFAs (where each
 * step can have multiple active states) the lines render the active
 * set as `{q0, q1}` so the reader can see branches splitting and
 * dying.
 */
export function getExecutionTrace(simulation: Simulation): string[] {
  const trace: string[] = [];

  for (let i = 0; i < simulation.steps.length; i++) {
    const stepData = simulation.steps[i]!;
    const stateLabel = formatStateSet(stepData.currentStates);

    if (stepData.symbolProcessed === null) {
      trace.push(
        `Start: ${stateLabel} | Remaining: "${stepData.remainingInput}"`
      );
    } else {
      const prevLabel = formatStateSet(simulation.steps[i - 1]!.currentStates);
      trace.push(
        `Read '${stepData.symbolProcessed}': ${prevLabel} → ${stateLabel} | Remaining: "${stepData.remainingInput}"`
      );
    }
  }

  if (isFinished(simulation)) {
    trace.push(`Result: ${isAccepted(simulation) ? 'ACCEPTED' : 'REJECTED'}`);
  }

  return trace;
}

/** Render an active state set as `q0` (single) or `{q0, q1}` (multi/empty). */
function formatStateSet(states: Set<number>): string {
  if (states.size === 1) {
    const id = states.values().next().value!;
    return `q${id}`;
  }
  const ids = Array.from(states).sort((a, b) => a - b).map((id) => `q${id}`);
  return `{${ids.join(', ')}}`;
}
