// Hand-written mid-game state matching the engine contract in the plan, plus the
// smallest transitions needed to click through the shell. Temporary: replaced by
// src/engine/game.js once the engine lands. Not the rules.

import { boardFor } from '../engine/editions.js';

export function stubState({ edition = 'zuerich', players } = {}) {
  const seats = players ?? [
    { name: 'Vreni', kind: 'local' },
    { name: 'Sepp', kind: 'cpu', level: 'gwieft' },
    { name: 'Heidi', kind: 'cpu', level: 'gmuetlich' },
    { name: 'Ueli', kind: 'cpu', level: 'gwieft' },
  ];
  const cash = [910, 1240, 385, 1560];
  const pos = [4, 15, 6, 22];
  return {
    edition,
    seed: 1234567,
    round: 7,
    maxRounds: 20,
    startPlayer: 0,
    finalRound: false,
    startedAt: Date.now() - 11 * 60 * 1000,
    timeLimitMs: 30 * 60 * 1000,
    players: seats.map((s, i) => ({
      id: `p${i}`,
      name: s.name,
      kind: s.kind,
      level: s.level ?? null,
      cash: cash[i] ?? 1500,
      pos: pos[i] ?? 0,
      inJail: i === 2,
      jailTurns: i === 2 ? 1 : 0,
      bankrupt: false,
      left: false,
    })),
    turn: { player: 0, phase: 'buy', doubles: 0, dice: [3, 1], offer: 4, debt: null, doubleRent: false },
    props: {
      1: { owner: 0, houses: 2, mortgaged: false },
      3: { owner: 0, houses: 1, mortgaged: false },
      5: { owner: 1, houses: 0, mortgaged: false },
      7: { owner: 1, houses: 0, mortgaged: false },
      8: { owner: 1, houses: 3, mortgaged: false },
      9: { owner: 1, houses: 0, mortgaged: false },
      10: { owner: 2, houses: 0, mortgaged: false },
      11: { owner: 2, houses: 0, mortgaged: true },
      13: { owner: 3, houses: 0, mortgaged: false },
      15: { owner: 3, houses: 4, mortgaged: false },
      17: { owner: 3, houses: 1, mortgaged: false },
      19: { owner: 2, houses: 0, mortgaged: false },
      20: { owner: 0, houses: 0, mortgaged: false },
    },
    deck: ['jass', 'rega', 'geburtstag', 'los', 'renovation'],
    log: [
      { t: 'round', n: 7 },
      { t: 'turn', p: 3 },
      { t: 'roll', p: 3, dice: [6, 4] },
      { t: 'move', p: 3, from: 12, to: 22, passedGo: false },
      { t: 'tax', p: 3, amount: 100 },
      { t: 'build', p: 3, square: 15, houses: 4 },
      { t: 'turn', p: 0 },
      { t: 'roll', p: 0, dice: [3, 1] },
      { t: 'move', p: 0, from: 0, to: 4, passedGo: false },
    ],
    winner: null,
  };
}

export function stubLegal(state) {
  const { turn } = state;
  const me = turn.player;
  if (turn.phase === 'over') return [];
  if (turn.phase === 'buy') return [{ type: 'BUY' }, { type: 'PASS' }];
  if (turn.phase === 'roll') {
    return state.players[me].inJail ? [{ type: 'JAIL_PAY' }, { type: 'JAIL_ROLL' }] : [{ type: 'ROLL' }];
  }
  const board = boardFor(state.edition);
  const cash = state.players[me].cash;
  const mine = Object.entries(state.props)
    .filter(([, p]) => p.owner === me)
    .map(([sq, p]) => ({ ...p, square: board[+sq] }));
  const actions = [];
  for (const p of mine) {
    const sq = p.square;
    if (sq.type === 'street' && !p.mortgaged && p.houses < 4 && ownsMajority(mine, sq.tier) && cash >= sq.houseCost) {
      actions.push({ type: 'BUILD', square: sq.index });
    }
    if (p.houses > 0) actions.push({ type: 'SELL_HOUSE', square: sq.index });
  }
  for (const p of mine) {
    if (p.houses === 0 && !p.mortgaged) actions.push({ type: 'MORTGAGE', square: p.square.index });
    if (p.mortgaged && turn.phase === 'actions') actions.push({ type: 'UNMORTGAGE', square: p.square.index });
  }
  if (turn.phase === 'debt') actions.push({ type: 'DECLARE_BANKRUPT' });
  if (turn.phase === 'actions') actions.push({ type: 'END_TURN' });
  return actions;
}

function ownsMajority(mine, tier) {
  return mine.filter((p) => p.square.type === 'street' && p.square.tier === tier).length >= 2;
}

function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export function stubReduce(state, action) {
  const next = structuredClone(state);
  const me = next.turn.player;
  const player = next.players[me];
  const board = boardFor(next.edition);
  const log = (entry) => next.log.push(entry);
  switch (action.type) {
    case 'ROLL':
    case 'JAIL_PAY':
    case 'JAIL_ROLL': {
      const dice = [rollDie(), rollDie()];
      if (action.type === 'JAIL_PAY') player.cash -= 50;
      player.inJail = false;
      const from = player.pos;
      const to = (from + dice[0] + dice[1]) % 24;
      const passedGo = to < from;
      if (passedGo) player.cash += 200;
      player.pos = to;
      next.turn.dice = dice;
      log({ t: 'roll', p: me, dice });
      log({ t: 'move', p: me, from, to, passedGo });
      const buyable = board[to].price && !next.props[to];
      next.turn.phase = buyable ? 'buy' : 'actions';
      next.turn.offer = buyable ? to : null;
      break;
    }
    case 'BUY': {
      const sq = board[next.turn.offer];
      next.props[sq.index] = { owner: me, houses: 0, mortgaged: false };
      player.cash -= sq.price;
      log({ t: 'buy', p: me, square: sq.index });
      next.turn.offer = null;
      next.turn.phase = 'actions';
      break;
    }
    case 'PASS':
      log({ t: 'pass', p: me, square: next.turn.offer });
      next.turn.offer = null;
      next.turn.phase = 'actions';
      break;
    case 'BUILD':
      next.props[action.square].houses += 1;
      player.cash -= board[action.square].houseCost;
      log({ t: 'build', p: me, square: action.square, houses: next.props[action.square].houses });
      break;
    case 'SELL_HOUSE':
      next.props[action.square].houses -= 1;
      player.cash += board[action.square].houseCost / 2;
      log({ t: 'sell', p: me, square: action.square });
      break;
    case 'MORTGAGE':
      next.props[action.square].mortgaged = true;
      player.cash += board[action.square].price / 2;
      log({ t: 'mortgage', p: me, square: action.square });
      break;
    case 'UNMORTGAGE':
      next.props[action.square].mortgaged = false;
      player.cash -= Math.ceil(board[action.square].price * 0.55);
      log({ t: 'unmortgage', p: me, square: action.square });
      break;
    case 'END_TURN': {
      next.turn.player = (me + 1) % next.players.length;
      next.turn.phase = 'roll';
      next.turn.dice = null;
      if (next.turn.player === next.startPlayer) {
        next.round += 1;
        log({ t: 'round', n: next.round });
      }
      log({ t: 'turn', p: next.turn.player });
      if (next.round > next.maxRounds || next.finalRound) finish(next, log);
      break;
    }
    case 'TIME_UP':
      next.finalRound = true;
      log({ t: 'timeUp' });
      break;
    case 'DECLARE_BANKRUPT':
      player.bankrupt = true;
      finish(next, log);
      break;
    default:
      throw new Error(`stub: unknown action ${action.type}`);
  }
  next.log = next.log.slice(-40);
  return next;
}

function finish(state, log) {
  const ranked = state.players.map((_, i) => i).sort((a, b) => stubNetWorth(state, b) - stubNetWorth(state, a));
  state.turn.phase = 'over';
  state.winner = ranked[0];
  log({ t: 'over', winner: ranked[0] });
}

export function stubNetWorth(state, i) {
  const board = boardFor(state.edition);
  return Object.entries(state.props).reduce((sum, [sq, p]) => {
    if (p.owner !== i) return sum;
    const square = board[+sq];
    return sum + (p.mortgaged ? square.price / 2 : square.price) + p.houses * (square.houseCost ?? 0);
  }, state.players[i].cash);
}
