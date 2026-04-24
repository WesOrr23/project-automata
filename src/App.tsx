import { useState, useEffect, useRef } from 'react';
import {
  createAutomaton,
  addState,
  removeState,
  addTransition,
  removeTransition,
  setStartState,
  addAcceptState,
  removeAcceptState,
} from './engine/automaton';
import { isRunnable, getValidationReport } from './engine/validator';
import { Automaton } from './engine/types';
import { AutomatonUI, computeDisplayLabels } from './ui-state/types';
import { AutomatonCanvas } from './components/AutomatonCanvas';
import { InputPanel } from './components/InputPanel';
import { SimulationControls } from './components/SimulationControls';
import { ToolMenu } from './components/toolMenu/ToolMenu';
import { ConfigPanel } from './components/toolMenu/ConfigPanel';
import { EditPanel } from './components/toolMenu/EditPanel';
import { ToolMenuState, ToolTabID } from './components/toolMenu/types';
import { NotificationStack } from './notifications/NotificationStack';
import { useNotifications } from './notifications/useNotifications';
import type { NotificationTarget } from './notifications/types';
import { computeLayout } from './ui-state/utils';
import { useSimulation } from './hooks/useSimulation';

/**
 * Build the sample DFA that accepts binary strings ending in "01"
 */
function buildSampleDFA(): Automaton {
  let dfa = createAutomaton('DFA', new Set(['0', '1']));

  let state1: number;
  ({ automaton: dfa, stateId: state1 } = addState(dfa));

  let state2: number;
  ({ automaton: dfa, stateId: state2 } = addState(dfa));

  dfa = addAcceptState(dfa, state2);

  dfa = addTransition(dfa, 0, new Set([state1]), '0');
  dfa = addTransition(dfa, 0, new Set([0]), '1');
  dfa = addTransition(dfa, state1, new Set([state1]), '0');
  dfa = addTransition(dfa, state1, new Set([state2]), '1');
  dfa = addTransition(dfa, state2, new Set([state1]), '0');
  dfa = addTransition(dfa, state2, new Set([0]), '1');

  return dfa;
}

function App() {
  const [automaton, setAutomaton] = useState<Automaton>(() => buildSampleDFA());
  const [automatonUI, setAutomatonUI] = useState<AutomatonUI | null>(null);
  const [inputString, setInputString] = useState('');
  const [menuState, setMenuState] = useState<ToolMenuState>({ mode: 'COLLAPSED' });

  const sim = useSimulation(automaton);
  const { highlightedTarget, notify } = useNotifications();

  // Derive per-component highlight props from the active notification target.
  // Each component only cares about one kind of target; everything else stays
  // null so React can early-bail on equality.
  const highlightedStateId =
    highlightedTarget?.kind === 'state' ? highlightedTarget.stateId : null;
  const highlightedTransition =
    highlightedTarget?.kind === 'transition'
      ? {
          from: highlightedTarget.from,
          to: highlightedTarget.to,
          symbol: highlightedTarget.symbol,
        }
      : null;
  const highlightedSymbol =
    highlightedTarget?.kind === 'alphabet' ? highlightedTarget.symbol : null;

  // Recompute layout whenever automaton changes (debounced to absorb rapid edits).
  // A version counter discards stale promises in case layout N-1 resolves after N.
  // After layout, we rewrite each state's label to the sequential display label
  // so the canvas and the tool menu stay consistent.
  const layoutVersionRef = useRef(0);
  useEffect(() => {
    const version = ++layoutVersionRef.current;
    const timer = setTimeout(() => {
      computeLayout(automaton).then((layout) => {
        if (version !== layoutVersionRef.current) return;
        const labels = computeDisplayLabels(automaton.states);
        const relabeled: AutomatonUI = {
          ...layout,
          states: new Map(
            Array.from(layout.states.entries()).map(([id, stateUI]) => [
              id,
              { ...stateUI, label: labels.get(id) ?? stateUI.label },
            ])
          ),
        };
        setAutomatonUI(relabeled);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [automaton]);

  // Reset simulation when the automaton structure changes (skip initial mount).
  // Input string is kept; we filter it against the current alphabet separately
  // so the user doesn't lose their test string just because they edited a state.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    sim.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automaton]);

  // If the alphabet changed (e.g. a symbol used in the input was removed),
  // filter the input string to only contain characters still in the alphabet.
  useEffect(() => {
    setInputString((previous) =>
      [...previous].filter((ch) => automaton.alphabet.has(ch)).join('')
    );
  }, [automaton.alphabet]);

  // Derived application mode from the active tab. Used to gate visual
  // simulation effects (highlights) — NOT to trigger resets.
  const appMode: 'IDLE' | 'EDITING' | 'SIMULATING' =
    menuState.mode === 'OPEN'
      ? (menuState.activeTab === 'EDIT'
          ? 'EDITING'
          : menuState.activeTab === 'SIMULATE'
            ? 'SIMULATING'
            : 'IDLE')
      : 'IDLE';

  // Display labels are sequential (q0, q1, q2) regardless of underlying IDs.
  // This detaches stable engine identity from user-visible numbering.
  const displayLabels = computeDisplayLabels(automaton.states);

  // ─── Menu state transitions ───

  function handleHoverEnter() {
    setMenuState((current) => (current.mode === 'COLLAPSED' ? { mode: 'EXPANDED' } : current));
  }

  function handleHoverLeave() {
    setMenuState((current) => (current.mode === 'EXPANDED' ? { mode: 'COLLAPSED' } : current));
  }

  function handleTabClick(tab: ToolTabID) {
    setMenuState({ mode: 'OPEN', activeTab: tab });
  }

  function handleCollapse() {
    setMenuState({ mode: 'COLLAPSED' });
  }

  // ─── Config handlers ───

  function handleTypeChange(type: 'DFA' | 'NFA') {
    setAutomaton((prev) => ({ ...prev, type }));
  }

  function handleAlphabetAdd(symbol: string) {
    setAutomaton((prev) => ({
      ...prev,
      alphabet: new Set([...prev.alphabet, symbol]),
    }));
  }

  function handleAlphabetRemove(symbol: string) {
    setAutomaton((prev) => {
      if (prev.alphabet.size <= 1) return prev;
      const newAlphabet = new Set(prev.alphabet);
      newAlphabet.delete(symbol);
      // Cascade: drop transitions that referenced the removed symbol
      const newTransitions = prev.transitions.filter((t) => t.symbol !== symbol);
      return { ...prev, alphabet: newAlphabet, transitions: newTransitions };
    });
  }

  function handleExportJSON() {
    const serializable = {
      type: automaton.type,
      states: Array.from(automaton.states).sort((a, b) => a - b),
      alphabet: Array.from(automaton.alphabet).sort(),
      transitions: automaton.transitions.map((t) => ({
        from: t.from,
        to: Array.from(t.to).sort((a, b) => a - b),
        symbol: t.symbol,
      })),
      startState: automaton.startState,
      acceptStates: Array.from(automaton.acceptStates).sort((a, b) => a - b),
      nextStateId: automaton.nextStateId,
    };
    const json = JSON.stringify(serializable, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'automaton.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  // ─── Edit handlers ───
  //
  // Each of these uses the functional updater form `setAutomaton(prev => ...)`
  // so rapid successive clicks see the latest automaton state rather than a
  // stale closure. Errors thrown by engine functions are routed to the global
  // notification system via notify().

  function applyEdit(
    update: (current: Automaton) => Automaton,
    targetOnError?: NotificationTarget
  ) {
    // Pre-check against the current snapshot so any error throws *outside*
    // of React's state updater (state updaters must be pure — calling notify()
    // inside one fires twice under StrictMode).
    try {
      update(automaton);
    } catch (error) {
      notify({
        severity: 'error',
        title: (error as Error).message,
        target: targetOnError,
      });
      return;
    }
    // Commit via functional updater so rapid successive clicks all see the
    // latest state.
    setAutomaton((previous) => update(previous));
  }

  function handleAddState() {
    applyEdit((prev) => addState(prev).automaton);
  }

  function handleRemoveState(stateId: number) {
    applyEdit((prev) => removeState(prev, stateId));
  }

  function handleSetStartState(stateId: number) {
    applyEdit((prev) => setStartState(prev, stateId));
  }

  function handleToggleAcceptState(stateId: number) {
    applyEdit((prev) =>
      prev.acceptStates.has(stateId)
        ? removeAcceptState(prev, stateId)
        : addAcceptState(prev, stateId)
    );
  }

  function handleAddTransition(from: number, to: number, symbol: string) {
    // addTransition throws on duplicates and invalid args. The duplicate case
    // is the most useful one to highlight — point the user at the existing
    // conflicting transition (same from + symbol).
    const existing = automaton.transitions.find(
      (transition) => transition.from === from && transition.symbol === symbol
    );
    const target: NotificationTarget | undefined = existing
      ? {
          kind: 'transition',
          from: existing.from,
          to: Array.from(existing.to)[0] ?? to,
          symbol: existing.symbol,
        }
      : undefined;
    applyEdit((prev) => addTransition(prev, from, new Set([to]), symbol), target);
  }

  function handleRemoveTransition(from: number, to: number, symbol: string | null) {
    applyEdit((prev) => removeTransition(prev, from, new Set([to]), symbol));
  }

  // ─── Simulation handlers ───

  function handleInputChange(value: string) {
    if (sim.simulation !== null) {
      sim.reset();
    }
    setInputString(value);
  }

  function ensureInitialized(): boolean {
    if (inputString.length === 0) return false;
    if (sim.simulation === null || sim.status === 'finished') {
      sim.initialize(inputString);
    }
    return true;
  }

  function handleStep() {
    if (sim.simulation === null || sim.status === 'finished') {
      if (!ensureInitialized()) return;
      return;
    }
    sim.stepForward();
  }

  function handlePlay() {
    if (sim.simulation === null || sim.status === 'finished') {
      if (!ensureInitialized()) return;
    }
    sim.run();
  }

  function handleJumpTo(characterIndex: number) {
    if (inputString.length === 0) return;
    sim.jumpTo(characterIndex, inputString);
  }

  const resultStatus: 'accepted' | 'rejected' | null =
    sim.status === 'finished' && sim.accepted !== null
      ? (sim.accepted ? 'accepted' : 'rejected')
      : null;

  // ─── Panel content ───

  const configContent = (
    <ConfigPanel
      automatonType={automaton.type}
      onTypeChange={handleTypeChange}
      onExportJSON={handleExportJSON}
    />
  );

  const editContent = (
    <EditPanel
      automaton={automaton}
      displayLabels={displayLabels}
      highlightedStateId={highlightedStateId}
      highlightedTransition={highlightedTransition}
      highlightedSymbol={highlightedSymbol}
      onAlphabetAdd={handleAlphabetAdd}
      onAlphabetRemove={handleAlphabetRemove}
      onAddState={handleAddState}
      onRemoveState={handleRemoveState}
      onSetStartState={handleSetStartState}
      onToggleAcceptState={handleToggleAcceptState}
      onAddTransition={handleAddTransition}
      onRemoveTransition={handleRemoveTransition}
    />
  );

  // Simulate content: gate on validation
  const runnable = isRunnable(automaton);
  const simulateContent = runnable ? (
    <>
      <InputPanel
        alphabet={automaton.alphabet}
        input={inputString}
        onInputChange={handleInputChange}
      />
      <SimulationControls
        status={sim.status}
        hasSimulation={sim.simulation !== null}
        hasInput={inputString.length > 0}
        accepted={sim.accepted}
        speed={sim.speed}
        input={inputString}
        consumedCount={sim.consumedCount}
        onStep={handleStep}
        onPlay={handlePlay}
        onPause={sim.pause}
        onStepBack={sim.stepBack}
        canStepBack={sim.canStepBack}
        onSpeedChange={sim.setSpeed}
        onJumpTo={handleJumpTo}
      />
    </>
  ) : (
    <ValidationView automaton={automaton} />
  );

  return (
    <>
      <ToolMenu
        state={menuState}
        onHoverEvent={handleHoverEnter}
        onHoverLeave={handleHoverLeave}
        onTabClick={handleTabClick}
        onCollapse={handleCollapse}
        configContent={configContent}
        editContent={editContent}
        simulateContent={simulateContent}
      />

      <NotificationStack />

      <main className="canvas-area">
        {automatonUI === null ? (
          <p className="caption">Loading...</p>
        ) : (
          <AutomatonCanvas
            automaton={automaton}
            automatonUI={automatonUI}
            activeStateIds={appMode === 'SIMULATING' ? sim.currentStateIds : undefined}
            resultStatus={appMode === 'SIMULATING' ? resultStatus : null}
            nextTransition={appMode === 'SIMULATING' ? sim.nextTransition : null}
            highlightedStateId={highlightedStateId}
            highlightedTransition={highlightedTransition}
          />
        )}
      </main>
    </>
  );
}

/**
 * Shows validation problems that prevent simulation (e.g. incomplete DFA).
 */
function ValidationView({ automaton }: { automaton: Automaton }) {
  const report = getValidationReport(automaton);
  return (
    <>
      <p className="caption">
        This automaton isn't ready to simulate. Fix the issues below in the Edit tab.
      </p>
      {report.errors.map((message, index) => (
        <div key={`error-${index}`} className="editor-validation-banner">
          {message}
        </div>
      ))}
      {report.warnings.map((message, index) => (
        <div key={`warning-${index}`} className="editor-validation-banner warning">
          {message}
        </div>
      ))}
    </>
  );
}

export default App
