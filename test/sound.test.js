import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { cuesFor, highestSeq, MAX_CUES_PER_CHANGE } from '../src/ui/cues.js';

const state = (...entries) => ({ log: entries.map((e, i) => ({ ...e, seq: i + 1 })) });

describe('cuesFor', () => {
  test('returns cues only for entries newer than prevSeq', () => {
    const s = state({ t: 'roll' }, { t: 'move' }, { t: 'buy' });
    assert.deepEqual(cuesFor(1, s), { cues: ['cash'], seq: 3 });
  });

  test('ignores log entries with no cue', () => {
    assert.deepEqual(cuesFor(0, state({ t: 'move' }, { t: 'turn' })).cues, []);
  });

  test('a hotel is its own cue', () => {
    assert.deepEqual(cuesFor(0, state({ t: 'build', houses: 4 })).cues, ['hotel']);
    assert.deepEqual(cuesFor(0, state({ t: 'build', houses: 2 })).cues, ['build']);
  });

  test('caps a burst at MAX_CUES_PER_CHANGE, keeping the highest-priority cues', () => {
    const s = state({ t: 'roll' }, { t: 'rent' }, { t: 'card' }, { t: 'jail' }, { t: 'tax' });
    const { cues } = cuesFor(0, s);
    assert.equal(cues.length, MAX_CUES_PER_CHANGE);
    assert.ok(cues.includes('dice'));
  });

  test('seq tracks the newest entry even when nothing is audible', () => {
    assert.equal(cuesFor(0, state({ t: 'move' })).seq, 1);
  });

  test('highestSeq seeds from an in-progress game', () => {
    assert.equal(highestSeq(state({ t: 'roll' }, { t: 'buy' })), 2);
  });
});
