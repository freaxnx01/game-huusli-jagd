// CPU opponents. chooseAction(state, playerIndex) is a pure function of the state:
// the only randomness (the "gmüetlich" level) comes from a seed derived from the
// state, never from Math.random, so the simulation harness can replay every game.

import { boardFor } from '../engine/editions.js';
import { legalActions, rentFor } from '../engine/game.js';
import { next } from '../engine/rng.js';

const BOARD_SIZE = 24;
const MAX_HOUSES_BEFORE_HOTEL = 3;
const MAJORITY = 2;
const EXPECTED_DICE = 7;
const LOOKAHEAD = 12;
const BASE_RESERVE = 150;
const UNMORTGAGE_MARGIN = 200;
const LATE_ROUND = 12;
const DANGEROUS_RENT = 100;
const TRANSPORT_BONUS = 50; // per transport square already owned
const GMUETLICH_BUY_MARGIN = 100;
const GMUETLICH_BUY_CHANCE = 0.7;
const GMUETLICH_BUILD_CHANCE = 0.5;

const boards = new Map();

function board(state) {
  if (!boards.has(state.edition)) boards.set(state.edition, boardFor(state.edition));
  return boards.get(state.edition);
}

// ---------- public API ----------

export function chooseAction(state, playerIndex) {
  if (playerIndex !== state.turn.player) throw new Error(`seat ${playerIndex} is not on turn`);
  const level = state.players[playerIndex].level === 'gwieft' ? GWIEFT : GMUETLICH;
  const decide = level[state.turn.phase];
  if (!decide) throw new Error(`no decision in phase ${state.turn.phase}`);
  return decide(context(state, playerIndex));
}

// ---------- context and helpers ----------

function context(state, me) {
  return { state, me, board: board(state), legal: legalActions(state), rand: randomSource(state, me) };
}

// Deterministic per decision point: the engine seed plus round, seat and cash.
function randomSource(state, me) {
  let seed = (state.seed + state.round * 7919 + me * 104729 + state.players[me].cash * 31) >>> 0;
  return () => {
    const r = next(seed);
    seed = r.seed;
    return r.value;
  };
}

const cash = (ctx) => ctx.state.players[ctx.me].cash;
const ofType = (ctx, type) => ctx.legal.filter((a) => a.type === type);
const first = (ctx, ...types) => types.map((t) => ofType(ctx, t)[0]).find(Boolean);
const prop = (ctx, square) => ctx.state.props[square];
const minBy = (items, score) => items.reduce((best, x) => (score(x) < score(best) ? x : best));
const maxBy = (items, score) => items.reduce((best, x) => (score(x) > score(best) ? x : best));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function myStreets(ctx) {
  return ctx.board.filter((sq) => sq.type === 'street' && prop(ctx, sq.index)?.owner === ctx.me);
}

function tierCount(ctx, tier, owner) {
  return ctx.board.filter((sq) => sq.type === 'street' && sq.tier === tier && prop(ctx, sq.index)?.owner === owner).length;
}

function rentAt(ctx, sq, houses) {
  if (houses > 0) return sq.rent[houses];
  return sq.rent[0] * (tierCount(ctx, sq.tier, ctx.me) === 3 ? 2 : 1);
}

// ---------- gmüetlich ----------

const GMUETLICH = {
  roll: (ctx) => first(ctx, 'JAIL_PAY', 'JAIL_ROLL', 'ROLL'),
  buy: (ctx) => (gmuetlichWantsToBuy(ctx) ? first(ctx, 'BUY') : first(ctx, 'PASS')),
  actions: gmuetlichActions,
  debt: (ctx) => first(ctx, 'SELL_HOUSE') ?? cheapestMortgage(ctx) ?? first(ctx, 'DECLARE_BANKRUPT'),
};

function gmuetlichWantsToBuy(ctx) {
  const price = ctx.board[ctx.state.turn.offer].price;
  return cash(ctx) >= price + GMUETLICH_BUY_MARGIN && ctx.rand() < GMUETLICH_BUY_CHANCE;
}

function gmuetlichActions(ctx) {
  const builds = ofType(ctx, 'BUILD');
  if (builds.length === 0 || ctx.rand() >= GMUETLICH_BUILD_CHANCE) return first(ctx, 'END_TURN');
  return builds[Math.floor(ctx.rand() * builds.length)];
}

function cheapestMortgage(ctx) {
  const mortgages = ofType(ctx, 'MORTGAGE');
  return mortgages.length ? minBy(mortgages, (a) => ctx.board[a.square].price) : undefined;
}

// ---------- gwieft ----------

const GWIEFT = {
  roll: gwieftRoll,
  buy: (ctx) => (gwieftWantsToBuy(ctx) ? first(ctx, 'BUY') : first(ctx, 'PASS')),
  actions: (ctx) => bestBuild(ctx) ?? affordableUnmortgage(ctx) ?? first(ctx, 'END_TURN'),
  debt: (ctx) => cheapestHouseToSell(ctx) ?? cheapestMortgage(ctx) ?? first(ctx, 'DECLARE_BANKRUPT'),
};

// Rents an opponent could collect from me within the next LOOKAHEAD squares.
function threats(ctx) {
  const pos = ctx.state.players[ctx.me].pos;
  return Array.from({ length: LOOKAHEAD }, (_, d) => (pos + d + 1) % BOARD_SIZE)
    .filter((sq) => prop(ctx, sq) && prop(ctx, sq).owner !== ctx.me)
    .map((sq) => rentFor(ctx.state, sq, EXPECTED_DICE));
}

const reserve = (ctx) => BASE_RESERVE + Math.max(0, ...threats(ctx));

function gwieftRoll(ctx) {
  if (!ctx.state.players[ctx.me].inJail) return first(ctx, 'ROLL');
  const stay = ctx.state.round > LATE_ROUND && mean(threats(ctx)) > DANGEROUS_RENT;
  return first(ctx, stay ? 'JAIL_ROLL' : 'JAIL_PAY', 'JAIL_ROLL');
}

function gwieftWantsToBuy(ctx) {
  const sq = ctx.board[ctx.state.turn.offer];
  if (cash(ctx) < sq.price) return false;
  if (sq.type === 'street' && tierMatters(ctx, sq.tier)) return true;
  return sq.price <= cash(ctx) - reserve(ctx) + transportBonus(ctx, sq);
}

// Buying completes my own 2-of-3, or denies an opponent who already holds 2-of-3.
function tierMatters(ctx, tier) {
  if (tierCount(ctx, tier, ctx.me) === MAJORITY - 1) return true;
  return ctx.state.players.some((_, i) => i !== ctx.me && tierCount(ctx, tier, i) >= MAJORITY);
}

function transportBonus(ctx, sq) {
  if (sq.type !== 'transport') return 0;
  const owned = ctx.board.filter((q) => q.type === 'transport' && prop(ctx, q.index)?.owner === ctx.me).length;
  return TRANSPORT_BONUS * owned;
}

function bestBuild(ctx) {
  const needed = reserve(ctx);
  const affordable = ofType(ctx, 'BUILD').filter((a) => cash(ctx) - ctx.board[a.square].houseCost >= needed);
  const houses = affordable.filter((a) => prop(ctx, a.square).houses < MAX_HOUSES_BEFORE_HOTEL);
  if (houses.length) return maxBy(houses, (a) => rentGainPerChf(ctx, a.square));
  if (!affordable.length || !allMajorityStreetsFull(ctx)) return undefined;
  return maxBy(affordable, (a) => rentGainPerChf(ctx, a.square));
}

function rentGainPerChf(ctx, square) {
  const sq = ctx.board[square];
  const { houses } = prop(ctx, square);
  return (rentAt(ctx, sq, houses + 1) - rentAt(ctx, sq, houses)) / sq.houseCost;
}

function allMajorityStreetsFull(ctx) {
  return myStreets(ctx)
    .filter((sq) => tierCount(ctx, sq.tier, ctx.me) >= MAJORITY)
    .every((sq) => prop(ctx, sq.index).houses >= MAX_HOUSES_BEFORE_HOTEL);
}

function affordableUnmortgage(ctx) {
  const needed = reserve(ctx) + UNMORTGAGE_MARGIN;
  const options = ofType(ctx, 'UNMORTGAGE').filter((a) => cash(ctx) - unmortgageCost(ctx.board[a.square]) >= needed);
  return options.length ? minBy(options, (a) => unmortgageCost(ctx.board[a.square])) : undefined;
}

const unmortgageCost = (sq) => Math.ceil(sq.price * 0.55);

function cheapestHouseToSell(ctx) {
  const sells = ofType(ctx, 'SELL_HOUSE');
  return sells.length ? minBy(sells, (a) => rentLoss(ctx, a.square)) : undefined;
}

function rentLoss(ctx, square) {
  const { houses } = prop(ctx, square);
  return rentAt(ctx, ctx.board[square], houses) - rentAt(ctx, ctx.board[square], houses - 1);
}
