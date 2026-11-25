// All data lives on the phone in localStorage. Nothing is sent anywhere unless the
// AI features are switched on with the user's own key.
import { dayKey, uid } from './util.js';

const KEY = 'vektplan.v1';
export const SCHEMA = 1;

export const DEFAULT_SLOTS = [
  { id: 'breakfast', kind: 'breakfast', time: '08:30', on: true },
  { id: 'snack1', kind: 'snack', time: '11:00', on: true },
  { id: 'lunch', kind: 'lunch', time: '13:30', on: true },
  { id: 'snack2', kind: 'snack', time: '16:00', on: true },
  { id: 'dinner', kind: 'dinner', time: '19:00', on: true },
  { id: 'evening', kind: 'evening', time: '21:30', on: true },
];

function defaults() {
  return {
    schema: SCHEMA,
    created: dayKey(),
    profile: { name: 'Emil', heightCm: 194, goalKcal: null, onboarded: false },
    // planSource: where meal ideas come from: 'auto' (mix once you have own food), 'recipes', 'mix', 'mine', 'free'.
    prefs: { lang: 'en', theme: 'light', calm: false, restSec: 60, planSource: 'auto', watchHint: true, shortcutName: 'Vektplan Health' },
    slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
    ai: { key: '', model: 'claude-sonnet-5-5' },
    days: {},
    weights: [],
    workouts: [],
    activeWorkout: null,
    chat: [],
    favorites: [],
    custom: [],
    shopping: { checked: {} },
    wordOffset: 0,
    health: { days: {}, lastSync: null }, // Apple Watch numbers per day, from the Shortcut (js/health.js)
    myMeals: [], // your own food: { id, name, kcal, fodmap, when: [kinds], note, used, last } (js/mymeals.js)
    training: {}, // your own training plan (js/training.js); empty = the built-in rhythm
  };
}

let state = defaults();

function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
  const out = { ...base };
  for (const k of Object.keys(saved)) {
    const b = base[k];
    const v = saved[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v) && k !== 'days') {
      out[k] = { ...b, ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function migrate(saved) {
  const s = merge(defaults(), saved);
  if (!Array.isArray(s.slots) || !s.slots.length) s.slots = DEFAULT_SLOTS.map((x) => ({ ...x }));
  for (const d of DEFAULT_SLOTS) if (!s.slots.find((x) => x.id === d.id)) s.slots.push({ ...d, on: false });
  // Personal app: it's always Emil (194 cm). Fill these in if an older setup left them empty.
  if (!String(s.profile.name || '').trim()) s.profile.name = 'Emil';
  if (!s.profile.heightCm) s.profile.heightCm = 194;
  if (!Array.isArray(s.myMeals)) s.myMeals = [];
  if (!s.training || typeof s.training !== 'object' || Array.isArray(s.training)) s.training = {};
  s.schema = SCHEMA;
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? migrate(JSON.parse(raw)) : defaults();
  } catch (e) {
    console.warn('Could not read saved data', e);
    state = defaults();
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  return state;
}

export const S = () => state;

let saveError = null;
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveError = null;
  } catch (e) {
    saveError = e;
    console.warn('Save failed', e);
  }
}
export const lastSaveError = () => saveError;

export function mutate(fn) {
  fn(state);
  save();
}

export function replaceAll(data) {
  state = migrate(data);
  save();
}

export function resetAll() {
  const keepLang = state.prefs.lang;
  state = defaults();
  state.prefs.lang = keepLang;
  save();
}

export function exportJSON() {
  return JSON.stringify({ app: 'vektplan', exported: new Date().toISOString(), ...state }, null, 1);
}

// ---- Days ----
const EMPTY_DAY = Object.freeze({ plan: {}, logs: [], skipped: {}, stomach: [], journal: null });

export function peekDay(key = dayKey()) {
  return state.days[key] || EMPTY_DAY;
}

export function day(key = dayKey()) {
  if (!state.days[key]) state.days[key] = { plan: {}, logs: [], skipped: {}, stomach: [], journal: null };
  const d = state.days[key];
  d.plan ||= {};
  d.logs ||= [];
  d.skipped ||= {};
  d.stomach ||= [];
  return d;
}

export function activeSlots() {
  return state.slots.filter((s) => s.on).slice().sort((a, b) => a.time.localeCompare(b.time));
}

export function addLog(key, entry) {
  const e = { id: uid(), ts: Date.now(), portion: 1, items: [], tags: [], fodmap: 'low', ...entry };
  e.kcal = Math.round((e.baseKcal ?? e.kcal ?? 0) * (e.portion ?? 1));
  mutate(() => {
    const d = day(key);
    d.logs.push(e);
    if (e.slot) delete d.skipped[e.slot];
  });
  return e;
}

export function latestWeight() {
  const w = state.weights;
  return w.length ? w[w.length - 1] : null;
}

export function addWeight(kg, date = dayKey()) {
  mutate((s) => {
    s.weights = s.weights.filter((w) => w.date !== date);
    s.weights.push({ date, kg: Math.round(kg * 10) / 10 });
    s.weights.sort((a, b) => a.date.localeCompare(b.date));
  });
}

export function hasJournal(key) {
  const j = state.days[key]?.journal;
  if (!j) return false;
  return !!(j.note?.trim() || j.good?.trim() || (j.symptoms && j.symptoms.length) || (j.levels && Object.keys(j.levels).length));
}
