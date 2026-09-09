# In-game escape to the main menu — design

**Date:** 2026-09-09
**Issue:** #2
**Component:** `src/main.js`, `src/ui/render.js`, `src/i18n.js`

## Problem

In a solo or hotseat game there is no way back to the main menu short of reloading the
page. The "Verlah" button exists in the top bar but is hidden unless `opts.onLeave` is
given (`src/ui/render.js:49`, `:125`), and `src/main.js` `startGame()` builds its `game`
object **without** an `onLeave` — only the two online paths pass one (`hostGame`,
`joinGame`). `Escape` is bound inside the game screen but only closes the pinned deed card
(`src/ui/render.js:108-112`).

## Goal

One obvious way out of a running game — button and `Escape` — in every mode, with a
confirmation, correct teardown, and no half-closed peer connections.

## Non-goals

- Saving or resuming an abandoned game.
- A pause screen or an in-game settings menu.
- Changing what the end screen's "Nomol spile" button does (`src/ui/dialogs.js` `renderEnd`
  already dispatches `{ type: 'NEW_GAME' }`).

## Approach

The leave path already exists end to end for online play; the work is to give the local
modes the same handle and to add the keyboard route.

**1. Local games get an `onLeave`.** In `startGame()` (`src/main.js`), add:

```js
onLeave: () => leaveLocal(loop),
```

with

```js
async function leaveLocal(loop) {
  const running = loop?.state && !isOver(loop.state);
  if (running && !(await confirmDialog(t('game.leaveConfirmLocal')))) return;
  showMenu();
}
```

mirroring `leaveOnline()` (`src/main.js`). `showMenu()` calls `show()`, which stops the
current screen (`src/main.js` `show()`), and the local screen's `stop()` already calls
`loop.stop()` — which clears the CPU timer and the clock interval and flips `running` to
false (`src/game-loop.js:65-69`). So the teardown for local play needs no new code, only
the entry point.

A new i18n key `game.leaveConfirmLocal` is added rather than reusing
`game.leaveConfirm` ("It will be over for you"), because in a local game the phrasing
should be "the game will be lost" — both `gsw` and `en` dictionaries.

**2. `Escape` triggers the same thing.** The existing keydown handler in
`src/ui/render.js:108-112` becomes layered, closing the deed first and only leaving when
nothing is pinned:

```js
game.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (pinned != null || deed.current() != null) { pinned = null; deed.hide(); return; }
  inst.opts.onLeave?.();
});
```

The handler is on the game element, so it fires only when focus is inside the game screen.
The chooser and confirm dialogs are `<dialog>` elements appended to `document.body`
(`src/ui/dialogs.js`), so their own `Escape` handling is unaffected and they cannot be
"escaped through" into a leave.

**3. Online teardown is verified, not rewritten.** `hostSession`/`guestSession` already
expose `leave()` and the screens call it from `stop()` (`src/main.js`). The check here is
behavioural: after a host leaves, each guest is dropped with a reason and lands back on
the menu with a notice (`onDropped` → `showMenu(t('net.' + reason))`), and after a guest
leaves, the host's game logs `left` for that seat (`src/engine/game.js:310`) and keeps
going, ending when fewer than two seats remain.

## UI details

- The leave button becomes visible in all modes because `update()` keys it off
  `opts.onLeave` (`src/ui/render.js:125`) — no markup change.
- Confirmation copy per mode: local → "the game is lost", guest → existing
  `game.leaveConfirm`, host → existing `game.leaveConfirmHost`.
- No confirmation once the game is over (`isOver`), matching `leaveOnline()`.

## Acceptance criteria

- [ ] A visible "Verlah" button appears in the top bar in solo, hotseat, host and guest
      games.
- [ ] Pressing `Escape` in a running game asks to leave; pressing it while a deed card is
      pinned closes the card instead and leaves the game running.
- [ ] Confirming returns to the main menu; cancelling leaves the game exactly as it was
      (same turn, same phase, clock still running).
- [ ] Leaving a local game stops the CPU timer and the clock — no timer keeps firing after
      the menu is shown.
- [ ] A host leaving drops the guests with a notice on their menu; a guest leaving marks
      the seat as left on the host and the game continues.
- [ ] No confirmation is asked when the game is already over.
- [ ] New key `game.leaveConfirmLocal` exists in both `gsw` and `en`.
- [ ] `node --test` stays green.

## Risks

- **Escape as a leave shortcut can be hit by accident.** Mitigated by the confirm dialog;
  the deed-first layering also means the common "close this popup" reflex never reaches it.
