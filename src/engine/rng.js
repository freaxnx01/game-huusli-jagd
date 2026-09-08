// mulberry32 as pure functions: the seed lives in game state, every draw returns
// the next seed alongside its result. A game is fully determined by (seed, actions).

export function next(seed) {
  const advanced = (seed + 0x6d2b79f5) | 0;
  let t = advanced;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: advanced >>> 0 };
}

export function randomInt(seed, n) {
  const r = next(seed);
  return { value: Math.floor(r.value * n), seed: r.seed };
}

export function rollDice(seed) {
  const first = randomInt(seed, 6);
  const second = randomInt(first.seed, 6);
  return { dice: [first.value + 1, second.value + 1], seed: second.seed };
}

export function shuffle(array, seed) {
  const out = [...array];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    const r = randomInt(s, i + 1);
    s = r.seed;
    [out[i], out[r.value]] = [out[r.value], out[i]];
  }
  return { array: out, seed: s };
}
