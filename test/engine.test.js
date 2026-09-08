import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { next, rollDice, shuffle } from '../src/engine/rng.js';
import { CARDS, CARD_IDS, cardById } from '../src/engine/cards.js';
import { EDITION_IDS, boardFor, JAIL_FINE, SALARY, TAX } from '../src/engine/editions.js';
import { newGame, legalActions, reduce, netWorth, rentFor, isOver } from '../src/engine/game.js';

// ---------- helpers ----------

const PLAYERS = [
  { name: 'Anna', kind: 'local' },
  { name: 'Beat', kind: 'cpu', level: 'gmuetlich' },
  { name: 'Cla', kind: 'cpu', level: 'gwieft' },
  { name: 'Dora', kind: 'remote' },
];

function setup(over = {}) {
  const state = newGame({ edition: 'zuerich', players: PLAYERS, seed: 7, ...over });
  return mut(state, (s) => {
    s.startPlayer = 0;
    s.turn.player = 0;
  });
}

function mut(state, fn) {
  const s = structuredClone(state);
  fn(s);
  return s;
}

function own(s, square, owner, extra = {}) {
  s.props[square] = { owner, houses: 0, mortgaged: false, ...extra };
}

function seedForRolls(rolls) {
  for (let seed = 1; seed < 5_000_000; seed++) {
    if (chainMatches(seed, rolls)) return seed;
  }
  throw new Error('no seed found');
}

function chainMatches(seed, rolls) {
  let s = seed;
  for (const [a, b] of rolls) {
    const r = rollDice(s);
    if (r.dice[0] !== a || r.dice[1] !== b) return false;
    s = r.seed;
  }
  return true;
}

function atPos(state, pos, rolls, patch = () => {}) {
  return mut(state, (s) => {
    s.players[0].pos = pos;
    s.seed = seedForRolls(rolls);
    patch(s);
  });
}

function withCard(state, id, patch = () => {}) {
  return atPos(state, 9, [[2, 3]], (s) => {
    s.deck = [id];
    patch(s);
  });
}

const types = (actions) => actions.map((a) => a.type);
const last = (state, t) => [...state.log].reverse().find((e) => e.t === t);
const inActions = (state) => mut(state, (s) => { s.turn.phase = 'actions'; s.turn.dice = [1, 2]; });

// ---------- rng ----------

describe('rng', () => {
  test('next is deterministic and advances the seed', () => {
    const a = next(42);
    const b = next(42);
    assert.deepEqual(a, b);
    assert.notEqual(a.seed, 42);
    assert.ok(a.value >= 0 && a.value < 1);
    assert.notEqual(next(a.seed).value, a.value);
  });

  test('rollDice yields two dice in 1..6 and a new seed', () => {
    let seed = 1;
    for (let i = 0; i < 200; i++) {
      const r = rollDice(seed);
      assert.equal(r.dice.length, 2);
      for (const d of r.dice) assert.ok(d >= 1 && d <= 6);
      assert.notEqual(r.seed, seed);
      seed = r.seed;
    }
  });

  test('shuffle returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const r = shuffle(input, 5);
    assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual([...r.array].sort(), input);
    assert.deepEqual(shuffle(input, 5).array, r.array);
    assert.notEqual(r.seed, 5);
  });
});

// ---------- cards ----------

describe('cards', () => {
  test('there are 11 cards with unique ids, text and effect', () => {
    assert.equal(CARDS.length, 11);
    assert.equal(new Set(CARD_IDS).size, 11);
    for (const c of CARDS) {
      assert.equal(typeof c.text, 'string');
      assert.equal(typeof c.effect.kind, 'string');
      assert.equal(cardById(c.id), c);
    }
  });

  test('the spec cards exist by id', () => {
    for (const id of ['rega', 'jass', 'chrankekasse', 'los', 'gfaengnis', 'sbb', 'verkehr', 'renovation', 'geburtstag', 'parkbuess', 'tuuerscht']) {
      assert.ok(cardById(id), id);
    }
    assert.equal(cardById('tuuerscht').effect.square, 23);
  });
});

// ---------- newGame ----------

describe('newGame', () => {
  for (const edition of EDITION_IDS) {
    test(`shape for edition ${edition}`, () => {
      const s = newGame({ edition, players: PLAYERS, seed: 3 });
      assert.equal(s.edition, edition);
      assert.equal(typeof s.seed, 'number');
      assert.equal(s.round, 1);
      assert.equal(s.maxRounds, 20);
      assert.equal(s.timeLimitMs, 30 * 60 * 1000);
      assert.equal(s.finalRound, false);
      assert.ok(s.startPlayer >= 0 && s.startPlayer < 4);
      assert.equal(s.players.length, 4);
      s.players.forEach((p, i) => {
        assert.equal(p.id, i);
        assert.equal(p.name, PLAYERS[i].name);
        assert.equal(p.kind, PLAYERS[i].kind);
        assert.equal(p.level, PLAYERS[i].level ?? null);
        assert.equal(p.cash, 1500);
        assert.equal(p.pos, 0);
        assert.equal(p.inJail, false);
        assert.equal(p.jailTurns, 0);
        assert.equal(p.bankrupt, false);
        assert.equal(p.left, false);
      });
      assert.deepEqual(s.turn, { player: s.startPlayer, phase: 'roll', doubles: 0, dice: null, offer: null, debt: null, doubleRent: false });
      assert.deepEqual(s.props, {});
      assert.equal(new Set(s.deck).size, 11);
      assert.equal(s.winner, null);
      assert.equal(last(s, 'turn').p, s.startPlayer);
      assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
    });
  }

  test('rejects unknown editions and wrong player counts', () => {
    assert.throws(() => newGame({ edition: 'bern', players: PLAYERS, seed: 1 }), /edition/);
    assert.throws(() => newGame({ edition: 'zuerich', players: PLAYERS.slice(0, 1), seed: 1 }), /players/);
    assert.throws(() => newGame({ edition: 'zuerich', players: [...PLAYERS, PLAYERS[0]], seed: 1 }), /players/);
  });

  test('the same seed gives the same start player and deck', () => {
    const a = newGame({ edition: 'basel', players: PLAYERS, seed: 99 });
    const b = newGame({ edition: 'basel', players: PLAYERS, seed: 99 });
    assert.deepEqual(a, b);
  });
});

// ---------- rolling and moving ----------

describe('roll and move', () => {
  test('ROLL moves the player and offers an unowned property', () => {
    const s = reduce(atPos(setup(), 0, [[3, 4]]), { type: 'ROLL' });
    assert.deepEqual(s.turn.dice, [3, 4]);
    assert.equal(s.players[0].pos, 7);
    assert.equal(s.turn.phase, 'buy');
    assert.equal(s.turn.offer, 7);
    assert.deepEqual(last(s, 'roll'), { t: 'roll', p: 0, dice: [3, 4] });
    assert.deepEqual(last(s, 'move'), { t: 'move', p: 0, from: 0, to: 7, passedGo: false });
  });

  test('passing LOS pays the salary', () => {
    const s = reduce(atPos(setup(), 20, [[3, 4]]), { type: 'ROLL' });
    assert.equal(s.players[0].pos, 3);
    assert.equal(s.players[0].cash, 1500 + SALARY);
    assert.equal(last(s, 'move').passedGo, true);
    assert.deepEqual(last(s, 'salary'), { t: 'salary', p: 0 });
  });

  test('landing exactly on LOS pays the salary once', () => {
    const s = reduce(atPos(setup(), 17, [[3, 4]]), { type: 'ROLL' });
    assert.equal(s.players[0].pos, 0);
    assert.equal(s.players[0].cash, 1700);
    assert.equal(s.turn.phase, 'actions');
  });

  test('reduce never mutates its input', () => {
    const before = atPos(setup(), 0, [[3, 4]]);
    const snapshot = JSON.stringify(before);
    reduce(before, { type: 'ROLL' });
    assert.equal(JSON.stringify(before), snapshot);
  });

  test('illegal actions throw', () => {
    assert.throws(() => reduce(setup(), { type: 'BUY' }), /illegal/i);
    assert.throws(() => reduce(setup(), { type: 'JAIL_PAY' }), /illegal/i);
    assert.throws(() => reduce(setup(), { type: 'NOPE' }), /illegal/i);
  });

  test('legalActions in roll phase', () => {
    assert.deepEqual(legalActions(setup()), [{ type: 'ROLL' }]);
  });
});

// ---------- buy / pass ----------

describe('buy and pass', () => {
  const offered = () => reduce(atPos(setup(), 0, [[3, 4]]), { type: 'ROLL' });

  test('BUY takes the property at list price', () => {
    const s = reduce(offered(), { type: 'BUY' });
    assert.equal(s.players[0].cash, 1400);
    assert.deepEqual(s.props[7], { owner: 0, houses: 0, mortgaged: false });
    assert.equal(s.turn.phase, 'actions');
    assert.equal(s.turn.offer, null);
    assert.deepEqual(last(s, 'buy'), { t: 'buy', p: 0, square: 7 });
  });

  test('PASS leaves it with the bank', () => {
    const s = reduce(offered(), { type: 'PASS' });
    assert.equal(s.players[0].cash, 1500);
    assert.equal(s.props[7], undefined);
    assert.equal(s.turn.phase, 'actions');
    assert.deepEqual(last(s, 'pass'), { t: 'pass', p: 0, square: 7 });
  });

  test('BUY is only legal with enough cash', () => {
    assert.deepEqual(types(legalActions(offered())), ['BUY', 'PASS']);
    const poor = mut(offered(), (s) => { s.players[0].cash = 99; });
    assert.deepEqual(types(legalActions(poor)), ['PASS']);
    assert.throws(() => reduce(poor, { type: 'BUY' }), /illegal/i);
  });
});

// ---------- rent ----------

describe('rent', () => {
  test('street rent with 0 houses, full tier doubles it', () => {
    const one = mut(setup(), (s) => own(s, 7, 1));
    assert.equal(rentFor(one, 7, 5), 8);
    const full = mut(one, (s) => { own(s, 8, 1); own(s, 11, 1); });
    assert.equal(rentFor(full, 7, 5), 16);
    assert.equal(rentFor(full, 11, 5), 20);
  });

  test('street rent with houses and hotel', () => {
    const s = mut(setup(), (s) => { own(s, 7, 1, { houses: 2 }); own(s, 8, 1, { houses: 4 }); own(s, 11, 1); });
    assert.equal(rentFor(s, 7, 5), 100);
    assert.equal(rentFor(s, 8, 5), 450);
  });

  test('mortgaged property collects nothing', () => {
    const s = mut(setup(), (s) => { own(s, 7, 1, { mortgaged: true }); own(s, 4, 1, { mortgaged: true }); });
    assert.equal(rentFor(s, 7, 5), 0);
    assert.equal(rentFor(s, 4, 5), 0);
  });

  test('transport rent by count owned', () => {
    const s = mut(setup(), (s) => { own(s, 4, 1); });
    assert.equal(rentFor(s, 4, 5), 25);
    const three = mut(s, (s) => { own(s, 9, 1); own(s, 16, 1); });
    assert.equal(rentFor(three, 4, 5), 100);
    const four = mut(three, (s) => own(s, 20, 1));
    assert.equal(rentFor(four, 20, 5), 200);
  });

  test('utility rent is 8 x dice', () => {
    const s = mut(setup(), (s) => own(s, 10, 1));
    assert.equal(rentFor(s, 10, 7), 56);
  });

  test('unowned squares have no rent', () => {
    assert.equal(rentFor(setup(), 7, 5), 0);
    assert.equal(rentFor(setup(), 0, 5), 0);
  });

  test('landing on an opponent street pays rent automatically', () => {
    const s = reduce(atPos(setup(), 3, [[1, 3]], (s) => own(s, 7, 1)), { type: 'ROLL' });
    assert.equal(s.players[0].cash, 1492);
    assert.equal(s.players[1].cash, 1508);
    assert.equal(s.turn.phase, 'actions');
    assert.deepEqual(last(s, 'rent'), { t: 'rent', p: 0, to: 1, square: 7, amount: 8 });
  });

  test('landing on a utility pays 8 x dice', () => {
    const s = reduce(atPos(setup(), 3, [[3, 4]], (s) => own(s, 10, 1)), { type: 'ROLL' });
    assert.equal(s.players[0].cash, 1500 - 56);
  });

  test('landing on your own property does nothing', () => {
    const s = reduce(atPos(setup(), 3, [[1, 3]], (s) => own(s, 7, 0)), { type: 'ROLL' });
    assert.equal(s.players[0].cash, 1500);
    assert.equal(s.turn.phase, 'actions');
  });

  test('landing on a mortgaged property costs nothing', () => {
    const s = reduce(atPos(setup(), 3, [[1, 3]], (s) => own(s, 7, 1, { mortgaged: true })), { type: 'ROLL' });
    assert.equal(s.players[0].cash, 1500);
    assert.equal(last(s, 'rent'), undefined);
  });
});

// ---------- building ----------

describe('building', () => {
  const majority = () => inActions(mut(setup(), (s) => { own(s, 7, 0); own(s, 8, 0); }));

  test('BUILD needs 2 of the 3 tier streets', () => {
    const single = inActions(mut(setup(), (s) => own(s, 7, 0)));
    assert.ok(!legalActions(single).some((a) => a.type === 'BUILD'));
    assert.throws(() => reduce(single, { type: 'BUILD', square: 7 }), /illegal/i);
    const builds = legalActions(majority()).filter((a) => a.type === 'BUILD');
    assert.deepEqual(builds, [{ type: 'BUILD', square: 7 }, { type: 'BUILD', square: 8 }]);
  });

  test('BUILD costs the house price and adds a house', () => {
    const s = reduce(majority(), { type: 'BUILD', square: 7 });
    assert.equal(s.props[7].houses, 1);
    assert.equal(s.players[0].cash, 1400);
    assert.deepEqual(last(s, 'build'), { t: 'build', p: 0, square: 7, houses: 1 });
    assert.equal(s.turn.phase, 'actions');
  });

  test('BUILD stops at the hotel, on mortgaged streets and without cash', () => {
    let s = majority();
    for (let i = 0; i < 4; i++) s = reduce(s, { type: 'BUILD', square: 7 });
    assert.equal(s.props[7].houses, 4);
    assert.ok(!legalActions(s).some((a) => a.type === 'BUILD' && a.square === 7));
    const mortgaged = mut(majority(), (s) => { s.props[8].mortgaged = true; });
    assert.ok(!legalActions(mortgaged).some((a) => a.type === 'BUILD' && a.square === 8));
    const poor = mut(majority(), (s) => { s.players[0].cash = 99; });
    assert.ok(!legalActions(poor).some((a) => a.type === 'BUILD'));
  });

  test('SELL_HOUSE returns half the house cost', () => {
    const built = reduce(majority(), { type: 'BUILD', square: 7 });
    assert.ok(legalActions(built).some((a) => a.type === 'SELL_HOUSE' && a.square === 7));
    const s = reduce(built, { type: 'SELL_HOUSE', square: 7 });
    assert.equal(s.props[7].houses, 0);
    assert.equal(s.players[0].cash, 1450);
    assert.deepEqual(last(s, 'sell'), { t: 'sell', p: 0, square: 7 });
    assert.ok(!legalActions(s).some((a) => a.type === 'SELL_HOUSE'));
  });

  test('legalActions shape in the actions phase', () => {
    const s = mut(majority(), (s) => { own(s, 4, 0, { mortgaged: true }); s.props[8].houses = 1; });
    assert.deepEqual(legalActions(s), [
      { type: 'BUILD', square: 7 },
      { type: 'BUILD', square: 8 },
      { type: 'SELL_HOUSE', square: 8 },
      { type: 'MORTGAGE', square: 7 },
      { type: 'UNMORTGAGE', square: 4 },
      { type: 'END_TURN' },
    ]);
  });
});

// ---------- mortgage ----------

describe('mortgage', () => {
  test('MORTGAGE raises half the price', () => {
    const s = reduce(inActions(mut(setup(), (s) => own(s, 7, 0))), { type: 'MORTGAGE', square: 7 });
    assert.equal(s.props[7].mortgaged, true);
    assert.equal(s.players[0].cash, 1550);
    assert.deepEqual(last(s, 'mortgage'), { t: 'mortgage', p: 0, square: 7 });
  });

  test('a street with houses cannot be mortgaged', () => {
    const s = inActions(mut(setup(), (s) => { own(s, 7, 0, { houses: 1 }); own(s, 8, 0); }));
    assert.ok(!legalActions(s).some((a) => a.type === 'MORTGAGE' && a.square === 7));
    assert.throws(() => reduce(s, { type: 'MORTGAGE', square: 7 }), /illegal/i);
  });

  test('UNMORTGAGE costs ceil(price x 0.55)', () => {
    const s = reduce(inActions(mut(setup(), (s) => own(s, 11, 0, { mortgaged: true }))), { type: 'UNMORTGAGE', square: 11 });
    assert.equal(s.props[11].mortgaged, false);
    assert.equal(s.players[0].cash, 1500 - 66);
    assert.deepEqual(last(s, 'unmortgage'), { t: 'unmortgage', p: 0, square: 11 });
  });

  test('UNMORTGAGE needs the cash', () => {
    const s = inActions(mut(setup(), (s) => { own(s, 11, 0, { mortgaged: true }); s.players[0].cash = 65; }));
    assert.ok(!legalActions(s).some((a) => a.type === 'UNMORTGAGE'));
  });

  test('you cannot mortgage what you do not own', () => {
    const s = inActions(mut(setup(), (s) => own(s, 7, 1)));
    assert.throws(() => reduce(s, { type: 'MORTGAGE', square: 7 }), /illegal/i);
  });
});

// ---------- doubles and jail ----------

describe('doubles', () => {
  test('doubles give another roll after END_TURN', () => {
    const rolled = reduce(atPos(setup(), 4, [[1, 1]]), { type: 'ROLL' });
    assert.equal(rolled.turn.doubles, 1);
    assert.equal(rolled.players[0].pos, 6);
    const s = reduce(rolled, { type: 'END_TURN' });
    assert.equal(s.turn.player, 0);
    assert.equal(s.turn.phase, 'roll');
    assert.equal(s.turn.doubles, 1);
    assert.equal(s.turn.dice, null);
  });

  test('the third double sends the player to jail and ends the turn', () => {
    let s = atPos(setup(), 4, [[1, 1], [2, 2], [3, 3]], (s) => own(s, 10, 0));
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'END_TURN' });
    s = reduce(s, { type: 'ROLL' });
    assert.equal(s.players[0].pos, 10);
    s = reduce(s, { type: 'END_TURN' });
    s = reduce(s, { type: 'ROLL' });
    assert.equal(s.players[0].pos, 6);
    assert.equal(s.players[0].inJail, true);
    assert.equal(s.turn.player, 1);
    assert.equal(s.turn.phase, 'roll');
    assert.deepEqual(last(s, 'jail'), { t: 'jail', p: 0, why: 'doubles' });
  });

  test('landing on Gang is Gfängnis jails without an extra roll', () => {
    const s = reduce(atPos(setup(), 14, [[2, 2]]), { type: 'ROLL' });
    assert.equal(s.players[0].pos, 6);
    assert.equal(s.players[0].inJail, true);
    assert.equal(s.turn.phase, 'actions');
    assert.deepEqual(last(s, 'jail'), { t: 'jail', p: 0, why: 'square' });
    const next = reduce(s, { type: 'END_TURN' });
    assert.equal(next.turn.player, 1);
  });
});

describe('jail', () => {
  const jailed = (rolls, patch = () => {}) => atPos(setup(), 6, rolls, (s) => {
    s.players[0].inJail = true;
    patch(s);
  });

  test('legal actions in jail', () => {
    assert.deepEqual(legalActions(jailed([[1, 2]])), [{ type: 'JAIL_PAY' }, { type: 'JAIL_ROLL' }]);
    const poor = jailed([[1, 2]], (s) => { s.players[0].cash = 49; });
    assert.deepEqual(legalActions(poor), [{ type: 'JAIL_ROLL' }]);
    assert.throws(() => reduce(jailed([[1, 2]]), { type: 'ROLL' }), /illegal/i);
  });

  test('JAIL_PAY pays 50 and rolls like a normal turn', () => {
    const s = reduce(jailed([[1, 2]]), { type: 'JAIL_PAY' });
    assert.equal(s.players[0].inJail, false);
    assert.equal(s.players[0].pos, 9);
    assert.equal(s.players[0].cash, 1500 - JAIL_FINE);
    assert.equal(s.turn.phase, 'buy');
    assert.deepEqual(last(s, 'jailOut'), { t: 'jailOut', p: 0, how: 'pay' });
  });

  test('JAIL_PAY with doubles grants another roll', () => {
    const s = reduce(reduce(jailed([[2, 2]], (s) => own(s, 10, 0)), { type: 'JAIL_PAY' }), { type: 'END_TURN' });
    assert.equal(s.turn.player, 0);
    assert.equal(s.turn.phase, 'roll');
  });

  test('JAIL_ROLL without doubles stays and counts the attempt', () => {
    const s = reduce(jailed([[1, 2]]), { type: 'JAIL_ROLL' });
    assert.equal(s.players[0].inJail, true);
    assert.equal(s.players[0].pos, 6);
    assert.equal(s.players[0].jailTurns, 1);
    assert.equal(s.turn.phase, 'actions');
    assert.equal(reduce(s, { type: 'END_TURN' }).turn.player, 1);
  });

  test('JAIL_ROLL with doubles leaves jail without an extra turn', () => {
    const s = reduce(jailed([[2, 2]], (s) => own(s, 10, 0)), { type: 'JAIL_ROLL' });
    assert.equal(s.players[0].inJail, false);
    assert.equal(s.players[0].pos, 10);
    assert.equal(s.players[0].jailTurns, 0);
    assert.equal(s.turn.phase, 'actions');
    assert.deepEqual(last(s, 'jailOut'), { t: 'jailOut', p: 0, how: 'doubles' });
    assert.equal(reduce(s, { type: 'END_TURN' }).turn.player, 1);
  });

  test('the third failed attempt pays 50 and moves anyway', () => {
    const s = reduce(jailed([[1, 2]], (s) => { s.players[0].jailTurns = 2; }), { type: 'JAIL_ROLL' });
    assert.equal(s.players[0].inJail, false);
    assert.equal(s.players[0].pos, 9);
    assert.equal(s.players[0].cash, 1450);
    assert.deepEqual(last(s, 'jailOut'), { t: 'jailOut', p: 0, how: 'forced' });
  });

  test('the forced fine can open the debt phase before the roll resolves', () => {
    const s = reduce(jailed([[1, 2]], (s) => { s.players[0].jailTurns = 2; s.players[0].cash = 20; }), { type: 'JAIL_ROLL' });
    assert.equal(s.turn.phase, 'debt');
    assert.deepEqual(s.turn.debt, { amount: 30, to: null });
    assert.equal(s.turn.offer, 9);
  });
});

// ---------- tax ----------

describe('tax', () => {
  test('landing on Stüüre pays 100', () => {
    const s = reduce(atPos(setup(), 17, [[2, 3]]), { type: 'ROLL' });
    assert.equal(s.players[0].pos, 22);
    assert.equal(s.players[0].cash, 1500 - TAX);
    assert.deepEqual(last(s, 'tax'), { t: 'tax', p: 0, amount: 100 });
    assert.equal(s.turn.phase, 'actions');
  });
});

// ---------- cards ----------

describe('card effects', () => {
  const draw = (id, patch) => reduce(withCard(setup(), id, patch), { type: 'ROLL' });

  test('drawing logs the card and consumes it from the deck', () => {
    const s = draw('jass');
    assert.deepEqual(last(s, 'card'), { t: 'card', p: 0, card: 'jass' });
    assert.deepEqual(s.deck, []);
  });

  test('an empty deck is reshuffled before drawing', () => {
    const s = reduce(withCard(setup(), 'jass', (s) => { s.deck = []; }), { type: 'ROLL' });
    assert.equal(s.deck.length, 10);
    assert.equal(new Set([...s.deck, last(s, 'card').card]).size, 11);
  });

  test('rega: pay 100', () => {
    assert.equal(draw('rega').players[0].cash, 1400);
  });

  test('jass: collect 50', () => {
    assert.equal(draw('jass').players[0].cash, 1550);
  });

  test('chrankekasse: collect 100', () => {
    assert.equal(draw('chrankekasse').players[0].cash, 1600);
  });

  test('los: go to LOS and collect the salary', () => {
    const s = draw('los');
    assert.equal(s.players[0].pos, 0);
    assert.equal(s.players[0].cash, 1700);
    assert.equal(s.turn.phase, 'actions');
  });

  test('gfaengnis: go to jail', () => {
    const s = draw('gfaengnis');
    assert.equal(s.players[0].pos, 6);
    assert.equal(s.players[0].inJail, true);
    assert.deepEqual(last(s, 'jail'), { t: 'jail', p: 0, why: 'card' });
    assert.equal(reduce(s, { type: 'END_TURN' }).turn.player, 1);
  });

  test('sbb: three squares back, then resolve that square', () => {
    const s = draw('sbb');
    assert.equal(s.players[0].pos, 11);
    assert.equal(s.turn.phase, 'buy');
    assert.equal(s.turn.offer, 11);
    const owned = draw('sbb', (s) => own(s, 11, 1));
    assert.equal(owned.players[0].cash, 1490);
  });

  test('sbb: going back over LOS pays no salary', () => {
    const s = reduce(atPos(setup(), 0, [[1, 1]], (s) => { s.deck = ['sbb']; }), { type: 'ROLL' });
    assert.equal(s.players[0].pos, 23);
    assert.equal(s.players[0].cash, 1500);
    assert.equal(s.turn.phase, 'buy');
  });

  test('verkehr: advance to the next transport square', () => {
    const s = draw('verkehr');
    assert.equal(s.players[0].pos, 16);
    assert.equal(s.turn.phase, 'buy');
    assert.equal(s.turn.offer, 16);
    assert.equal(s.turn.doubleRent, false);
  });

  test('verkehr: double rent when it is owned by someone else', () => {
    const s = draw('verkehr', (s) => own(s, 16, 1));
    assert.equal(s.turn.doubleRent, true);
    assert.equal(s.players[0].cash, 1450);
    assert.equal(s.players[1].cash, 1550);
    assert.equal(last(s, 'rent').amount, 50);
  });

  test('renovation: 25 per house, 100 per hotel', () => {
    const s = draw('renovation', (s) => { own(s, 7, 0, { houses: 2 }); own(s, 8, 0, { houses: 4 }); own(s, 11, 0); });
    assert.equal(s.players[0].cash, 1500 - 150);
  });

  test('geburtstag: every present solvent player pays 20', () => {
    const s = draw('geburtstag', (s) => { s.players[2].bankrupt = true; s.players[3].left = true; });
    assert.equal(s.players[0].cash, 1520);
    assert.equal(s.players[1].cash, 1480);
    assert.equal(s.players[2].cash, 1500);
    assert.equal(s.players[3].cash, 1500);
  });

  test('geburtstag: a payer without cash gets a pending debt resolved at their turn', () => {
    const s = draw('geburtstag', (s) => { s.players[1].cash = 10; });
    assert.equal(s.players[1].cash, -10);
    assert.deepEqual(s.players[1].pendingDebt, { amount: 10, to: 0 });
    const theirs = reduce(s, { type: 'END_TURN' });
    assert.equal(theirs.turn.player, 1);
    assert.equal(theirs.turn.phase, 'debt');
    assert.deepEqual(theirs.turn.debt, { amount: 10, to: 0 });
    assert.equal(theirs.players[1].pendingDebt, null);
    assert.deepEqual(types(legalActions(theirs)), ['DECLARE_BANKRUPT']);
  });

  test('geburtstag: a pending debt paid off by rent in between is dropped', () => {
    const s = draw('geburtstag', (s) => { s.players[1].cash = 10; });
    const repaid = mut(s, (s) => { s.players[1].cash = 40; });
    const theirs = reduce(repaid, { type: 'END_TURN' });
    assert.equal(theirs.turn.phase, 'roll');
    assert.equal(theirs.players[1].pendingDebt, null);
  });

  test('parkbuess: pay 40', () => {
    assert.equal(draw('parkbuess').players[0].cash, 1460);
  });

  test('tuuerscht: advance to square 23', () => {
    const s = draw('tuuerscht');
    assert.equal(s.players[0].pos, 23);
    assert.equal(s.turn.phase, 'buy');
    assert.equal(s.turn.offer, 23);
    const owned = draw('tuuerscht', (s) => own(s, 23, 1));
    assert.equal(owned.players[0].cash, 1500 - 26);
  });

  test('a card that costs more than the cash opens the debt phase', () => {
    const s = draw('rega', (s) => { s.players[0].cash = 30; });
    assert.equal(s.turn.phase, 'debt');
    assert.deepEqual(s.turn.debt, { amount: 70, to: null });
  });
});

// ---------- debt ----------

describe('debt', () => {
  const inDebt = () => reduce(atPos(setup(), 3, [[1, 3]], (s) => {
    s.players[0].cash = 10;
    own(s, 7, 1, { houses: 1 });
    own(s, 19, 0);
    own(s, 21, 0, { houses: 2 });
    own(s, 23, 0, { mortgaged: true });
  }), { type: 'ROLL' });

  test('rent beyond the cash opens the debt phase', () => {
    const s = inDebt();
    assert.equal(s.players[0].cash, -30);
    assert.equal(s.players[1].cash, 1540);
    assert.equal(s.turn.phase, 'debt');
    assert.deepEqual(s.turn.debt, { amount: 30, to: 1 });
    assert.deepEqual(last(s, 'debt'), { t: 'debt', p: 0, amount: 30 });
  });

  test('only selling, mortgaging and bankruptcy are legal in debt', () => {
    assert.deepEqual(legalActions(inDebt()), [
      { type: 'SELL_HOUSE', square: 21 },
      { type: 'MORTGAGE', square: 19 },
      { type: 'DECLARE_BANKRUPT' },
    ]);
    assert.throws(() => reduce(inDebt(), { type: 'END_TURN' }), /illegal/i);
    assert.throws(() => reduce(inDebt(), { type: 'UNMORTGAGE', square: 23 }), /illegal/i);
    assert.throws(() => reduce(inDebt(), { type: 'BUILD', square: 21 }), /illegal/i);
  });

  test('selling a house back to solvency resumes the turn', () => {
    const s = reduce(inDebt(), { type: 'SELL_HOUSE', square: 21 });
    assert.equal(s.players[0].cash, 45);
    assert.equal(s.turn.phase, 'actions');
    assert.equal(s.turn.debt, null);
  });

  test('mortgaging back to solvency resumes the turn', () => {
    const s = reduce(inDebt(), { type: 'MORTGAGE', square: 19 });
    assert.equal(s.players[0].cash, 80);
    assert.equal(s.turn.phase, 'actions');
  });

  test('a partial sale stays in debt with the amount updated', () => {
    const s = reduce(mut(inDebt(), (s) => { s.players[0].cash = -100; s.turn.debt.amount = 100; }), { type: 'SELL_HOUSE', square: 21 });
    assert.equal(s.turn.phase, 'debt');
    assert.deepEqual(s.turn.debt, { amount: 25, to: 1 });
  });

  test('debt resolved before a pending offer returns to the buy phase', () => {
    const s = reduce(mut(inDebt(), (s) => { s.turn.offer = 9; }), { type: 'MORTGAGE', square: 19 });
    assert.equal(s.turn.phase, 'buy');
    assert.deepEqual(types(legalActions(s)), ['PASS']);
  });
});

// ---------- bankruptcy ----------

describe('bankruptcy', () => {
  const debtTo = (to) => mut(setup(), (s) => {
    s.turn.phase = 'debt';
    s.turn.dice = [1, 3];
    s.turn.debt = { amount: 30, to };
    s.players[0].cash = -30;
    own(s, 19, 0, { houses: 2 });
    own(s, 21, 0, { mortgaged: true });
    own(s, 4, 0);
  });

  test('to a player: houses sold, cash and mortgaged properties transfer', () => {
    const s = reduce(debtTo(1), { type: 'DECLARE_BANKRUPT' });
    assert.equal(s.players[0].bankrupt, true);
    assert.equal(s.players[0].cash, 0);
    assert.equal(s.players[1].cash, 1500 + 120);
    assert.deepEqual(s.props[19], { owner: 1, houses: 0, mortgaged: true });
    assert.deepEqual(s.props[21], { owner: 1, houses: 0, mortgaged: true });
    assert.deepEqual(s.props[4], { owner: 1, houses: 0, mortgaged: true });
    assert.deepEqual(last(s, 'bankrupt'), { t: 'bankrupt', p: 0, to: 1 });
    assert.equal(s.turn.player, 1);
    assert.equal(s.turn.phase, 'roll');
  });

  test('to the bank: properties return unowned', () => {
    const s = reduce(debtTo(null), { type: 'DECLARE_BANKRUPT' });
    assert.equal(s.players[0].bankrupt, true);
    assert.equal(s.players[0].cash, 0);
    assert.deepEqual(s.props, {});
    assert.equal(s.turn.player, 1);
  });

  test('the last solvent player wins immediately', () => {
    const s = reduce(mut(debtTo(1), (s) => { s.players[2].bankrupt = true; s.players[3].bankrupt = true; }), { type: 'DECLARE_BANKRUPT' });
    assert.equal(s.turn.phase, 'over');
    assert.equal(isOver(s), true);
    assert.equal(s.winner, 1);
    assert.deepEqual(last(s, 'over'), { t: 'over', winner: 1 });
    assert.deepEqual(legalActions(s), []);
  });

  test('a bankrupt player has no net worth', () => {
    const s = reduce(debtTo(1), { type: 'DECLARE_BANKRUPT' });
    assert.equal(netWorth(s, 0), 0);
  });
});

// ---------- turn order and rounds ----------

describe('turn order and rounds', () => {
  const endTurn = (state) => reduce(inActions(state), { type: 'END_TURN' });

  test('END_TURN passes to the next player and logs it', () => {
    const s = endTurn(setup());
    assert.equal(s.turn.player, 1);
    assert.deepEqual(s.turn, { player: 1, phase: 'roll', doubles: 0, dice: null, offer: null, debt: null, doubleRent: false });
    assert.deepEqual(last(s, 'turn'), { t: 'turn', p: 1 });
  });

  test('bankrupt and left players are skipped', () => {
    const s = endTurn(mut(setup(), (s) => { s.players[1].bankrupt = true; s.players[2].left = true; }));
    assert.equal(s.turn.player, 3);
  });

  test('the round increments when the turn returns to the start player', () => {
    let s = setup();
    for (let i = 0; i < 3; i++) s = endTurn(s);
    assert.equal(s.round, 1);
    s = endTurn(s);
    assert.equal(s.turn.player, 0);
    assert.equal(s.round, 2);
    assert.deepEqual(last(s, 'round'), { t: 'round', n: 2 });
  });

  test('a bankrupt start player still marks the round boundary', () => {
    let s = mut(setup(), (s) => { s.players[0].bankrupt = true; s.turn.player = 1; });
    for (let i = 0; i < 3; i++) s = endTurn(s);
    assert.equal(s.turn.player, 1);
    assert.equal(s.round, 2);
  });

  test('the game ends after maxRounds with the richest player winning', () => {
    let s = mut(setup({ maxRounds: 1 }), (s) => { own(s, 7, 1); s.players[1].cash = 1401; });
    for (let i = 0; i < 4; i++) s = endTurn(s);
    assert.equal(s.turn.phase, 'over');
    assert.equal(s.winner, 1);
    assert.equal(s.round, 2);
    assert.deepEqual(last(s, 'over'), { t: 'over', winner: 1 });
  });

  test('ties in net worth are broken by cash, then by seat', () => {
    let s = mut(setup({ maxRounds: 1 }), (s) => { own(s, 7, 1); s.players[1].cash = 1400; s.players[2].cash = 1500; });
    for (let i = 0; i < 4; i++) s = endTurn(s);
    assert.equal(s.winner, 0);
  });

  test('TIME_UP makes this the final round', () => {
    let s = reduce(setup(), { type: 'TIME_UP' });
    assert.equal(s.finalRound, true);
    assert.deepEqual(last(s, 'timeUp'), { t: 'timeUp' });
    assert.equal(s.turn.phase, 'roll');
    for (let i = 0; i < 3; i++) s = endTurn(s);
    assert.equal(s.turn.phase, 'roll');
    s = endTurn(s);
    assert.equal(s.turn.phase, 'over');
    assert.equal(s.winner, 0);
  });

  test('TIME_UP is not a player action and is illegal once over', () => {
    assert.ok(!legalActions(setup()).some((a) => a.type === 'TIME_UP'));
    const over = mut(setup(), (s) => { s.turn.phase = 'over'; });
    assert.throws(() => reduce(over, { type: 'TIME_UP' }), /illegal/i);
  });

  test('the log keeps the last 40 entries', () => {
    let s = setup();
    for (let i = 0; i < 50; i++) s = endTurn(s);
    assert.equal(s.log.length, 40);
    assert.equal(s.log.at(-1).t, 'turn');
  });
});

// ---------- net worth ----------

describe('netWorth', () => {
  test('cash + prices (mortgaged half) + houses x house cost', () => {
    const s = mut(setup(), (s) => {
      own(s, 7, 0, { houses: 3 });
      own(s, 8, 0, { mortgaged: true });
      own(s, 4, 0);
      own(s, 23, 1);
    });
    assert.equal(netWorth(s, 0), 1500 + 100 + 300 + 50 + 200);
    assert.equal(netWorth(s, 1), 1500 + 280);
    assert.equal(netWorth(s, 2), 1500);
  });
});

// ---------- scripted random games ----------

function checkInvariants(s, board) {
  s.players.forEach((p, i) => {
    const allowed = (s.turn.phase === 'debt' && s.turn.player === i) || p.pendingDebt !== null;
    assert.ok(p.cash >= 0 || allowed, `player ${i} has ${p.cash} in phase ${s.turn.phase}`);
    assert.ok(p.pos >= 0 && p.pos < 24);
  });
  for (const [key, prop] of Object.entries(s.props)) {
    const sq = board[Number(key)];
    assert.ok(['street', 'transport', 'utility'].includes(sq.type));
    assert.ok(!s.players[prop.owner].bankrupt, `bankrupt owner on ${key}`);
    assert.ok(prop.houses >= 0 && prop.houses <= 4);
    assert.ok(!(prop.houses > 0 && prop.mortgaged));
    if (prop.houses > 0) assert.ok(tierCount(s, board, sq.tier, prop.owner) >= 2, `house without majority on ${key}`);
  }
  assert.ok(s.round <= s.maxRounds + 1);
  if (s.turn.phase !== 'over') assert.ok(s.round <= s.maxRounds);
  if (s.turn.phase === 'over') assert.notEqual(s.winner, null);
  assert.ok(s.log.length <= 40);
}

function tierCount(s, board, tier, owner) {
  return board.filter((q) => q.type === 'street' && q.tier === tier && s.props[q.index]?.owner === owner).length;
}

describe('scripted random games', () => {
  for (const edition of EDITION_IDS) {
    test(`a random-legal-action game in ${edition} ends within maxRounds`, () => {
      const board = boardFor(edition);
      let s = newGame({ edition, players: PLAYERS, seed: 1234 });
      let rng = 4321;
      let steps = 0;
      while (!isOver(s)) {
        const actions = legalActions(s);
        assert.ok(actions.length > 0, `no legal action in phase ${s.turn.phase}`);
        const pick = next(rng);
        rng = pick.seed;
        s = reduce(s, actions[Math.floor(pick.value * actions.length)]);
        checkInvariants(s, board);
        assert.ok(++steps < 20_000, 'game did not end');
      }
      assert.equal(s.turn.phase, 'over');
      assert.ok(s.winner !== null);
      assert.equal(legalActions(s).length, 0);
    });
  }

  test('several seeds in every edition end cleanly', () => {
    for (const edition of EDITION_IDS) {
      for (let seed = 1; seed <= 15; seed++) {
        const board = boardFor(edition);
        let s = newGame({ edition, players: PLAYERS.slice(0, 2 + (seed % 3)), seed });
        let rng = seed * 17;
        while (!isOver(s)) {
          const actions = legalActions(s);
          const pick = next(rng);
          rng = pick.seed;
          s = reduce(s, actions[Math.floor(pick.value * actions.length)]);
          checkInvariants(s, board);
        }
      }
    }
  });
});
