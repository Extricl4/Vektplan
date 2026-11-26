// Recommendations "on the side": a few ideas that fit the time of day, your stomach, training
// and protein so far. Never a plan, never an order: you decide what you eat.
import { S, peekDay } from './store.js';
import { RECIPES } from './data/recipes.js';
import { RECIPE_MACROS } from './data/macros.js';
import { myMeals, whenOf } from './mymeals.js';
import { mealKcal, mealMacros } from './amount.js';
import { dayTotals, proteinGoal } from './nutrition.js';
import { workoutsOn } from './planner.js';
import { hasSupp, isTicked, suppList } from './supps.js';
import { tr } from './i18n.js';
import { dayKey, nowMinutes, dayNum } from './util.js';

export function kindAt(min = nowMinutes()) {
  if (min < 10 * 60 + 30) return 'breakfast';
  if (min < 14 * 60 + 30) return 'lunch';
  if (min < 17 * 60) return 'snack';
  if (min < 20 * 60 + 30) return 'dinner';
  return 'evening';
}

function stomachNow(key) {
  const c = peekDay(key).stomach?.slice(-1)[0];
  return c && Date.now() - c.ts < 4 * 3600 * 1000 ? c.level : null;
}

// Returns { why, items: [{ t: 'recipe'|'my'|'shake', id, title, kcal, p, tag }] }
export function ideasFor(key = dayKey()) {
  const min = nowMinutes();
  const kind = kindAt(min);
  const d = peekDay(key);
  const eaten = new Set(d.logs.flatMap((l) => [l.rid, l.myId].filter(Boolean)));
  const tot = dayTotals(key);
  const rough = ['queasy', 'rough'].includes(stomachNow(key));
  const lastWorkout = workoutsOn(key).slice(-1)[0];
  const fedSince = lastWorkout && d.logs.some((l) => l.ts > lastWorkout.ts);
  const afterTraining = lastWorkout && !fedSince && Date.now() - lastWorkout.ts < 3 * 3600 * 1000;
  const goal = proteinGoal();
  // Share of the waking day gone (08–22), to see if protein is behind without inventing a target.
  const share = Math.max(0, Math.min(1, (min - 8 * 60) / (14 * 60)));
  const lowProtein = goal ? tot.p < goal * share - 15 : false;

  const out = [];
  const add = (x) => { if (out.length < 7 && !out.some((y) => y.t === x.t && y.id === x.id)) out.push(x); };
  const recipeIdea = (r, tag) => ({ t: 'recipe', id: r.id, title: r.name, kcal: r.kcal, p: RECIPE_MACROS[r.id]?.[0] ?? null, tag });
  const fits = (r) => r.kinds.includes(kind === 'snack' ? 'snack' : kind) || (kind === 'snack' && r.kinds.includes('evening'));
  const rot = (arr) => { const n = arr.length ? dayNum(key) % arr.length : 0; return [...arr.slice(n), ...arr.slice(0, n)]; };

  let why = '';
  if (rough) why = tr('Your stomach felt rough, so these are the gentlest ones.', 'Magen kjentes tung, så dette er de mildeste.');
  else if (afterTraining) why = tr('You trained today. Something with protein helps the muscles grow.', 'Du har trent i dag. Noe med protein hjelper musklene å vokse.');
  else if (lowProtein) why = tr('A bit more protein today would help your muscles.', 'Litt mer protein i dag hjelper musklene.');

  // A shake is the easiest protein when you get full fast.
  if ((afterTraining || lowProtein) && hasSupp('protein') && !isTicked(suppList().find((x) => x.kind === 'protein')?.id || 'protein')) {
    add({ t: 'shake', id: 'protein', title: { en: 'Protein shake', nb: 'Proteinshake' }, kcal: null, p: 26, tag: tr('Easy protein', 'Lett protein') });
  }
  const pool = RECIPES.filter((r) => !eaten.has(r.id));
  if (rough) rot(pool.filter((r) => r.gentle && fits(r))).concat(pool.filter((r) => r.gentle)).forEach((r) => add(recipeIdea(r, tr('Gentle', 'Mild'))));
  if (afterTraining || lowProtein) rot(pool.filter((r) => (RECIPE_MACROS[r.id]?.[0] || 0) >= 18 && (fits(r) || kind === 'snack'))).slice(0, 3).forEach((r) => add(recipeIdea(r, tr('Protein', 'Protein'))));
  // Your own meals that fit this time of day, most used first.
  myMeals().filter((m) => !eaten.has(m.id) && (!m.when?.length || m.when.includes(whenOf(kind))))
    .sort((a, b) => (b.used || 0) - (a.used || 0)).slice(0, 3)
    .forEach((m) => add({ t: 'my', id: m.id, title: m.name, kcal: mealKcal(m) || null, p: mealMacros(m)?.[0] ?? null, tag: tr('Yours', 'Din') }));
  rot(pool.filter(fits)).forEach((r) => add(recipeIdea(r, r.min <= 10 ? tr('Quick', 'Rask') : '')));
  return { why, kind, items: out.slice(0, 6) };
}
