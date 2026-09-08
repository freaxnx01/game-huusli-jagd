import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { EDITION_IDS } from '../src/engine/editions.js';
import { newGame, legalActions, reduce, isOver } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/cpu.js';

const LEVELS = ['gmuetlich', 'gwieft'];
const GAMES_PER_EDITION = 20;
const MIXED_GAMES = 200;
const MAX_ACTIONS = 20_000;

const cpus = (levels) => levels.map((level, i) => ({ name: `CPU ${i}`, kind: 'cpu', level }));
const sameAction = (a, b) => a.type === b.type && a.square === b.square;

function play({ edition, seed, players, maxRounds = 20 }) {
  let s = newGame({ edition, players, seed, maxRounds });
  let actions = 0;
  while (!isOver(s)) {
    const action = chooseAction(s, s.turn.player);
    assert.ok(legalActions(s).some((a) => sameAction(a, action)), `illegal ${JSON.stringify(action)} in phase ${s.turn.phase} (seed ${seed})`);
    assert.deepEqual(chooseAction(s, s.turn.player), action, 'chooseAction is not a pure function of the state');
    s = reduce(s, action);
    assert.ok(++actions < MAX_ACTIONS, `game ${seed} did not end`);
  }
  return s;
}

describe('cpu levels drive full games', () => {
  const originalRandom = Math.random;
  test.before(() => { Math.random = () => { throw new Error('cpu used Math.random'); }; });
  test.after(() => { Math.random = originalRandom; });

  for (const level of LEVELS) {
    for (const edition of EDITION_IDS) {
      test(`${level} finishes ${GAMES_PER_EDITION} seeded games in ${edition} with only legal actions`, () => {
        for (let seed = 1; seed <= GAMES_PER_EDITION; seed++) {
          const s = play({ edition, seed, players: cpus([level, level, level, level]) });
          assert.equal(s.turn.phase, 'over');
          assert.notEqual(s.winner, null);
        }
      });
    }
  }
});

describe('gwieft beats gmuetlich', () => {
  test(`gwieft wins more mixed 2+2 games than gmuetlich over ${MIXED_GAMES} seeds`, () => {
    const players = cpus(['gmuetlich', 'gwieft', 'gmuetlich', 'gwieft']);
    const wins = { gmuetlich: 0, gwieft: 0 };
    for (let seed = 1; seed <= MIXED_GAMES; seed++) {
      const s = play({ edition: EDITION_IDS[seed % EDITION_IDS.length], seed, players });
      wins[s.players[s.winner].level] += 1;
    }
    console.log(`mixed table: gwieft ${wins.gwieft} wins, gmuetlich ${wins.gmuetlich} wins of ${MIXED_GAMES}`);
    assert.ok(wins.gwieft > wins.gmuetlich, `gwieft ${wins.gwieft} vs gmuetlich ${wins.gmuetlich}`);
  });
});
