import { useState, useEffect, useRef, useReducer, useMemo } from 'react';
import {
  createAutomaton,
  addState,
  removeState,
  addTransition,
  addTransitionDestination,
  removeTransitionDestination,
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
import { StateActionsPopover } from './components/popover/StateActionsPopover';
import {
  actionMode,
  computePreview,
  creationReducer,
  creationStateKind,
  INITIAL_CREATION_STATE,
  parseSymbolInput,
} from './components/transitionEditor/creationReducer';
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
  // The single character that authors an ε-transition in the symbol input.
  // UI-only state — not part of the engine model. Defaults to 'e'; can be
  // changed in the Configure tab when in NFA mode.
  const [epsilonSymbol, setEpsilonSymbol] = useState('e');

  const sim = useSimulation(automaton);
  const { highlightedTarget, notify } = useNotifications();

  // Transition creation state machine — lifted here so the canvas can
  // dispatch state-picks into it (Phase 2). TransitionCreator becomes a
  // controlled component, taking state + dispatch as props.
  const [creationState, creationDispatch] = useReducer(
    creationReducer,
    INITIAL_CREATION_STATE
  );

  // Canvas enters "pick a state" mode while the form is in a picking phase.
  const canvasPickMode: 'state' | null =
    creationState.phase === 'picking-source' ||
    creationState.phase === 'picking-destination'
      ? 'state'
      : null;

  // Live preview of "what the canvas will look like after the user commits
  // the in-progress edit." The preview's transitions are what gets laid out;
  // the edge highlights tell the canvas which edges to color blue/purple/red.
  //
  // Gated on the Edit tab being open: outside of Edit mode the form state may
  // still hold an in-progress edit (the user could be tab-switching), but we
  // don't want speculative edges polluting the Simulate or collapsed views.
  const editTabOpen =
    menuState.mode === 'OPEN' && menuState.activeTab === 'EDIT';
  const preview = useMemo(() => {
    if (!editTabOpen) {
      return { transitions: automaton.transitions, edges: [] };
    }
    const parsed = parseSymbolInput(creationState.symbol, automaton.alphabet, epsilonSymbol);
    const mode = actionMode(creationState, automaton.alphabet, epsilonSymbol);
    return computePreview(automaton, creationState, mode, parsed, automaton.type === 'NFA');
  }, [editTabOpen, automaton, creationState, epsilonSymbol]);
  const previewSourceAutomaton: Automaton =
    preview.transitions === automaton.transitions
      ? automaton
      : { ...automaton, transitions: preview.transitions as Automaton['transitions'] };

  // State-actions popover (opened by clicking a state node on the canvas
  // while in EDIT mode and not actively picking).
  const [stateActions, setStateActions] = useState<{
    stateId: number;
    anchorRect: DOMRect;
  } | null>(null);

  function handleCanvasStateClick(stateId: number, anchorEl: SVGGElement) {
    setStateActions({ stateId, anchorRect: anchorEl.getBoundingClientRect() });
  }

  // Close the popover whenever the underlying state list changes (e.g.
  // after a Delete action) so it doesn't linger pointing at a removed state.
  useEffect(() => {
    setStateActions(null);
  }, [automaton.states]);

  function handleCanvasPickState(stateId: number) {
    if (creationState.phase === 'picking-source') {
      creationDispatch({ type: 'sourcePicked', stateId });
    } else if (creationState.phase === 'picking-destination') {
      creationDispatch({ type: 'destinationPicked', stateId });
    }
  }

  /**
   * Click an existing transition on the canvas → load it into the
   * creator form for editing or deletion. Loads the entire consolidated
   * group (every symbol on the visual edge) so the comma-separated
   * symbol input shows the whole thing — modify/delete then operate on
   * the group as a unit.
   */
  function handleCanvasEdgeClick(transition: {
    from: number;
    to: number;
    symbols: ReadonlyArray<string | null>;
  }) {
    creationDispatch({
      type: 'loadExisting',
      transition: {
        from: transition.from,
        to: transition.to,
        symbols: transition.symbols,
      },
      epsilonSymbol,
    });
  }

  // Reset the creation form whenever the automaton structure changes
  // (states/alphabet/transitions). Avoids the form referencing IDs or
  // symbols that no longer exist.
  useEffect(() => {
    creationDispatch({ type: 'reset' });
  }, [automaton]);

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

  // Recompute layout whenever the automaton (or its preview overlay) changes,
  // debounced to absorb rapid edits. A version counter discards stale promises
  // in case layout N-1 resolves after N. After layout, we rewrite each state's
  // label to the sequential display label so the canvas and the tool menu stay
  // consistent.
  //
  // Layout uses `previewSourceAutomaton` (which equals `automaton` when no
  // preview is active) so in-progress edits show up on the canvas with full
  // GraphViz spline routing — not as a simple overlay drawn on top.
  const layoutVersionRef = useRef(0);
  useEffect(() => {
    const version = ++layoutVersionRef.current;
    const timer = setTimeout(() => {
      computeLayout(previewSourceAutomaton).then((layout) => {
        if (version !== layoutVersionRef.current) return;
        const labels = computeDisplayLabels(previewSourceAutomaton.states);
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
  }, [previewSourceAutomaton]);

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
    // Reject the reserved ε symbol — it's how the user authors ε-transitions
    // in the symbol input, so it can't double as a regular alphabet symbol.
    // Only enforced in NFA mode (DFA mode has no ε-transitions, so the
    // symbol could be used freely there).
    if (automaton.type === 'NFA' && symbol === epsilonSymbol) {
      notify({
        severity: 'error',
        title: `'${symbol}' is reserved for ε-transitions in NFA mode.`,
        detail: 'Change the reserved symbol in Configure if you need this character in the alphabet.',
        autoDismissMs: 6_000,
      });
      return;
    }
    setAutomaton((prev) => ({
      ...prev,
      alphabet: new Set([...prev.alphabet, symbol]),
    }));
  }

  // Configure-tab handler for the ε symbol. Returns null on accept,
  // an error string otherwise — the panel surfaces the error inline.
  function handleEpsilonSymbolChange(newSymbol: string): string | null {
    if (newSymbol.length !== 1) return 'Use a single character';
    if (automaton.alphabet.has(newSymbol)) {
      return `'${newSymbol}' is already in the alphabet`;
    }
    setEpsilonSymbol(newSymbol);
    return null;
  }

  function handleAlphabetRemove(symbol: string) {
    // Allow removing the last symbol — leaving the alphabet empty. Simulation
    // is gated on a non-empty alphabet via isRunnable, so this can't produce
    // a runnable-but-broken automaton. Empty alphabet is a useful editing
    // intermediate state (e.g. wholesale switching from 0/1 to a/b).
    setAutomaton((prev) => {
      const newAlphabet = new Set(prev.alphabet);
      newAlphabet.delete(symbol);
      const newTransitions = prev.transitions.filter((t) => t.symbol !== symbol);
      return { ...prev, alphabet: newAlphabet, transitions: newTransitions };
    });
  }

  // "Clear canvas" — reset to a minimal automaton: one state, no
  // transitions, alphabet inherited from the current automaton (so the
  // user doesn't have to retype 0/1 or whatever they were working with).
  // Type also persists since it's a separate setting.
  function handleClearCanvas() {
    setAutomaton((prev) => ({
      ...createAutomaton(prev.type, prev.alphabet.size > 0 ? prev.alphabet : new Set(['0'])),
    }));
    creationDispatch({ type: 'reset' });
    sim.reset();
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
    targetOnError?: NotificationTarget,
    titleOnError?: string
  ) {
    // Pre-check against the current snapshot so any error throws *outside*
    // of React's state updater (state updaters must be pure — calling notify()
    // inside one fires twice under StrictMode).
    try {
      update(automaton);
    } catch (error) {
      const message = (error as Error).message;
      notify({
        severity: 'error',
        title: titleOnError ?? message,
        detail: titleOnError ? message : undefined,
        target: targetOnError,
        // Edits that fail are non-blocking — the user can keep working. Auto-
        // dismiss so the stack doesn't fill with stale errors.
        autoDismissMs: 6_000,
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

  /**
   * Apply a batch transition edit: a list of (from, to, symbol) triples
   * to remove, and another list to add. Runs all removes then all adds
   * in a single setAutomaton call so the canvas re-layouts once.
   *
   * NFA mode adds via addTransitionDestination — typing a symbol that
   * already has a transition from the same source unions in a new
   * destination instead of replacing. DFA mode adds via the
   * "filter then push" idiom (since DFA addTransition throws on
   * duplicate (from, symbol) and we want replace semantics).
   */
  function handleApplyTransitionEdit(
    removes: ReadonlyArray<{ from: number; to: number; symbol: string | null }>,
    adds: ReadonlyArray<{ from: number; to: number; symbol: string | null }>
  ) {
    setAutomaton((previous) => {
      let result = previous;
      for (const r of removes) {
        result = removeTransitionDestination(result, r.from, r.to, r.symbol);
      }
      for (const a of adds) {
        if (result.type === 'NFA') {
          result = addTransitionDestination(result, a.from, a.to, a.symbol);
        } else {
          // DFA: replace any existing (from, symbol) — DFAs are deterministic
          // so the form is replacing whatever was previously routed.
          const filtered = result.transitions.filter(
            (transition) =>
              !(transition.from === a.from && transition.symbol === a.symbol)
          );
          result = {
            ...result,
            transitions: [
              ...filtered,
              { from: a.from, to: new Set([a.to]), symbol: a.symbol },
            ],
          };
        }
      }
      return result;
    });
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
      epsilonSymbol={epsilonSymbol}
      onEpsilonSymbolChange={handleEpsilonSymbolChange}
      onClearCanvas={handleClearCanvas}
      onExportJSON={handleExportJSON}
    />
  );

  const editContent = (
    <EditPanel
      automaton={automaton}
      displayLabels={displayLabels}
      highlightedStateId={highlightedStateId}
      highlightedSymbol={highlightedSymbol}
      creationState={creationState}
      creationDispatch={creationDispatch}
      epsilonSymbol={epsilonSymbol}
      onAlphabetAdd={handleAlphabetAdd}
      onAlphabetRemove={handleAlphabetRemove}
      onAddState={handleAddState}
      onRemoveState={handleRemoveState}
      onSetStartState={handleSetStartState}
      onToggleAcceptState={handleToggleAcceptState}
      onApplyTransitionEdit={handleApplyTransitionEdit}
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

      {stateActions !== null && (
        <StateActionsPopover
          stateLabel={displayLabels.get(stateActions.stateId) ?? `q${stateActions.stateId}`}
          isStartState={stateActions.stateId === automaton.startState}
          isAcceptState={automaton.acceptStates.has(stateActions.stateId)}
          canDelete={automaton.states.size > 1}
          anchorRect={stateActions.anchorRect}
          onSetStart={() => {
            handleSetStartState(stateActions.stateId);
            setStateActions(null);
          }}
          onToggleAccept={() => {
            handleToggleAcceptState(stateActions.stateId);
            setStateActions(null);
          }}
          onCreateTransition={() => {
            creationDispatch({
              type: 'startTransitionFrom',
              stateId: stateActions.stateId,
            });
            setStateActions(null);
          }}
          onDelete={() => {
            handleRemoveState(stateActions.stateId);
            setStateActions(null);
          }}
          onClose={() => setStateActions(null)}
        />
      )}

      {/* Discoverability hint while in EDIT mode and the form is at rest.
          The educational tool aims for "intuitive, with explanations where
          it isn't." Surfacing the canvas's primary affordances here means
          the user doesn't have to guess that nodes and edges are clickable.
          Hidden as soon as the user starts an edit so it doesn't compete
          with the in-form instruction text. */}
      {appMode === 'EDITING' &&
        canvasPickMode === null &&
        creationState.editingExisting === null &&
        creationState.source === null &&
        creationState.destination === null &&
        creationState.symbol === '' && (
          <div className="canvas-tip" role="note">
            Click any state for actions, or any edge to edit it.
          </div>
        )}

      <main className="canvas-area">
        {automatonUI === null ? (
          <p className="caption">Loading...</p>
        ) : (
          <AutomatonCanvas
            automaton={automaton}
            automatonUI={automatonUI}
            activeStateIds={appMode === 'SIMULATING' ? sim.currentStateIds : undefined}
            resultStatus={appMode === 'SIMULATING' ? resultStatus : null}
            nextTransitions={appMode === 'SIMULATING' ? sim.nextTransitions : undefined}
            dyingStateIds={appMode === 'SIMULATING' ? sim.dyingStateIds : undefined}
            firedTransitions={appMode === 'SIMULATING' ? sim.firedTransitions : undefined}
            simulationStepIndex={appMode === 'SIMULATING' ? sim.stepIndex : undefined}
            highlightedStateId={highlightedStateId}
            highlightedTransition={highlightedTransition}
            pickMode={canvasPickMode}
            onPickState={handleCanvasPickState}
            onStateClick={
              appMode === 'EDITING' && canvasPickMode === null
                ? handleCanvasStateClick
                : undefined
            }
            onEdgeClick={appMode === 'EDITING' ? handleCanvasEdgeClick : undefined}
            edgePreviews={appMode === 'EDITING' ? preview.edges : undefined}
            creationSourceId={appMode === 'EDITING' ? creationState.source : null}
            creationDestinationId={appMode === 'EDITING' ? creationState.destination : null}
            creationStateKind={appMode === 'EDITING' ? creationStateKind(creationState) : null}
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
