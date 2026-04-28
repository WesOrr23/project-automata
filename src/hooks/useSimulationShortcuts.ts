/**
 * useSimulationShortcuts — keyboard bindings for the Simulate stage.
 *
 *   Space  → toggle play/pause (or replay if finished + has input)
 *   →      → step forward
 *   ←      → step back
 *
 * Scoped via useKeyboardScope so:
 *   - typing in the Input field doesn't fire Space-as-play
 *   - the onboarding tour (which also binds Space/←/→) takes
 *     precedence when it's open (it registers a `capture: true`
 *     scope above this one in the stack).
 *
 * Gated on `enabled` — caller passes `appMode === 'SIMULATING'` so
 * the keys are inert outside the simulate stage.
 */

import { useKeyboardScope } from './useKeyboardScope';

type UseSimulationShortcutsArgs = {
  enabled: boolean;
  /** True when the simulation is currently auto-running (so Space
   *  pauses); false when idle/paused/finished (so Space plays). */
  isRunning: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onStepBack: () => void;
};

export function useSimulationShortcuts({
  enabled,
  isRunning,
  onPlay,
  onPause,
  onStep,
  onStepBack,
}: UseSimulationShortcutsArgs): void {
  useKeyboardScope({
    id: 'simulation-shortcuts',
    active: enabled,
    capture: false,
    // Default text-input filter is on — typing into the input field
    // shouldn't trigger Space-as-play. (The Input field has no
    // arrow-key handlers of its own beyond cursor movement, so even
    // if a user presses ← while focused there, the cursor will move
    // and our handler won't fire — both desired.)
    inTextInputs: false,
    onKey: (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return false;
      if (event.key === ' ') {
        event.preventDefault();
        if (isRunning) onPause();
        else onPlay();
        return true;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onStep();
        return true;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onStepBack();
        return true;
      }
      return false;
    },
  });
}
