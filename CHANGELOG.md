# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

### Added

- Desktop board scaling to fill the browser window in both flat and isometric views,
  eliminating the previous 540px size constraint
- Sound effects for dice rolls and other money/property events, synthesized with Web
  Audio (no assets, no build step), muteable via a top-bar toggle persisted in
  `localStorage`
- Funny Swiss names pre-filled in the menu's name fields, so a game can be started
  without typing anything; the saved name always wins for a returning player
- 24-square board template with four city editions: Zürich, Basel, Frick, Sursee
- Pure game engine (`newGame` / `legalActions` / `reduce`) with seeded RNG, majority-build
  rule (2 of 3 streets of a district), mortgage, jail, 11 Ereignis cards, Gäldnot and
  bankruptcy
- Hard end condition: round limit 25 or a 30-minute clock, current round completed, winner
  by net worth
- CPU opponents at two levels, Gmüetlich and Gwieft
- Solo (1 human vs 1–3 CPUs) and hotseat play on one screen
- Online 2–4 player P2P over manual WebRTC offer/answer codes, host-authoritative
- Isometric "travel case" board with a flat view toggle; Schwiizerdütsch UI
- Simulation harness (`scripts/sim/harness.mjs`) and engine tests (`node --test test/`)
- In-game way to leave a running solo or hotseat game back to the main menu, via the
  "Verlah" button or `Escape`, with a confirmation before the game state is lost
