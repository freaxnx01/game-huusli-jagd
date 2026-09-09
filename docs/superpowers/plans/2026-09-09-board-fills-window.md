# Board fills the window on desktop — implementation plan

**Spec:** [docs/superpowers/specs/2026-09-09-board-fills-window-design.md](../specs/2026-09-09-board-fills-window-design.md)
**Issue:** #3

## Global constraints

- **CSS only.** No JavaScript, no `ResizeObserver`, no changes under `src/`. If a step
  seems to need JS, the sizing formula is wrong — fix the formula.
- Everything downstream of `--b` already scales (case, shadow, board font size at
  `style.css:275`, percentage-placed pieces at `src/ui/board.js:35-44`), so `--b` is the
  single knob to change.
- Mobile and portrait must come out byte-for-byte equivalent in behaviour: the
  `@media (max-width: 480px)` block (`style.css:511`) and the portrait flat default
  (`src/ui/scene.js:25-27`) are untouched.

## Task 1 — Name the vertical chrome

**Files:** `style.css`

1. In the `.game` rule (`style.css:159`), introduce the reserved-height budget as a
   custom property so it is stated once:

```css
.game {
  --chrome: 260px;             /* top bar + actions + log + footer + gaps */
  max-width: 1900px;
  margin: 0 auto;
  padding: 10px 16px 24px;
}
```

2. Measure `--chrome` rather than guessing: with DevTools at 1440×900, sum the rendered
   heights of `.topbar`, `.actions`, `.log-wrap`, `.foot` and the three 14px
   `.game-main` gaps **in the debt phase**, which shows the most action buttons and is the
   worst realistic case (`src/ui/actions.js:8` `ORDER`). Write the measured number in the
   comment.
3. Below `@media (min-width: 900px)` the stage is full-width and the side panel sits under
   it (`style.css:180-192`), so the budget is larger there — override `--chrome` inside the
   existing narrow-screen path only if the measurement says it is needed.

## Task 2 — Size the board from width and height

**Files:** `style.css`

1. Replace the `--b` declarations at `style.css:200` and `:211-212`:

```css
.stage {
  --view-ratio: 1;                                   /* flat: height budget ≈ board size */
  --b-max: min(calc(100cqw * 0.86), calc((100svh - var(--chrome)) * var(--view-ratio)));
  --b: max(320px, var(--b-max));
  --case-w: clamp(14px, calc(var(--b) * 0.055), 30px);
  --case-h: clamp(12px, calc(var(--b) * 0.045), 24px);
  /* …unchanged: position, overflow, border, background, perspective… */
}
.stage.iso {
  --view-ratio: 1.05;                                /* iso footprint is ~0.95 × --b tall */
  --b-max: min(calc(100cqw / 1.58), calc((100svh - var(--chrome)) * var(--view-ratio)));
  height: calc(var(--b) * 0.95 + 48px);
}
.stage.flat { height: calc(var(--b) + 2 * var(--case-w) + 16px); }
```

2. Keep the two view-specific width divisors exactly as they are today (`* 0.86` flat,
   `/ 1.58` iso) — they encode the horizontal footprint of the rotated scene and are not
   what this issue is about.
3. The old `540px` literal disappears entirely; grep for it afterwards to be sure
   (`grep -n '540px' style.css`).

## Task 3 — Check the wide-window case

**Files:** `style.css`

1. At 2560 px the stage is now bounded by height, not width, so the extra width goes to
   empty stage background. Confirm the stage box does not become a wide letterbox around a
   small board — if it does, cap `.stage-wrap` with `max-width: calc(100svh * 1.6)` and
   centre it (`margin-inline: auto`) rather than growing `--chrome`.
2. The side column stays `320px` (`style.css:188`) — do not widen it.

## Task 4 — Verify

Serve with `python -m http.server 8080`, open `index.html?rounds=3&minutes=1`, and check
each row in **both** views (toggle in the top bar):

| viewport | expectation |
|---|---|
| 2560×1440 | board much larger than before; no horizontal scrollbar; stage not a letterbox |
| 1920×1080 | board clearly larger than the old 540 px; top bar, actions, side panel and newest log lines all visible without scrolling |
| 1440×900 | same, with the debt phase's full action row rendered |
| 1280×800 | no regression: nothing overlaps, board ≥ its old size |
| 390×844 (portrait phone) | identical to today; flat view default; the `≤480px` block still applies |
| resize drag | board grows and shrinks live, no reload, no jank |

Also confirm: square names, prices and owner dots stay legible at the largest size, and
tokens, houses and dice stay on their squares (they are percentage-placed, so a
misalignment here means a `--b`-derived offset was missed).

Then `node --test` — green; nothing under `src/` changed.

## Task 5 — Wrap up

1. Before/after screenshots at 1920×1080 in both views on the PR.
2. CHANGELOG entry under the unreleased section.
