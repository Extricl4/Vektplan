import { S } from '../store.js';
import { RECIPES } from '../data/recipes.js';
import { tr, L, n0, dayShort, shortDate, unitName } from '../i18n.js';
import { icon, plate, tabbar } from '../ui.js';
import { esc, dayKey, addDays, parseKey, norm } from '../util.js';
import { nav } from '../nav.js';
import { totalsCard, timeline, ideasCard, diaryActions } from './diary.js';
import { dayChart, legend } from './charts.js';

let cat = 'all';
let quick = false;

export function fmtQty(q, unit) {
  if (q == null) return '';
  if (unit === 'l' && q < 1) return fmtQty(q * 1000, 'ml');
  if (unit === 'ml' && q >= 1000) return fmtQty(q / 1000, 'l');
  if (unit === 'g' && q >= 1000) return `${(Math.round(q / 100) / 10).toLocaleString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB')} kg`;
  if (unit === 'can' && q > 1) unit = 'cans';
  let v = q;
  if (unit === 'g' || unit === 'ml') v = q >= 20 ? Math.round(q / 5) * 5 : Math.round(q);
  const whole = Math.floor(v + 1e-9);
  const frac = v - whole;
  const fracStr = Math.abs(frac - 0.25) < 0.07 ? '¼' : Math.abs(frac - 0.5) < 0.07 ? '½' : Math.abs(frac - 0.75) < 0.07 ? '¾' : Math.abs(frac - 1 / 3) < 0.05 ? '⅓' : Math.abs(frac - 2 / 3) < 0.05 ? '⅔' : '';
  let num;
  if (unit === 'g' || unit === 'ml' || unit === 'cm') num = String(Math.round(v));
  else if (fracStr) num = whole ? `${whole}${fracStr}` : fracStr;
  else if (frac < 0.07) num = String(whole);
  else num = (Math.round(v * 10) / 10).toLocaleString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB');
  const u = unitName(unit);
  return u ? `${num} ${u}` : num;
}

// One day in the diary, with arrows to go back in time.
function diaryTab(key) {
  const today = dayKey();
  const label = key === today ? tr('Today', 'I dag') : key === addDays(today, -1) ? tr('Yesterday', 'I går') : `${dayShort(parseKey(key))} ${shortDate(parseKey(key))}`;
  const calm = S().prefs.calm;
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  return `<div class="daynav"><a class="icon-btn surface" href="#/food/diary/${addDays(key, -1)}" aria-label="${tr('Previous day', 'Forrige dag')}">${icon('chevL', 20)}</a>
      <span class="grow">${esc(label)}</span>
      ${key < today ? `<a class="icon-btn surface" href="#/food/diary/${addDays(key, 1)}" aria-label="${tr('Next day', 'Neste dag')}">${icon('chevR', 20)}</a>` : '<span style="width:44px"></span>'}</div>
    ${totalsCard(key, { link: false })}
    <a class="btn primary" href="#/log${key === today ? '' : `/${key}`}" style="min-height:54px">${icon('plus', 18)} ${key === today ? tr('Log what you ate', 'Logg det du spiste') : tr(`Add food to ${label.toLowerCase()}`, `Legg til mat for ${label.toLowerCase()}`)}</a>
    ${timeline(key)}
    ${key === today ? ideasCard(key) : ''}
    ${S().prefs.calm ? '' : `<section class="card tight" aria-label="${tr('Last 7 days', 'Siste 7 dager')}">
      <div class="row between"><h2 class="h3">${tr('Last 7 days', 'Siste 7 dager')}</h2><a class="link-btn small" href="#/progress">${tr('More', 'Mer')} →</a></div>
      ${dayChart(week.slice().reverse(), { label: tr('Calories per day, split into protein, carbs and fat', 'Kalorier per dag, delt i protein, karbo og fett'), selected: key })}
      ${legend([[tr('No macro info', 'Uten makroinfo'), 'background:var(--c-unknown)']])}
      <p class="tiny muted">${tr('Each bar is one day. The number under it is protein. Tap a day to open it.', 'Hver søyle er én dag. Tallet under er protein. Trykk på en dag for å åpne den.')}</p></section>`}`;
}

export function recipeCard(r) {
  const calm = S().prefs.calm;
  return `<a class="rcard" href="#/recipe/${r.id}"><div class="thumb">${plate(r, 74)}</div>
    <span class="t">${esc(L(r.name))}</span><span class="s">${r.min ? `${r.min} min` : tr('No cooking', 'Ingen matlaging')}${calm ? '' : ` · ${n0(r.kcal)} kcal`}</span></a>`;
}

const CATS = [
  ['all', () => tr('All', 'Alle')],
  ['breakfast', () => tr('Breakfast', 'Frokost')],
  ['snack', () => tr('Snacks', 'Mellommåltid')],
  ['lunch', () => tr('Lunch', 'Lunsj')],
  ['dinner', () => tr('Dinner', 'Middag')],
  ['evening', () => tr('Evening', 'Kveld')],
  ['gentle', () => tr('Rough-day food', 'Mild mat')],
  ['fav', () => tr('Saved', 'Lagret')],
];

function filtered() {
  const favs = S().favorites;
  return RECIPES.filter((r) => {
    if (cat === 'gentle' && !r.gentle) return false;
    if (cat === 'fav' && !favs.includes(r.id)) return false;
    if (!['all', 'gentle', 'fav'].includes(cat) && !r.kinds.includes(cat)) return false;
    if (quick && r.min > 15) return false;
    return true;
  });
}

function recipesTab() {
  const list = filtered();
  return `<div class="search">${icon('search', 18)}<label class="sr-only" for="rq">${tr('Search recipes', 'Søk i oppskrifter')}</label>
      <input id="rq" class="input" type="search" placeholder="${tr('Search recipes', 'Søk i oppskrifter')}" data-input="rq" autocomplete="off"></div>
    <div class="chips scroll" role="group" aria-label="${tr('Category', 'Kategori')}">${CATS.map(([id, label]) => `<button class="chip solid" aria-pressed="${cat === id}" data-act="cat" data-cat="${id}">${label()}</button>`).join('')}</div>
    <div class="row"><button class="chip" aria-pressed="${quick}" data-act="quick">${icon('clock', 15)} ${tr('15 min or less', '15 min eller mindre')}</button>
      <span class="small muted grow" style="text-align:right">${list.length} ${tr('recipes', 'oppskrifter')}</span></div>
    <div class="grid2" id="rgrid">${list.length ? list.map((r) => `<div data-name="${esc(norm(r.name.en + ' ' + r.name.nb))}">${recipeCard(r)}</div>`).join('') : ''}</div>
    ${!list.length ? `<div class="empty-state">${icon(cat === 'fav' ? 'bookmark' : 'search', 32)}<p>${cat === 'fav' ? tr('Save recipes with the bookmark button and they show up here.', 'Lagre oppskrifter med bokmerkeknappen, så dukker de opp her.') : tr('Nothing here.', 'Ingenting her.')}</p></div>` : ''}
    <p class="tiny muted center" style="line-height:1.5">${tr('All recipes are built to be low FODMAP following Monash University guidance. Portions matter: stick to the amounts shown.', 'Alle oppskriftene er laget for å være lav-FODMAP etter Monash University sine råd. Mengder betyr noe: hold deg til mengdene som står.')}</p>`;
}

export function render(ctx) {
  const [tab, arg] = ctx.params;
  const isRecipes = tab === 'recipes';
  const key = tab === 'diary' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '') && arg <= dayKey() ? arg : dayKey();
  return `<div class="screen">
    <div class="blob b1"></div>
    <header class="head"><h1 class="h1">${tr('Food', 'Mat')}</h1></header>
    <div class="seg" role="tablist">
      <a role="tab" href="#/food" aria-selected="${!isRecipes}">${tr('Diary', 'Dagbok')}</a>
      <a role="tab" href="#/food/recipes" aria-selected="${isRecipes}">${tr('Recipe ideas', 'Oppskriftsideer')}</a></div>
    ${isRecipes ? recipesTab() : diaryTab(key)}
  </div>${tabbar('food')}`;
}

export const actions = {
  ...diaryActions,
  cat: (el) => { cat = el.dataset.cat; nav.rerender(); },
  quick: () => { quick = !quick; nav.rerender(); },
  rq: (el) => {
    const q = norm(el.value.trim());
    document.querySelectorAll('#rgrid > [data-name]').forEach((c) => c.classList.toggle('hidden', !!q && !c.dataset.name.includes(q)));
  },
};
