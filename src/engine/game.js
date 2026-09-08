// Pure game engine: newGame() builds a plain-JSON state, reduce() returns a fresh state
// for every action and never mutates its input. Dice and card draws advance state.seed,
// so a game is fully determined by (seed, action list).

import { boardFor, EDITION_IDS, TRANSPORT_RENT, UTILITY_MULTIPLIER, TAX, SALARY, JAIL_FINE, START_CASH } from './editions.js';
import { rollDice, shuffle, randomInt } from './rng.js';
import { CARD_IDS, cardById } from './cards.js';

const BOARD_SIZE = 24;
const LOG_LIMIT = 40;
const HOTEL = 4;
const MAX_JAIL_ATTEMPTS = 3;
const MAX_DOUBLES = 3;
const UNMORTGAGE_RATE = 0.55;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const boards = new Map();

function board(state) {
  if (!boards.has(state.edition)) boards.set(state.edition, boardFor(state.edition));
  return boards.get(state.edition);
}

// ---------- public API ----------

export function newGame({ edition, players, seed = Date.now() >>> 0, maxRounds = 20, timeLimitMs = 30 * 60 * 1000 }) {
  if (!EDITION_IDS.includes(edition)) throw new Error(`unknown edition: ${edition}`);
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`players: ${MIN_PLAYERS} to ${MAX_PLAYERS} seats required`);
  }
  const start = randomInt(seed, players.length);
  const deck = shuffle(CARD_IDS, start.seed);
  const state = {
    edition, seed: deck.seed, round: 1, maxRounds, timeLimitMs, startPlayer: start.value, finalRound: false,
    players: players.map(newPlayer), turn: newTurn(start.value), props: {}, deck: deck.array, log: [], winner: null,
  };
  log(state, { t: 'turn', p: start.value });
  return state;
}

export function legalActions(state) {
  const { phase } = state.turn;
  if (phase === 'roll') return rollActions(state);
  if (phase === 'buy') return buyActions(state);
  if (phase === 'actions') return [...buildActions(state), ...estateActions(state), ...unmortgageActions(state), { type: 'END_TURN' }];
  if (phase === 'debt') return [...estateActions(state), { type: 'DECLARE_BANKRUPT' }];
  return [];
}

export function reduce(state, action) {
  if (!isLegal(state, action)) throw new Error(`illegal action ${JSON.stringify(action)} in phase ${state.turn.phase}`);
  const s = structuredClone(state);
  HANDLERS[action.type](s, action);
  return s;
}

export function netWorth(state, playerIndex) {
  const assets = propsOf(state, playerIndex).reduce((sum, sq) => sum + assetValue(state, sq), 0);
  return state.players[playerIndex].cash + assets;
}

export function rentFor(state, square, diceTotal) {
  const prop = state.props[square];
  if (!prop || prop.mortgaged) return 0;
  const sq = board(state)[square];
  if (sq.type === 'street') return streetRent(state, sq, prop);
  if (sq.type === 'transport') return transportRent(state, prop);
  if (sq.type === 'utility') return UTILITY_MULTIPLIER * diceTotal;
  return 0;
}

export function isOver(state) {
  return state.turn.phase === 'over';
}

// ---------- construction ----------

function newPlayer({ name, kind, level }, id) {
  return { id, name, kind, level: level ?? null, cash: START_CASH, pos: 0, inJail: false, jailTurns: 0, bankrupt: false, left: false, pendingDebt: null };
}

function newTurn(player) {
  return { player, phase: 'roll', doubles: 0, dice: null, offer: null, debt: null, doubleRent: false };
}

function log(s, entry) {
  s.log.push(entry);
  if (s.log.length > LOG_LIMIT) s.log.shift();
}

// ---------- queries ----------

const player = (s) => s.players[s.turn.player];
const isActive = (p) => !p.bankrupt && !p.left;
const activeSeats = (s) => s.players.map((_, i) => i).filter((i) => isActive(s.players[i]));
const diceTotal = (s) => (s.turn.dice ? s.turn.dice[0] + s.turn.dice[1] : 0);
const isDouble = (dice) => dice[0] === dice[1];
const unmortgageCost = (sq) => Math.ceil(sq.price * UNMORTGAGE_RATE);

function propsOf(state, owner) {
  return board(state).filter((sq) => state.props[sq.index]?.owner === owner);
}

function tierCount(state, tier, owner) {
  return propsOf(state, owner).filter((sq) => sq.type === 'street' && sq.tier === tier).length;
}

function assetValue(state, sq) {
  const prop = state.props[sq.index];
  const price = prop.mortgaged ? sq.price / 2 : sq.price;
  return price + prop.houses * (sq.houseCost ?? 0);
}

function streetRent(state, sq, prop) {
  if (prop.houses > 0) return sq.rent[prop.houses];
  const fullTier = tierCount(state, sq.tier, prop.owner) === 3;
  return sq.rent[0] * (fullTier ? 2 : 1);
}

function transportRent(state, prop) {
  const count = propsOf(state, prop.owner).filter((sq) => sq.type === 'transport').length;
  const base = TRANSPORT_RENT[count - 1];
  return state.turn.doubleRent ? base * 2 : base;
}

function canBuild(state, sq) {
  const prop = state.props[sq.index];
  if (sq.type !== 'street' || prop.mortgaged || prop.houses >= HOTEL) return false;
  return player(state).cash >= sq.houseCost && tierCount(state, sq.tier, prop.owner) >= 2;
}

// ---------- legal actions ----------

function isLegal(state, action) {
  if (action.type === 'TIME_UP') return !isOver(state);
  return legalActions(state).some((a) => a.type === action.type && a.square === action.square);
}

function rollActions(state) {
  const p = player(state);
  if (!p.inJail) return [{ type: 'ROLL' }];
  const actions = [];
  if (p.cash >= JAIL_FINE) actions.push({ type: 'JAIL_PAY' });
  actions.push({ type: 'JAIL_ROLL' });
  return actions;
}

function buyActions(state) {
  const actions = [];
  if (player(state).cash >= board(state)[state.turn.offer].price) actions.push({ type: 'BUY' });
  actions.push({ type: 'PASS' });
  return actions;
}

function buildActions(state) {
  return propsOf(state, state.turn.player)
    .filter((sq) => canBuild(state, sq))
    .map((sq) => ({ type: 'BUILD', square: sq.index }));
}

function estateActions(state) {
  const mine = propsOf(state, state.turn.player);
  const sells = mine.filter((sq) => state.props[sq.index].houses > 0).map((sq) => ({ type: 'SELL_HOUSE', square: sq.index }));
  const mortgages = mine
    .filter((sq) => !state.props[sq.index].mortgaged && state.props[sq.index].houses === 0)
    .map((sq) => ({ type: 'MORTGAGE', square: sq.index }));
  return [...sells, ...mortgages];
}

function unmortgageActions(state) {
  return propsOf(state, state.turn.player)
    .filter((sq) => state.props[sq.index].mortgaged && player(state).cash >= unmortgageCost(sq))
    .map((sq) => ({ type: 'UNMORTGAGE', square: sq.index }));
}

// ---------- action handlers ----------

const HANDLERS = {
  ROLL: rollAndMove,
  JAIL_PAY: jailPay,
  JAIL_ROLL: jailRoll,
  BUY: buy,
  PASS: pass,
  BUILD: build,
  SELL_HOUSE: sellHouse,
  MORTGAGE: mortgage,
  UNMORTGAGE: unmortgage,
  DECLARE_BANKRUPT: declareBankrupt,
  END_TURN: endTurn,
  TIME_UP: timeUp,
};

function rollAndMove(s) {
  const dice = roll(s);
  if (isDouble(dice)) s.turn.doubles += 1;
  if (s.turn.doubles >= MAX_DOUBLES) {
    goToJail(s, 'doubles');
    advanceTurn(s);
    return;
  }
  moveAndResolve(s, dice[0] + dice[1]);
}

function jailPay(s) {
  charge(s, JAIL_FINE, null);
  leaveJail(s, 'pay');
  rollAndMove(s);
}

function jailRoll(s) {
  const dice = roll(s);
  const p = player(s);
  if (isDouble(dice)) {
    leaveJail(s, 'doubles');
    moveAndResolve(s, dice[0] + dice[1]);
    return;
  }
  if (p.jailTurns + 1 >= MAX_JAIL_ATTEMPTS) {
    charge(s, JAIL_FINE, null);
    leaveJail(s, 'forced');
    moveAndResolve(s, dice[0] + dice[1]);
    return;
  }
  p.jailTurns += 1;
  settle(s);
}

function buy(s) {
  const sq = board(s)[s.turn.offer];
  player(s).cash -= sq.price;
  s.props[sq.index] = { owner: s.turn.player, houses: 0, mortgaged: false };
  log(s, { t: 'buy', p: s.turn.player, square: sq.index });
  s.turn.offer = null;
  settle(s);
}

function pass(s) {
  log(s, { t: 'pass', p: s.turn.player, square: s.turn.offer });
  s.turn.offer = null;
  settle(s);
}

function build(s, { square }) {
  const prop = s.props[square];
  prop.houses += 1;
  player(s).cash -= board(s)[square].houseCost;
  log(s, { t: 'build', p: s.turn.player, square, houses: prop.houses });
}

function sellHouse(s, { square }) {
  s.props[square].houses -= 1;
  player(s).cash += board(s)[square].houseCost / 2;
  log(s, { t: 'sell', p: s.turn.player, square });
  if (s.turn.phase === 'debt') resumeAfterDebt(s);
}

function mortgage(s, { square }) {
  s.props[square].mortgaged = true;
  player(s).cash += board(s)[square].price / 2;
  log(s, { t: 'mortgage', p: s.turn.player, square });
  if (s.turn.phase === 'debt') resumeAfterDebt(s);
}

function unmortgage(s, { square }) {
  s.props[square].mortgaged = false;
  player(s).cash -= unmortgageCost(board(s)[square]);
  log(s, { t: 'unmortgage', p: s.turn.player, square });
}

function declareBankrupt(s) {
  const me = s.turn.player;
  const to = s.turn.debt.to;
  sellAllHouses(s, me);
  transferEstate(s, me, to);
  Object.assign(s.players[me], { bankrupt: true, cash: 0, pendingDebt: null });
  s.turn.debt = null;
  log(s, { t: 'bankrupt', p: me, to });
  advanceTurn(s);
}

function endTurn(s) {
  if (s.turn.doubles > 0 && !player(s).inJail) {
    s.turn = { ...newTurn(s.turn.player), doubles: s.turn.doubles };
    return;
  }
  advanceTurn(s);
}

function timeUp(s) {
  s.finalRound = true;
  log(s, { t: 'timeUp' });
}

// ---------- movement ----------

function roll(s) {
  const r = rollDice(s.seed);
  s.seed = r.seed;
  s.turn.dice = r.dice;
  s.turn.doubleRent = false;
  log(s, { t: 'roll', p: s.turn.player, dice: r.dice });
  return r.dice;
}

function moveAndResolve(s, steps) {
  advance(s, steps);
  resolveSquare(s);
  settle(s);
}

function advance(s, steps) {
  const p = player(s);
  const from = p.pos;
  const passedGo = from + steps >= BOARD_SIZE;
  p.pos = (from + steps) % BOARD_SIZE;
  log(s, { t: 'move', p: s.turn.player, from, to: p.pos, passedGo });
  if (passedGo) paySalary(s);
}

function advanceTo(s, target) {
  advance(s, (target - player(s).pos + BOARD_SIZE) % BOARD_SIZE);
}

function moveBack(s, steps) {
  const p = player(s);
  const from = p.pos;
  p.pos = (from - steps + BOARD_SIZE) % BOARD_SIZE;
  log(s, { t: 'move', p: s.turn.player, from, to: p.pos, passedGo: false });
}

function paySalary(s) {
  player(s).cash += SALARY;
  log(s, { t: 'salary', p: s.turn.player });
}

function goToJail(s, why) {
  const p = player(s);
  p.pos = board(s).findIndex((sq) => sq.type === 'jail');
  p.inJail = true;
  p.jailTurns = 0;
  s.turn.doubles = 0;
  s.turn.offer = null;
  log(s, { t: 'jail', p: s.turn.player, why });
}

function leaveJail(s, how) {
  const p = player(s);
  p.inJail = false;
  p.jailTurns = 0;
  log(s, { t: 'jailOut', p: s.turn.player, how });
}

// ---------- square resolution ----------

const SQUARES = {
  street: resolveProperty,
  transport: resolveProperty,
  utility: resolveProperty,
  tax: payTax,
  card: drawCard,
  gotojail: (s) => goToJail(s, 'square'),
};

function resolveSquare(s) {
  const sq = board(s)[player(s).pos];
  const handler = SQUARES[sq.type];
  if (handler) handler(s, sq);
}

function resolveProperty(s, sq) {
  const prop = s.props[sq.index];
  if (!prop) {
    s.turn.offer = sq.index;
    return;
  }
  if (prop.owner === s.turn.player) return;
  const amount = rentFor(s, sq.index, diceTotal(s));
  if (amount === 0) return;
  const creditor = s.players[prop.owner].left ? null : prop.owner;
  charge(s, amount, creditor);
  log(s, { t: 'rent', p: s.turn.player, to: prop.owner, square: sq.index, amount });
}

function payTax(s) {
  charge(s, TAX, null);
  log(s, { t: 'tax', p: s.turn.player, amount: TAX });
}

function drawCard(s) {
  if (s.deck.length === 0) reshuffle(s);
  const card = cardById(s.deck[0]);
  s.deck = s.deck.slice(1);
  log(s, { t: 'card', p: s.turn.player, card: card.id });
  CARD_EFFECTS[card.effect.kind](s, card.effect);
}

function reshuffle(s) {
  const r = shuffle(CARD_IDS, s.seed);
  s.deck = r.array;
  s.seed = r.seed;
}

// ---------- card effects ----------

const CARD_EFFECTS = {
  pay: (s, e) => charge(s, e.amount, null),
  collect: (s, e) => { player(s).cash += e.amount; },
  goto: (s, e) => { advanceTo(s, e.square); resolveSquare(s); },
  jail: (s) => goToJail(s, 'card'),
  back: (s, e) => { moveBack(s, e.steps); resolveSquare(s); },
  nextTransport,
  repairs: (s, e) => charge(s, repairCost(s, e), null),
  birthday,
};

function nextTransport(s) {
  const target = nextTransportSquare(board(s), player(s).pos);
  advanceTo(s, target.index);
  const prop = s.props[target.index];
  if (prop && prop.owner !== s.turn.player) s.turn.doubleRent = true;
  resolveProperty(s, target);
}

function nextTransportSquare(squares, pos) {
  const transports = squares.filter((sq) => sq.type === 'transport');
  return transports.find((sq) => sq.index > pos) ?? transports[0];
}

function repairCost(s, { perHouse, perHotel }) {
  return propsOf(s, s.turn.player).reduce((sum, sq) => {
    const { houses } = s.props[sq.index];
    return sum + (houses === HOTEL ? perHotel : houses * perHouse);
  }, 0);
}

function birthday(s, { amount }) {
  const me = s.turn.player;
  s.players.forEach((other, i) => {
    if (i === me || !isActive(other)) return;
    other.cash -= amount;
    s.players[me].cash += amount;
    if (other.cash < 0) other.pendingDebt = { amount: -other.cash, to: me };
  });
}

// ---------- money and debt ----------

function charge(s, amount, to) {
  const payer = player(s);
  payer.cash -= amount;
  if (to !== null) s.players[to].cash += amount;
  if (payer.cash < 0) s.turn.debt = { amount: -payer.cash, to };
}

function settle(s) {
  if (player(s).cash < 0) {
    openDebt(s, s.turn.debt?.to ?? null);
    return;
  }
  s.turn.debt = null;
  s.turn.phase = s.turn.offer !== null ? 'buy' : 'actions';
}

function openDebt(s, to) {
  const amount = -player(s).cash;
  s.turn.debt = { amount, to };
  s.turn.phase = 'debt';
  log(s, { t: 'debt', p: s.turn.player, amount });
}

function resumeAfterDebt(s) {
  const p = player(s);
  if (p.cash < 0) {
    s.turn.debt.amount = -p.cash;
    return;
  }
  s.turn.debt = null;
  s.turn.phase = resumedPhase(s.turn);
}

function resumedPhase(turn) {
  if (turn.offer !== null) return 'buy';
  if (turn.dice === null) return 'roll';
  return 'actions';
}

function sellAllHouses(s, owner) {
  for (const sq of propsOf(s, owner)) {
    const { houses } = s.props[sq.index];
    if (houses === 0) continue;
    s.players[owner].cash += houses * (sq.houseCost / 2);
    s.props[sq.index].houses = 0;
  }
}

function transferEstate(s, from, to) {
  for (const sq of propsOf(s, from)) {
    if (to === null) delete s.props[sq.index];
    else Object.assign(s.props[sq.index], { owner: to, mortgaged: true });
  }
  if (to !== null && s.players[from].cash > 0) s.players[to].cash += s.players[from].cash;
}

// ---------- turn order and game end ----------

function advanceTurn(s) {
  if (activeSeats(s).length <= 1) {
    finish(s);
    return;
  }
  const { seat, roundEnded } = nextSeat(s);
  if (roundEnded && endRound(s)) {
    finish(s);
    return;
  }
  startTurn(s, seat);
}

function nextSeat(s) {
  const n = s.players.length;
  let seat = s.turn.player;
  let roundEnded = false;
  do {
    seat = (seat + 1) % n;
    if (seat === s.startPlayer) roundEnded = true;
  } while (!isActive(s.players[seat]));
  return { seat, roundEnded };
}

function endRound(s) {
  s.round += 1;
  log(s, { t: 'round', n: s.round });
  return s.round > s.maxRounds || s.finalRound;
}

function startTurn(s, seat) {
  s.turn = newTurn(seat);
  log(s, { t: 'turn', p: seat });
  const p = s.players[seat];
  const pending = p.pendingDebt;
  p.pendingDebt = null;
  if (pending && p.cash < 0) openDebt(s, pending.to);
}

function finish(s) {
  s.winner = ranking(s)[0] ?? null;
  s.turn.phase = 'over';
  log(s, { t: 'over', winner: s.winner });
}

function ranking(s) {
  const active = activeSeats(s);
  const pool = active.length > 0 ? active : s.players.map((_, i) => i);
  return pool.sort((a, b) => netWorth(s, b) - netWorth(s, a) || s.players[b].cash - s.players[a].cash || a - b);
}
