// What you ate, in numbers: calories, protein, fat and carbs per log and per day.
// A log stores its macros for one portion in `mac` ([protein, fat, carbs]); `portion` scales it.
import { S, peekDay, addLog, activeSlots, latestWeight } from './store.js';
import { packItem, itemFodmap, r1 } from './amount.js';
import { tr } from './i18n.js';
import { dayKey, toMinutes } from './util.js';

const RANK = { low: 0, check: 1, moderate: 2, high: 3 };
const worst = (fs) => fs.reduce((w, f) => (RANK[f] > RANK[w] ? f : w), 'low');
const sum3 = (list) => list.reduce((a, x) => a.map((v, j) => v + (x[j] || 0)), [0, 0, 0]);

function itemsMac(items) {
  const known = (items || []).filter((i) => i.p != null);
  return known.length ? sum3(known.map((i) => [i.p, i.f, i.c])) : null;
}

// Macros actually eaten for one log (after "half" etc.), or null if unknown.
export function logMac(l) {
  const base = l.mac || itemsMac(l.items);
  if (!base) return null;
  const p = l.portion ?? 1;
  return base.map((v) => v * p);
}

export function dayTotals(key = dayKey()) {
  const logs = peekDay(key).logs;
  let kcal = 0;
  let unknown = 0;
  const m = [0, 0, 0];
  for (const l of logs) {
    kcal += l.kcal || 0;
    const x = logMac(l);
    if (x) x.forEach((v, j) => { m[j] += v; });
    else unknown++;
  }
  return { kcal: Math.round(kcal), p: r1(m[0]), f: r1(m[1]), c: r1(m[2]), n: logs.length, unknown };
}

// The meal slot nearest a time of day, so older parts of the app still see a meal kind.
export function slotAt(minutes) {
  const slots = activeSlots();
  if (!slots.length) return null;
  let best = slots[0];
  for (const s of slots) if (Math.abs(toMinutes(s.time) - minutes) < Math.abs(toMinutes(best.time) - minutes)) best = s;
  return Math.abs(toMinutes(best.time) - minutes) <= 90 ? best.id : null;
}

// Log a list of amount items as one entry (a meal or a snack) at a time you choose.
// "Storfekjøtt, magert, rå" + "Hvit ris, ukokt" → "Storfekjøtt og hvit ris" (the details stay in the items).
export function autoTitle(items) {
  if (items.length === 1) return items[0].name;
  const short = (n) => String(n || '').split(/,| \(/)[0].trim();
  const parts = [...new Set(items.map((i) => short(i.name)).filter(Boolean))];
  const low = (t, i) => (i === 0 || !/^\p{Lu}\p{Ll}/u.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
  const shown = parts.slice(0, 3).map(low);
  const and = tr(' and ', ' og ');
  if (parts.length > 3) return `${shown.join(', ')}${tr(' and more', ' og mer')}`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')}${and}${shown[shown.length - 1]}` : shown[0] || '';
}

export function logItems(key, list, { title = '', ts = null, source = 'search', myId = null, rid = null, extra = {} } = {}) {
  const items = list.map(packItem);
  if (!items.length) return null;
  const when = ts || Date.now();
  const d = new Date(when);
  const known = items.filter((i) => i.p != null);
  const mac = known.length ? sum3(known.map((i) => [i.p, i.f, i.c])).map(r1) : null;
  const name = title || autoTitle(items);
  return addLog(key, {
    ts: when,
    slot: slotAt(d.getHours() * 60 + d.getMinutes()),
    title: name,
    baseKcal: items.reduce((a, i) => a + i.kcal, 0),
    portion: 1,
    mac,
    ...(known.length < items.length ? { macPart: true } : {}),
    items: items.map((i) => ({ name: i.name, kcal: i.kcal, amount: i.amount, unit: i.unit, fodmap: i.fodmap, tags: i.tags || [], ...(i.p != null ? { p: i.p, f: i.f, c: i.c } : {}), ...(i.fid ? { fid: i.fid } : {}) })),
    tags: [...new Set(items.flatMap((i) => i.tags || []).concat(mac && mac[0] >= 20 ? ['protein'] : []))],
    fodmap: worst(items.map((i) => i.fodmap || itemFodmap(i))),
    source,
    rid: rid || (list.length === 1 ? list[0].rid || null : null),
    myId: myId || (list.length === 1 ? list[0].myId || null : null),
    ...extra,
  });
}

// A protein goal is never set for you. This is the common research-based suggestion for building
// muscle (about 1.6 g per kg body weight a day), offered when you choose to set a goal.
export function proteinSuggestion() {
  const w = latestWeight();
  return w ? Math.round((w.kg * 1.6) / 5) * 5 : null;
}
export const proteinGoal = () => S().profile.goalProtein || null;

export const MACRO_NAMES = () => [tr('Protein', 'Protein'), tr('Fat', 'Fett'), tr('Carbs', 'Karbo')];
