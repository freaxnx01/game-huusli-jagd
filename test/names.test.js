import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FUNNY_NAMES, randomName, randomNames } from '../src/ui/names.js';
import { CPU_NAMES } from '../src/ui/menu.js';

describe('funny name prefill', () => {
  test('every name fits the 16-character input limit', () => {
    for (const name of FUNNY_NAMES) assert.ok(name.length <= 16, `${name} is ${name.length} chars`);
  });

  test('no funny name collides with a CPU name', () => {
    const cpus = new Set(CPU_NAMES.map((n) => n.toLowerCase()));
    for (const name of FUNNY_NAMES) assert.ok(!cpus.has(name.toLowerCase()));
  });

  test('the pool has no duplicates', () => {
    assert.equal(new Set(FUNNY_NAMES).size, FUNNY_NAMES.length);
  });

  test('randomName picks from the pool', () => {
    assert.ok(FUNNY_NAMES.includes(randomName([], () => 0)));
    assert.equal(randomName([], () => 0), FUNNY_NAMES[0]);
  });

  test('randomName skips names already taken', () => {
    const name = randomName([FUNNY_NAMES[0]], () => 0);
    assert.notEqual(name, FUNNY_NAMES[0]);
    assert.equal(name, FUNNY_NAMES[1]);
  });

  test('taken matching is case-insensitive', () => {
    assert.notEqual(randomName([FUNNY_NAMES[0].toUpperCase()], () => 0), FUNNY_NAMES[0]);
  });

  test('randomName still returns a name when the pool is exhausted', () => {
    assert.ok(FUNNY_NAMES.includes(randomName(FUNNY_NAMES, () => 0)));
  });

  test('randomNames returns the requested count, all distinct', () => {
    const names = randomNames(4, [], () => 0);
    assert.equal(names.length, 4);
    assert.equal(new Set(names).size, 4);
  });

  test('randomNames avoids names already at the table', () => {
    const names = randomNames(2, [FUNNY_NAMES[0]], () => 0);
    assert.ok(!names.includes(FUNNY_NAMES[0]));
  });

  test('empty entries in taken are ignored', () => {
    assert.equal(randomName(['', null, undefined], () => 0), FUNNY_NAMES[0]);
  });
});
