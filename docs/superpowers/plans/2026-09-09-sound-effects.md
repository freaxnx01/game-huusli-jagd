# Sound effects — implementation plan

**Spec:** [docs/superpowers/specs/2026-09-09-sound-effects-design.md](../specs/2026-09-09-sound-effects-design.md)
**Issue:** #1

## Global constraints

- No build step, no dependencies, no asset files. Everything is ES modules under `src/`
  plus Web Audio.
- `node --test` must stay green after every task. Web Audio is not available in Node, so
  only `src/ui/cues.js` is unit-tested; `src/ui/sound.js` is verified in the browser.
- Never let audio break rendering: every Web Audio call is guarded, and `play()` is a
  no-op until the first user gesture.

## Task 1 — Sequence numbers on log entries

**Files:** `src/engine/game.js`, `test/engine.test.js`

**Interfaces:** `log(s, entry)` stays internal; state gains `logSeq: number`.

1. *Write the failing test* in `test/engine.test.js`:

```js
test('log entries carry a monotonic sequence number that survives the 40-entry cap', () => {
  let s = setup();
  assert.equal(s.log.at(-1).n, 1);
  for (let i = 0; i < 60; i++) s = reduce(s, { type: 'END_TURN' });
  const ns = s.log.map((e) => e.n);
  assert.equal(s.log.length, 40);
  assert.deepEqual(ns, [...ns].sort((a, b) => a - b));
  assert.ok(ns[0] > 1, 'oldest entries were dropped, numbering did not restart');
});
```

2. Implement: initialise `logSeq: 0` in the `newGame()` state literal
   (`src/engine/game.js:35-37`) and stamp in `log()` (`:87-90`):

```js
function log(s, entry) {
  s.logSeq += 1;
  s.log.push({ ...entry, n: s.logSeq });
  if (s.log.length > LOG_LIMIT) s.log.shift();
}
```

3. Run `node --test`. The existing log assertions (`test/engine.test.js:69`, `:833-837`)
   read `.t` and lengths, so they must stay green untouched. `scripts/sim/harness.mjs`
   must also still run clean (`node scripts/sim/harness.mjs 50`).

## Task 2 — `cuesFor()`, the pure mapping

**Files:** `src/ui/cues.js` (new), `test/sound.test.js` (new)

**Interfaces:**

```js
export const CUE_PRIORITY;                    // string[] — highest first
export const MAX_CUES_PER_CHANGE = 3;
export function cuesFor(prevSeq, state);      // → { cues: string[], seq: number }
export function highestSeq(state);            // → number
```

1. *Write the failing test* `test/sound.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cuesFor, highestSeq, MAX_CUES_PER_CHANGE } from '../src/ui/cues.js';

const state = (...entries) => ({ log: entries.map((e, i) => ({ ...e, n: i + 1 })) });

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
```

2. Implement `src/ui/cues.js` with the table from the spec. Keep it data-first:
   a `CUES` object from log `t` to cue name, a small override for `build`/`hotel`, the
   priority list, and a filter/slice for the cap. Output order stays log order after the
   priority-based selection.
3. `node --test` green.

## Task 3 — `createSound()`, the Web Audio layer

**Files:** `src/ui/sound.js` (new)

**Interfaces:**

```js
export function createSound();  // → { play(cue), muted(), setMuted(on), toggle(), onChange(fn) }
```

1. Persisted mute state under `hj.sound`, copying the try/catch shape of
   `src/ui/scene.js:5-23` verbatim in spirit (read → validate → fall back; write → ignore
   failure). Default unmuted.
2. Lazy `AudioContext`: created and `resume()`d inside a one-shot
   `pointerdown`/`keydown` listener on `window` (`{ once: true }`). Before that, `play()`
   returns immediately.
3. One `VOICES` table mapping cue → `{ type, freq, dur, gain, noise }`, and a single
   `voice()` function that builds oscillator-or-noise → gain envelope → destination and
   stops itself. Peak gain ≤ 0.25, duration 60–400 ms.
4. `play(cue)` is a no-op when muted, when the context is missing, or when the cue is
   unknown — no throw, ever. Wrap the whole body in try/catch.
5. Manual check in the browser: every cue name in `CUES` produces an audible, distinct
   sound; the dice cue is filtered noise, not a tone.

## Task 4 — Wire it into the render loop

**Files:** `src/ui/render.js`

1. Import `createSound` and `{ cuesFor, highestSeq }`.
2. In `mount()` (`src/ui/render.js:60`), after the scene is created:
   `const sound = createSound(); let seq = highestSeq(state);` — seeding from the mount
   state so a remount (edition/language change, `:33-39`) replays nothing.
3. In `update()` (`:123`), after `board.update(current)`:

```js
const { cues, seq: next } = cuesFor(seq, current);
seq = next;
cues.forEach((cue, i) => (i ? setTimeout(() => sound.play(cue), i * 120) : sound.play(cue)));
```

4. Return `sound` on the instance so the toggle in Task 5 can reach it.

## Task 5 — Mute toggle in the top bar

**Files:** `src/ui/render.js`, `src/i18n.js`

1. Add the button to `skeleton()` (`src/ui/render.js:49`), before the leave button:
   `<button class="btn small sound-toggle" type="button"></button>`.
2. Label it like the view toggle is labelled (`:97-104`): text `🔊`/`🔇`,
   `aria-pressed` = muted, `title` = `t('game.soundOn')` / `t('game.soundOff')`, relabelled
   on change and on mount.
3. Click → `sound.toggle()` → relabel. The first click is also the gesture that unlocks the
   `AudioContext`, so unmuting from the toggle must produce sound immediately.
4. i18n: add `game.soundOn` / `game.soundOff` to **both** dictionaries in `src/i18n.js`
   (`gsw` around `:76-77` next to `game.viewFlat`, `en` around `:262`). Suggested copy —
   gsw: `'game.soundOn': 'Ton a'`, `'game.soundOff': 'Ton us'`; en: `'Sound on'`,
   `'Sound off'`.
5. CSS: no new rule needed — `.btn.small` already exists for the view toggle.

## Task 6 — Verify and document

1. `node --test` — green, including the new `test/sound.test.js`.
2. `node scripts/sim/harness.mjs 200` — no invariant break from the `logSeq` change.
3. Browser pass on `index.html?rounds=3&minutes=1`: dice on every roll; distinct cues for
   buy / rent / build / jail / card / bankrupt / end; mute persists across reload; nothing
   plays before the first click; a CPU turn never fires more than 3 cues.
4. Online pass: host and guest both hear the guest's roll (guests render broadcast state
   only — this is the check that the log-diff approach was the right one).
5. Tick the TODO.md "Polish" line for sounds and add a CHANGELOG entry.
