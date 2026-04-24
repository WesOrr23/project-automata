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
import { AutomatonUI } from './ui-state/types';
import { AutomatonCanvas } from './components/AutomatonCanvas';
import { InputPanel } from './components/InputPanel';
import { SimulationControls } from './components/SimulationControls';
import { ToolMenu } from './components/toolMenu/ToolMenu';
import { ConfigPanel } from './components/toolMenu/ConfigPanel';
import { EditPanel } from './components/toolMenu/EditPanel';
import { ToolMenuState, ToolTabID } from './components/toolMenu/types';
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
  const [editError, setEditError] = useState<string | null>(null);

  const sim = useSimulation(automaton);

  // Recompute layout whenever automaton changes (debounced to absorb rapid edits)
  useEffect(() => {
    const timer = setTimeout(() => {
      computeLayout(automaton).then(setAutomatonUI);
    }, 120);
    return () => clearTimeout(timer);
  }, [automaton]);

  // Reset simulation when the automaton structure changes (skip initial mount)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    sim.reset();
    setInputString('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automaton]);

  // Also reset simulation whenever user enters the Edit tab
  const previousAppMode = useRef<'IDLE' | 'EDITING' | 'SIMULATING'>('IDLE');

  // Derived application mode from the active tab
  const appMode: 'IDLE' | 'EDITING' | 'SIMULATING' =
    menuState.mode === 'OPEN'
      ? (menuState.activeTab === 'EDIT'
          ? 'EDITING'
          : menuState.activeTab === 'SIMULATE'
            ? 'SIMULATING'
            : 'IDLE')
      : 'IDLE';

  // Entering Edit mode resets the simulation (mode exclusivity with Simulate)
  useEffect(() => {
    const prev = previousAppMode.current;
    previousAppMode.current = appMode;
    if (prev !== 'EDITING' && appMode === 'EDITING') {
      sim.reset();
      setInputString('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode]);

  // ─── Menu state transitions ───

  function handleHoverEnter() {
    setMenuState((current) => (current.mode === 'COLLAPSED' ? { mode: 'EXPANDED' } : current));
  }

  function handleHoverLeave() {
    setMenuState((current) => (current.mode === 'EXPANDED' ? { mode: 'COLLAPSED' } : current));
  }

  function handleTabClick(tab: ToolTabID) {
    setEditError(null);
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

  function runEdit(fn: () => Automaton) {
    try {
      const next = fn();
      setAutomaton(next);
      setEditError(null);
    } catch (error) {
      setEditError((error as Error).message);
    }
  }

  function handleAddState() {
    runEdit(() => addState(automaton).automaton);
  }

  function handleRemoveState(stateId: number) {
    runEdit(() => removeState(automaton, stateId));
  }

  function handleSetStartState(stateId: number) {
    runEdit(() => setStartState(automaton, stateId));
  }

  function handleToggleAcceptState(stateId: number) {
    runEdit(() =>
      automaton.acceptStates.has(stateId)
        ? removeAcceptState(automaton, stateId)
        : addAcceptState(automaton, stateId)
    );
  }

  function handleAddTransition(from: number, to: number, symbol: string): string | null {
    try {
      const next = addTransition(automaton, from, new Set([to]), symbol);
      setAutomaton(next);
      setEditError(null);
      return null;
    } catch (error) {
      const message = (error as Error).message;
      setEditError(message);
      return message;
    }
  }

  function handleRemoveTransition(from: number, to: number, symbol: string | null) {
    runEdit(() => removeTransition(automaton, from, new Set([to]), symbol));
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
      alphabet={automaton.alphabet}
      onTypeChange={handleTypeChange}
      onAlphabetAdd={handleAlphabetAdd}
      onAlphabetRemove={handleAlphabetRemove}
      onExportJSON={handleExportJSON}
    />
  );

  const editContent = (
    <EditPanel
      automaton={automaton}
      error={editError}
      onAddState={handleAddState}
      onRemoveState={handleRemoveState}
      onSetStartState={handleSetStartState}
      onToggleAcceptState={handleToggleAcceptState}
      onAddTransition={handleAddTransition}
      onRemoveTransition={handleRemoveTransition}
      onDismissError={() => setEditError(null)}
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
