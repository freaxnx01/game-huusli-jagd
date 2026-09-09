# Sound effects — design

**Date:** 2026-09-09
**Issue:** #1
**Component:** `src/ui/` (new `sound.js`, `cues.js`), `src/engine/game.js` (log sequence number)

## Problem

The game is silent. Rolling the dice, buying a street, paying rent and building a Hüüsli
all pass without any audible feedback, which makes the turn rhythm harder to follow —
especially while a CPU seat plays on its own timer (`src/game-loop.js:10-17`).

TODO.md parks this as "Sounds via Web Audio (dice, cash register, jail), muteable".

## Goal

Audible feedback for dice rolls and the other money/property events, muteable and
persisted, with no new assets and no build step.

## Non-goals

- Music, ambience, voice.
- Per-event volume control or a sound settings screen. One mute toggle.
- Sound for pure UI interactions (opening the deed card, switching view/language).

## Constraints inherited from the repo

- **No build step, no `package.json`, no dependencies** (README "Tech"). Sound must be
  synthesized in the browser via Web Audio; no `.mp3`/`.wav` files, no CDN.
- **The engine is pure and network-authoritative.** Guests never dispatch state changes,
  they only receive whole states from the host (`src/net/session.js`, README "Online
  multiplayer"). So sound must not be driven from `dispatch()` — a guest would stay
  silent.
- **`reduce()` deep-clones** (`src/engine/game.js:53`), so no object identity survives a
  state transition.

## Approach — sound is a function of the state log

Every interesting event is already recorded in `state.log` by the engine
(`src/engine/game.js:87-90`, entries `roll`, `buy`, `rent`, `build`, `jail`, `card`,
`bankrupt`, …). Rendering happens on every state change for local *and* online play
(`src/main.js` `draw()` → `src/ui/render.js:27`), so diffing the log between renders gives
one event source that covers solo, hotseat, host and guest without touching the network
layer or the CPU loop.

**Log entries need a stable identity.** `structuredClone` in `reduce()` kills object
identity, and `log()` shifts the array once it exceeds 40 entries
(`src/engine/game.js:88-89`), so neither `===` nor array length can tell new entries from
old. The engine therefore stamps each entry with a monotonic `n`:

```js
// src/engine/game.js
function log(s, entry) {
  s.logSeq = (s.logSeq ?? 0) + 1;
  s.log.push({ ...entry, n: s.logSeq });
  if (s.log.length > LOG_LIMIT) s.log.shift();
}
```

`logSeq` is part of the state, so it is deterministic, survives `structuredClone`, and
travels over the wire with every broadcast. It changes no existing rule and no existing
assertion (tests read `.t` and `log.length` only — `test/engine.test.js:69`, `:833-837`).

## Modules

**`src/ui/cues.js` — pure, testable in Node**

```js
export function cuesFor(prevSeq, state)   // → { cues: string[], seq: number }
```

Returns the cue names for every log entry with `n > prevSeq`, in log order, plus the new
high-water mark. Pure: no Web Audio, no DOM, so `test/sound.test.js` runs it under
`node --test` like the engine tests.

Mapping (log `t` → cue):

| log entry | cue | note |
|---|---|---|
| `roll` | `dice` | the headline sound |
| `buy` | `cash` | cash register |
| `rent`, `tax` | `pay` | money leaving |
| `salary` | `salary` | money arriving |
| `build` | `build` | wooden thunk; `houses === 4` → `hotel` |
| `sell`, `mortgage`, `unmortgage` | `paper` | |
| `card` | `card` | |
| `jail` | `jail` | clang |
| `jailOut` | `unlock` | |
| `bankrupt` | `bust` | descending |
| `timeUp` | `alarm` | |
| `over` | `fanfare` | |
| `move`, `turn`, `round`, `pass`, `debt`, `left` | — | too chatty / already implied |

**Burst limit.** A single state change can append several entries (roll → move → rent).
Play at most 3 cues from one transition, chosen by a fixed priority order, spaced ~120 ms
apart, and drop the rest — a CPU turn resolved in one tick must not machine-gun.

**`src/ui/sound.js` — the Web Audio layer**

```js
export function createSound()   // → { play(cue), muted(), setMuted(v), toggle() }
```

- One lazily created `AudioContext`, built on the **first user gesture** and `resume()`d
  there, because browsers block audio before interaction. Until then `play()` is a no-op —
  never a thrown error.
- Each cue is a short synthesized voice: an oscillator (or a noise buffer for `dice`)
  through a gain envelope. Target 60–400 ms, peak gain ≤ 0.25.
- Mute state persisted in `localStorage` under `hj.sound`, following the exact pattern
  `src/ui/scene.js:5-23` uses for `hj.view` — try/catch on both read and write, and a
  sensible default when storage is unavailable. **Default: unmuted.**
- Everything is wrapped so that a missing/blocked `AudioContext` degrades to silence
  rather than breaking the render (`sound.js` is imported by `render.js`).

## UI

A mute button in the existing `.tools` group next to the view toggle
(`src/ui/render.js:49`), rendered as `🔊` / `🔇` with `aria-pressed` and a translated
`title`. New i18n keys `game.soundOn` / `game.soundOff` in both `gsw` and `en` dictionaries
(`src/i18n.js`). The button reads its initial state from the persisted value, so it
survives a reload and a language switch (which remounts the skeleton —
`src/ui/render.js:33-39`).

## Wiring

In `mount()` (`src/ui/render.js:60`): create the sound instance and hold `seq` per
instance. In `update()`, after the board update, call `cuesFor(seq, current)` and play what
comes back. Because `seq` lives on the render instance and the skeleton is rebuilt on an
edition/language change, a remount replays nothing: seed `seq` from the current state's
highest `n` at mount time.

## Acceptance criteria

- [ ] Rolling the dice plays a dice sound in solo, hotseat and online (host and guest).
- [ ] Buying, paying rent/tax, collecting salary, building, mortgaging, drawing a card,
      going to and getting out of jail, going bankrupt, the final-round alarm and the end
      of the game each have a distinct cue.
- [ ] A mute toggle sits in the top bar, shows its state, and is keyboard reachable.
- [ ] The mute choice persists across a reload (`localStorage` `hj.sound`) and never
      throws when storage is unavailable.
- [ ] Nothing plays before the first user interaction, and no console error is produced by
      that (autoplay policy).
- [ ] A single state change never plays more than 3 cues.
- [ ] `cuesFor()` is covered by `node --test` (new `test/sound.test.js`), including the
      log-shift case at the 40-entry limit.
- [ ] No new files outside `src/`, no dependency, no build step; `node --test` stays green.

## Risks

- **Synthesized cues can sound cheap.** Mitigation: keep them short, quiet and percussive;
  the dice cue is filtered noise rather than a tone.
- **`logSeq` grows unbounded** over a long game — a plain integer over ~1000 entries is
  harmless.
