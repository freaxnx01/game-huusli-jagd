// The 11 Ereignis cards, edition-neutral. Effects are plain descriptors; game.js applies them.
// effect.kind: pay | collect | goto | jail | back | nextTransport | repairs | birthday

export const CARDS = [
  { id: 'rega', text: 'Rega-Iisatz i de Bärge — zahl 100', effect: { kind: 'pay', amount: 100 } },
  { id: 'jass', text: 'Jass-Obig gwunne — 50 für dich', effect: { kind: 'collect', amount: 50 } },
  { id: 'chrankekasse', text: 'Rückzahlig Chrankekasse — 100 für dich', effect: { kind: 'collect', amount: 100 } },
  { id: 'los', text: 'Gang uf LOS', effect: { kind: 'goto', square: 0 } },
  { id: 'gfaengnis', text: 'Gang is Gfängnis', effect: { kind: 'jail' } },
  { id: 'sbb', text: 'SBB-Verspötig — 3 Fälder zrugg', effect: { kind: 'back', steps: 3 } },
  { id: 'verkehr', text: 'Fahr zum nöchschte Verkehrsfeld — doppelti Miete, wenn verchauft', effect: { kind: 'nextTransport' } },
  { id: 'renovation', text: 'Renovation — 25 pro Huus, 100 pro Hotel', effect: { kind: 'repairs', perHouse: 25, perHotel: 100 } },
  { id: 'geburtstag', text: 'Geburtstag — jede zahlt dir 20', effect: { kind: 'birthday', amount: 20 } },
  { id: 'parkbuess', text: 'Parkbuess — zahl 40', effect: { kind: 'pay', amount: 40 } },
  { id: 'tuuerscht', text: 'Fahr zum tüürschte Feld', effect: { kind: 'goto', square: 23 } },
];

export const CARD_IDS = CARDS.map((c) => c.id);

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export function cardById(id) {
  return BY_ID.get(id);
}
