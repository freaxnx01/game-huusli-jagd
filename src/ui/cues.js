// Pure mapping from a state's log to the sound cues a state change should play. No Web
// Audio, no DOM — cuesFor() diffs state.log by the engine's monotonic n (game.js) so it
// works the same for solo, hotseat, host and guest renders. See sound.js for playback.

export const MAX_CUES_PER_CHANGE = 3;

const CUES = {
  roll: 'dice',
  buy: 'cash',
  rent: 'pay',
  tax: 'pay',
  salary: 'salary',
  build: 'build',
  sell: 'paper',
  mortgage: 'paper',
  unmortgage: 'paper',
  card: 'card',
  jail: 'jail',
  jailOut: 'unlock',
  bankrupt: 'bust',
  timeUp: 'alarm',
  over: 'fanfare',
};

export const CUE_PRIORITY = ['dice', 'fanfare', 'bust', 'jail', 'alarm', 'hotel', 'cash', 'pay', 'salary', 'build', 'card', 'unlock', 'paper'];

function cueFor(entry) {
  if (entry.t === 'build' && entry.houses === 4) return 'hotel';
  return CUES[entry.t] ?? null;
}

export function cuesFor(prevSeq, state) {
  const entries = state.log.filter((e) => e.n > prevSeq);
  const seq = entries.length ? entries[entries.length - 1].n : prevSeq;
  const withCues = entries.map((e, i) => ({ cue: cueFor(e), i })).filter((x) => x.cue);
  const selected = withCues
    .slice()
    .sort((a, b) => CUE_PRIORITY.indexOf(a.cue) - CUE_PRIORITY.indexOf(b.cue))
    .slice(0, MAX_CUES_PER_CHANGE)
    .sort((a, b) => a.i - b.i);
  return { cues: selected.map((x) => x.cue), seq };
}

export function highestSeq(state) {
  return state.log.length ? state.log[state.log.length - 1].n : 0;
}
