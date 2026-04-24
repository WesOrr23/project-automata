import { describe, it, expect } from 'vitest';
import {
  creationReducer,
  INITIAL_CREATION_STATE,
  isReady,
  actionButtonLabel,
} from './creationReducer';

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
      expect(isReady(INITIAL_CREATION_STATE)).toBe(false);
    });

    it('button label is "Pick source"', () => {
      expect(actionButtonLabel(INITIAL_CREATION_STATE)).toBe('Pick source');
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
  });

  describe('symbol input', () => {
    it('symbolChanged updates the symbol', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'symbolChanged',
        symbol: '0',
      });
      expect(state.symbol).toBe('0');
    });

    it('symbolChanged clears editingExisting (mutating breaks the link)', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbol: '0' },
      });
      expect(state.editingExisting).not.toBeNull();
      state = creationReducer(state, { type: 'symbolChanged', symbol: '1' });
      expect(state.editingExisting).toBeNull();
    });
  });

  describe('isReady predicate', () => {
    it('false when source missing', () => {
      const state = { ...INITIAL_CREATION_STATE, destination: 0, symbol: '0' };
      expect(isReady(state)).toBe(false);
    });

    it('false when destination missing', () => {
      const state = { ...INITIAL_CREATION_STATE, source: 0, symbol: '0' };
      expect(isReady(state)).toBe(false);
    });

    it('false when symbol empty', () => {
      const state = { ...INITIAL_CREATION_STATE, source: 0, destination: 1 };
      expect(isReady(state)).toBe(false);
    });

    it('true when all three filled', () => {
      const state = {
        ...INITIAL_CREATION_STATE,
        source: 0,
        destination: 1,
        symbol: '0',
      };
      expect(isReady(state)).toBe(true);
    });
  });

  describe('action button label progression', () => {
    it('"Pick source" when nothing filled', () => {
      expect(actionButtonLabel(INITIAL_CREATION_STATE)).toBe('Pick source');
    });

    it('"Pick destination" when only source filled', () => {
      const state = { ...INITIAL_CREATION_STATE, source: 0 };
      expect(actionButtonLabel(state)).toBe('Pick destination');
    });

    it('"Type a symbol" when source + destination but no symbol', () => {
      const state = { ...INITIAL_CREATION_STATE, source: 0, destination: 1 };
      expect(actionButtonLabel(state)).toBe('Type a symbol');
    });

    it('"Add transition" when ready', () => {
      const state = {
        ...INITIAL_CREATION_STATE,
        source: 0,
        destination: 1,
        symbol: '0',
      };
      expect(actionButtonLabel(state)).toBe('Add transition');
    });

    it('"Delete transition" when editing an existing', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbol: '0' },
      });
      expect(actionButtonLabel(state)).toBe('Delete transition');
    });
  });

  describe('loadExisting', () => {
    it('fills all three slots and binds to the transition identity', () => {
      const state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'loadExisting',
        transition: { from: 2, to: 3, symbol: '1' },
      });
      expect(state.source).toBe(2);
      expect(state.destination).toBe(3);
      expect(state.symbol).toBe('1');
      expect(state.editingExisting).toEqual({ from: 2, to: 3, symbol: '1' });
      expect(state.phase).toBe('idle');
    });

    it('overwrites any prior in-progress form', () => {
      let state = creationReducer(INITIAL_CREATION_STATE, {
        type: 'sourcePicked',
        stateId: 99,
      });
      state = creationReducer(state, { type: 'symbolChanged', symbol: 'x' });
      state = creationReducer(state, {
        type: 'loadExisting',
        transition: { from: 0, to: 1, symbol: '0' },
      });
      expect(state.source).toBe(0);
      expect(state.symbol).toBe('0');
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
      expect(isReady(state)).toBe(true);
      expect(actionButtonLabel(state)).toBe('Add transition');
    });
  });
});
