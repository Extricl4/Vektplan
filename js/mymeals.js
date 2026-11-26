// Your own meals: things you actually eat, saved once with what is in them (and how much),
// then logged in one tap or suggested by the plan.
// { id, name, items: [packed amount items], kcal (used when there are no items), when: [kinds], fodmap, note, used, last }
import { S, mutate, addLog } from './store.js';
import { tr, n0 } from './i18n.js';
import { uid } from './util.js';
import { nav } from './nav.js';
import { mealKcal } from './amount.js';

export const WHEN = [
  ['breakfast', () => tr('Breakfast', 'Frokost')],
  ['lunch', () => tr('Lunch', 'Lunsj')],
  ['dinner', () => tr('Dinner', 'Middag')],
  ['snack', () => tr('Snack', 'Mellommåltid')],
];
export const STOMACH = [
  ['low', () => tr('Fine for me', 'Går fint')],
  ['check', () => tr('Not sure yet', 'Usikker ennå')],
  ['moderate', () => tr('Sometimes trouble', 'Noen ganger trøbbel')],
];

export const myMeals = () => S().myMeals || [];
export const myMealById = (id) => myMeals().find((m) => m.id === id) || null;

// Meal slots: snack, evening → 'snack'; the rest map to themselves.
export const whenOf = (slotKind) => (slotKind === 'evening' || slotKind === 'snack' ? 'snack' : slotKind);

export function mealsFor(slotKind) {
  const k = whenOf(slotKind);
  return myMeals().filter((m) => !m.when?.length || m.when.includes(k));
}

// Most used first, then newest.
export function sortedMeals(list = myMeals()) {
  return list.slice().sort((a, b) => (b.used || 0) - (a.used || 0) || (b.created || 0) - (a.created || 0));
}

export function saveMyMeal(m) {
  let id = m.id;
  mutate((s) => {
    const i = m.id ? s.myMeals.findIndex((x) => x.id === m.id) : -1;
    if (i >= 0) s.myMeals[i] = { ...s.myMeals[i], ...m };
    else {
      id = 'm-' + uid();
      s.myMeals.unshift({ created: Date.now(), used: 0, ...m, id });
    }
  });
  return id;
}

export function deleteMyMeal(id) {
  mutate((s) => {
    s.myMeals = s.myMeals.filter((m) => m.id !== id);
  });
}

export function logMyMeal(key, meal, slotId, portion = 1) {
  mutate((s) => {
    const m = s.myMeals.find((x) => x.id === meal.id);
    if (m) { m.used = (m.used || 0) + 1; m.last = Date.now(); }
  });
  return addLog(key, {
    slot: slotId || null,
    title: meal.name,
    baseKcal: mealKcal(meal),
    portion,
    myId: meal.id,
    items: (meal.items || []).map((i) => ({ name: i.name, kcal: i.kcal || 0, amount: i.amount, unit: i.unit, fodmap: i.fodmap, tags: i.tags || [] })),
    tags: [...new Set((meal.items || []).flatMap((i) => i.tags || []))],
    fodmap: meal.fodmap || 'low',
    source: 'mine',
  });
}

export function kcalLine(m) {
  if (S().prefs.calm) return '';
  const k = mealKcal(m);
  return k ? `${n0(k)} kcal` : tr('kcal not set', 'kcal ikke satt');
}

// The editor is a full screen (views/mymeal.js). `prefill` can carry a name, items or 'when'.
let pending = null;
export const takePrefill = () => { const p = pending; pending = null; return p; };
export function myMealSheet(existing = null, { prefill = null } = {}) {
  pending = prefill;
  nav.go(existing ? `mymeal/${existing.id}` : 'mymeal/new');
}
