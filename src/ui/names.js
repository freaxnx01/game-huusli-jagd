// Funny Swiss names offered as a prefill in the menu's name fields, so a player can
// start without typing anything. Pure and injectable-random, so it is testable in Node.

export const FUNNY_NAMES = [
  'Chäs-Chöni',
  'Rösti-Ruedi',
  'Fondue-Fritz',
  'Schoggi-Schaggi',
  'Guetzli-Gusti',
  'Chuchichäschtli',
  'Sackmesser-Sämi',
  'Cervelat-Cesar',
  'Toblerone-Toni',
  'Bünzli-Beni',
  'Jass-Jöggu',
  'Znüni-Zäni',
  'Bergli-Bethli',
  'Alpöhi-Aldo',
  'Müesli-Mäng',
  'Chübeli-Chrigu',
];

// Picks a name no one at the table has yet. Falls back to the full pool once every
// name is taken, so it always returns something. rnd is injectable for tests.
export function randomName(taken = [], rnd = Math.random) {
  const lower = new Set(taken.filter(Boolean).map((n) => n.toLowerCase()));
  const free = FUNNY_NAMES.filter((n) => !lower.has(n.toLowerCase()));
  const pool = free.length ? free : FUNNY_NAMES;
  return pool[Math.floor(rnd() * pool.length)];
}

// n distinct names, for prefilling all the hotseat seats at once.
export function randomNames(count, taken = [], rnd = Math.random) {
  const picked = [];
  for (let i = 0; i < count; i++) picked.push(randomName([...taken, ...picked], rnd));
  return picked;
}
