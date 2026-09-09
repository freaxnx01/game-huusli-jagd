# Board fills the window on desktop — design

**Date:** 2026-09-09
**Issue:** #3
**Component:** `style.css` (game layout, stage, board)

## Problem

On a desktop browser the board stops growing long before the window does. Three caps stack
up:

- `.game { max-width: 1280px }` (`style.css:159`) caps the whole screen.
- `.stage { --b: min(540px, calc(100cqw * 0.86)) }` and
  `.stage.iso { --b: min(540px, calc(100cqw / 1.58)) }` (`style.css:200`, `:211`) cap the
  board itself at **540 px** no matter how much room there is.
- `.stage-wrap` is `container-type: inline-size` (`style.css:193`), so `100cqw` is a
  **width-only** measure. The stage never learns how tall the viewport is, which is why it
  cannot simply be uncapped: a wide, short window would push the action bar and log below
  the fold.

## Goal

On desktop the board grows to fill the available window — in both the flat and the
isometric view — while the side panel, action bar and log stay visible without scrolling.
Phones and portrait layouts keep exactly what they have today.

## Approach — size the board from width *and* height

Replace the fixed 540 px ceiling with a ceiling derived from both axes:

```css
.stage {
  --b-max: min(
    calc(100cqw * 0.86),                                   /* container width */
    calc((100svh - var(--chrome)) * var(--view-ratio))      /* leftover viewport height */
  );
  --b: max(320px, var(--b-max));
}
```

- `--chrome` is the vertical space the rest of the game screen needs (top bar, action bar,
  log, footer, gaps) — a single custom property so the value is stated once and can be
  tuned per breakpoint rather than being re-derived in three places.
- `--view-ratio` is the view-dependent factor already implicit in today's rules: the flat
  stage is `--b + 2 * --case-w + 16px` tall and the iso stage `--b * 0.95 + 48px`
  (`style.css:211-212`), so the iso board can be wider than the height budget suggests.
- `svh` (small viewport height) rather than `vh` keeps mobile browser chrome from making
  the board jump as the URL bar hides.
- The `max(320px, …)` floor keeps the board legible on a short window; the page may then
  scroll, which is the correct trade at that size.

This is pure CSS — the height query happens in the viewport unit, not in the inline-size
container, so `.stage-wrap`'s `container-type` can stay as it is and nothing needs a
resize listener. Everything downstream already scales off `--b`: the case, the shadow, the
board font size (`font-size: clamp(8px, calc(var(--b) * 0.021), 12px)`, `style.css:275`)
and the piece placement, which is expressed in percentages of the board
(`src/ui/board.js:35-44`, `:111-135`). No JS changes.

**The page cap also has to move.** `.game { max-width: 1280px }` (`style.css:159`) is what
stops a 2560 px monitor from being used at all. Raise it to a wide-but-sane ceiling
(≈1900 px) rather than removing it — an unbounded line length in the log and panel reads
badly. The side column stays `320px` (`style.css:188`), so every extra pixel of window
goes to the stage.

## Alternatives considered

- **JS `ResizeObserver` computing a pixel size.** Rejected: adds a listener, a render
  path and a source of layout thrash to a codebase that is deliberately CSS-only for
  layout; `svh` + container query units cover it.
- **`aspect-ratio` on `.stage-wrap` with the grid doing the rest.** Rejected: the iso view
  is a 3D-transformed scene whose visual footprint is not its layout box
  (`style.css:222`), so the ratio would have to be fudged per view anyway.
- **`container-type: size` on `.stage-wrap`.** Rejected: it requires the container to have
  a definite height, which is exactly what the stage is trying to derive.

## Acceptance criteria

- [ ] On a 1920×1080 desktop window the board is visibly larger than today's 540 px cap in
      both the flat and the isometric view.
- [ ] The top bar, the action bar, the side panel and at least the newest log lines stay
      visible without scrolling on a 1920×1080 and a 1440×900 window, in both views.
- [ ] The board grows and shrinks when the window is resized, with no reload and no
      JavaScript involved.
- [ ] Square labels, prices and the owner dots stay legible at the larger size, and the
      pieces (tokens, houses, dice) stay on their squares.
- [ ] The layout at ≤ 480 px and in portrait is unchanged from today, and the flat default
      for portrait phones (`src/ui/scene.js:25-27`) still applies.
- [ ] Switching between iso and flat at a large size does not overflow the stage or clip
      the case.
- [ ] `node --test` stays green (no engine or UI-module change is expected).

## Verification

Manual, since the repo has no browser test setup: open `index.html?rounds=3&minutes=1`
(README "Running locally") at 1920×1080, 1440×900, 1280×800 and a 390×844 phone emulation,
in both views, and confirm the criteria above. Screenshots of the desktop before/after go
on the PR.

## Risks

- **`--chrome` is an estimate.** If the action bar wraps to two rows (many legal actions at
  once) the reserved height is off and the log can be pushed below the fold. Mitigation:
  size `--chrome` against the worst realistic case — the debt phase, which shows the most
  buttons — and verify at 1440×900.
