# Hüüsli-Jagd 🏠🎲🚁

A 30-minute Swiss mini-Monopoly for the browser. Buy streets in **Zürich**, **Basel**,
**Frick** or **Sursee**, build Hüüsli once you hold the majority of a district, and finish
with the highest net worth before the round limit or the clock runs out. Play solo against
the CPU, hotseat on one screen, or online with 2–4 players over peer-to-peer WebRTC.

**Play here:** https://github.freaxnx01.ch/game-huusli-jagd/

## How to play

- **Board:** 24 squares (6 per side). Each side has 3 streets, 1 transport square and 1
  special square (LOS, Gfängnis, Frei Parkiere, Gang is Gfängnis, Stüüre, Ereignis).
  Streets come in four districts of three, cheapest first: green, gold, red, blue.

- **Start:** 1500 CHF each, everyone on LOS, random start player. Salary 200 for passing
  or landing on LOS. Stüüre costs 100.

- **Turn:** roll two dice, move, resolve the square, then optionally build, mortgage or
  unmortgage, and end your turn. Doubles roll again; a third double in a row sends you to
  jail.

- **Buying:** land on an unowned property and buy it at list price, or pass. No auctions —
  a passed property stays with the bank.

- **Rent:** paid automatically. Streets by house level; owning all 3 streets of a district
  doubles the unimproved rent. Transport squares pay 25 / 50 / 100 / 200 by how many the
  owner holds. The Stromwärch pays 8 × the dice roll. Mortgaged property collects nothing.

- **Majority-build rule:** you may build on a street as soon as you own **2 of the 3
  streets** of its district. Levels 0–4 (3 Hüüser + Hotel), any number per turn as cash
  allows, no even-build rule.

- **Mortgage:** raise half the price; unmortgage at 55 %. Sell houses first (half house cost).

- **Jail:** pay 50 at the start of your turn or try for doubles; after two failed tries you
  pay and move anyway. Visiting is free.

- **Ereignis cards:** 11 face-up event cards, reshuffled when the deck runs out — Rega-Iisatz,
  Jass-Obig, Chrankekasse, Gang uf LOS, Gang is Gfängnis, SBB-Verspötig, Fahr zum nöchschte
  Bahnhof (double rent if owned), Renovation, Geburtstag, Parkbuess, Fahr zum tüürschte Feld.

- **Gäldnot:** if a payment drives your cash below zero you must sell houses or mortgage
  until solvent, or declare bankruptcy. Bankrupt to a player: the creditor gets everything
  (properties arrive mortgaged). Bankrupt to the bank: properties return unowned.

- **End:** the game ends after **round 20** or when the **30-minute clock** runs out —
  whichever comes first, always finishing the current round — or as soon as only one solvent
  player is left. Winner: highest **net worth** (cash + property prices + house costs;
  mortgaged property counts half). Ties are broken by cash.

## Editions

Four separate city editions, never mixed on one board. Every edition shares the same
template (square types, prices, rents); only the street, transport and utility names change:

- **Zürich** — Langstrass to Bahnhofstrass, Zürich HB, Flughafe Zürich, EWZ Stromwärch

- **Basel** — Klybeckstrooss to Freie Strooss, Basel SBB, EuroAirport, IWB Stromwärch

- **Frick** — Niederfrick to Gmeindshuus, Bahnhof Frick, A3-Aaschluss, AEW Stromwärch

- **Sursee** — Strandbad to Rathuusplatz, Bahnhof Sursee, Schiffsteg, CKW Stromwärch

Pick the edition in the menu. The Frick and Sursee names are best-effort and listed in
[TODO.md](TODO.md) for local verification.

## CPU opponents

- **Gmüetlich** — buys when it can afford price + 100 (most of the time), builds at random,
  always pays its way out of jail.

- **Gwieft** — keeps a cash reserve, buys anything that gives it 2-of-3 in a district or
  denies yours, values transport squares by count, builds where the rent per CHF is best,
  and stays in jail late in the game when the board is dangerous.

Both are pure functions of the game state and seed, so the simulation harness can replay
them.

## Online multiplayer

Peer-to-peer over WebRTC, no server, no accounts — the same manual signalling as
[Tschau Sepp](https://github.com/freaxnx01/game-tschau-sepp):

1. The host opens **Online → Hoste** and creates one **offer code** per guest.
2. Each guest opens **Online → Bitritt**, pastes the offer code and gets an **answer code**
   back.
3. The guest sends the answer code to the host (chat, mail, whatever), the host pastes it,
   and the seat connects. Repeat for every guest, up to 4 players in total.

The host is authoritative: guests send actions, the host validates them against the rules,
applies them and broadcasts the new state. A guest who disconnects leaves an empty seat
whose turn is skipped; if fewer than 2 seats remain the game ends.

**Limitation:** connectivity is STUN-only (no TURN relay). Two players behind strict or
symmetric NATs may not be able to connect; same LAN, home routers and most mobile data
connections work.

## Tech

- A single static page: `index.html` + `style.css` + ES modules under `src/`.
- No build step, no `package.json`, no bundler, no framework.
- One pure reducer drives every mode: dice are drawn from a seeded RNG inside the game
  state, so a game is fully determined by `(seed, action list)` — free replay, testable in
  Node, and a trivially host-authoritative network model.
- Isometric "travel case" board built with CSS 3D transforms on a plain 7 × 7 grid; a flat
  view toggle keeps it readable on phones and for screen readers.
- Schwiizerdütsch copy, CHF formatting via `Intl.NumberFormat('de-CH')`.

## Running locally

Open `index.html` directly in a browser, or serve the folder with any static server:

```sh
python -m http.server 8080
# or
npx serve .
```

Two query parameters shorten a game for testing: `?rounds=3` sets the round limit and
`?minutes=1` the clock, e.g. `index.html?rounds=3&minutes=1`.

The CPU-vs-CPU simulation harness runs games in Node (≥ 22), checks the rule invariants
after every action and prints length and winner statistics:

```sh
node scripts/sim/harness.mjs          # 500 games, 2–4 CPUs
node scripts/sim/harness.mjs 1000     # more games
```

## Tests

```sh
node --test
```

Node ≥ 22 runs the ES-module engine directly; no install needed.

## Credits

Rules, engine, CPU and UI by [freaxnx01](https://github.com/freaxnx01) with Claude Code.
Visual reference: a compact travel-edition board game seen tilted on a table. Not
affiliated with Hasbro; "Monopoly" is their trademark and this is a different game.

## License

[MIT](LICENSE)
