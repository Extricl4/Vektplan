import { S, mutate } from '../store.js';
import { bestSlotFor } from '../planner.js';
import { RECIPES, POOLS, GENTLE, recipeById } from '../data/recipes.js';
import { tr, L, n0, kindName, dayShort, shortDate, unitName } from '../i18n.js';
import { icon, plate, tabbar, toast, openSheet, closeSheet, confirmSheet } from '../ui.js';
import { swapSheet, portionButtons, cheer } from '../meals.js';
import { myMeals, sortedMeals, myMealSheet, logMyMeal, kcalLine, WHEN, STOMACH } from '../mymeals.js';
import { buildShopping } from '../data/shopping.js';
import { esc, dayKey, addDays, startOfWeek, parseKey, norm } from '../util.js';
import { nav } from '../nav.js';
import { totalsCard, timeline, ideasCard, diaryActions } from './diary.js';
import { dayTotals } from '../nutrition.js';

let cat = 'all';
let quick = false;
let shopRange = 'week';

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
    <section class="card tight" aria-label="${tr('Last 7 days', 'Siste 7 dager')}">
      <div class="row between"><h2 class="h3">${tr('Last 7 days', 'Siste 7 dager')}</h2><a class="link-btn small" href="#/progress">${tr('Trends', 'Utvikling')} →</a></div>
      <div class="list">${week.map((k) => {
        const t = dayTotals(k);
        return `<a class="item" href="#/food/diary/${k}" style="text-decoration:none;color:inherit;${k === key ? 'font-weight:600' : ''}">
          <span style="width:84px;flex:none" class="small">${k === today ? tr('Today', 'I dag') : `${dayShort(parseKey(k))} ${parseKey(k).getDate()}.`}</span>
          <span class="grow small soft num">${t.n ? (calm ? `${t.n} ${tr('times', 'ganger')}` : `${n0(t.kcal)} kcal · ${Math.round(t.p)} g ${tr('protein', 'protein')}`) : '–'}</span>${icon('chevR', 16)}</a>`;
      }).join('')}</div></section>`;
}

function mineTab() {
  const list = sortedMeals(myMeals());
  const calm = S().prefs.calm;
  const stomach = (k) => STOMACH.find(([x]) => x === k)?.[1]() || '';
  return `<button class="btn primary" data-act="newMy">${icon('plus', 18)} ${tr('New meal', 'Nytt måltid')}</button>
    ${list.length ? `<div class="col" style="gap:10px">${list.map((m) => `<section class="card tight">
      <div class="row between top" style="gap:10px"><button class="grow" data-act="editMy" data-id="${m.id}" style="all:unset;cursor:pointer;min-width:0">
        <span class="h3" style="display:block">${esc(m.name)}</span>
        <span class="small muted">${[(m.items || []).length ? `${m.items.length} ${tr('ingredients', 'ingredienser')}` : '', !calm ? kcalLine(m) : '', stomach(m.fodmap)].filter(Boolean).join(' · ')}</span>
        ${(m.items || []).length ? `<span class="tiny soft" style="display:block;margin-top:3px">${esc(m.items.slice(0, 4).map((i) => i.name.replace(/\s*\(.*\)$/, '')).join(', '))}${m.items.length > 4 ? '…' : ''}</span>` : ''}
        ${m.note ? `<span class="small soft" style="display:block;margin-top:4px">${esc(m.note)}</span>` : ''}</button>
        <button class="btn tiny secondary" data-act="logMy" data-id="${m.id}">${icon('plus', 15)} ${tr('Log', 'Logg')}</button></div></section>`).join('')}</div>`
      : `<div class="empty-state">${icon('heart', 30)}<p>${tr('Put the food you actually eat here: your usual breakfast, a dinner at home, a snack that sits well. Then you can log it in one tap, and the plan can suggest it.', 'Legg inn maten du faktisk spiser: den vanlige frokosten, middag hjemme, et mellommåltid som går fint. Da kan du logge med ett trykk, og planen kan foreslå den.')}</p></div>`}
    <p class="tiny muted" style="margin:0 6px;line-height:1.5">${tr('Tip: when you log food, switch on "Also save it to My meals" and it shows up here.', 'Tips: når du logger mat, slå på «Lagre det også i Mine måltider», så dukker det opp her.')}</p>`;
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

// The shopping list is built from recipes you add (Recipes → "Add to shopping list") plus your own items.
export const shopRecipes = () => (Array.isArray(S().shopping.recipes) ? S().shopping.recipes : []);
function shopItems() {
  const raw = [];
  for (const x of shopRecipes()) {
    const r = recipeById(x.rid);
    if (!r) continue;
    for (const [q, unit, name] of r.ing) raw.push({ q: q == null ? null : (q / r.serves) * (x.n || r.serves), unit, name });
  }
  const { list, pantry } = buildShopping(raw);
  list.sort((a, b) => L(a.name).localeCompare(L(b.name), S().prefs.lang === 'nb' ? 'nb' : 'en'));
  return { items: list, pantry };
}

function shopTab() {
  const { items, pantry } = shopItems();
  const checked = S().shopping.checked || {};
  const extra = Array.isArray(S().shopping.extra) ? S().shopping.extra : [];
  const left = items.filter((it) => !checked[it.key]).length + extra.filter((x) => !checked[x.key]).length;
  const row = (key, name, qty) => {
    const on = !!checked[key];
    return `<button class="item" data-act="tick" data-id="${esc(key)}" aria-pressed="${on}">
      <span class="state ${on ? 'done' : ''}" style="border-radius:7px">${on ? icon('check', 13, 'stroke-width="3.2"') : ''}</span>
      <span class="grow" style="${on ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(name)}</span>
      <span class="small muted num">${esc(qty || '')}</span></button>`;
  };
  return `<header class="head"><a class="icon-btn surface" href="#/food" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</a>
      <div class="grow"><h1 class="h2">${tr('Shopping list', 'Handleliste')}</h1></div>
      ${items.length + extra.length ? `<span class="badge accent">${left} ${tr('left', 'igjen')}</span>` : ''}</header>
    ${shopRecipes().length ? `<div class="chips">${shopRecipes().map((x) => recipeById(x.rid) ? `<button class="chip solid" aria-pressed="true" data-act="unshop" data-id="${x.rid}">${esc(L(recipeById(x.rid).name))} ${icon('x', 13)}</button>` : '').join('')}</div>` : ''}
    <div class="row" style="gap:8px"><input id="shop-add" class="input" type="text" maxlength="60" autocomplete="off" placeholder="${tr('Add something, e.g. bananas', 'Legg til noe, f.eks. bananer')}">
      <button class="btn secondary" data-act="shopAdd" style="flex:none">${icon('plus', 18)}</button></div>
    <section class="card" style="padding:4px 16px">
      ${items.length || extra.length ? `<div class="list">${extra.map((x) => row(x.key, x.text, '')).join('')}${items.map((it) => row(it.key, L(it.name), it.q != null ? fmtQty(it.q, it.unit) : '')).join('')}</div>`
        : `<div class="empty-state">${icon('cart', 32)}<p>${tr('Empty for now. Open a recipe and tap "Add to shopping list", or add things yourself above.', 'Tom foreløpig. Åpne en oppskrift og trykk «Legg i handlelisten», eller legg til ting selv over.')}</p></div>`}
    </section>
    ${pantry.length ? `<section class="card tight"><h2 class="h3">${tr('Check the cupboard', 'Sjekk skapet')}</h2>
      <p class="small soft" style="line-height:1.5">${esc(pantry.map((n) => L(n)).join(', '))}</p></section>` : ''}
    <div class="btns"><button class="btn secondary" data-act="clearTicks">${tr('Clear ticks', 'Fjern haker')}</button><button class="btn outline" data-act="clearShop">${tr('Empty the list', 'Tøm listen')}</button></div>
    <p class="tiny muted center" style="line-height:1.5">${tr('Rounded up to what you buy. Choose lactose-free dairy and check labels for onion and garlic.', 'Rundet opp til det du kjøper. Velg laktosefrie meieriprodukter og sjekk etiketter for løk og hvitløk.')}</p>`;
}

export function render(ctx) {
  const [tab, arg] = ctx.params;
  if (tab === 'shop') return `<div class="screen">${shopTab()}</div>${tabbar('food')}`;
  const isRecipes = tab === 'recipes';
  const isMine = tab === 'mine';
  const key = tab === 'diary' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '') && arg <= dayKey() ? arg : dayKey();
  return `<div class="screen">
    <div class="blob b1"></div>
    <header class="head"><h1 class="h1">${tr('Food', 'Mat')}</h1>
      <a class="btn small secondary" href="#/food/shop">${icon('cart', 17)} ${tr('Shopping list', 'Handleliste')}</a></header>
    <div class="seg" role="tablist">
      <a role="tab" href="#/food" aria-selected="${!isRecipes && !isMine}">${tr('Diary', 'Dagbok')}</a>
      <a role="tab" href="#/food/mine" aria-selected="${isMine}">${tr('My meals', 'Mine måltider')}</a>
      <a role="tab" href="#/food/recipes" aria-selected="${isRecipes}">${tr('Recipes', 'Oppskrifter')}</a></div>
    ${isRecipes ? recipesTab() : isMine ? mineTab() : diaryTab(key)}
  </div>${tabbar('food')}`;
}

export const actions = {
  ...diaryActions,
  cat: (el) => { cat = el.dataset.cat; nav.rerender(); },
  newMy: () => myMealSheet(null),
  editMy: (el) => {
    const m = myMeals().find((x) => x.id === el.dataset.id);
    if (m) myMealSheet(m);
  },
  logMy: (el) => {
    const m = myMeals().find((x) => x.id === el.dataset.id);
    if (!m) return;
    openSheet({
      title: esc(m.name),
      html: `<p class="small muted">${tr('How much did you eat?', 'Hvor mye spiste du?')}</p>${portionButtons(1)}`,
      actions: {
        portion: (b) => {
          logMyMeal(dayKey(), m, bestSlotFor(), Number(b.dataset.p));
          closeSheet();
          toast(cheer());
          nav.rerender();
        },
      },
    });
  },
  quick: () => { quick = !quick; nav.rerender(); },
  rq: (el) => {
    const q = norm(el.value.trim());
    document.querySelectorAll('#rgrid > [data-name]').forEach((c) => c.classList.toggle('hidden', !!q && !c.dataset.name.includes(q)));
  },
  tick: (el) => {
    const id = el.dataset.id;
    mutate((s) => {
      s.shopping.checked ||= {};
      if (s.shopping.checked[id]) delete s.shopping.checked[id];
      else s.shopping.checked[id] = true;
    });
    nav.rerender();
  },
  clearTicks: () => { mutate((s) => { s.shopping.checked = {}; }); toast(tr('Cleared.', 'Fjernet.')); nav.rerender(); },
  unshop: (el) => { mutate((s) => { s.shopping.recipes = shopRecipes().filter((x) => x.rid !== el.dataset.id); }); nav.rerender(); },
  shopAdd: () => {
    const v = document.getElementById('shop-add')?.value.trim();
    if (!v) return;
    mutate((s) => { s.shopping.extra = [...(Array.isArray(s.shopping.extra) ? s.shopping.extra : []), { key: 'x-' + Date.now(), text: v.slice(0, 60) }]; });
    nav.rerender();
    setTimeout(() => document.getElementById('shop-add')?.focus(), 50);
  },
  clearShop: async () => {
    const ok = await confirmSheet({ title: tr('Empty the list?', 'Tømme listen?'), text: tr('Removes the recipes and your own items from the list.', 'Fjerner oppskriftene og dine egne ting fra listen.'), yes: tr('Empty it', 'Tøm') });
    if (!ok) return;
    mutate((s) => { s.shopping = { checked: {}, recipes: [], extra: [] }; });
    nav.rerender();
  },
};
