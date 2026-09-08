# Hüüsli-Jagd (mini-Monopoly, four Swiss city editions) — design

Status: **approved 2026-09-08** — all seven decisions taken with the recommended option (see the end). Name: Hüüsli-Jagd, repo `game-huusli-jagd`. Implementation plan: [2026-09-08-mini-monopoly-plan.md](../plans/2026-09-08-mini-monopoly-plan.md).

Idea (from the session on 2026-09-08): a browser board game in the Monopoly family with
four Swiss locations — **Zürich, Basel, Frick, Sursee** — playable solo against the CPU or
online with up to 4 players over P2P, and **finished within 30 minutes**.

Reference project for stack and P2P: [game-tschau-sepp](https://github.com/freaxnx01/game-tschau-sepp)
(house pattern: buildless vanilla JS, manual WebRTC, GitHub Pages).

## Goals and non-goals

Goals

- A complete game in **≤ 30 minutes** with 4 players, guaranteed by rules (not by hoping).
- Same engine drives solo-vs-CPU, hotseat, and P2P — one rule set, one code path.
- Shippable as static files on GitHub Pages at `https://github.freaxnx01.ch/game-<name>/`.
- Swiss flavour in every square, card and message; Schwiizerdütsch copy like Tschau Sepp.

Non-goals for v1 (parked, see [Later](#later))

- Player-to-player trading and auctions.
- A TURN/relay fallback for strict NATs (same limitation as Tschau Sepp).
- Accounts, persistence beyond `localStorage`, leaderboards.

## Why it ends in 30 minutes

Classic Monopoly runs long because sets are hard to complete and cash never runs out.
Four levers fix that:

1. **Small board: 24 squares** (6 per side) instead of 40. A lap takes ~3–4 turns.
2. **Majority rule:** you may build once you own **2 of the 3 streets** of a city. Owning all 3
   additionally doubles the unimproved rent. Sets happen without trading.
3. **Hard end condition:** the game ends after **N rounds** (default 25, tuned by the harness after the doubles fix) *or* when the
   **30-minute clock** runs out — whichever first — always finishing the current round so
   everyone gets the same number of turns. Winner: highest **net worth**
   (cash + property prices + house costs; mortgaged property counts half).
4. **No dead time:** rent, tax, salary and cards resolve automatically. A human only ever
   answers three questions: *buy?*, *build?*, *how do you pay?*

Rough budget: 4 players × 20 rounds = 80 turns. CPU turns take ~2 s, human turns ~15–20 s.
With two humans and two CPUs that is ~25 minutes; the clock caps the rest.

## Editions and the board (24 squares)

**Four separate editions — Zürich, Basel, Frick, Sursee — never mixed on one board**
(user, 2026-09-08). The player picks the edition in the menu. Every edition shares one
board template (same square types, indices, prices and rent tiers), only the names differ,
so the engine, AI and UI never branch on the edition. Source of truth for the template and
all four name sets: [`src/engine/editions.js`](../../../src/engine/editions.js).

Template: each side has 3 streets, 1 transport square and 1 special square. Streets come in
four groups of three (tiers, cheapest first, colours green / gold / red / blue); a tier is
the "city district" the majority rule applies to. Transport squares replace the four
stations (per edition: main station, second station, airport/port/Postauto, motorway
junction); the utility is the local power company.

The table below shows the template with the Zürich names; the other editions substitute
their own names at the same indices. Frick and Sursee names are best-effort and listed in
TODO.md for local verification.

| # | Square | Type | Price | Rent 0 / 1 / 2 / 3 Hüüser / Hotel | House |
|---|---|---|---|---|---|
| 0 | **LOS** — +200 | corner | | | |
| 1 | Langstrass | street (tier 1) | 60 | 4 / 20 / 60 / 180 / 320 | 50 |
| 2 | Ereignis | card | | | |
| 3 | Badenerstrass | street (tier 1) | 60 | 4 / 20 / 60 / 180 / 320 | 50 |
| 4 | Zürich HB | transport | 200 | 25 / 50 / 100 / 200 (by transport squares owned) | |
| 5 | Zurlindestrass | street (tier 1) | 80 | 6 / 30 / 90 / 270 / 400 | 50 |
| 6 | **Gfängnis / Nur zu Bsuech** | corner | | | |
| 7 | Universitätstrass | street (tier 2) | 100 | 8 / 40 / 100 / 300 / 450 | 100 |
| 8 | Rämistrass | street (tier 2) | 100 | 8 / 40 / 100 / 300 / 450 | 100 |
| 9 | Bahnhof Stadelhofe | transport | 200 | as above | |
| 10 | EWZ Stromwärch | utility | 150 | 8 × dice roll | |
| 11 | Seefäldstrass | street (tier 2) | 120 | 10 / 50 / 150 / 450 / 625 | 100 |
| 12 | **Frei Parkiere** | corner | | | |
| 13 | Niederdorf | street (tier 3) | 140 | 12 / 60 / 180 / 500 / 700 | 100 |
| 14 | Ereignis | card | | | |
| 15 | Limmatquai | street (tier 3) | 140 | 12 / 60 / 180 / 500 / 700 | 100 |
| 16 | Bahnhof Oerlikon | transport | 200 | as above | |
| 17 | Bellevue | street (tier 3) | 160 | 14 / 70 / 200 / 550 / 750 | 100 |
| 18 | **Gang is Gfängnis** | corner | | | |
| 19 | Paradeplatz | street (tier 4) | 220 | 18 / 90 / 250 / 700 / 875 | 150 |
| 20 | Flughafe Zürich | transport | 200 | as above | |
| 21 | Bürkliplatz | street (tier 4) | 240 | 20 / 100 / 300 / 750 / 925 | 150 |
| 22 | Stüüre — pay 100 | tax | | | |
| 23 | Bahnhofstrass | street (tier 4) | 280 | 26 / 130 / 390 / 900 / 1100 | 150 |

Tier colours: green, gold, red, blue (same in every edition). All amounts in CHF.

Total purchasable value is 2650; four players start with 1500 each, so the board sells out
in a few laps and money moves into houses quickly. Numbers are a starting point for the
simulation harness to tune, not final.

## Rules

- **Start:** 1500 CHF each, everyone on LOS, random start player. Salary 200 on passing LOS.
- **Turn:** roll 2 dice → move → resolve square → optional actions (build, mortgage,
  unmortgage) → end turn. Doubles roll again; the third double in a row sends you to jail.
- **Unowned property:** buy at list price or pass. No auction; a passed property stays with
  the bank.
- **Rent:** paid automatically. Streets by house level; full set doubles level-0 rent;
  stations by count owned; utility 8 × roll. Mortgaged property collects nothing.
- **Building:** allowed on a street when you own ≥ 2 of that city's 3 streets. Levels 0–4
  (3 Hüüser + Hotel). Build any number per turn as cash allows. No even-build rule; no
  house supply limit.
- **Mortgage:** raise half the price; unmortgage at 55 %. Houses must be sold first (half
  house cost).
- **Jail:** pay 50 at the start of the turn or try for doubles; after two failed tries you
  pay and move. Visiting is free.
- **Ereignis cards (11)**, drawn face-up and reshuffled when the deck runs out:
  Rega-Iisatz i de Bärge — zahl 100 · Jass-Obig gwunne — 50 für dich · Rückzahlig
  Chrankekasse — 100 für dich · Gang uf LOS · Gang is Gfängnis · SBB-Verspötig — 3 Fälder
  zrugg · Fahr zum nöchschte Verkehrsfeld (doppelti Miete, wenn verchauft) · Renovation — 25 pro
  Huus, 100 pro Hotel · Geburtstag — jede zahlt dir 20 · Parkbuess — zahl 40 · Fahr zum
  tüürschte Feld (square 23).
- **Debt:** if a payment drives cash below zero, the player enters *Gäldnot* and must sell
  houses or mortgage until solvent, or declare bankruptcy. Bankrupt to a player: creditor
  gets everything (properties arrive mortgaged). Bankrupt to the bank: properties return
  unowned. A bankrupt player is out but stays visible.
- **End:** last solvent player, or after round N / the 30-minute clock (current round is
  completed). Ties broken by cash.

## CPU opponents

Two levels, named like Tschau Sepp's:

- **Gmüetlich** — buys when it can afford price + 100 (70 % of the time), builds at random,
  always pays out of jail.
- **Gwieft** — keeps a cash reserve of 150 + the highest rent it could hit next lap; buys
  anything that gives it 2-of-3 in a city or denies an opponent's 2-of-3; values stations by
  count already owned; builds the city with the best rent-per-CHF up to level 3 while the
  reserve holds; stays in jail late in the game when the board is dangerous.

Both are pure functions of `(state, seed)` so the simulation harness can replay them.

## Architecture

Buildless ES modules, matching the `game-*` stack overlay. No `package.json`, no bundler.

```text
index.html              markup + boot
style.css
version.js              VERSION mirror of the git tag
src/engine/editions.js  board template, rent tiers, the four edition name sets
src/engine/cards.js     Ereignis deck
src/engine/rng.js       mulberry32; the seed lives in game state
src/engine/game.js      newGame(), legalActions(state), reduce(state, action) — pure
src/ai/cpu.js           chooseAction(state, seat, level) — pure
src/net/webrtc.js       offer/answer codes, STUN, data channel (lifted from Tschau Sepp)
src/ui/*.js             board, dice, player panel, dialogs, log — render reads state only
src/i18n.js             strings { gsw, en }, CHF via Intl.NumberFormat('de-CH')
scripts/sim/harness.mjs CPU-vs-CPU simulation, invariants and length statistics
```

Key idea: **one pure reducer.** Dice are drawn from the RNG inside the state, so a game is
fully determined by `(seed, action list)`. That gives free replay, a testable engine in Node
without extracting scripts from HTML, and a trivially host-authoritative network model.

### Multiplayer (host-authoritative star, like Tschau Sepp)

- Host creates one offer code per guest; guest pastes it and returns an answer code;
  signalling is copy-paste, STUN only, no server, no PeerJS. The encode/decode
  (deflate + base64, `TS1.` prefix) and lobby code from Tschau Sepp can be reused nearly
  verbatim.
- Seats have a kind: `local`, `cpu`, `remote`. The engine does not care; the host runs the
  reducer and CPU moves, guests only render.
- Protocol: guest → host `{t:'act', action}`; host validates against `legalActions`, applies,
  broadcasts `{t:'state', state, you}`. Lobby and `hello`/`lobby`/`bye`/`leave` messages as
  in Tschau Sepp.
- Disconnect during a game: seat becomes `left`, its turn is skipped, its property keeps
  collecting rent for nobody (frozen). If fewer than 2 seats remain the game ends.
- Because seat kinds are free, **hotseat** (several locals on one screen) costs nothing and
  covers Tschau Sepp's open TODO for local multiplayer.

### Visual design — pseudo-3D isometric, "travel case on a table"

Reference (user, 2026-09-08): Hasbro *Monopoly Kompakt* travel edition
([Orell Füssli A1070672091](https://www.orellfuessli.ch/shop/home/artikeldetails/A1070672091)):
a red plastic case with a pale green board, photographed tilted in three-quarter view,
chunky green houses and red hotels standing on the squares, metal tokens, white dice,
title deed cards fanned beside the case.

What we take from it

- **The scene:** a table surface, the board sitting in a red case with visible thickness,
  everything viewed from a fixed camera tilted about 58° and turned about 38°. Not a flat
  diagram — the board is an object.
- **Pieces are things:** houses and hotels are small extruded blocks that appear on the
  squares as they are bought; the dice are cubes that tumble; tokens stand up on the board.
- **Cards are flat and readable:** tapping or hovering a square lifts a *Besitzrechtkarte*
  (title deed) as a 2D card facing the viewer — the isometric board carries atmosphere,
  the cards carry the numbers.
- **Colour:** pale-green board, red case, black corner ink, the four city colours as
  square bars; pieces in saturated plastic colours.

How it is built (stays inside the stack overlay: DOM/SVG, no engine)

- The 7 × 7 grid from the flat design is kept as the DOM and wrapped in a
  `perspective` container with `transform: rotateX(58deg) rotateZ(-38deg)` and
  `transform-style: preserve-3d`. Squares stay real elements: clickable, focusable,
  styleable, testable.
- **Case:** a red frame around the board; its front and right sides are pseudo-elements
  folded down with `rotateX(-90deg)` / `rotateY(90deg)` to give it depth.
- **Houses, hotels, dice:** three-face CSS cubes (top + two sides) placed with
  `translateZ`. Cheap, crisp, and they follow the board's tilt for free.
- **Tokens:** cardboard-standee style — an SVG silhouette counter-rotated to face the
  camera (`rotateZ(38deg) rotateX(-58deg)`), so it reads at any board size. Token set
  proposed: Postauto, Bernhardiner, Rega-Heli, Pedalo (replaces car / dog / ship / cat).
- **Motion:** a token slides square to square along the perimeter; dice roll via a short
  cube rotation; a bought house pops in with a scale-in. `prefers-reduced-motion` turns
  all of it into instant changes.
- **Accessibility and phones:** a **flat view toggle** (top-down, no transform) for small
  screens, screen readers and anyone who finds the tilt hard to read. The DOM is the same;
  only the transform changes. Portrait phones default to flat.
- **Text on the tilted board** is short (street name, price); everything else lives on the
  deed card or in the side panel, which stay 2D.

### UI

- Board as a 7 × 7 CSS grid: 24 perimeter cells, centre holds dice, the last action, and
  the action buttons. Rendered isometric as above, flat view available. Player panel with
  cash and coloured property chips beside it; on narrow screens it drops below the board.
- Round counter and the 30-minute clock always visible; the final round is announced.
- Swiss German copy; `en` strings via the house i18n pattern. Amounts through
  `Intl.NumberFormat`.
- Sound via Web Audio (dice, cash register, jail), muteable — optional polish.

### Testing

The stack is buildless, so the gate is the manual playtest checklist plus a Node harness
importing the engine directly:

- Invariants after every action: total cash + bank ledger balances; no house without the
  majority rule; no negative cash outside *Gäldnot*; every game ends within round N.
- Statistics over 1000 CPU-vs-CPU games: rounds to finish, bankruptcies, winner spread by
  seat order. These numbers tune prices, salary and N until the 30-minute target holds.

## Milestones

1. **Engine + harness** — rules complete, invariants green, length tuned. `verify:` harness
   reports median game < 20 rounds with ≥ 1 bankruptcy in most games.
2. **Solo UI** — `/ui:brainstorm` → `/ui:flow` → `/ui:build` for board, panel and dialogs;
   1 human vs 1–3 CPUs. Flat view first, then the isometric scene on top of the same DOM.
   `verify:` a full game in the browser, empty console, both views.
3. **P2P** — lift the WebRTC layer from Tschau Sepp, lobby with names, 2–4 players.
   `verify:` two browsers finish a game; a dropped guest does not hang the host.
4. **Release** — version badge, changelog, README, hub card, `v1.0.0` tag.

## Later

Trading (offer/accept over the same protocol), auctions, a jail-free card, TURN fallback,
more Ereignis cards, a Frick/Sursee/Basel/Zürich themed piece set, statistics screen.

## Decisions (settled 2026-09-08, first option each)

1. **Stack.** Earlier in the session we chose Vite + TypeScript + PeerJS. The `game-*` stack
   overlay forbids exactly that (no bundler, no `package.json`, no PeerJS). This proposal
   follows the overlay. Confirm, or override it on purpose.
2. **Signalling UX.** Copy-paste codes need the host to run three exchanges for a 4-player
   table. Acceptable as in Tschau Sepp, or worth breaking the "no PeerJS" rule for room codes?
3. **Name.** "Monopoly" is a trademark; the public name should not use it. Candidates:
   *Hüüsli-Jagd*, *Chaufe & Baue*, *Stadt · Land · Miete*. Repo: `game-<slug>`.
4. **What is "Rega"?** The working folder is `rega-game-clone`. If there is a physical
   Rega-branded board game being cloned, photos of its board and cards would let the squares
   and Ereignis deck match it instead of my invented ones.
5. **Rules tweaks.** Majority-build (2 of 3) and no auctions/trading in v1 — OK?
6. **Defaults.** Round limit 20 and a hard 30-minute clock, both finishing the round — OK?
7. **Language.** Schwiizerdütsch only like Tschau Sepp, or `gsw` + `en` from the start?
