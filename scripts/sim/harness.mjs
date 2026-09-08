#!/usr/bin/env node
// CPU-vs-CPU simulation:
//   node scripts/sim/harness.mjs [games=500] [players=4] [edition=zuerich|all] [level=mix|gmuetlich|gwieft] [maxRounds=20]
// Checks engine invariants after every action and prints length statistics per edition.
// Exit code 1 on the first violation, with seed and action list for reproduction.

import { newGame, reduce, isOver, netWorth } from '../../src/engine/game.js';
import { boardFor, EDITION_IDS, SALARY, JAIL_FINE } from '../../src/engine/editions.js';
import { cardById } from '../../src/engine/cards.js';
import { chooseAction } from '../../src/ai/cpu.js';

const HOTEL = 4;
const MAJORITY = 2;
const UNMORTGAGE_RATE = 0.55;
const MAX_ACTIONS = 10_000;
const HUMAN_SECONDS = 15;
const CPU_TURN_SECONDS = 2;
const HUMAN_SEATS = 2;
const HUMAN_DECISIONS = new Set(['BUY', 'PASS', 'BUILD', 'END_TURN']);
const TURN_STARTS = new Set(['ROLL', 'JAIL_PAY', 'JAIL_ROLL']);

// ---------- arguments ----------

const [games = '500', players = '4', edition = 'zuerich', level = 'mix', maxRounds = '20'] = process.argv.slice(2);
const options = { games: Number(games), players: Number(players), level, maxRounds: Number(maxRounds) };
const editions = edition === 'all' ? EDITION_IDS : [edition];

function seats(n, level) {
  return Array.from({ length: n }, (_, i) => ({
    name: `CPU ${i}`, kind: 'cpu', level: level === 'mix' ? ['gmuetlich', 'gwieft'][i % 2] : level,
  }));
}

// ---------- one game ----------

function playGame(edition, seed, { players, level, maxRounds }) {
  const board = boardFor(edition);
  let s = newGame({ edition, players: seats(players, level), seed, maxRounds });
  const trace = [];
  try {
    while (!isOver(s)) {
      const action = chooseAction(s, s.turn.player);
      trace.push({ seat: s.turn.player, action });
      const before = s;
      s = reduce(s, action);
      checkInvariants(before, s, board);
      if (trace.length > MAX_ACTIONS) throw new Error(`more than ${MAX_ACTIONS} actions`);
    }
  } catch (err) {
    const actions = JSON.stringify(trace.map((t) => t.action));
    throw new Error(`invariant violated: ${err.message}\nedition=${edition} seed=${seed} players=${players} level=${level} maxRounds=${maxRounds}\nactions=${actions}`);
  }
  return summarize(s, trace, maxRounds);
}

// ---------- invariants ----------

function checkInvariants(before, after, board) {
  checkMoney(before, after, board);
  checkCash(after);
  checkProps(after, board);
  checkRounds(after);
  checkTurn(after);
}

const totalCash = (s) => s.players.reduce((sum, p) => sum + p.cash, 0);

function checkMoney(before, after, board) {
  const entries = newEntries(before.log, after.log);
  const expected = entries.reduce((sum, e) => sum + (FLOWS[e.t]?.(e, before, board) ?? 0), 0);
  const actual = totalCash(after) - totalCash(before);
  if (actual !== expected) throw new Error(`money: cash moved by ${actual}, log explains ${expected} (${entries.map((e) => e.t).join(',')})`);
}

// Money entering (+) or leaving (-) the players' pockets via the bank, per log entry.
const FLOWS = {
  salary: () => SALARY,
  tax: (e) => -e.amount,
  buy: (e, s, board) => -board[e.square].price,
  build: (e, s, board) => -board[e.square].houseCost,
  sell: (e, s, board) => board[e.square].houseCost / 2,
  mortgage: (e, s, board) => board[e.square].price / 2,
  unmortgage: (e, s, board) => -Math.ceil(board[e.square].price * UNMORTGAGE_RATE),
  jailOut: (e) => (e.how === 'doubles' ? 0 : -JAIL_FINE),
  rent: (e, s) => (s.players[e.to].left ? -e.amount : 0),
  card: cardFlow,
  bankrupt: bankruptFlow,
};

function cardFlow(e, s, board) {
  const { effect } = cardById(e.card);
  if (effect.kind === 'pay') return -effect.amount;
  if (effect.kind === 'collect') return effect.amount;
  if (effect.kind === 'repairs') return -repairCost(s, e.p, board, effect);
  return 0;
}

function repairCost(s, owner, board, { perHouse, perHotel }) {
  return ownedSquares(s, owner, board).reduce((sum, sq) => {
    const { houses } = s.props[sq.index];
    return sum + (houses === HOTEL ? perHotel : houses * perHouse);
  }, 0);
}

// Houses are sold to the bank; a positive balance goes to the creditor, a negative one is written off.
function bankruptFlow(e, s, board) {
  const cashBefore = s.players[e.p].cash;
  const proceeds = ownedSquares(s, e.p, board).reduce((sum, sq) => sum + s.props[sq.index].houses * (sq.houseCost / 2), 0);
  if (e.to !== null && cashBefore + proceeds > 0) return proceeds;
  return -cashBefore;
}

function ownedSquares(s, owner, board) {
  return board.filter((sq) => s.props[sq.index]?.owner === owner);
}

// The log keeps only the last 40 entries: the new ones follow the longest tail of the old log.
function newEntries(oldLog, newLog) {
  for (let n = 0; n <= newLog.length; n++) {
    const kept = newLog.length - n;
    if (kept > oldLog.length) continue;
    if (same(newLog.slice(0, kept), oldLog.slice(oldLog.length - kept))) return newLog.slice(kept);
  }
  throw new Error('log does not continue the previous log');
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function checkCash(s) {
  s.players.forEach((p, i) => {
    const inDebt = (s.turn.phase === 'debt' && s.turn.player === i) || p.pendingDebt !== null;
    if (p.cash < 0 && !inDebt) throw new Error(`player ${i} has ${p.cash} in phase ${s.turn.phase}`);
    if (p.bankrupt && p.cash !== 0) throw new Error(`bankrupt player ${i} holds ${p.cash}`);
  });
}

function checkProps(s, board) {
  for (const [key, prop] of Object.entries(s.props)) {
    const sq = board[Number(key)];
    if (!sq || !['street', 'transport', 'utility'].includes(sq.type)) throw new Error(`property on square ${key}`);
    const owner = s.players[prop.owner];
    if (!owner || owner.bankrupt) throw new Error(`square ${key} owned by missing or bankrupt player ${prop.owner}`);
    if (prop.houses < 0 || prop.houses > HOTEL) throw new Error(`square ${key} has ${prop.houses} houses`);
    if (prop.houses > 0 && sq.type !== 'street') throw new Error(`houses on non-street ${key}`);
    if (prop.houses > 0 && prop.mortgaged) throw new Error(`houses on mortgaged ${key}`);
    if (prop.houses > 0 && tierCount(s, board, sq.tier, prop.owner) < MAJORITY) throw new Error(`houses without majority on ${key}`);
  }
}

function tierCount(s, board, tier, owner) {
  return board.filter((q) => q.type === 'street' && q.tier === tier && s.props[q.index]?.owner === owner).length;
}

function checkRounds(s) {
  if (s.round > s.maxRounds + 1) throw new Error(`round ${s.round} exceeds maxRounds ${s.maxRounds}`);
  if (!isOver(s) && s.round > s.maxRounds) throw new Error(`round ${s.round} but game not over`);
  if (isOver(s) && s.winner === null) throw new Error('game over without winner');
}

function checkTurn(s) {
  const p = s.players[s.turn.player];
  if (!p) throw new Error(`turn.player ${s.turn.player} does not exist`);
  if (!isOver(s) && (p.bankrupt || p.left)) throw new Error(`turn given to inactive player ${s.turn.player}`);
}

// ---------- per-game summary ----------

function summarize(s, trace, maxRounds) {
  const solvent = s.players.filter((p) => !p.bankrupt);
  const worths = solvent.map((p) => netWorth(s, p.id));
  return {
    rounds: Math.min(s.round, maxRounds),
    bankruptcies: s.players.length - solvent.length,
    ending: ending(s, solvent),
    winner: s.winner,
    actions: trace.length,
    spread: Math.max(...worths) - Math.min(...worths),
    seconds: wallClock(trace),
  };
}

function ending(s, solvent) {
  if (solvent.length <= 1) return 'last-solvent';
  return solvent.length === s.players.length ? 'limit' : 'limit+bankruptcy';
}

// Seats below HUMAN_SEATS are imagined as humans: 15 s per decision; the rest are CPUs: 2 s per turn.
function wallClock(trace) {
  return trace.reduce((sum, { seat, action }) => {
    if (seat < HUMAN_SEATS) return sum + (HUMAN_DECISIONS.has(action.type) ? HUMAN_SECONDS : 0);
    return sum + (TURN_STARTS.has(action.type) ? CPU_TURN_SECONDS : 0);
  }, 0);
}

// ---------- aggregation and output ----------

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pct = (xs, pred) => `${Math.round((100 * xs.filter(pred).length) / xs.length)} %`;
const minutes = (seconds) => `${(seconds / 60).toFixed(1)} min`;

function aggregate(results, nSeats) {
  const winners = Array.from({ length: nSeats }, (_, seat) => pct(results, (r) => r.winner === seat)).join(' / ');
  return {
    games: results.length,
    'rounds median / mean': `${median(results.map((r) => r.rounds))} / ${mean(results.map((r) => r.rounds)).toFixed(1)}`,
    'ended by round limit, no bankruptcy': pct(results, (r) => r.ending === 'limit'),
    'ended by round limit after bankruptcy': pct(results, (r) => r.ending === 'limit+bankruptcy'),
    'ended by last solvent player': pct(results, (r) => r.ending === 'last-solvent'),
    'games with >= 1 bankruptcy': pct(results, (r) => r.bankruptcies > 0),
    'bankruptcies per game': mean(results.map((r) => r.bankruptcies)).toFixed(2),
    'net-worth spread at end (mean)': Math.round(mean(results.map((r) => r.spread))),
    'winner share by seat': winners,
    'actions per game': Math.round(mean(results.map((r) => r.actions))),
    [`wall-clock ${HUMAN_SEATS} humans + ${nSeats - HUMAN_SEATS} CPUs (median / mean)`]:
      `${minutes(median(results.map((r) => r.seconds)))} / ${minutes(mean(results.map((r) => r.seconds)))}`,
  };
}

function printTable(rows) {
  const metrics = Object.keys(rows[editions[0]]);
  const label = Math.max(...metrics.map((m) => m.length));
  const value = Math.max(...editions.flatMap((e) => metrics.map((m) => String(rows[e][m]).length))) + 2;
  console.log(`${'metric'.padEnd(label)}${editions.map((e) => e.padStart(value)).join('')}`);
  for (const metric of metrics) {
    console.log(`${metric.padEnd(label)}${editions.map((e) => String(rows[e][metric]).padStart(value)).join('')}`);
  }
}

function main() {
  console.log(`harness: ${options.games} games, ${options.players} players, level ${options.level}, maxRounds ${options.maxRounds}`);
  const rows = {};
  for (const ed of editions) {
    const results = [];
    for (let seed = 1; seed <= options.games; seed++) results.push(playGame(ed, seed, options));
    rows[ed] = aggregate(results, options.players);
  }
  printTable(rows);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
