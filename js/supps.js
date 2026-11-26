// Supplements: a small daily tick list (creatine, protein powder, vitamins…).
// Ticks live per day in days[key].supps = { id: timestamp }. Protein powder also logs itself as food.
import { S, peekDay, day, mutate, addLog } from './store.js';
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
export const DEFAULT_SUPPS = () => [
  { id: 'creatine-gummy', kind: 'creatine-gummy' },
  { id: 'protein', kind: 'protein', mix: 'water' },
  { id: 'vitd', kind: 'vitd' },
];

export const suppList = () => (Array.isArray(S().supps?.list) ? S().supps.list : []);
export const suppName = (x) => (x.name && x.name.trim()) || PRESETS[x.kind]?.name() || tr('Supplement', 'Tilskudd');
export const suppDose = (x) => (x.dose != null && String(x.dose).trim() ? String(x.dose).trim() : PRESETS[x.kind]?.dose() || '');
export const hasSupp = (kind) => suppList().some((x) => x.kind === kind);

export const ticks = (key = dayKey()) => peekDay(key).supps || {};
export const isTicked = (id, key = dayKey()) => !!ticks(key)[id];
export function doneCount(key = dayKey()) {
  const t = ticks(key);
  return suppList().filter((x) => t[x.id]).length;
}
export const allDone = (key = dayKey()) => suppList().length > 0 && doneCount(key) === suppList().length;

// Days in a row with every supplement ticked (today counts once it is done).
export function suppStreak() {
  if (!suppList().length) return 0;
  let k = dayKey();
  if (!allDone(k)) k = addDays(k, -1);
  let n = 0;
  while (n < 999) {
    const t = ticks(k);
    if (!Object.keys(t).length || !suppList().every((x) => t[x.id])) break;
    n++;
    k = addDays(k, -1);
  }
  return n;
}

function shakeItems(x) {
  const items = [];
  const whey = foodById('whey');
  if (whey) items.push(packItem(foodItem(whey, 1, 'mscoop')));
  if (x.mix === 'milk') {
    const milk = foodById('lf-milk');
    if (milk) items.push(packItem(foodItem(milk, 1, 'glass')));
  }
  return items;
}
export const shakeKcal = (x) => shakeItems(x).reduce((a, i) => a + i.kcal, 0);

// Tick or untick. Returns { on, all, streak }.
export function toggleSupp(id, key = dayKey()) {
  const x = suppList().find((s) => s.id === id);
  if (!x) return { on: false };
  const on = !isTicked(id, key);
  if (on && PRESETS[x.kind]?.food) {
    const items = shakeItems(x);
    if (items.length) {
      addLog(key, {
        slot: null, title: tr('Protein shake', 'Proteinshake'), baseKcal: items.reduce((a, i) => a + i.kcal, 0), portion: 1,
        items: items.map((i) => ({ name: i.name, kcal: i.kcal, amount: i.amount, unit: i.unit, fodmap: i.fodmap, tags: i.tags || [] })),
        tags: ['protein'], fodmap: 'low', source: 'supp', supp: id,
      });
    }
  }
  mutate(() => {
    const d = day(key);
    d.supps ||= {};
    if (on) d.supps[id] = Date.now();
    else {
      delete d.supps[id];
      d.logs = d.logs.filter((l) => l.supp !== id);
    }
  });
  return { on, all: allDone(key), streak: suppStreak() };
}

// Friendly words after a tick.
export function suppCheer(res) {
  if (!res.on) return tr('Unticked.', 'Fjernet.');
  if (res.all) {
    return res.streak >= 2
      ? tr(`All done today. ${res.streak} days in a row, that's how it works.`, `Alt gjort i dag. ${res.streak} dager på rad, det er sånn det virker.`)
      : tr('All done today. Small habit, big help.', 'Alt gjort i dag. Liten vane, stor hjelp.');
  }
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
export const addCustomSupp = (name, dose) => setSupps((sp) => sp.list.push({ id: `s-${uid()}`, kind: 'custom', name: String(name).trim().slice(0, 40), dose: String(dose || '').trim().slice(0, 30) }));

// Short description for the AI coach and trends.
export function suppText(key = dayKey()) {
  const t = ticks(key);
  return suppList().map((x) => `${suppName(x)}${t[x.id] ? ' ✓' : ''}`).join(', ');
}
export const proteinNote = (x) => (S().prefs.calm ? '' : `≈ ${n0(shakeKcal(x))} kcal`);
