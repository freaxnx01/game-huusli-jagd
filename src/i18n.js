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
  'menu.hostHint': 'du bisch de Host',
  'menu.join': 'Spiel biitrette',
  'menu.joinHint': 'du hesch en Code übercho',
  'menu.onlineIntro': 'Bis zu 4 Spieler. Ihr tuuschet Codes us – z.B. per Chat oder Mail. Kei Server, kei Aamäldig: gspilt wird direkt vo Browser zu Browser.',

  'lobby.players': 'Spieler ({n}/4)',
  'lobby.hostTag': 'Host',
  'lobby.makeCode': 'Code für de nöchscht Spieler mache',
  'lobby.making': 'Code wird gmacht…',
  'lobby.step1': '1 · Schick dä Code em nöchschte Spieler:',
  'lobby.step2': '2 · Er schickt dir en Antwort-Code zrugg – füeg en da ii:',
  'lobby.copy': 'Code kopiere',
  'lobby.copied': 'Kopiert!',
  'lobby.validFor': 'Dä Code isch no {time} gültig',
  'lobby.answerPlaceholder': 'Antwort-Code da iifüege…',
  'lobby.connect': 'Verbinde',
  'lobby.connecting': 'Verbinde…',
  'lobby.addCpu': '+ Compi',
  'lobby.removeCpu': 'Compi entfärne',
  'lobby.start': 'Spiel starte',
  'lobby.cancel': 'Abbräche',
  'lobby.offerLabel': 'Füeg de Aagebot-Code vom Host ii:',
  'lobby.offerPlaceholder': 'Aagebot-Code da iifüege…',
  'lobby.answer': 'Antwort mache',
  'lobby.answering': 'Antwort-Code wird gmacht…',
  'lobby.sendBack': 'Schick dä Antwort-Code zrugg an Host:',
  'lobby.waitingConnect': 'Warte uf d Verbindig… Sobald de Host de Code iigfüegt het, bisch du drin.',
  'lobby.joined': 'Du bisch drin!',
  'lobby.waitingHost': 'Warte uf de Host…',
  'lobby.guest': 'Gascht',
  'lobby.err.badAnswer': 'Dä Code isch nöd gültig – bitte de ganz Antwort-Code iifüege.',
  'lobby.err.badOffer': 'Dä Code isch nöd gültig – bitte de ganz Code vom Host iifüege.',
  'lobby.err.makeFailed': 'Öppis isch schiefgloffe – probiers nomol.',
  'lobby.err.connectFailed': 'D Verbindig het nöd klappet – probiereds nomol. Hinder gwüsse Firmenetz gohts leider nöd.',
  'lobby.err.expiredHost': 'De Code isch abgloffe – mach eifach en nöie.',
  'lobby.err.expiredGuest': 'De Code isch abgloffe – füeg de Host-Code nomol ii.',

  'net.full': 'S Spiel isch scho voll (max. 4 Spieler).',
  'net.bye': 'De Host het s Spiel beändet.',
  'net.closed': 'D Verbindig zum Host isch abbroche.',
  'net.failed': 'D Verbindig het nöd klappet – hinder gwüsse Firmenetz gohts leider nöd.',

  'game.leave': 'Verlah',
  'game.leaveConfirm': 'Wotsch s Spiel würkli verlah? Für di isch es dänn fertig.',
  'game.leaveConfirmHost': 'Wotsch s Spiel würkli beände? Es isch dänn für alli fertig.',
  'confirm.yes': 'Ja',
  'confirm.no': 'Nei',

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
  'log.left': '{name} isch gange',
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
  'menu.hostHint': 'you are the host',
  'menu.join': 'Join game',
  'menu.joinHint': 'you got a code',
  'menu.onlineIntro': 'Up to 4 players. You swap codes – by chat or mail, for instance. No server, no sign-up: you play straight from browser to browser.',

  'lobby.players': 'Players ({n}/4)',
  'lobby.hostTag': 'Host',
  'lobby.makeCode': 'Make a code for the next player',
  'lobby.making': 'Making the code…',
  'lobby.step1': '1 · Send this code to the next player:',
  'lobby.step2': '2 · They send you an answer code back – paste it here:',
  'lobby.copy': 'Copy code',
  'lobby.copied': 'Copied!',
  'lobby.validFor': 'This code is valid for {time}',
  'lobby.answerPlaceholder': 'Paste the answer code here…',
  'lobby.connect': 'Connect',
  'lobby.connecting': 'Connecting…',
  'lobby.addCpu': '+ Computer',
  'lobby.removeCpu': 'Remove computer',
  'lobby.start': 'Start game',
  'lobby.cancel': 'Cancel',
  'lobby.offerLabel': 'Paste the offer code from the host:',
  'lobby.offerPlaceholder': 'Paste the offer code here…',
  'lobby.answer': 'Make answer',
  'lobby.answering': 'Making the answer code…',
  'lobby.sendBack': 'Send this answer code back to the host:',
  'lobby.waitingConnect': 'Waiting for the connection… As soon as the host pastes the code, you are in.',
  'lobby.joined': 'You are in!',
  'lobby.waitingHost': 'Waiting for the host…',
  'lobby.guest': 'Guest',
  'lobby.err.badAnswer': 'That code is not valid – please paste the whole answer code.',
  'lobby.err.badOffer': 'That code is not valid – please paste the whole code from the host.',
  'lobby.err.makeFailed': 'Something went wrong – please try again.',
  'lobby.err.connectFailed': 'The connection failed – try again. Behind some corporate networks it sadly does not work.',
  'lobby.err.expiredHost': 'The code has expired – just make a new one.',
  'lobby.err.expiredGuest': 'The code has expired – paste the host code again.',

  'net.full': 'The game is already full (max. 4 players).',
  'net.bye': 'The host ended the game.',
  'net.closed': 'The connection to the host was lost.',
  'net.failed': 'The connection failed – behind some corporate networks it sadly does not work.',

  'game.leave': 'Leave',
  'game.leaveConfirm': 'Really leave the game? It will be over for you.',
  'game.leaveConfirmHost': 'Really end the game? It will be over for everyone.',
  'confirm.yes': 'Yes',
  'confirm.no': 'No',

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
  'log.left': '{name} left',
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
