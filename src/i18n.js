// Strings for gsw (default) and en. t(key, params) replaces {name} placeholders.
// The chosen language is persisted in localStorage under "hj.lang".

const STORAGE_KEY = 'hj.lang';

const gsw = {
  'app.title': 'Hüüsli-Jagd',
  'app.tagline': 'Chaufe, baue, kassiere – fertig i 30 Minute.',
  'lang.gsw': 'Schwiizerdütsch',
  'lang.en': 'English',

  'menu.edition': 'Edition',
  'menu.mode': 'Wie wotsch spile?',
  'menu.mode.solo': 'Solo gäge de Compi',
  'menu.mode.hotseat': 'Zäme am gliiche Bildschirm',
  'menu.mode.online': 'Online',
  'menu.yourName': 'Din Name',
  'menu.cpus': 'Compis',
  'menu.level': 'Stufe',
  'menu.level.gmuetlich': 'Gmüetlich',
  'menu.level.gwieft': 'Gwieft',
  'menu.players': 'Spieler',
  'menu.playerN': 'Spieler {n}',
  'menu.start': 'Los gahts',
  'menu.host': 'Spiel erstelle',
  'menu.join': 'Spiel biitrette',
  'menu.onlineSoon': 'S Online-Spiel chunnt bald. Bis dänn: Solo oder zäme am gliiche Gröt.',
  'menu.onlineHost': 'Du wirsch de Gastgäber. Da chunnt din Code ane.',
  'menu.onlineJoin': 'Da chasch de Code vom Gastgäber iifüege.',

  'game.round': 'Rundi {n} / {max}',
  'game.finalRound': 'Letschti Rundi!',
  'game.viewFlat': 'Flach',
  'game.viewIso': '3D',
  'game.yourTurn': 'Du bisch dra',
  'game.turnOf': '{name} isch dra',
  'game.cpuThinking': '{name} überleit…',
  'game.waitingFor': 'Warte uf {name}',
  'game.offer': '{square} für {amount} chaufe?',
  'game.debt': 'Gäldnot! Dir fähled {amount}.',
  'game.inJail': 'Du bisch im Gfängnis.',

  'action.ROLL': 'Würfle',
  'action.BUY': 'Chaufe',
  'action.PASS': 'Verzichte',
  'action.BUILD': 'Baue',
  'action.SELL_HOUSE': 'Huus verchaufe',
  'action.MORTGAGE': 'Verpfände',
  'action.UNMORTGAGE': 'Uslöse',
  'action.JAIL_PAY': 'Gfängnis zahle',
  'action.JAIL_ROLL': 'Gfängnis würfle',
  'action.DECLARE_BANKRUPT': 'Bankrott',
  'action.END_TURN': 'Zug beände',

  'chooser.BUILD': 'Wo wotsch boue?',
  'chooser.SELL_HOUSE': 'Wo wotsch es Huus verchaufe?',
  'chooser.MORTGAGE': 'Was wotsch verpfände?',
  'chooser.UNMORTGAGE': 'Was wotsch uslöse?',
  'chooser.cancel': 'Abbräche',

  'deed.title': 'Besitzrecht',
  'deed.rent': 'Miete',
  'deed.rentSet': 'mit ganzem Quartier',
  'deed.house1': '1 Huus',
  'deed.house2': '2 Hüüser',
  'deed.house3': '3 Hüüser',
  'deed.hotel': 'Hotel',
  'deed.houseCost': 'Huus choschtet',
  'deed.mortgage': 'Pfandwärt',
  'deed.owner': 'Bsitzer',
  'deed.bank': 'Bank',
  'deed.mortgaged': 'Verpfändet',
  'deed.transportRent': 'Miete 25 / 50 / 100 / 200 – je nach Azahl',
  'deed.utilityRent': 'Miete 8 × Würfel',
  'deed.go': 'Wär da verbii chunnt, holt 200.',
  'deed.jail': 'Nur zu Bsuech isch gratis.',
  'deed.parking': 'Da passiert nüt.',
  'deed.gotojail': 'Direkt is Gfängnis, ohni 200.',
  'deed.tax': 'Zahl 100 Stüüre.',
  'deed.card': 'Zieh e Ereignis-Charte.',

  'sq.go': '+200',
  'sq.jail': 'Nur zu Bsuech',
  'sq.parking': 'nüt passiert',
  'sq.gotojail': 'direkt',
  'sq.tax': 'zahl 100',
  'sq.card': 'Charte',

  'panel.you': 'du',
  'panel.cpu': 'Compi',
  'panel.remote': 'Online',
  'panel.jail': 'Gfängnis',
  'panel.bankrupt': 'Bankrott',
  'panel.left': 'Gange',

  'end.title': 'Fertig!',
  'end.winner': '{name} gwünnt!',
  'end.netWorth': 'Vermöge',
  'end.cash': 'Cash',
  'end.again': 'Nomol spile',

  'log.roll': '{name} würflet {d1} + {d2}',
  'log.move': '{name} gaht uf {square}',
  'log.movePassedGo': '{name} gaht über LOS uf {square}',
  'log.buy': '{name} chauft {square}',
  'log.pass': '{name} verzichtet uf {square}',
  'log.rent': '{name} zahlt {amount} Miete a {to} für {square}',
  'log.tax': '{name} zahlt {amount} Stüüre',
  'log.salary': '{name} holt de Lohn',
  'log.card': '{name} zieht: {card}',
  'card.rega': 'Rega-Iisatz i de Bärge — zahl CHF 100',
  'card.jass': 'Jass-Obig gwunne — CHF 50 für dich',
  'card.chrankekasse': 'Rückzahlig vo de Chrankekasse — CHF 100 für dich',
  'card.los': 'Gang uf LOS',
  'card.gfaengnis': 'Gang is Gfängnis',
  'card.sbb': 'SBB-Verspötig — 3 Fälder zrugg',
  'card.verkehr': 'Fahr zum nöchschte Verkehrsfeld — doppelti Miete, wenn verchauft',
  'card.renovation': 'Renovation — CHF 25 pro Huus, CHF 100 pro Hotel',
  'card.geburtstag': 'Geburtstag — jede zahlt dir CHF 20',
  'card.parkbuess': 'Parkbuess — zahl CHF 40',
  'card.tuuerscht': 'Fahr zum tüürschte Feld',
  'log.build': '{name} baut uf {square} ({houses})',
  'log.sell': '{name} verchauft es Huus uf {square}',
  'log.mortgage': '{name} verpfändet {square}',
  'log.unmortgage': '{name} löst {square} us',
  'log.jail': '{name} muess is Gfängnis ({why})',
  'log.jailOut': '{name} chunnt us em Gfängnis ({how})',
  'log.debt': '{name} isch i Gäldnot: {amount}',
  'log.bankrupt': '{name} isch bankrott – alles gaht a {to}',
  'log.turn': '{name} isch dra',
  'log.round': 'Rundi {n}',
  'log.timeUp': 'D Ziit isch um – letschti Rundi!',
  'log.over': '{name} gwünnt!',
  'houses.1': '1 Huus',
  'houses.2': '2 Hüüser',
  'houses.3': '3 Hüüser',
  'houses.4': 'Hotel',
  'jail.why.doubles': 'dritte Pasch',
  'jail.why.square': 'Gang is Gfängnis',
  'jail.why.card': 'Charte',
  'jail.how.pay': 'zahlt',
  'jail.how.doubles': 'Pasch',
  'jail.how.forced': 'zahlt nach drüü Mal',

  'version': 'Version {v}',
};

const en = {
  'app.title': 'Hüüsli-Jagd',
  'app.tagline': 'Buy, build, collect – done in 30 minutes.',
  'lang.gsw': 'Schwiizerdütsch',
  'lang.en': 'English',

  'menu.edition': 'Edition',
  'menu.mode': 'How do you want to play?',
  'menu.mode.solo': 'Solo vs. computer',
  'menu.mode.hotseat': 'Together on one screen',
  'menu.mode.online': 'Online',
  'menu.yourName': 'Your name',
  'menu.cpus': 'Computers',
  'menu.level': 'Level',
  'menu.level.gmuetlich': 'Easy-going',
  'menu.level.gwieft': 'Crafty',
  'menu.players': 'Players',
  'menu.playerN': 'Player {n}',
  'menu.start': 'Start',
  'menu.host': 'Create game',
  'menu.join': 'Join game',
  'menu.onlineSoon': 'Online play is coming soon. Until then: solo or together on one device.',
  'menu.onlineHost': 'You will be the host. Your code will appear here.',
  'menu.onlineJoin': 'Paste the code from the host here.',

  'game.round': 'Round {n} / {max}',
  'game.finalRound': 'Final round!',
  'game.viewFlat': 'Flat',
  'game.viewIso': '3D',
  'game.yourTurn': 'Your turn',
  'game.turnOf': 'Turn: {name}',
  'game.cpuThinking': '{name} is thinking…',
  'game.waitingFor': 'Waiting for {name}',
  'game.offer': 'Buy {square} for {amount}?',
  'game.debt': 'In debt! You are short {amount}.',
  'game.inJail': 'You are in jail.',

  'action.ROLL': 'Roll',
  'action.BUY': 'Buy',
  'action.PASS': 'Pass',
  'action.BUILD': 'Build',
  'action.SELL_HOUSE': 'Sell house',
  'action.MORTGAGE': 'Mortgage',
  'action.UNMORTGAGE': 'Unmortgage',
  'action.JAIL_PAY': 'Pay bail',
  'action.JAIL_ROLL': 'Roll for doubles',
  'action.DECLARE_BANKRUPT': 'Go bankrupt',
  'action.END_TURN': 'End turn',

  'chooser.BUILD': 'Where do you want to build?',
  'chooser.SELL_HOUSE': 'Where do you want to sell a house?',
  'chooser.MORTGAGE': 'What do you want to mortgage?',
  'chooser.UNMORTGAGE': 'What do you want to unmortgage?',
  'chooser.cancel': 'Cancel',

  'deed.title': 'Title deed',
  'deed.rent': 'Rent',
  'deed.rentSet': 'with full set',
  'deed.house1': '1 house',
  'deed.house2': '2 houses',
  'deed.house3': '3 houses',
  'deed.hotel': 'Hotel',
  'deed.houseCost': 'House costs',
  'deed.mortgage': 'Mortgage value',
  'deed.owner': 'Owner',
  'deed.bank': 'Bank',
  'deed.mortgaged': 'Mortgaged',
  'deed.transportRent': 'Rent 25 / 50 / 100 / 200 – by number owned',
  'deed.utilityRent': 'Rent 8 × dice',
  'deed.go': 'Collect 200 as you pass.',
  'deed.jail': 'Just visiting is free.',
  'deed.parking': 'Nothing happens here.',
  'deed.gotojail': 'Straight to jail, no 200.',
  'deed.tax': 'Pay 100 tax.',
  'deed.card': 'Draw an event card.',

  'sq.go': '+200',
  'sq.jail': 'Just visiting',
  'sq.parking': 'nothing happens',
  'sq.gotojail': 'directly',
  'sq.tax': 'pay 100',
  'sq.card': 'Card',

  'panel.you': 'you',
  'panel.cpu': 'CPU',
  'panel.remote': 'Online',
  'panel.jail': 'Jail',
  'panel.bankrupt': 'Bankrupt',
  'panel.left': 'Left',

  'end.title': 'Game over!',
  'end.winner': '{name} wins!',
  'end.netWorth': 'Net worth',
  'end.cash': 'Cash',
  'end.again': 'Play again',

  'log.roll': '{name} rolls {d1} + {d2}',
  'log.move': '{name} moves to {square}',
  'log.movePassedGo': '{name} passes GO and lands on {square}',
  'log.buy': '{name} buys {square}',
  'log.pass': '{name} passes on {square}',
  'log.rent': '{name} pays {amount} rent to {to} for {square}',
  'log.tax': '{name} pays {amount} tax',
  'log.salary': '{name} collects salary',
  'log.card': '{name} draws: {card}',
  'card.rega': 'Rega mountain rescue — pay CHF 100',
  'card.jass': 'Won the Jass night — collect CHF 50',
  'card.chrankekasse': 'Health insurance refund — collect CHF 100',
  'card.los': 'Advance to LOS',
  'card.gfaengnis': 'Go to jail',
  'card.sbb': 'SBB delay — go back 3 squares',
  'card.verkehr': 'Advance to the next transport square — pay double rent if owned',
  'card.renovation': 'Renovation — CHF 25 per house, CHF 100 per hotel',
  'card.geburtstag': 'Birthday — everyone pays you CHF 20',
  'card.parkbuess': 'Parking fine — pay CHF 40',
  'card.tuuerscht': 'Advance to the most expensive square',
  'log.build': '{name} builds on {square} ({houses})',
  'log.sell': '{name} sells a house on {square}',
  'log.mortgage': '{name} mortgages {square}',
  'log.unmortgage': '{name} unmortgages {square}',
  'log.jail': '{name} goes to jail ({why})',
  'log.jailOut': '{name} leaves jail ({how})',
  'log.debt': '{name} is in debt: {amount}',
  'log.bankrupt': '{name} is bankrupt – everything goes to {to}',
  'log.turn': 'Turn: {name}',
  'log.round': 'Round {n}',
  'log.timeUp': 'Time is up – final round!',
  'log.over': '{name} wins!',
  'houses.1': '1 house',
  'houses.2': '2 houses',
  'houses.3': '3 houses',
  'houses.4': 'hotel',
  'jail.why.doubles': 'third doubles',
  'jail.why.square': 'Go to jail',
  'jail.why.card': 'card',
  'jail.how.pay': 'paid',
  'jail.how.doubles': 'doubles',
  'jail.how.forced': 'paid after three tries',

  'version': 'Version {v}',
};

const STRINGS = { gsw, en };
export const LANGS = Object.keys(STRINGS);

const listeners = new Set();
let current = readStoredLang();

function readStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(stored) ? stored : 'gsw';
  } catch {
    return 'gsw';
  }
}

export function lang() {
  return current;
}

export function setLang(next) {
  if (!LANGS.includes(next) || next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage unavailable: the language lives for this session only
  }
  document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, params = {}) {
  const template = STRINGS[current][key] ?? gsw[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export function has(key) {
  return key in STRINGS[current] || key in gsw;
}

const chfFormat = new Intl.NumberFormat('de-CH', {
  style: 'currency',
  currency: 'CHF',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function chf(amount) {
  return chfFormat.format(amount);
}
