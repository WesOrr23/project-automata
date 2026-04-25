import { useState, useEffect, useRef, useReducer, useMemo } from 'react';
import {
  createAutomaton,
  addState,
  removeState,
  addTransition,
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
  computePreview,
  creationReducer,
  creationStateKind,
  INITIAL_CREATION_STATE,
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
  const preview = useMemo(
    () =>
      editTabOpen
        ? computePreview(automaton, creationState)
        : { transitions: automaton.transitions, edges: [] },
    [editTabOpen, automaton, creationState]
  );
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
   * creator form for editing or deletion. Only active in EDITING mode
   * so that simulation clicks (currently nothing, but future-proof) and
   * idle hover don't trigger it.
   *
   * The mini SVG only knows DFA transitions (single destination). For
   * an NFA transition with multiple destinations, we load the matching
   * single (from, to, symbol) tuple — the edge the user clicked.
   */
  function handleCanvasEdgeClick(transition: {
    from: number;
    to: number;
    symbol: string | null;
  }) {
    // ε-transitions can't be edited via the form (it requires a symbol);
    // skip them gracefully.
    if (transition.symbol === null) return;
    creationDispatch({
      type: 'loadExisting',
      transition: {
        from: transition.from,
        to: transition.to,
        symbol: transition.symbol,
      },
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
    setAutomaton((prev) => ({
      ...prev,
      alphabet: new Set([...prev.alphabet, symbol]),
    }));
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
   * Set the destination of (from, symbol). Replaces any existing transition
   * for that pair. If `to` is null, removes the transition (no-op if none
   * existed). One atomic state update.
   */
  function handleSetTransition(from: number, symbol: string, to: number | null) {
    setAutomaton((previous) => {
      const filtered = previous.transitions.filter(
        (transition) => !(transition.from === from && transition.symbol === symbol)
      );
      if (to === null) {
        return { ...previous, transitions: filtered };
      }
      return {
        ...previous,
        transitions: [...filtered, { from, to: new Set([to]), symbol }],
      };
    });
  }

  /**
   * Replace one transition with another in a single atomic update.
   * Used by the creator form's Modify action: the user loaded an
   * existing transition, changed one or more slots, and committed.
   * Removes the original (oldFrom, oldSymbol) and any conflicting
   * (newFrom, newSymbol), then adds the new one.
   */
  function handleReplaceTransition(
    oldFrom: number,
    oldSymbol: string,
    newFrom: number,
    newSymbol: string,
    newTo: number
  ) {
    setAutomaton((previous) => {
      const filtered = previous.transitions.filter(
        (transition) =>
          !(transition.from === oldFrom && transition.symbol === oldSymbol) &&
          !(transition.from === newFrom && transition.symbol === newSymbol)
      );
      return {
        ...previous,
        transitions: [
          ...filtered,
          { from: newFrom, to: new Set([newTo]), symbol: newSymbol },
        ],
      };
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
      onAlphabetAdd={handleAlphabetAdd}
      onAlphabetRemove={handleAlphabetRemove}
      onAddState={handleAddState}
      onRemoveState={handleRemoveState}
      onSetStartState={handleSetStartState}
      onToggleAcceptState={handleToggleAcceptState}
      onSetTransition={handleSetTransition}
      onReplaceTransition={handleReplaceTransition}
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
            nextTransition={appMode === 'SIMULATING' ? sim.nextTransition : null}
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
