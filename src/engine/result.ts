/**
 * Result<T> — engine-layer error handling.
 *
 * Engine functions used to throw on invalid input (duplicate state, missing
 * source state, ε-edge in DFA mode, etc.). The UI then had to dance around
 * this — running the engine update once outside React's setState (to catch
 * the throw) and once inside (to actually commit) so that side effects like
 * notifications didn't fire twice under StrictMode.
 *
 * Result<T> replaces that with a discriminated-union return: every fallible
 * exported engine function returns `{ ok: true; value }` or
 * `{ ok: false; error }`. Callers branch on `result.ok`. No throws cross
 * the engine boundary anymore (with the exception of legitimately programmer-
 * fault contracts like `createAutomaton` rejecting an empty alphabet — those
 * stay as throws because they're not user-recoverable).
 *
 * Error variants are a *typed string-literal union* (EngineError) rather than
 * raw `string` so:
 *   - exhaustive switch checks at the UI boundary actually work
 *   - typo'd error tags fail at compile time
 *   - `errorMessage(error)` is a total function, not a partial map
 */

/**
 * Every error variant the engine layer can return.
 *
 * Adding a new error: add the variant here AND a case in `errorMessage`.
 * TypeScript will flag the missing case in `errorMessage` if you forget.
 */
export type EngineError =
  // Shared reference-existence errors
  | 'state-not-found'
  | 'symbol-not-in-alphabet'

  // automaton.ts
  | 'cannot-remove-only-state'
  | 'transition-already-exists'
  | 'epsilon-not-allowed-in-dfa'
  | 'multi-destination-not-allowed-in-dfa'
  | 'add-destination-not-allowed-in-dfa'
  | 'state-already-accept'
  | 'state-not-accept'

  // simulator.ts
  | 'simulation-already-finished'
  | 'dfa-dead-end'
  | 'automaton-not-runnable-empty-alphabet'
  | 'automaton-not-runnable-no-start-state'
  | 'automaton-not-runnable-incomplete-dfa'

  // files/format.ts
  | 'parse-invalid-json'
  | 'parse-wrong-kind'
  | 'parse-bad-version'
  | 'parse-malformed'
  | 'file-read-failed'
  | 'file-cancelled'

  // converter.ts (NFA → DFA)
  | 'conversion-requires-nfa'
  | 'conversion-empty-alphabet'
  | 'conversion-too-large'

  // minimizer.ts (Hopcroft)
  | 'minimize-requires-dfa'
  | 'minimize-incomplete-dfa';

/**
 * Discriminated-union result type. Use the `ok` and `err` constructors
 * below rather than building object literals by hand — keeps the call
 * sites tidy and makes the discriminant impossible to typo.
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: EngineError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

// `Result<never>` so the literal `err('...')` is assignable to any
// `Result<T>` — TypeScript widens `never` to whatever `T` is in context.
export const err = (error: EngineError): Result<never> => ({ ok: false, error });

/**
 * Map an EngineError variant to a human-readable message for the UI's
 * notification system. Total over EngineError — adding a new variant
 * without updating this switch is a compile error.
 *
 * Messages are written for end-users, not developers: no tag names, no
 * stack-trace flavor, no dynamic interpolation (the variant alone is
 * enough context for the static message). Where a variant could carry
 * a state ID or symbol, the engine produces the variant and the UI
 * supplies the specifics in surrounding copy if it cares.
 */
export function errorMessage(error: EngineError): string {
  switch (error) {
    case 'state-not-found':
      return 'State not found';
    case 'symbol-not-in-alphabet':
      return 'Symbol is not in the alphabet';
    case 'cannot-remove-only-state':
      return 'Cannot remove the last state';
    case 'transition-already-exists':
      return 'Transition already exists';
    case 'epsilon-not-allowed-in-dfa':
      return 'ε-transitions are only allowed in NFAs';
    case 'multi-destination-not-allowed-in-dfa':
      return 'DFAs allow only one destination per (state, symbol)';
    case 'add-destination-not-allowed-in-dfa':
      return 'Adding a parallel destination is only allowed in NFAs';
    case 'state-already-accept':
      return 'State is already an accept state';
    case 'state-not-accept':
      return 'State is not an accept state';
    case 'simulation-already-finished':
      return 'Simulation is already finished';
    case 'dfa-dead-end':
      return 'No transition for this symbol from current state';
    case 'automaton-not-runnable-empty-alphabet':
      return 'Automaton has an empty alphabet';
    case 'automaton-not-runnable-no-start-state':
      return 'Automaton has no start state';
    case 'automaton-not-runnable-incomplete-dfa':
      return 'DFA is incomplete — add the missing transitions to simulate';
    case 'parse-invalid-json':
      return 'File is not valid JSON';
    case 'parse-wrong-kind':
      return 'File is not a Project Automata save file';
    case 'parse-bad-version':
      return 'File was saved by a newer version of Project Automata';
    case 'parse-malformed':
      return 'File is missing required fields or has invalid values';
    case 'file-read-failed':
      return 'Could not read the file';
    case 'file-cancelled':
      return 'File operation cancelled';
    case 'conversion-requires-nfa':
      return 'Conversion requires an NFA — this automaton is already a DFA';
    case 'conversion-empty-alphabet':
      return 'Cannot convert: alphabet is empty';
    case 'conversion-too-large':
      return 'Conversion produced more states than the safety cap allows';
    case 'minimize-requires-dfa':
      return 'Minimization requires a DFA';
    case 'minimize-incomplete-dfa':
      return 'Cannot minimize: DFA is incomplete (missing transitions)';
  }
}
