# Hüüsli-Jagd — implementation plan

Spec: [2026-09-08-mini-monopoly-design.md](../specs/2026-09-08-mini-monopoly-design.md)
(approved 2026-09-08, all seven decisions accepted with the recommended option).

Stack: buildless vanilla JS ES modules, no `package.json`, no bundler, GitHub Pages.
Node ≥ 22 runs `.js` ES modules directly (module syntax detection), so tests and the
simulation harness import the engine as-is: `node --test`.

Verifiable success criterion: a human can start `index.html`, play a full game against 1–3
CPUs to the end screen, or host/join a 2–4 player P2P game, with an empty console; the
harness shows CPU-vs-CPU games ending within the round limit.

## Engine contract (all tasks code against this)

**Editions (added 2026-09-08):** the four cities are separate editions, never mixed.
`src/engine/editions.js` already exists and is the source of truth: `TEMPLATE`, `TIERS`,
`EDITIONS`, `EDITION_IDS`, `boardFor(editionId)` → 24 resolved squares, plus the constants
`TRANSPORT_PRICE`, `TRANSPORT_RENT`, `UTILITY_PRICE`, `UTILITY_MULTIPLIER`, `TAX`,
`SALARY`, `JAIL_FINE`, `START_CASH`. Square types: `go | street | card | transport |
utility | jail | parking | gotojail | tax`. Streets carry `tier` (0–3) and `color`; the
majority rule is per tier ("own ≥ 2 of the 3 streets of a tier"). The engine stores
`state.edition` and resolves the board with `boardFor` — nothing else may branch on it.
There is no `board.js`; `cards.js` stays edition-neutral ("Fahr zum tüürschte Feld" =
square 23, "nöchschte Verkehrsfeld" = next transport square).

```js
// src/engine/game.js
export function newGame({ edition, players, seed, maxRounds = 25, timeLimitMs = 30 * 60 * 1000 }) // -> state; edition ∈ EDITION_IDS
export function legalActions(state)            // -> Action[] for state.turn.player
export function reduce(state, action)          // -> new state (never mutates); throws Error on illegal action
export function netWorth(state, playerIndex)   // cash + prices (mortgaged: half) + houses × house cost
export function rentFor(state, square, diceTotal) // rent an opponent pays when landing there now
export function isOver(state)                  // state.turn.phase === 'over'

// players input: [{ name, kind: 'local' | 'cpu' | 'remote', level?: 'gmuetlich' | 'gwieft' }]

// state (plain JSON, structured-clone safe — it is sent over the wire as-is)
{
  seed,                 // current mulberry32 state; every dice/card draw advances it
  round, maxRounds,     // round is 1-based; increments when the turn returns to the start player
  startPlayer,          // index
  finalRound,           // true once TIME_UP was applied; game ends after this round
  players: [{ id, name, kind, level, cash, pos, inJail, jailTurns, bankrupt, left }],
  turn: {
    player,             // index
    phase,              // 'roll' | 'buy' | 'debt' | 'actions' | 'over'
    doubles,            // consecutive doubles this turn
    dice,               // [d1, d2] | null
    offer,              // square index awaiting BUY/PASS | null
    debt,               // { amount, to: playerIndex | null } | null  (null = bank)
    doubleRent,         // true after the "nöchschte Bahnhof" card
  },
  props: { [square]: { owner, houses /* 0..4, 4 = Hotel */, mortgaged } },
  deck,                 // card ids, draw from index 0; reshuffled (using seed) when empty
  log,                  // last 40 events, newest last: { t, p, ...data } — UI renders them via i18n
  winner,               // index | null
}

// actions
{ type: 'ROLL' }                      // phase 'roll', not in jail
{ type: 'JAIL_PAY' } | { type: 'JAIL_ROLL' }   // phase 'roll', in jail
{ type: 'BUY' } | { type: 'PASS' }    // phase 'buy'
{ type: 'BUILD', square } | { type: 'SELL_HOUSE', square }
{ type: 'MORTGAGE', square } | { type: 'UNMORTGAGE', square }   // phases 'actions' and 'debt' (not BUILD/UNMORTGAGE in debt)
{ type: 'DECLARE_BANKRUPT' }          // phase 'debt'
{ type: 'END_TURN' }                  // phase 'actions'
{ type: 'TIME_UP' }                   // any phase except 'over'; host dispatches when the clock ends
```

Rule details the engine must implement (from the spec):

- Board data comes from `boardFor(state.edition)` in `src/engine/editions.js` (see above).
- Salary 200 on passing or landing on LOS. Tax square: pay 100. Utility rent 8 × dice sum.
  Transport squares 25/50/100/200 by count owned by the owner. Street rent by `houses`;
  with 0 houses and the owner holding all 3 streets of the tier, rent doubles. Mortgaged:
  no rent.
- Majority rule: `BUILD` on a street is legal when the player owns ≥ 2 of the tier's 3
  streets, the street is not mortgaged, houses < 4 and cash ≥ houseCost. No even-build rule.
- Mortgage value = price / 2; unmortgage costs ceil(price × 0.55); a street with houses
  cannot be mortgaged (sell houses first, half house cost each).
- Doubles: roll again after the turn's actions (END_TURN keeps the player, phase `roll`);
  a third double sends the player to jail and ends the turn.
- Jail: `JAIL_PAY` pays 50 then rolls and moves like a normal ROLL. `JAIL_ROLL`: doubles →
  out and move (no extra turn); otherwise jailTurns++; on the third failed attempt the
  player pays 50 and moves anyway. Landing on 18 (Gang is Gfängnis) or the card → pos 6,
  inJail. Square 6 visiting is free.
- Cards: the 11 Ereignis cards from the spec; "Fahr zum nöchschte Bahnhof" sets
  `turn.doubleRent` if the station is owned by someone else; "Renovation" 25 per house,
  100 per hotel; "Geburtstag" collects 20 from every solvent, present player (they may go
  into debt on their own next turn — simplification: deduct now, if their cash goes below
  zero they are put into debt phase when their turn starts; implement as `pendingDebt` on
  the player if simpler, document the choice in a test).
- Payments that leave cash < 0 open phase `debt` with `{ amount: -cash, to }`. Selling and
  mortgaging in `debt` phase returns to the interrupted flow as soon as cash ≥ 0.
  `DECLARE_BANKRUPT`: to a player → creditor receives all cash and properties (mortgaged
  flag set on each, houses sold to bank first at half price into the bankrupt's cash, which
  then transfers); to the bank → properties reset to unowned. Player `bankrupt = true`,
  turn passes.
- Turn order skips `bankrupt` and `left` players. Round ends when the next player would be
  `startPlayer`; if `round > maxRounds` or `finalRound` → phase `over`, `winner` = highest
  `netWorth`, ties by cash, then lower index. Only one solvent player left → `over` at once.
- `log` entries (structured): `roll {p, dice}`, `move {p, from, to, passedGo}`,
  `buy {p, square}`, `pass {p, square}`, `rent {p, to, square, amount}`, `tax {p, amount}`,
  `salary {p}`, `card {p, card}`, `build {p, square, houses}`, `sell {p, square}`,
  `mortgage {p, square}`, `unmortgage {p, square}`, `jail {p, why}`, `jailOut {p, how}`,
  `debt {p, amount}`, `bankrupt {p, to}`, `turn {p}`, `round {n}`, `timeUp`, `over {winner}`.

## Tasks

Each task is self-contained; a subagent gets the task text plus the contract above.

1. **Engine + tests** — `src/engine/{rng,cards,game}.js` (editions.js exists),
   `test/engine.test.js` (node:test, TDD). `verify:` `node --test` green; a scripted
   4-player game with a fixed seed reaches `over` without throwing, for every edition id.
2. **CPU + harness** (after 1) — `src/ai/cpu.js` `chooseAction(state, playerIndex)` pure
   over `(state, state.seed)`; two levels per spec; `scripts/sim/harness.mjs` runs N games
   (default 500) with 2–4 CPUs, asserts invariants after every action, prints median rounds,
   bankruptcies, winner spread by seat, and average elapsed turns. `verify:` harness runs
   clean; if the median game exceeds `maxRounds` or ends with no bankruptcies in > 80 % of
   games, tune `board.js` numbers and record the change in the harness output notes.
3. **UI shell** (parallel with 1, against the contract with a stub state) —
   `index.html`, `style.css`, `src/ui/{board,panel,dialogs,scene,log}.js`, `src/i18n.js`,
   `version.js`. Screens: menu (edition picker Zürich / Basel / Frick / Sursee; solo: name,
   number of CPUs, level; hotseat; online host/join placeholders), game (isometric board
   with flat toggle, dice, player panel, action bar, log, round + clock), end screen. The
   board renders `boardFor(edition)` names; the visual language is the isometric
   "travel case" from the spec and `docs/design/proposal/index.html` (reuse its CSS 3D
   approach: perspective wrapper, case pseudo-element sides, three-face cubes, standees). Render reads state only. `verify:` opens from
   `file://` and via a static server with an empty console; flat/iso toggle works; layout
   holds at 375 px and 1280 px.
4. **Solo integration** (after 1, 2, 3) — `src/main.js` game loop: local seats dispatch
   through UI, CPU seats through `chooseAction` with a short delay, clock → `TIME_UP`.
   `verify:` a full game vs 3 CPUs to the end screen in the browser.
5. **P2P** (after 4) — `src/net/webrtc.js` lifted from Tschau Sepp (offer/answer codes,
   deflate+base64, STUN, data channel, lobby messages), host-authoritative: guests send
   `{t:'act', action}`, host validates with `legalActions`, broadcasts `{t:'state', state,
   you}`. Names, seat overview, leave/disconnect handling. `verify:` two browser tabs
   connect and finish a game; closing the guest tab does not hang the host.
6. **Release scaffolding** (parallel) — `README.md`, `CHANGELOG.md` with `[Unreleased]`,
   `cliff.toml`, `.gitignore` (`.worktrees/`), `LICENSE` (MIT), `TODO.md` with parked items
   from the spec's "Later" section. `verify:` files present, README explains play + P2P.

## Out of scope (parked in TODO.md)

Trading, auctions, jail-free card, TURN fallback, sounds, hub card in
`freaxnx01.github.io`, GitHub repo creation and branch protection.
