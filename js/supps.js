// Supplements: a small daily tick list (creatine, protein powder, vitamins…).
// Ticks live per day in days[key].supps = { id: timestamp }. Protein powder also logs itself as food.
import { S, peekDay, day, mutate } from './store.js';
import { logItems } from './nutrition.js';
import { tr, n0 } from './i18n.js';
import { dayKey, addDays, uid } from './util.js';
import { foodById, foodItem, packItem } from './amount.js';

// About-texts are short and calm. Nothing here replaces advice from a doctor or pharmacy.
export const PRESETS = {
  'creatine-gummy': {
    name: () => tr('Creatine gummies', 'Kreatin-gummies'),
    dose: () => '3 g',
    about: () => tr('Creatine helps your muscles do a rep or two more, and over weeks that adds up to more muscle. Taking it every day matters more than the time of day. Heads-up: lab tests have found that many creatine gummies hold much less creatine than the label says, so pick a brand with a third-party test seal. Check the label for sorbitol, maltitol or xylitol too: those sweeteners are FODMAPs and can upset a sensitive stomach.',
      'Kreatin hjelper musklene å klare en repetisjon eller to til, og over uker blir det mer muskler. Det viktigste er å ta det hver dag, tidspunktet spiller liten rolle. Obs: labtester har funnet at mange kreatin-gummies har mye mindre kreatin enn det står på pakken, så velg et merke som er testet av en uavhengig tredjepart. Sjekk også om det står sorbitol, maltitol eller xylitol: de søtstoffene er FODMAP og kan plage en sensitiv mage.'),
  },
  creatine: {
    name: () => tr('Creatine (powder)', 'Kreatin (pulver)'),
    dose: () => tr('3–5 g · about 1 tsp', '3–5 g · ca. 1 ts'),
    about: () => tr('Creatine monohydrate powder is the cheapest and best tested kind. Stir 3–5 g into any drink or yogurt, every day. No loading or breaks needed. If it bothers your stomach, take it with a meal or split it in two.',
      'Kreatin monohydrat i pulverform er den billigste og best testede typen. Rør 3–5 g inn i en drikke eller yoghurt, hver dag. Du trenger ikke «lade opp» eller ta pauser. Plager det magen, ta det med et måltid eller del det i to.'),
  },
  protein: {
    name: () => tr('Protein powder', 'Proteinpulver'),
    dose: () => tr('1 scoop', '1 skje'),
    food: true,
    about: () => tr('Ticking it also logs a shake as food, so your calories stay right. Whey isolate usually has very little lactose; whey concentrate and many "gainers" have more, and some add inulin or chicory root, which are FODMAPs. A shake is an easy way to get protein in when you get full fast.',
      'Når du krysser av, logges en shake som mat, så kaloriene blir riktige. Whey-isolat har som regel veldig lite laktose; whey-konsentrat og mange «gainere» har mer, og noen har inulin eller sikorirot, som er FODMAP. En shake er en enkel måte å få i seg protein på når du blir fort mett.'),
  },
  vitd: {
    name: () => tr('Vitamin D', 'Vitamin D'),
    dose: () => tr('1 tablet or drops', '1 tablett eller dråper'),
    about: () => tr('Most people in Norway are advised to take extra vitamin D in the dark half of the year, as tran, tablets or drops. One source is enough: tran already has vitamin D.',
      'De fleste i Norge bør ta ekstra vitamin D i vinterhalvåret, som tran, tabletter eller dråper. Én kilde holder: tran har allerede vitamin D.'),
  },
  tran: {
    name: () => tr('Cod liver oil (tran)', 'Tran'),
    dose: () => tr('1 tsp (5 ml)', '1 ts (5 ml)'),
    about: () => tr('Tran gives both vitamin D and omega-3. Don\'t take it together with a separate vitamin D unless your doctor says so, and if you also take a multivitamin, pick one without vitamins A and D.',
      'Tran gir både vitamin D og omega-3. Ikke ta det sammen med et eget vitamin D-tilskudd med mindre legen sier det, og tar du også multivitamin, velg en uten vitamin A og D.'),
  },
  omega3: {
    name: () => tr('Omega-3', 'Omega-3'),
    dose: () => tr('1–2 capsules', '1–2 kapsler'),
    about: () => tr('Fish oil capsules. Taking them with a meal is gentler on the stomach and cuts the fishy burps.', 'Fiskeoljekapsler. Ta dem med et måltid, det er snillere mot magen og gir mindre fiskesmak i munnen.'),
  },
  multi: {
    name: () => tr('Multivitamin', 'Multivitamin'),
    dose: () => tr('1 tablet', '1 tablett'),
    about: () => tr('Nice to have while you eat small amounts. If you also take tran, pick a multivitamin without vitamins A and D so you don\'t get too much.',
      'Greit å ha mens du spiser lite. Tar du også tran, velg en multivitamin uten vitamin A og D, så du ikke får for mye.'),
  },
};
export const PRESET_ORDER = ['creatine-gummy', 'creatine', 'protein', 'vitd', 'tran', 'omega3', 'multi'];
// How many a day and of what, unless you change it.
export const PER_DAY = {
  'creatine-gummy': { n: 3, unit: 'gummy', each: '1 g' }, creatine: { n: 1, unit: 'tsp', each: '3–5 g' }, protein: { n: 1, unit: 'scoop', each: '' },
  vitd: { n: 1, unit: 'tablet', each: '' }, tran: { n: 1, unit: 'tsp', each: '' }, omega3: { n: 2, unit: 'capsule', each: '' }, multi: { n: 1, unit: 'tablet', each: '' },
  custom: { n: 1, unit: 'pill', each: '' },
};
export const SUPP_UNITS = {
  gummy: [() => tr('gummy', 'gummy'), () => tr('gummies', 'gummies')], tablet: [() => tr('tablet', 'tablett'), () => tr('tablets', 'tabletter')],
  capsule: [() => tr('capsule', 'kapsel'), () => tr('capsules', 'kapsler')], pill: [() => tr('pill', 'pille'), () => tr('pills', 'piller')],
  scoop: [() => tr('scoop', 'skje'), () => tr('scoops', 'skjeer')], tsp: [() => tr('tsp', 'ts'), () => tr('tsp', 'ts')],
  drops: [() => tr('dose of drops', 'dose dråper'), () => tr('doses of drops', 'doser dråper')], portion: [() => tr('portion', 'porsjon'), () => tr('portions', 'porsjoner')],
};
export const perDay = (x) => Math.max(1, Math.min(20, Number(x.n) || PER_DAY[x.kind]?.n || 1));
export const suppUnit = (x) => (SUPP_UNITS[x.unit] ? x.unit : PER_DAY[x.kind]?.unit || 'pill');
export const suppEach = (x) => (x.each != null ? String(x.each) : PER_DAY[x.kind]?.each || '');
export const unitWord = (u, n) => SUPP_UNITS[u]?.[n === 1 ? 0 : 1]() || '';
export const DEFAULT_SUPPS = () => [
  { id: 'creatine-gummy', kind: 'creatine-gummy' },
  { id: 'protein', kind: 'protein', mix: 'water' },
  { id: 'vitd', kind: 'vitd' },
];

export const suppList = () => (Array.isArray(S().supps?.list) ? S().supps.list : []);
export const suppName = (x) => (x.name && x.name.trim()) || PRESETS[x.kind]?.name() || tr('Supplement', 'Tilskudd');
// "3 gummies · 1 g each" (or your own dose text for older custom ones).
export function suppDose(x) {
  const n = perDay(x);
  const u = suppUnit(x);
  const each = suppEach(x);
  const base = `${n} ${unitWord(u, n)}`;
  if (x.kind === 'custom' && x.dose && !x.n) return String(x.dose);
  return each ? `${base} · ${each} ${tr('each', 'hver')}` : base;
}
export const hasSupp = (kind) => suppList().some((x) => x.kind === kind);

export const ticks = (key = dayKey()) => peekDay(key).supps || {};
// What you took on a given day: something you added later doesn't make older days look unfinished.
export const listOn = (key = dayKey()) => suppList().filter((x) => !x.since || x.since <= key);
// How many taken today. Older days only stored "done".
export function countOf(id, key = dayKey()) {
  const d = peekDay(key);
  const x = suppList().find((s) => s.id === id);
  if (d.suppN && d.suppN[id] != null) return d.suppN[id];
  return d.supps?.[id] ? (x ? perDay(x) : 1) : 0;
}
export const isTicked = (id, key = dayKey()) => !!ticks(key)[id];
export function doneCount(key = dayKey()) {
  const t = ticks(key);
  return listOn(key).filter((x) => t[x.id]).length;
}
export const allDone = (key = dayKey()) => listOn(key).length > 0 && doneCount(key) === listOn(key).length;

// Days in a row with every supplement ticked (today counts once it is done).
export function suppStreak() {
  if (!suppList().length) return 0;
  let k = dayKey();
  if (!allDone(k)) k = addDays(k, -1);
  let n = 0;
  while (n < 999) {
    const t = ticks(k);
    if (!Object.keys(t).length || !listOn(k).every((x) => t[x.id])) break;
    n++;
    k = addDays(k, -1);
  }
  return n;
}

function shakeItems(x) {
  const items = [];
  const whey = foodById('whey');
  if (whey) items.push(foodItem(whey, 1, 'mscoop'));
  if (x.mix === 'milk') {
    const milk = foodById('lf-milk');
    if (milk) items.push(foodItem(milk, 1, 'glass'));
  }
  return items;
}
export const shakeKcal = (x) => shakeItems(x).reduce((a, i) => a + packItem(i).kcal, 0);
export const shakeProtein = (x) => shakeItems(x).reduce((a, i) => a + (packItem(i).p || 0), 0);
// One more, always (a second shake on a hungry day), never wrapping round to zero.
export function addOne(id, key = dayKey()) {
  const x = suppList().find((s) => s.id === id);
  if (!x) return { on: false };
  return setCount(x, countOf(id, key) + 1, key);
}

// Take one more (or, when all are taken, start over). Returns { on, all, streak, count, n }.
export function toggleSupp(id, key = dayKey()) {
  const x = suppList().find((s) => s.id === id);
  if (!x) return { on: false };
  const n = perDay(x);
  const cur = countOf(id, key);
  return setCount(x, cur >= n ? 0 : cur + 1, key);
}
export function decSupp(id, key = dayKey()) {
  const x = suppList().find((s) => s.id === id);
  if (!x) return { on: false };
  return setCount(x, Math.max(0, countOf(id, key) - 1), key);
}

function setCount(x, count, key) {
  const id = x.id;
  const n = perDay(x);
  const before = countOf(id, key);
  // Each scoop of protein powder is also a shake in the food diary.
  if (PRESETS[x.kind]?.food && count > before) {
    const items = shakeItems(x);
    for (let i = before; i < count; i++) if (items.length) logItems(key, items, { title: tr('Protein shake', 'Proteinshake'), source: 'supp', extra: { supp: id, tags: ['protein'] } });
  }
  mutate(() => {
    const d = day(key);
    d.supps ||= {};
    d.suppN ||= {};
    d.suppN[id] = count;
    if (count >= n) d.supps[id] = d.supps[id] || Date.now();
    else delete d.supps[id];
    if (PRESETS[x.kind]?.food && count < before) {
      // Remove the newest shakes until they match the count.
      let extra = before - count;
      for (let i = d.logs.length - 1; i >= 0 && extra > 0; i--) if (d.logs[i].supp === id) { d.logs.splice(i, 1); extra--; }
    }
  });
  return { on: count > before, all: allDone(key), streak: suppStreak(), count, n, name: suppName(x), unit: suppUnit(x) };
}

// Friendly words after a tick.
export function suppCheer(res) {
  if (!res.on) return res.count ? tr(`${res.count} of ${res.n} now.`, `${res.count} av ${res.n} nå.`) : tr('Unticked.', 'Fjernet.');
  if (res.all) {
    return res.streak >= 2
      ? tr(`All done today. ${res.streak} days in a row, that's how it works.`, `Alt gjort i dag. ${res.streak} dager på rad, det er sånn det virker.`)
      : tr('All done today. Small habit, big help.', 'Alt gjort i dag. Liten vane, stor hjelp.');
  }
  if (res.n > 1 && res.count < res.n) return tr(`${res.count} of ${res.n} ${unitWord(res.unit, res.n)}. Nice.`, `${res.count} av ${res.n} ${unitWord(res.unit, res.n)}. Fint.`);
  const lines = [tr('Ticked. Nice.', 'Krysset av. Fint.'), tr('Done. One less thing to think about.', 'Gjort. Én ting mindre å tenke på.'), tr('Ticked. Steady wins.', 'Krysset av. Jevnt vinner.')];
  return lines[doneCount() % lines.length];
}

// Gentle heads-ups for combinations.
export function suppWarnings(list = suppList()) {
  const has = (k) => list.some((x) => x.kind === k);
  const out = [];
  if (has('tran') && has('vitd')) out.push(tr('Tran already has vitamin D. Taking both every day can be too much over time: pick one, or ask the pharmacy.', 'Tran har allerede vitamin D. Begge hver dag kan bli for mye over tid: velg én, eller spør på apoteket.'));
  if (has('tran') && has('multi')) out.push(tr('With tran, pick a multivitamin without vitamins A and D.', 'Med tran bør du velge en multivitamin uten vitamin A og D.'));
  if (has('creatine') && has('creatine-gummy')) out.push(tr('Two creatine sources: one is enough. 3–5 g a day in total.', 'To kreatinkilder: én holder. 3–5 g om dagen til sammen.'));
  return out;
}

export function setSupps(fn) {
  mutate((s) => {
    s.supps ||= { list: [], setup: true };
    if (!Array.isArray(s.supps.list)) s.supps.list = [];
    fn(s.supps);
    s.supps.setup = true;
  });
}
export const addCustomSupp = (name, n = 1, unit = 'pill', each = '') => setSupps((sp) => sp.list.push({ id: `s-${uid()}`, kind: 'custom', since: dayKey(), name: String(name).trim().slice(0, 40), n: Math.max(1, Math.min(20, Number(n) || 1)), unit, each: String(each || '').trim().slice(0, 30) }));

// Short description for the AI coach and trends.
export function suppText(key = dayKey()) {
  const t = ticks(key);
  return suppList().map((x) => `${suppName(x)} ${countOf(x.id, key)}/${perDay(x)} ${unitWord(suppUnit(x), perDay(x))}${t[x.id] ? ' ✓' : ''}`).join(', ');
}
export const proteinNote = (x) => (S().prefs.calm ? '' : `≈ ${n0(shakeKcal(x))} kcal`);
