import { describe, it, expect } from 'vitest';
import {
  creationReducer,
  INITIAL_CREATION_STATE,
  isReady,
  isModified,
  actionButtonLabel,
  parseSymbolInput,
  formatSymbolsForInput,
  type CreationState,
} from './creationReducer';
import { computePreview, type PreviewMode } from '../../engine/preview';
import type { Automaton, Transition } from '../../engine/types';

// Default alphabet + reserved-ε symbol shared across most tests. Override
// per-test only when the case actually depends on a specific alphabet.
const A = new Set(['0', '1']);
const EPS = 'e';

describe('creationReducer', () => {
  describe('initial state', () => {
    it('starts idle with no slots filled', () => {
      const state = INITIAL_CREATION_STATE;
      expect(state.phase).toBe('idle');
      expect(state.source).toBeNull();
      expect(state.destination).toBeNull();
      expect(state.symbol).toBe('');
      expect(state.editingExisting).toBeNull();
    });

    it('is not ready', () => {
      expect(isReady(INITIAL_CREATION_STATE, A, EPS)).toBe(false);
    });

    it('button label is "Add"', () => {
      expect(actionButtonLabel(INITIAL_CREATION_STATE, A, EPS)).toBe('Add');
    });
  });

  describe('phase transitions', () => {
    it('pickSourceSlot enters picking-source phase', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, { type: 'pickSourceSlot' });
      expect(state.phase).toBe('picking-source');
    });

    it('pickDestinationSlot enters picking-destination phase', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'pickDestinationSlot',
      });
      expect(state.phase).toBe('picking-destination');
    });

    it('cancel returns to idle without clearing slots', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, { type: 'sourcePicked', stateId: 0 });
      state = creationReducer(state, { type: 'pickDestinationSlot' });
      state = creationReducer(state, { type: 'cancel' });
      expect(state.phase).toBe('idle');
      expect(state.source).toBe(0);
    });

    it('reset clears everything', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, { type: 'sourcePicked', stateId: 0 });
      state = creationReducer(state, { type: 'destinationPicked', stateId: 1 });
      state = creationReducer(state, { type: 'symbolChanged', symbol: '0' });
      state = creationReducer(state, { type: 'reset' });
      expect(state).toEqual(INITIAL_CREATION_STATE);
    });
  });

  describe('source picking auto-advance', () => {
    it('after sourcePicked with destination empty, phase becomes picking-destination', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'sourcePicked',
        stateId: 0,
      });
      expect(state.source).toBe(0);
      expect(state.phase).toBe('picking-destination');
    });

    it('after sourcePicked with destination already set, phase returns to idle', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'sourcePicked',
        stateId: 0,
      });
      state = creationReducer(state, { type: 'destinationPicked', stateId: 1 });
      // User now re-picks source
      state = creationReducer(state, { type: 'sourcePicked', stateId: 2 });
      expect(state.source).toBe(2);
      expect(state.destination).toBe(1);
      expect(state.phase).toBe('idle');
    });

    it('keeps editingExisting through slot changes', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: ['0'] },
        epsilonSymbol: EPS,
      });
      state = creationReducer(state, { type: 'sourcePicked', stateId: 2 });
      expect(state.editingExisting).toEqual({ from: 0, to: 1, symbols: ['0'] });
      state = creationReducer(state, { type: 'destinationPicked', stateId: 3 });
      expect(state.editingExisting).toEqual({ from: 0, to: 1, symbols: ['0'] });
    });
  });

  describe('symbol input', () => {
    it('symbolChanged updates the symbol', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'symbolChanged',
        symbol: '0',
      });
      expect(state.symbol).toBe('0');
    });

    it('symbolChanged keeps editingExisting (slot edits do not break the edit link)', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: ['0'] },
        epsilonSymbol: EPS,
      });
      expect(state.editingExisting).not.toBeNull();
      state = creationReducer(state, { type: 'symbolChanged', symbol: '1' });
      expect(state.editingExisting).toEqual({ from: 0, to: 1, symbols: ['0'] });
    });
  });

  describe('isReady predicate', () => {
    it('false when source missing', () => {
      const state = { ...INITIAL_CREATION_STATE, destination: 0, symbol: '0' };
      expect(isReady(state, A, EPS)).toBe(false);
    });

    it('false when destination missing', () => {
      const state = { ...INITIAL_CREATION_STATE, source: 0, symbol: '0' };
      expect(isReady(state, A, EPS)).toBe(false);
    });

    it('false when symbol empty', () => {
      const state = { ...INITIAL_CREATION_STATE, source: 0, destination: 1 };
      expect(isReady(state, A, EPS)).toBe(false);
    });

    it('true when all three filled with a valid symbol', () => {
      const state = {
        ...INITIAL_CREATION_STATE,
        source: 0,
        destination: 1,
        symbol: '0',
      };
      expect(isReady(state, A, EPS)).toBe(true);
    });

    it('true with multi-symbol comma-separated input', () => {
      const state = {
        ...INITIAL_CREATION_STATE,
        source: 0,
        destination: 1,
        symbol: '0, 1',
      };
      expect(isReady(state, A, EPS)).toBe(true);
    });

    it('true when ε is the symbol', () => {
      const state = {
        ...INITIAL_CREATION_STATE,
        source: 0,
        destination: 1,
        symbol: 'e',
      };
      expect(isReady(state, A, EPS)).toBe(true);
    });
  });

  describe('action button label', () => {
    it('"Add" in creation mode', () => {
      expect(actionButtonLabel(INITIAL_CREATION_STATE, A, EPS)).toBe('Add');
    });

    it('"Delete" when editing an existing transition with no changes', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: ['0'] },
        epsilonSymbol: EPS,
      });
      expect(actionButtonLabel(state, A, EPS)).toBe('Delete');
    });

    it('"Modify" when editing an existing and the symbol has been changed', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: ['0'] },
        epsilonSymbol: EPS,
      });
      state = creationReducer(state, { type: 'symbolChanged', symbol: '1' });
      expect(actionButtonLabel(state, A, EPS)).toBe('Modify');
    });
  });

  describe('isModified', () => {
    it('false when editingExisting is null', () => {
      expect(isModified(INITIAL_CREATION_STATE, A, EPS)).toBe(false);
    });

    it('false when slots match the original', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: ['0'] },
        epsilonSymbol: EPS,
      });
      expect(isModified(state, A, EPS)).toBe(false);
    });

    it('false when symbol input is the same group reordered', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: ['0', '1'] },
        epsilonSymbol: EPS,
      });
      // The display text is "0, 1" — re-typing "1, 0" parses to the same set.
      state = creationReducer(state, { type: 'symbolChanged', symbol: '1, 0' });
      expect(isModified(state, A, EPS)).toBe(false);
    });

    it.each<['symbol' | 'source' | 'destination', () => any]>([
      ['symbol', () =>
        creationReducer(
          creationReducer(INITIAL_CREATION_STATE, {
            type: 'loadExisting',
            transition: { from: 0, to: 1, symbols: ['0'] },
            epsilonSymbol: EPS,
          }),
          { type: 'symbolChanged', symbol: '1' }
        ),
      ],
      ['source', () =>
        creationReducer(
          creationReducer(INITIAL_CREATION_STATE, {
            type: 'loadExisting',
            transition: { from: 0, to: 1, symbols: ['0'] },
            epsilonSymbol: EPS,
          }),
          { type: 'sourcePicked', stateId: 2 }
        ),
      ],
      ['destination', () =>
        creationReducer(
          creationReducer(INITIAL_CREATION_STATE, {
            type: 'loadExisting',
            transition: { from: 0, to: 1, symbols: ['0'] },
            epsilonSymbol: EPS,
          }),
          { type: 'destinationPicked', stateId: 2 }
        ),
      ],
    ])('true when %s differs from original', (_, build) => {
      expect(isModified(build(), A, EPS)).toBe(true);
    });
  });

  describe('loadExisting', () => {
    it('fills all three slots and binds to the transition identity', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 2, to: 3, symbols: ['1'] },
        epsilonSymbol: EPS,
      });
      expect(state.source).toBe(2);
      expect(state.destination).toBe(3);
      expect(state.symbol).toBe('1');
      expect(state.editingExisting).toEqual({ from: 2, to: 3, symbols: ['1'] });
      expect(state.phase).toBe('idle');
    });

    it('joins multi-symbol consolidated edges into the symbol input', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: ['0', '1'] },
        epsilonSymbol: EPS,
      });
      expect(state.symbol).toBe('0, 1');
    });

    it('renders ε using the configured epsilonSymbol', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: [null] },
        epsilonSymbol: 'ε',
      });
      expect(state.symbol).toBe('ε');
    });

    it('overwrites any prior in-progress form', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'sourcePicked',
        stateId: 99,
      });
      state = creationReducer(state, { type: 'symbolChanged', symbol: 'x' });
      state = creationReducer(state, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbols: ['0'] },
        epsilonSymbol: EPS,
      });
      expect(state.source).toBe(0);
      expect(state.symbol).toBe('0');
    });
  });

  describe('parseSymbolInput', () => {
    it('parses a single symbol', () => {
      const r = parseSymbolInput('0', A, EPS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.symbols).toEqual(['0']);
    });

    it('parses comma-separated symbols (with whitespace)', () => {
      const r = parseSymbolInput('0,  1', A, EPS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(new Set(r.symbols)).toEqual(new Set(['0', '1']));
    });

    it('maps the ε symbol to null', () => {
      const r = parseSymbolInput('e', A, EPS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.symbols).toEqual([null]);
    });

    it('mixes ε with regular symbols', () => {
      const r = parseSymbolInput('0, e', A, EPS);
      expect(r.ok).toBe(true);
      if (r.ok) expect(new Set(r.symbols)).toEqual(new Set(['0', null]));
    });

    it('rejects symbols not in the alphabet', () => {
      const r = parseSymbolInput('z', A, EPS);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]).toContain("'z' is not in the alphabet");
    });

    it('rejects multi-character non-ε tokens', () => {
      const r = parseSymbolInput('abc', A, EPS);
      expect(r.ok).toBe(false);
    });

    it('rejects empty input', () => {
      const r = parseSymbolInput('', A, EPS);
      expect(r.ok).toBe(false);
    });
  });

  describe('formatSymbolsForInput', () => {
    it('joins literals alphabetically', () => {
      expect(formatSymbolsForInput(['1', '0'], EPS)).toBe('0, 1');
    });

    it('places ε last using the configured symbol', () => {
      expect(formatSymbolsForInput([null, '0'], 'ε')).toBe('0, ε');
    });

    it('handles a single ε', () => {
      expect(formatSymbolsForInput([null], EPS)).toBe('e');
    });
  });

  describe('computePreview DFA conflict branches', () => {
    // Helper: build an Automaton fixture with just enough structure for
    // computePreview to work. Real automaton operations would build this
    // through addState/addTransition; the tests only need the transitions
    // and alphabet to drive the diff logic.
    function automaton(transitions: Transition[]): Automaton {
      const states = new Set<number>();
      for (const t of transitions) {
        states.add(t.from);
        for (const dest of t.to) states.add(dest);
      }
      return {
        type: 'DFA',
        states,
        alphabet: A,
        transitions,
        startState: 0,
        acceptStates: new Set<number>(),
        nextStateId: Math.max(0, ...states) + 1,
      };
    }
    function tr(from: number, to: number, symbol: string | null): Transition {
      return { from, to: new Set([to]), symbol };
    }
    // Bridges the tests' (state, mode, parsed) shape to the new primitive-
    // arg signature on computePreview, so each individual case stays a
    // one-liner. ActionMode 'create' maps to PreviewMode 'add'.
    function preview(
      auto: Automaton,
      state: CreationState,
      mode: 'create' | 'modify' | 'delete',
      symbols: ReadonlyArray<string | null>,
      isNFA: boolean
    ) {
      const previewMode: PreviewMode = mode === 'create' ? 'add' : mode;
      return computePreview(
        auto,
        state.source,
        state.destination,
        symbols,
        previewMode,
        state.editingExisting,
        isNFA
      );
    }

    it('single-symbol DFA modify with conflict emits modify + delete edges', () => {
      // Existing: q0 -0-> q1, q0 -1-> q2.
      // Form: editing q0 -0-> q1, change symbol to "1" (still source q0 → q1).
      // The new (q0, 1) collides with the existing q0 -1-> q2 transition.
      // Expected preview: modify edge for the moved symbol + delete edge
      // for the conflict (DFA overwrite).
      const auto = automaton([tr(0, 1, '0'), tr(0, 2, '1')]);
      const state: CreationState = {
        phase: 'idle',
        source: 0,
        destination: 1,
        symbol: '1',
        editingExisting: { from: 0, to: 1, symbols: ['0'] },
      };
      const parsed = parseSymbolInput('1', A, EPS);
      const result = preview(auto, state, 'modify', parsed.ok ? parsed.symbols : [], false);
      // One modify edge (the new q0 -1-> q1) and one delete edge for
      // the conflicting q0 -1-> q2.
      const modifyEdges = result.overlays.filter((edge) => edge.kind === 'modify');
      const deleteEdges = result.overlays.filter((edge) => edge.kind === 'delete');
      expect(modifyEdges).toHaveLength(1);
      expect(modifyEdges[0]).toMatchObject({
        from: 0,
        to: 1,
        symbol: '1',
        oldSymbol: '0',
      });
      expect(deleteEdges).toHaveLength(1);
      expect(deleteEdges[0]).toMatchObject({
        from: 0,
        to: 2,
        symbol: '1',
        kind: 'delete',
      });
    });

    it('single-symbol DFA modify in NFA mode does not emit a delete edge', () => {
      // Same setup as above, but isNFA=true → conflicts are not overwrites,
      // they accumulate destinations. Only the modify edge survives.
      const auto = automaton([tr(0, 1, '0'), tr(0, 2, '1')]);
      const state: CreationState = {
        phase: 'idle',
        source: 0,
        destination: 1,
        symbol: '1',
        editingExisting: { from: 0, to: 1, symbols: ['0'] },
      };
      const parsed = parseSymbolInput('1', A, EPS);
      const result = preview(auto, state, 'modify', parsed.ok ? parsed.symbols : [], true);
      expect(result.overlays.filter((e) => e.kind === 'delete')).toHaveLength(0);
      expect(result.overlays.filter((e) => e.kind === 'modify')).toHaveLength(1);
    });

    it('general-case DFA add with conflict emits add + delete edges', () => {
      // Existing: q0 -0-> q2.
      // Form: brand-new transition q0 -0-> q1 (no editingExisting).
      // The new (q0, 0) collides with q0 -0-> q2 → add + delete preview.
      const auto = automaton([tr(0, 2, '0')]);
      const state: CreationState = {
        ...INITIAL_CREATION_STATE,
        source: 0,
        destination: 1,
        symbol: '0',
      };
      const parsed = parseSymbolInput('0', A, EPS);
      const result = preview(auto, state, 'create', parsed.ok ? parsed.symbols : [], false);
      const addEdges = result.overlays.filter((edge) => edge.kind === 'add');
      const deleteEdges = result.overlays.filter((edge) => edge.kind === 'delete');
      expect(addEdges).toHaveLength(1);
      expect(addEdges[0]).toMatchObject({ from: 0, to: 1, symbol: '0', kind: 'add' });
      expect(deleteEdges).toHaveLength(1);
      expect(deleteEdges[0]).toMatchObject({ from: 0, to: 2, symbol: '0', kind: 'delete' });
    });

    it('general-case DFA structural modify (different destination) emits delete-of-original + add', () => {
      // Existing: q0 -0-> q1.
      // Form: editing q0 -0-> q1, changes destination to q2.
      // → structural modify: original goes red (delete), new edge goes
      //   blue (add). No extra DFA conflict because no other (q0, 0) exists.
      const auto = automaton([tr(0, 1, '0')]);
      const state: CreationState = {
        phase: 'idle',
        source: 0,
        destination: 2,
        symbol: '0',
        editingExisting: { from: 0, to: 1, symbols: ['0'] },
      };
      const parsed = parseSymbolInput('0', A, EPS);
      const result = preview(auto, state, 'modify', parsed.ok ? parsed.symbols : [], false);
      const addEdges = result.overlays.filter((edge) => edge.kind === 'add');
      const deleteEdges = result.overlays.filter((edge) => edge.kind === 'delete');
      expect(addEdges).toHaveLength(1);
      expect(addEdges[0]).toMatchObject({ from: 0, to: 2, symbol: '0' });
      expect(deleteEdges).toHaveLength(1);
      expect(deleteEdges[0]).toMatchObject({ from: 0, to: 1, symbol: '0' });
    });

    it('general-case DFA add does NOT emit delete when isNFA is true', () => {
      const auto = automaton([tr(0, 2, '0')]);
      const state: CreationState = {
        ...INITIAL_CREATION_STATE,
        source: 0,
        destination: 1,
        symbol: '0',
      };
      const parsed = parseSymbolInput('0', A, EPS);
      const result = preview(auto, state, 'create', parsed.ok ? parsed.symbols : [], true);
      expect(result.overlays.filter((e) => e.kind === 'delete')).toHaveLength(0);
      expect(result.overlays.filter((e) => e.kind === 'add')).toHaveLength(1);
    });
  });

  describe('full happy path: pick source → destination → symbol', () => {
    it('walks through to ready', () => {
      let state = INITIAL_CREATION_STATE;
      state = creationReducer(state, { type: 'pickSourceSlot' });
      expect(state.phase).toBe('picking-source');
      state = creationReducer(state, { type: 'sourcePicked', stateId: 0 });
      expect(state.phase).toBe('picking-destination');
      state = creationReducer(state, { type: 'destinationPicked', stateId: 1 });
      expect(state.phase).toBe('idle');
      state = creationReducer(state, { type: 'symbolChanged', symbol: '0' });
      expect(isReady(state, A, EPS)).toBe(true);
      expect(actionButtonLabel(state, A, EPS)).toBe('Add');
    });
  });
});
