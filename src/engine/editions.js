// Edition data: one board template, four name sets. Every edition shares the same
// square types, indices and rent tiers, so the engine, the AI and the UI never
// branch on the edition — only names and colours differ.

// 24 squares, counter-clockwise from LOS. Each side: 3 streets, 1 transport, 1 special.
// Streets come in four groups of three (tiers), cheapest first.
export const TEMPLATE = [
  { type: 'go' },
  { type: 'street', tier: 0 },
  { type: 'card' },
  { type: 'street', tier: 0 },
  { type: 'transport', n: 0 },
  { type: 'street', tier: 0 },
  { type: 'jail' },
  { type: 'street', tier: 1 },
  { type: 'street', tier: 1 },
  { type: 'transport', n: 1 },
  { type: 'utility' },
  { type: 'street', tier: 1 },
  { type: 'parking' },
  { type: 'street', tier: 2 },
  { type: 'card' },
  { type: 'street', tier: 2 },
  { type: 'transport', n: 2 },
  { type: 'street', tier: 2 },
  { type: 'gotojail' },
  { type: 'street', tier: 3 },
  { type: 'transport', n: 3 },
  { type: 'street', tier: 3 },
  { type: 'tax' },
  { type: 'street', tier: 3 },
];

// Price and rent per tier, in street order within the tier (third street is dearer).
// rent = [0 houses, 1, 2, 3, hotel]
export const TIERS = [
  { color: 'green', houseCost: 50, streets: [
    { price: 60, rent: [4, 20, 60, 180, 320] },
    { price: 60, rent: [4, 20, 60, 180, 320] },
    { price: 80, rent: [6, 30, 90, 270, 400] },
  ] },
  { color: 'gold', houseCost: 100, streets: [
    { price: 100, rent: [8, 40, 100, 300, 450] },
    { price: 100, rent: [8, 40, 100, 300, 450] },
    { price: 120, rent: [10, 50, 150, 450, 625] },
  ] },
  { color: 'red', houseCost: 100, streets: [
    { price: 140, rent: [12, 60, 180, 500, 700] },
    { price: 140, rent: [12, 60, 180, 500, 700] },
    { price: 160, rent: [14, 70, 200, 550, 750] },
  ] },
  { color: 'blue', houseCost: 150, streets: [
    { price: 220, rent: [18, 90, 250, 700, 875] },
    { price: 240, rent: [20, 100, 300, 750, 925] },
    { price: 280, rent: [26, 130, 390, 900, 1100] },
  ] },
];

export const TRANSPORT_PRICE = 200;
export const TRANSPORT_RENT = [25, 50, 100, 200]; // by count owned
export const UTILITY_PRICE = 150;
export const UTILITY_MULTIPLIER = 8; // × dice sum
export const TAX = 100;
export const SALARY = 200;
export const JAIL_FINE = 50;
export const START_CASH = 1500;

// Names per edition. streets[tier][i], transport[n]. Frick and Sursee names are
// best-effort and flagged in TODO.md for local verification.
export const EDITIONS = {
  zuerich: {
    id: 'zuerich',
    name: 'Zürich',
    streets: [
      ['Langstrass', 'Badenerstrass', 'Zurlindestrass'],
      ['Universitätstrass', 'Rämistrass', 'Seefäldstrass'],
      ['Niederdorf', 'Limmatquai', 'Bellevue'],
      ['Paradeplatz', 'Bürkliplatz', 'Bahnhofstrass'],
    ],
    transport: ['Zürich HB', 'Bahnhof Stadelhofe', 'Bahnhof Oerlikon', 'Flughafe Zürich'],
    utility: 'EWZ Stromwärch',
  },
  basel: {
    id: 'basel',
    name: 'Basel',
    streets: [
      ['Klybeckstrooss', 'Feldbergstrooss', 'Clarastrooss'],
      ['Steinevorstadt', 'Barfüesserplatz', 'Gerbergass'],
      ['Spalebärg', 'Marktplatz', 'Münsterplatz'],
      ['Aeschevorstadt', 'St. Albe-Grabe', 'Freie Strooss'],
    ],
    transport: ['Basel SBB', 'Badische Bahnhof', 'EuroAirport', 'Rhyhafe Kleinhüninge'],
    utility: 'IWB Stromwärch',
  },
  frick: {
    id: 'frick',
    name: 'Frick',
    streets: [
      ['Niederfrick', 'Oberfrick', 'Kornbergstross'],
      ['Schuelstross', 'Widegass', 'Bahnhofstross'],
      ['Tongruebe Gruhalde', 'Sauriermuseum', 'Chile St. Peter und Paul'],
      ['Wideplatz', 'Hauptstross', 'Gmeindshuus'],
    ],
    transport: ['Bahnhof Frick', 'Postauto Frick', 'A3-Aaschluss Frick', 'Fricktaler Velowäg'],
    utility: 'AEW Stromwärch',
  },
  sursee: {
    id: 'sursee',
    name: 'Sursee',
    streets: [
      ['Strandbad', 'Campus Sursee', 'Surseepark'],
      ['Bahnhofstrass', 'Centralstrass', 'Kapuzinerchloster'],
      ['Basler Tor', 'Understadt', 'Oberstadt'],
      ['Pfarrchile St. Georg', 'Schlössli', 'Rathuusplatz'],
    ],
    transport: ['Bahnhof Sursee', 'Schiffsteg Sursee', 'Postauto Sursee', 'A2-Aaschluss Sursee'],
    utility: 'CKW Stromwärch',
  },
};

export const EDITION_IDS = Object.keys(EDITIONS);

// Resolved board for one edition: 24 square objects with everything the engine needs.
// square: { index, type, name, tier?, color?, price?, rent?, houseCost?, transportIndex? }
export function boardFor(editionId) {
  const edition = EDITIONS[editionId];
  if (!edition) throw new Error(`unknown edition: ${editionId}`);
  const seenPerTier = [0, 0, 0, 0];
  return TEMPLATE.map((t, index) => {
    if (t.type === 'street') {
      const i = seenPerTier[t.tier]++;
      const tier = TIERS[t.tier];
      const s = tier.streets[i];
      return { index, type: 'street', tier: t.tier, color: tier.color, name: edition.streets[t.tier][i], price: s.price, rent: s.rent, houseCost: tier.houseCost };
    }
    if (t.type === 'transport') return { index, type: 'transport', transportIndex: t.n, name: edition.transport[t.n], price: TRANSPORT_PRICE };
    if (t.type === 'utility') return { index, type: 'utility', name: edition.utility, price: UTILITY_PRICE };
    return { index, type: t.type, name: SPECIAL_NAMES[t.type] };
  });
}

export const SPECIAL_NAMES = {
  go: 'LOS',
  card: 'Ereignis',
  jail: 'Gfängnis',
  parking: 'Frei Parkiere',
  gotojail: 'Gang is Gfängnis',
  tax: 'Stüüre',
};

export function streetsOfTier(board, tier) {
  return board.filter((s) => s.type === 'street' && s.tier === tier);
}
