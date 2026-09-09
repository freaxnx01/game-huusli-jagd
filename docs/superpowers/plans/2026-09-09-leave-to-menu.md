# In-game escape to the main menu — implementation plan

**Spec:** [docs/superpowers/specs/2026-09-09-leave-to-menu-design.md](../specs/2026-09-09-leave-to-menu-design.md)
**Issue:** #2

## Global constraints

- No new modules. This is three small edits in `src/main.js`, `src/ui/render.js` and
  `src/i18n.js`.
- The UI layer has no test harness in this repo (`test/` covers engine, CPU and net), so
  the verification for this change is the browser checklist in Task 4 — do not skip it.
- Do not touch `src/net/session.js` or `src/game-loop.js`: the teardown they provide is
  already correct and is what this change reuses.

## Task 1 — Local games can leave

**Files:** `src/main.js`

**Interfaces:** `startGame({ edition, mode, players })` gains an `onLeave` on its `game`
object; new module-level `leaveLocal(loop)`.

1. Add next to `leaveOnline()` (`src/main.js`, "online" section — keep it above
   `startGame` so the two leave helpers read together):

```js
// Leaving a running local game asks first; from the end screen it just leaves.
async function leaveLocal(loop) {
  const running = loop?.state && !isOver(loop.state);
  if (running && !(await confirmDialog(t('game.leaveConfirmLocal')))) return;
  showMenu();
}
```

2. In `startGame()`, add to the `game` object: `onLeave: () => leaveLocal(loop),`.
   `loop` is assigned after `show(game)`, and `onLeave` is only ever called from a click or
   key press, so the closure is safe — the `loop?.` guard covers the impossible early call.
3. `isOver` and `confirmDialog` are already imported in `src/main.js`; no import changes.
4. Check by hand: the "Verlah" button now renders in solo and hotseat, because
   `update()` keys its visibility off `opts.onLeave` (`src/ui/render.js:125`).

## Task 2 — Escape leaves, deed first

**Files:** `src/ui/render.js`

1. Replace the keydown handler at `src/ui/render.js:108-112`:

```js
game.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (pinned != null || deed.current() != null) {
    pinned = null;
    deed.hide();
    return;
  }
  inst.opts.onLeave?.();
});
```

2. Rationale to keep in the comment above it: the pinned deed is the nearer "close me"
   target, so `Escape` only reaches the leave path when nothing is open. The chooser and
   confirm modals are `<dialog>`s on `document.body` (`src/ui/dialogs.js`), so their own
   `Escape` never bubbles here.

## Task 3 — Copy for the local confirmation

**Files:** `src/i18n.js`

1. Add `game.leaveConfirmLocal` to **both** dictionaries, next to the existing
   `game.leaveConfirm` / `game.leaveConfirmHost` (`src/i18n.js:69-70` and `:255-256`).
2. Suggested copy — gsw: `'Wotsch s Spiel würkli verlah? De Spielstand isch dänn wäg.'`;
   en: `'Really leave? The game will be lost.'`
3. Sanity: both dictionaries must have the same key set — scan the two blocks for the
   three `game.leave*` keys after editing.

## Task 4 — Verify in the browser

Run `python -m http.server 8080` and use `index.html?rounds=3&minutes=1`
(README "Running locally"). Walk every row:

| mode | check |
|---|---|
| solo | leave button visible; click → confirm → menu; cancel → same turn, clock still ticking |
| solo | `Escape` with a deed card pinned closes the card only; `Escape` again asks to leave |
| hotseat | same as solo |
| solo, after the end screen | leave/`Escape` goes straight to the menu, no confirmation |
| host | leave asks with `game.leaveConfirmHost`; guests land on the menu with a notice |
| guest | leave asks with `game.leaveConfirm`; the host's log shows the seat as left and play continues |
| any | after leaving a local game, no CPU move and no clock tick fires on the menu (watch the console / add a temporary log if unsure) |

Then `node --test` — it must stay green (nothing under test changed).

## Task 5 — Wrap up

1. CHANGELOG entry under the unreleased section.
2. If the manual pass turns up a teardown gap in the online paths, do **not** widen this
   change — file it as a separate issue and link it from #2.
