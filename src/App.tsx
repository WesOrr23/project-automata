import { useState, useEffect, useReducer, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAutomatonLayout } from './hooks/useAutomatonLayout';
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
import { type Result, errorMessage } from './engine/result';
import { computeDisplayLabels } from './ui-state/types';
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
  creationReducer,
  creationStateKind,
  INITIAL_CREATION_STATE,
  parseSymbolInput,
} from './components/transitionEditor/creationReducer';
import { computePreview } from './engine/preview';
import { convertNfaToDfa } from './engine/converter';
import { minimizeDfa } from './engine/minimizer';
import { complementDfa } from './engine/operations';
import { areEquivalent } from './engine/equivalence';
import { isComplete } from './engine/validator';
import { useSimulation } from './hooks/useSimulation';
import { useUndoableAutomaton } from './hooks/useUndoableAutomaton';
import { useUndoRedoShortcuts } from './hooks/useUndoRedoShortcuts';
import { useAutomatonSimulationGlue } from './hooks/useAutomatonSimulationGlue';
import { useFileSession } from './hooks/useFileSession';
import { useFileShortcuts } from './hooks/useFileShortcuts';
import { createFileAdapter } from './files/fileAdapter';
import { CommandBar } from './components/CommandBar';
import { ComparePicker } from './components/ComparePicker';
import { Onboarding } from './components/Onboarding';
import { useOnboarding } from './hooks/useOnboarding';
import { useDebugOverlay } from './hooks/useDebugOverlay';
import { createAutomaton as createBlankAutomaton } from './engine/automaton';
import { Shuffle, Contrast, Shrink, GitCompare } from 'lucide-react';

const fileAdapter = createFileAdapter();
function blankFactory() {
  return {
    automaton: createBlankAutomaton('DFA', new Set(['0', '1'])),
    epsilonSymbol: 'ε',
    description: '',
  };
}

/**
 * Build the sample DFA that accepts binary strings ending in "01".
 *
 * The engine now returns Result<Automaton> from fallible operations.
 * The construction below is statically known to succeed (we control
 * every input — alphabet, states, symbols), so an error here would
 * indicate a programmer bug, not a runtime condition. unwrap() throws
 * on err to make any future regression in the construction loud.
 */
function buildSampleDFA(): Automaton {
  function unwrap<T>(result: Result<T>): T {
    if (!result.ok) {
      throw new Error(`buildSampleDFA: unexpected engine error: ${result.error}`);
    }
    return result.value;
  }

  let dfa = createAutomaton('DFA', new Set(['0', '1']));

  let state1: number;
  ({ automaton: dfa, stateId: state1 } = addState(dfa));

  let state2: number;
  ({ automaton: dfa, stateId: state2 } = addState(dfa));

  dfa = unwrap(addAcceptState(dfa, state2));

  dfa = unwrap(addTransition(dfa, 0, new Set([state1]), '0'));
  dfa = unwrap(addTransition(dfa, 0, new Set([0]), '1'));
  dfa = unwrap(addTransition(dfa, state1, new Set([state1]), '0'));
  dfa = unwrap(addTransition(dfa, state1, new Set([state2]), '1'));
  dfa = unwrap(addTransition(dfa, state2, new Set([state1]), '0'));
  dfa = unwrap(addTransition(dfa, state2, new Set([0]), '1'));

  return dfa;
}

function initialSnapshot() {
  return { automaton: buildSampleDFA(), epsilonSymbol: 'e', description: '' };
}

function App() {
  // Undo/redo-aware store for the two pieces of state that change together
  // under user edits: the automaton itself and the reserved ε-symbol.
  // Folding both into one snapshot means a single undo reverses whatever
  // the last edit touched, and the caller doesn't have to coordinate two
  // parallel history stacks.
  const {
    automaton,
    epsilonSymbol,
    description,
    setAutomaton,
    setEpsilonSymbol,
    setDescription,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    replaceSnapshot,
    markSaved,
    isDirty,
  } = useUndoableAutomaton(initialSnapshot);
  const [inputString, setInputString] = useState('');
  const [menuState, setMenuState] = useState<ToolMenuState>({ mode: 'COLLAPSED' });
  // Bumped by Edit's "+ alphabet" jump-to button. ConfigPanel/AlphabetEditor
  // watch the value via useEffect and focus the input when it changes,
  // so the user lands in Define ready to type.
  const [alphabetFocusSignal, setAlphabetFocusSignal] = useState(0);

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

  // Derived application mode from the active tab. Used to gate visual
  // simulation effects (highlights), the preview overlay, and canvas
  // affordances — NOT to trigger resets.
  const appMode: 'IDLE' | 'EDITING' | 'SIMULATING' =
    menuState.mode === 'OPEN'
      ? (menuState.activeTab === 'EDIT'
          ? 'EDITING'
          : menuState.activeTab === 'SIMULATE'
            ? 'SIMULATING'
            : 'IDLE')
      : 'IDLE';

  // Live preview of "what the canvas will look like after the user commits
  // the in-progress edit." The preview's transitions are what gets laid out;
  // the edge highlights tell the canvas which edges to color blue/purple/red.
  //
  // Gated on EDITING: outside of Edit mode the form state may still hold an
  // in-progress edit (the user could be tab-switching), but we don't want
  // speculative edges polluting the Simulate or collapsed views.
  const preview = useMemo(() => {
    if (appMode !== 'EDITING') {
      return { automaton, overlays: [] };
    }
    const parsed = parseSymbolInput(creationState.symbol, automaton.alphabet, epsilonSymbol);
    const mode = actionMode(creationState, automaton.alphabet, epsilonSymbol);
    // ActionMode names the UI button ('create' / 'modify' / 'delete');
    // PreviewMode names the engine semantics ('add' / 'modify' /
    // 'delete'). They line up except for the create→add rename.
    const previewMode = mode === 'create' ? 'add' : mode;
    // computePreview takes a primitive symbol list — when the user's
    // input doesn't parse, we feed an empty list and the function falls
    // through to the no-preview branch (which still honors delete mode).
    const symbols = parsed.ok ? parsed.symbols : [];
    return computePreview(
      automaton,
      creationState.source,
      creationState.destination,
      symbols,
      previewMode,
      creationState.editingExisting,
      automaton.type === 'NFA'
    );
  }, [appMode, automaton, creationState, epsilonSymbol]);
  const previewSourceAutomaton: Automaton = preview.automaton;

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
  // null so React can early-bail on equality. `pickHighlight` returns the
  // payload only when the target's discriminant matches the requested kind.
  function pickHighlight<K extends NotificationTarget['kind']>(
    kind: K
  ): Extract<NotificationTarget, { kind: K }> | null {
    return highlightedTarget?.kind === kind
      ? (highlightedTarget as Extract<NotificationTarget, { kind: K }>)
      : null;
  }
  const highlightedStateId = pickHighlight('state')?.stateId ?? null;
  const highlightedTransitionTarget = pickHighlight('transition');
  const highlightedTransition = highlightedTransitionTarget
    ? {
        from: highlightedTransitionTarget.from,
        to: highlightedTransitionTarget.to,
        symbol: highlightedTransitionTarget.symbol,
      }
    : null;
  const highlightedSymbol = pickHighlight('alphabet')?.symbol ?? null;

  // Recompute layout whenever the automaton (or its preview overlay) changes.
  // The hook handles debouncing, stale-promise rejection via a version
  // counter, and the post-layout relabel pass that maps engine IDs to
  // sequential display labels (q0, q1, q2...).
  //
  // We feed `previewSourceAutomaton` (which equals `automaton` when no
  // preview is active) so in-progress edits show up with full GraphViz
  // spline routing — not as a simple overlay drawn on top.
  const { automatonUI } = useAutomatonLayout(previewSourceAutomaton);

  // Keeps the simulation and the input string in sync with structural
  // changes to the automaton: reset sim on edits (skipping initial mount)
  // and filter the input down to symbols still in the alphabet.
  useAutomatonSimulationGlue({
    automaton,
    resetSimulation: sim.reset,
    inputString,
    setInputString,
  });

  // Global undo/redo shortcuts. Active only while editing — outside
  // EDIT mode the keyboard shortcut is also off, matching the visible
  // controls being hidden.
  const isEditing = menuState.mode === 'OPEN' && menuState.activeTab === 'EDIT';
  useUndoRedoShortcuts({ undo, redo, canUndo, canRedo, enabled: isEditing });

  // Display labels are sequential (q0, q1, q2) regardless of underlying IDs.
  // This detaches stable engine identity from user-visible numbering.
  // After NFA→DFA conversion, the labels for the resulting DFA states
  // are overridden with subset notation ({q0,q2,q5}). The override is
  // tied to the specific automaton reference, so undoing the conversion
  // (which restores the prior reference) automatically reverts to qN.
  const [conversionLabels, setConversionLabels] = useState<{
    automatonRef: Automaton;
    subsetMap: ReadonlyMap<number, ReadonlySet<number>>;
  } | null>(null);

  const displayLabels = useMemo(() => {
    const base = computeDisplayLabels(automaton.states);
    if (conversionLabels === null) return base;
    if (conversionLabels.automatonRef !== automaton) return base;
    // Build subset labels referencing the ORIGINAL NFA's q-numbering
    // (the indices the user knew before the conversion). For each
    // numeric NFA state ID inside a subset, we emit `q<id>` so labels
    // like {q0,q2} are stable + readable.
    const out = new Map(base);
    for (const [dfaStateId, subset] of conversionLabels.subsetMap) {
      if (subset.size === 0) {
        out.set(dfaStateId, '∅');
      } else if (subset.size === 1) {
        const only = subset.values().next().value as number;
        out.set(dfaStateId, `q${only}`);
      } else {
        const sorted = Array.from(subset).sort((a, b) => a - b);
        out.set(dfaStateId, `{${sorted.map((s) => `q${s}`).join(',')}}`);
      }
    }
    return out;
  }, [automaton, conversionLabels]);

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

  function handleJumpToAlphabet() {
    setMenuState({ mode: 'OPEN', activeTab: 'CONFIG' });
    setAlphabetFocusSignal((n) => n + 1);
  }

  function handleCollapse() {
    // Click "collapse" closes the panel back to EXPANDED — a hover-able
    // intermediate state. From EXPANDED, the existing onMouseLeave path
    // takes the menu the rest of the way to COLLAPSED naturally if the
    // user moves their cursor off the menu. This avoids the previous
    // "click collapse, mouse-back, get stuck with stale active chrome"
    // flow.
    setMenuState({ mode: 'EXPANDED' });
  }

  // ─── Config handlers ───

  function handleTypeChange(type: 'DFA' | 'NFA') {
    // No-op guard: spreading into a new object would otherwise push a
    // new-reference-same-content snapshot onto the undo stack.
    if (type === automaton.type) return;
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
        detail: 'Change the reserved symbol in Define if you need this character in the alphabet.',
        autoDismissMs: 6_000,
      });
      return;
    }
    // No-op guard: re-adding an existing symbol would build a fresh Set
    // with identical contents, triggering a history push for nothing.
    if (automaton.alphabet.has(symbol)) return;
    setAutomaton((prev) => ({
      ...prev,
      alphabet: new Set([...prev.alphabet, symbol]),
    }));
  }

  // Define-tab handler for the ε symbol. Returns null on accept,
  // an error string otherwise — the panel surfaces the error inline.
  function handleEpsilonSymbolChange(newSymbol: string): string | null {
    if (newSymbol.length !== 1) return 'Use a single character';
    if (automaton.alphabet.has(newSymbol)) {
      return `'${newSymbol}' is already in the alphabet`;
    }
    // setEpsilonSymbol in the hook already no-ops on identical values, so
    // no additional guard is needed here — but returning null early also
    // avoids the redundant call in the identical case.
    if (newSymbol === epsilonSymbol) return null;
    setEpsilonSymbol(newSymbol);
    return null;
  }

  function handleAlphabetRemove(symbol: string) {
    // Allow removing the last symbol — leaving the alphabet empty. Simulation
    // is gated on a non-empty alphabet via isRunnable, so this can't produce
    // a runnable-but-broken automaton. Empty alphabet is a useful editing
    // intermediate state (e.g. wholesale switching from 0/1 to a/b).
    // No-op guard: removing a symbol that isn't in the alphabet shouldn't
    // consume a history slot.
    if (!automaton.alphabet.has(symbol)) return;
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
    // Wholesale nuke: the clear itself isn't undoable. `setAutomaton` above
    // would have pushed the pre-clear snapshot onto undo; `clearHistory()`
    // drops it so the cleared state becomes the new origin.
    clearHistory();
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
  // stale closure. Engine functions now return Result<Automaton>; on err we
  // route the error variant to the global notification system via notify().

  function applyEdit(
    update: (current: Automaton) => Result<Automaton>,
    targetOnError?: NotificationTarget,
    titleOnError?: string
  ) {
    // The engine no longer throws — Result<T> means we can run the
    // updater exactly once, inside React's setAutomaton, with no
    // pre-check dance. The double-call workaround that used to live
    // here was needed because notify() (a side effect) couldn't safely
    // fire from inside a state updater under StrictMode. Now that
    // success and failure are values, we branch on result.ok:
    //
    //   - On success, return the new automaton (commit).
    //   - On failure, return the previous reference (no-op for the
    //     undoable store) and notify *outside* the updater via
    //     queueMicrotask. queueMicrotask fires once per turn even if
    //     the updater itself runs twice under StrictMode, because the
    //     second updater run is a pure recomputation that arrives at
    //     the same Result and would queue an identical microtask —
    //     React only commits one of them.
    //
    // useUndoableAutomaton's setAutomaton runs the updater synchronously
    // inside the hook (not as React's own setState updater), so the
    // closure-captured `capturedError` is reliably set by the time we
    // read it. StrictMode's double-fire only applies to React's own
    // setters, not to user-defined imperative APIs.
    let capturedError: import('./engine/result').EngineError | null = null;
    setAutomaton((previous) => {
      const result = update(previous);
      if (!result.ok) {
        capturedError = result.error;
        return previous; // same reference → undoable store skips history push
      }
      return result.value;
    });
    if (capturedError !== null) {
      // Type assertion: TS narrows `capturedError` to `null` after the
      // closure-write because it can't see the synchronous call into
      // setAutomaton. The runtime is sound — the updater ran once and
      // the assignment happened-before this read.
      const errorVariant: import('./engine/result').EngineError = capturedError;
      // Conditional spreads keep `detail` / `target` omit-only so the
      // notification store never sees an explicit `undefined` (would
      // undermine exactOptionalPropertyTypes).
      notify({
        severity: 'error',
        title: titleOnError ?? errorMessage(errorVariant),
        ...(titleOnError !== undefined && { detail: errorMessage(errorVariant) }),
        ...(targetOnError !== undefined && { target: targetOnError }),
        // Edits that fail are non-blocking — the user can keep working.
        // Auto-dismiss so the stack doesn't fill with stale errors.
        autoDismissMs: 6_000,
      });
    }
  }

  function handleAddState() {
    // addState always succeeds; wrap the {automaton, stateId} return in
    // a Result so applyEdit's signature stays uniform.
    applyEdit((prev) => ({ ok: true, value: addState(prev).automaton }));
  }

  function handleRemoveState(stateId: number) {
    applyEdit((prev) => removeState(prev, stateId));
  }

  function handleSetStartState(stateId: number) {
    // setStartState now returns ok(prev) (same reference) when the
    // state is already the start, so the undoable store's reference-
    // equality check naturally short-circuits the redundant write.
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
    // No-op guard: a form submission with no changes shouldn't push
    // history. The loops below would still build a new object even when
    // both lists are empty.
    if (removes.length === 0 && adds.length === 0) return;
    // Funnel through applyEdit so a Result err (e.g. an
    // addTransitionDestination call hits a stale state) surfaces as a
    // notification. removeTransitionDestination is a pure no-op on bad
    // input, so it's not part of the Result chain.
    applyEdit((previous) => {
      let working = previous;
      for (const r of removes) {
        working = removeTransitionDestination(working, r.from, r.to, r.symbol);
      }
      for (const a of adds) {
        if (working.type === 'NFA') {
          const result = addTransitionDestination(working, a.from, a.to, a.symbol);
          if (!result.ok) return result;
          working = result.value;
        } else {
          // DFA: replace any existing (from, symbol) — DFAs are deterministic
          // so the form is replacing whatever was previously routed.
          const filtered = working.transitions.filter(
            (transition) =>
              !(transition.from === a.from && transition.symbol === a.symbol)
          );
          working = {
            ...working,
            transitions: [
              ...filtered,
              { from: a.from, to: new Set([a.to]), symbol: a.symbol },
            ],
          };
        }
      }
      return { ok: true, value: working };
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

  // ─── Operations: Convert / Minimize / Complement ───
  function handleConvertToDfa() {
    const result = convertNfaToDfa(automaton);
    if (!result.ok) {
      notify({ severity: 'error', title: 'Convert failed', detail: errorMessage(result.error) });
      return;
    }
    setAutomaton(() => result.value.dfa);
    setConversionLabels({ automatonRef: result.value.dfa, subsetMap: result.value.subsetMap });
    notify({
      severity: 'success',
      title: `Converted NFA to DFA — ${result.value.dfa.states.size} state${result.value.dfa.states.size === 1 ? '' : 's'}`,
      autoDismissMs: 3_500,
    });
  }

  function handleMinimize() {
    const result = minimizeDfa(automaton);
    if (!result.ok) {
      notify({ severity: 'error', title: 'Minimize failed', detail: errorMessage(result.error) });
      return;
    }
    const before = automaton.states.size;
    const after = result.value.dfa.states.size;
    if (before === after) {
      notify({ severity: 'info', title: 'Already minimal', detail: 'No states could be merged.', autoDismissMs: 3_000 });
      return;
    }
    setAutomaton(() => result.value.dfa);
    // Drop conversion labels — minimization renumbers states; the old
    // subset map's keys no longer line up.
    setConversionLabels(null);
    notify({
      severity: 'success',
      title: `Minimized DFA — ${before} states → ${after}`,
      autoDismissMs: 3_500,
    });
  }

  function handleComplement() {
    const result = complementDfa(automaton);
    if (!result.ok) {
      notify({ severity: 'error', title: 'Complement failed', detail: errorMessage(result.error) });
      return;
    }
    setAutomaton(() => result.value);
    notify({
      severity: 'success',
      title: 'Complemented DFA',
      detail: 'Accept and non-accept states swapped.',
      autoDismissMs: 3_000,
    });
  }

  // Equivalence check: opens a picker to choose the comparison
  // automaton; once picked, runs areEquivalent and reports the result
  // via notification (with the counterexample when not equivalent).
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  function handleCompareAgainst() {
    setComparePickerOpen(true);
  }
  function runEquivalence(other: Automaton, otherName: string) {
    setComparePickerOpen(false);
    const result = areEquivalent(automaton, other);
    if (!result.ok) {
      notify({ severity: 'error', title: 'Equivalence check failed', detail: errorMessage(result.error) });
      return;
    }
    if (result.value.equivalent) {
      notify({
        severity: 'success',
        title: `Equivalent ✓`,
        detail: `These automatons accept the same language as "${otherName}".`,
        autoDismissMs: 6_000,
      });
    } else {
      const ce = result.value.counterexample;
      const ceLabel = ce === '' ? 'ε (empty string)' : `"${ce}"`;
      const side = result.value.acceptingSide === 'a' ? 'this DFA' : `"${otherName}"`;
      const otherSide = result.value.acceptingSide === 'a' ? `"${otherName}"` : 'this DFA';
      notify({
        severity: 'error',
        title: 'Not equivalent ✗',
        detail: `Counterexample: ${ceLabel} — accepted by ${side} but rejected by ${otherSide}.`,
        autoDismissMs: 10_000,
      });
    }
  }

  const isCurrentDfaComplete = automaton.type === 'DFA' && isComplete(automaton);
  const requiresCompleteDfaTitle =
    automaton.type !== 'DFA' ? 'Requires a DFA' : 'Requires a complete DFA';
  const operationsCategories = [
    {
      id: 'conversions',
      label: 'Conversions',
      items: [
        {
          id: 'nfa-to-dfa',
          label: 'Convert to DFA',
          icon: <Shuffle size={16} strokeWidth={2} />,
          enabled: automaton.type === 'NFA',
          ...(automaton.type !== 'NFA' ? { title: 'Already a DFA' } : {}),
          onClick: handleConvertToDfa,
        },
        {
          id: 'complement',
          label: 'Complement',
          icon: <Contrast size={16} strokeWidth={2} />,
          enabled: isCurrentDfaComplete,
          ...(isCurrentDfaComplete ? {} : { title: requiresCompleteDfaTitle }),
          onClick: handleComplement,
        },
      ],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      items: [
        {
          id: 'minimize',
          label: 'Minimize',
          icon: <Shrink size={16} strokeWidth={2} />,
          enabled: isCurrentDfaComplete,
          ...(isCurrentDfaComplete ? {} : { title: requiresCompleteDfaTitle }),
          onClick: handleMinimize,
        },
        {
          id: 'compare-against',
          label: 'Compare against…',
          icon: <GitCompare size={16} strokeWidth={2} />,
          enabled: isCurrentDfaComplete,
          ...(isCurrentDfaComplete ? {} : { title: requiresCompleteDfaTitle }),
          onClick: handleCompareAgainst,
        },
      ],
    },
  ];

  // ─── File session ───
  // First-launch tour. Auto-shown if the user has never dismissed it
  // (localStorage flag); the "Show tour" item in the CommandBar ⋯
  // overflow re-opens it on demand.
  const onboarding = useOnboarding();
  const debugOverlay = useDebugOverlay();

  const fileSession = useFileSession(
    {
      automaton,
      epsilonSymbol,
      description,
      isDirty,
      markSaved,
      replaceSnapshot,
      adapter: fileAdapter,
      notify,
    },
    blankFactory
  );

  // File shortcuts are always-on under variant B — file ops are
  // always-visible in the CommandBar, so the keyboard shortcuts should
  // mirror that. (Undo/redo shortcuts stay EDIT-gated; see
  // useUndoRedoShortcuts call above.)
  useFileShortcuts({
    enabled: true,
    onSave: fileSession.save,
    onSaveAs: fileSession.saveAs,
    onOpen: fileSession.openFile,
    onNew: fileSession.newFile,
  });

  // ─── Panel content ───

  const configContent = (
    <ConfigPanel
      automatonType={automaton.type}
      onTypeChange={handleTypeChange}
      epsilonSymbol={epsilonSymbol}
      onEpsilonSymbolChange={handleEpsilonSymbolChange}
      alphabet={automaton.alphabet}
      highlightedSymbol={highlightedSymbol}
      onAlphabetAdd={handleAlphabetAdd}
      onAlphabetRemove={handleAlphabetRemove}
      alphabetFocusSignal={alphabetFocusSignal}
      description={description}
      onDescriptionChange={setDescription}
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
      onJumpToAlphabet={handleJumpToAlphabet}
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

      {/* Top-center command bar: file segment (always visible) + EDIT
          segment (undo/redo, animates in/out by appMode). Niche
          operations like Convert-to-DFA live in the Edit panel itself,
          not the bar. */}
      <CommandBar
        appMode={appMode}
        currentName={fileSession.currentName}
        isDirty={isDirty}
        recents={fileSession.recents}
        onNew={fileSession.newFile}
        onOpen={fileSession.openFile}
        onSave={fileSession.save}
        onSaveAs={fileSession.saveAs}
        onOpenRecent={fileSession.openRecent}
        onForgetRecent={fileSession.forgetRecent}
        onRenameCurrent={fileSession.renameCurrent}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        operationsCategories={operationsCategories}
      />

      <Onboarding visible={onboarding.visible} onDismiss={onboarding.dismiss} />

      {/* Comparison picker — opened by the Operations widget's
          "Compare against…" item, dispatches the chosen automaton
          back into runEquivalence. EDIT-mode-only by virtue of the
          state being only set from inside an EDIT-mode handler. */}
      <ComparePicker
        visible={comparePickerOpen && appMode === 'EDITING'}
        current={automaton}
        recents={fileSession.recents}
        adapter={fileAdapter}
        onPicked={runEquivalence}
        onClose={() => setComparePickerOpen(false)}
        notify={notify}
      />

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
            edgePreviews={appMode === 'EDITING' ? preview.overlays : undefined}
            creationSourceId={appMode === 'EDITING' ? creationState.source : null}
            creationDestinationId={appMode === 'EDITING' ? creationState.destination : null}
            creationStateKind={appMode === 'EDITING' ? creationStateKind(creationState) : null}
            viewportInset={{
              // Tool menu sits at left:16, takes ~48 (COLLAPSED) /
              // ~152 (EXPANDED) / ~280 (OPEN). 16+width+~24 gap so
              // centering doesn't crowd the menu's right edge.
              left:
                16 +
                (menuState.mode === 'COLLAPSED' ? 52 :
                 menuState.mode === 'EXPANDED' ? 152 : 280) +
                24,
              // Menu is vertically centered in the viewport via CSS
              // (top:50%; translateY(-50%)). To make the FA's vertical
              // center align with the menu's vertical center (=
              // window vertical center), we use a SYMMETRIC vertical
              // inset — top and bottom both reserve the same space.
              // Otherwise the visible vertical center sits below the
              // window center by half the top inset, and the FA looks
              // 'too low' relative to the menu.
              right: 0,
              top: 16 + 48 + 8,
              bottom: 16 + 48 + 8,
            }}
            onShowTour={onboarding.show}
            debugOverlay={debugOverlay.enabled}
            bottomRightExtras={
              /* Discoverability hint while in EDIT mode and the form is
                 at rest. Sits at the bottom of the canvas-bottom-right
                 stack; when present, the zoom controls rise above it.
                 mode="popLayout" tells AnimatePresence to remove the
                 exiting element from layout immediately while its exit
                 animation still plays — that way the zoom controls'
                 `layout` animation sees the layout shrink right away
                 and slides DOWN as the tip fades, instead of waiting
                 for the exit to complete (which would cause the zoom
                 to snap into place with no animation). */
              <AnimatePresence mode="popLayout">
                {appMode === 'EDITING' &&
                  canvasPickMode === null &&
                  creationState.editingExisting === null &&
                  creationState.source === null &&
                  creationState.destination === null &&
                  creationState.symbol === '' && (
                    <motion.div
                      className="canvas-tip"
                      role="note"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    >
                      Click any state for actions, or any edge to edit it.
                    </motion.div>
                  )}
              </AnimatePresence>
            }
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
