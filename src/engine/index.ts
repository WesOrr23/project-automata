/**
 * Project Automata - Engine Layer
 *
 * Public API for the automaton engine
 * Import from here rather than individual files
 *
 * @example
 * import { createAutomaton, addState, runSimulation, isAccepted } from './engine';
 */

// Type definitions
export type { Automaton, Transition, SimulationStep, Simulation } from './types';

// Automaton operations (CRUD)
export {
  createAutomaton,
  addState,
  removeState,
  addTransition,
  addTransitionDestination,
  removeTransition,
  removeTransitionDestination,
  setStartState,
  addAcceptState,
  removeAcceptState,
  getTransitionsFrom,
  getTransition,
} from './automaton';

// Validation predicates
export {
  isDFA,
  isComplete,
  hasStartState,
  hasAcceptStates,
  isRunnable,
  getOrphanedStates,
  getValidationReport,
} from './validator';

// Simulation functions
export {
  createSimulation,
  step,
  isFinished,
  isAccepted,
  runSimulation,
  accepts,
  getFinalStates,
  getExecutionTrace,
} from './simulator';

// Engine utilities
export { epsilonClosure } from './utils';
