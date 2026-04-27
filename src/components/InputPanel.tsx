/**
 * InputPanel Component
 *
 * Text input for entering test strings with per-keystroke alphabet validation.
 * Always editable — modifying the input auto-resets the simulation.
 *
 * Includes a "Test batch" pill below the input that opens the
 * BatchTestModal — the companion surface for "I want to run 30
 * strings and see a table" instead of stepping through one at a time.
 */

import { ListChecks } from 'lucide-react';

type InputPanelProp = {
  /** The automaton's alphabet — used for input validation */
  alphabet: Set<string>;

  /** Controlled input value */
  input: string;

  /** Called when input changes (after filtering invalid characters) */
  onInputChange: (value: string) => void;

  /** Opens the batch-test modal. Optional so older callers / tests can
   *  omit it. */
  onOpenBatchTest?: () => void;
};

export function InputPanel({
  alphabet,
  input,
  onInputChange,
  onOpenBatchTest,
}: InputPanelProp) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const rawValue = event.target.value;
    const filteredValue = [...rawValue]
      .filter((character) => alphabet.has(character))
      .join('');
    onInputChange(filteredValue);
  }

  const alphabetDisplay = Array.from(alphabet).sort().join(', ');

  return (
    <div>
      <label
        htmlFor="simulation-input"
        className="label"
        style={{ display: 'block', marginBottom: 'var(--space-2)' }}
      >
        Input
      </label>

      <input
        id="simulation-input"
        type="text"
        className="glass-input"
        value={input}
        onChange={handleChange}
        placeholder={`Symbols: ${alphabetDisplay}`}
      />

      {onOpenBatchTest && (
        <div className="batch-test-trigger-row">
          <button
            type="button"
            className="batch-test-trigger"
            onClick={onOpenBatchTest}
            title="Run many input strings against the FA at once"
            aria-label="Open batch test"
          >
            <ListChecks size={12} />
            <span>Test batch</span>
          </button>
        </div>
      )}
    </div>
  );
}
