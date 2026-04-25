/**
 * Simulation engine — DFA and NFA.
 *
 * Both are represented uniformly as a set of currently-active states.
 * For DFAs that set always has size 1; for NFAs it can be 0 (every
 * branch died), 1, or many (parallel exploration). The step function
 * advances the active set by the input symbol and re-applies ε-closure.
 *
 * Error handling: `createSimulation` and `step` are fallible — they
 * return `Result<Simulation>` rather than throwing. `runSimulation`,
 * `accepts`, and `getFinalStates` propagate the Result for callers that
 * want to handle structural failures gracefully.
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
import { epsilonClosureWithTrace } from './utils';
import { type Result, ok, err } from './result';

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
 * @returns ok(simulation) on success; on failure, one of:
 *   - 'automaton-not-runnable-empty-alphabet'
 *   - 'automaton-not-runnable-no-start-state'
 *   - 'automaton-not-runnable-incomplete-dfa'
 */
export function createSimulation(
  automaton: Automaton,
  input: string
): Result<Simulation> {
  if (automaton.alphabet.size === 0) {
    return err('automaton-not-runnable-empty-alphabet');
  }
  if (!hasStartState(automaton)) {
    return err('automaton-not-runnable-no-start-state');
  }
  if (automaton.type === 'DFA' && !isComplete(automaton)) {
    return err('automaton-not-runnable-incomplete-dfa');
  }

  // Initial active set is the ε-closure of {startState}. The traced
  // closure also records which ε-edges were followed so the canvas can
  // pulse them on the initial step (otherwise the user wouldn't know
  // those edges were taken to reach the starting active set).
  const { closure: initialStates, fired: initialFired } =
    epsilonClosureWithTrace(
      new Set([automaton.startState]),
      automaton.transitions
    );

  const initialStep: SimulationStep = {
    currentStates: initialStates,
    dyingStateIds: new Set(),
    firedTransitions: initialFired,
    symbolProcessed: null,
    remainingInput: input,
  };

  return ok({
    automaton,
    currentStates: initialStates,
    remainingInput: input,
    steps: [initialStep],
    input,
  });
}

/**
 * Execute a single simulation step.
 *
 * For each currently-active state, follows every transition that matches
 * the next input symbol; the union of destinations is then ε-closed to
 * produce the new active set. For DFAs this collapses to "look up the
 * one transition and replace the active state."
 *
 * @returns ok(simulation) on success; on failure, one of:
 *   - 'simulation-already-finished' if remainingInput is empty
 *   - 'symbol-not-in-alphabet' if the next symbol isn't in the alphabet
 *   - 'dfa-dead-end' if a complete DFA has no transition for the symbol
 *     from any active state. NFA mode lets the active set go empty
 *     instead — that's a normal outcome (every branch died) and not an
 *     error.
 */
export function step(simulation: Simulation): Result<Simulation> {
  if (isFinished(simulation)) {
    return err('simulation-already-finished');
  }

  const { automaton, currentStates, remainingInput } = simulation;
  const symbol = remainingInput[0]!;
  const newRemainingInput = remainingInput.slice(1);

  if (!automaton.alphabet.has(symbol)) {
    return err('symbol-not-in-alphabet');
  }

  // Collect every state reachable from the current set on this symbol,
  // tracking dying branches (no outgoing transition) and recording every
  // symbol-driven transition that fired (for the canvas's per-step pulse).
  const intermediate = new Set<number>();
  const dyingStateIds = new Set<number>();
  const firedTransitions: Array<{ from: number; to: number; symbol: string | null }> = [];
  for (const state of currentStates) {
    let hadAny = false;
    for (const transition of automaton.transitions) {
      if (transition.from !== state) continue;
      if (transition.symbol !== symbol) continue;
      hadAny = true;
      for (const dest of transition.to) {
        intermediate.add(dest);
        firedTransitions.push({ from: state, to: dest, symbol });
      }
    }
    if (!hadAny) dyingStateIds.add(state);
  }

  // DFA invariant: a complete DFA always has a transition. If we got
  // nothing, something's wrong with the automaton or the simulation
  // input — surface it as a typed error so the caller can decide
  // whether to halt the simulation, show a notification, etc.
  if (automaton.type === 'DFA' && intermediate.size === 0) {
    return err('dfa-dead-end');
  }

  // ε-closure expands the new active set with every state reachable
  // for free via ε-transitions. For DFAs (no ε edges) this is a no-op.
  // The traced variant also reports which ε-edges were followed so
  // they can pulse alongside the symbol-driven edges.
  const { closure: nextStates, fired: epsilonFired } = epsilonClosureWithTrace(
    intermediate,
    automaton.transitions
  );
  firedTransitions.push(...epsilonFired);

  // A state was provisionally "dying" if it had no outgoing transition
  // on the symbol — but if some OTHER active state's transition (or an
  // ε-closure) routes back into it, a fresh instance is alive and the
  // state isn't dying after all. Subtract the next active set from
  // dyingStateIds to keep the visual honest.
  for (const state of nextStates) {
    dyingStateIds.delete(state);
  }

  const newStep: SimulationStep = {
    currentStates: nextStates,
    dyingStateIds,
    firedTransitions,
    symbolProcessed: symbol,
    remainingInput: newRemainingInput,
  };

  return ok({
    ...simulation,
    currentStates: nextStates,
    remainingInput: newRemainingInput,
    steps: [...simulation.steps, newStep],
  });
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
 * Run the entire simulation to completion. Propagates any error from
 * `createSimulation` or `step` (e.g. an invalid symbol mid-input).
 */
export function runSimulation(
  automaton: Automaton,
  input: string
): Result<Simulation> {
  const initial = createSimulation(automaton, input);
  if (!initial.ok) return initial;
  let simulation = initial.value;

  while (!isFinished(simulation)) {
    const stepResult = step(simulation);
    if (!stepResult.ok) return stepResult;
    simulation = stepResult.value;
  }

  return ok(simulation);
}

/**
 * Check if the automaton accepts an input string.
 *
 * @returns ok(boolean) when the simulation completed; err(...) if the
 *          automaton or input is structurally invalid (empty alphabet,
 *          unknown symbol, etc.). Treating the error case as
 *          "not-accepted" would silently swallow real bugs — make the
 *          caller acknowledge the failure mode.
 */
export function accepts(
  automaton: Automaton,
  input: string
): Result<boolean> {
  const simulation = runSimulation(automaton, input);
  if (!simulation.ok) return simulation;
  return ok(isAccepted(simulation.value));
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
): Result<Set<number>> {
  const simulation = runSimulation(automaton, input);
  if (!simulation.ok) return simulation;
  return ok(simulation.value.currentStates);
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
