// English + Norwegian (bokmål). Strings live next to the code that uses them:
// tr('English', 'Norsk') — and L({ en, nb }) for content objects.
import { cap } from './util.js';

let lang = 'en';

export function setLang(value) {
  lang = value === 'nb' ? 'nb' : 'en';
  document.documentElement.lang = lang === 'nb' ? 'nb' : 'en';
}

export const getLang = () => lang;

export function tr(en, nb) {
  return lang === 'nb' && nb != null ? nb : en;
}

export function L(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return (lang === 'nb' ? obj.nb : obj.en) ?? obj.en ?? '';
}

export const locale = () => (lang === 'nb' ? 'nb-NO' : 'en-GB');

export function n0(v) {
  return Math.round(Number(v) || 0).toLocaleString(locale());
}

export function n1(v) {
  return (Math.round((Number(v) || 0) * 10) / 10).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function longDate(d = new Date()) {
  return cap(d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function shortDate(d) {
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

export function dayShort(d) {
  return cap(d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', ''));
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return tr('Good night', 'God natt');
  if (h < 12) return tr('Good morning', 'God morgen');
  if (h < 18) return tr('Good afternoon', 'God ettermiddag');
  return tr('Good evening', 'God kveld');
}

export function kindName(kind) {
  return {
    breakfast: tr('Breakfast', 'Frokost'),
    snack: tr('Snack', 'Mellommåltid'),
    lunch: tr('Lunch', 'Lunsj'),
    dinner: tr('Dinner', 'Middag'),
    evening: tr('Evening', 'Kveldsmat'),
  }[kind] || kind;
}

const UNITS = {
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  l: ['l', 'l'],
  tbsp: ['tbsp', 'ss'],
  tsp: ['tsp', 'ts'],
  pcs: ['', 'stk'],
  slice: ['slice', 'skive'],
  slices: ['slices', 'skiver'],
  can: ['can', 'boks'],
  cans: ['cans', 'bokser'],
  cm: ['cm', 'cm'],
  pinch: ['pinch', 'klype'],
  bunch: ['bunch', 'bunt'],
};

export function unitName(u) {
  const pair = UNITS[u];
  if (!pair) return u || '';
  return lang === 'nb' ? pair[1] : pair[0];
}

export function minutesLeft(min) {
  if (min < 1) return tr('now', 'nå');
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return tr(`in ${m} min`, `om ${m} min`);
  if (m === 0) return tr(`in ${h} h`, `om ${h} t`);
  return tr(`in ${h} h ${m} min`, `om ${h} t ${m} min`);
}
