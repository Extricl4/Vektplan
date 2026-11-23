import { S, mutate } from '../store.js';
import { dayStatus, planFor, itemInfo } from '../planner.js';
import { RECIPES, POOLS, GENTLE, recipeById } from '../data/recipes.js';
import { tr, L, n0, kindName, dayShort, shortDate, unitName } from '../i18n.js';
import { icon, plate, tabbar, toast } from '../ui.js';
import { swapSheet } from '../meals.js';
import { buildShopping } from '../data/shopping.js';
import { esc, dayKey, addDays, startOfWeek, parseKey, norm } from '../util.js';
import { nav } from '../nav.js';

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

function weekStrip(selected) {
  const start = startOfWeek(selected);
  const today = dayKey();
  return `<div class="row between" style="margin-bottom:-4px">
      <a class="icon-btn surface" href="#/food/plan/${addDays(start, -7)}" aria-label="${tr('Previous week', 'Forrige uke')}">${icon('chevL', 20)}</a>
      <span class="small muted">${shortDate(parseKey(start))} – ${shortDate(parseKey(addDays(start, 6)))}</span>
      <a class="icon-btn surface" href="#/food/plan/${addDays(start, 7)}" aria-label="${tr('Next week', 'Neste uke')}">${icon('chevR', 20)}</a></div>
    <div class="week" role="group" aria-label="${tr('Day', 'Dag')}">${Array.from({ length: 7 }, (_, i) => {
      const k = addDays(start, i);
      const d = parseKey(k);
      return `<a class="d ${k === today ? 'today' : ''}" href="#/food/plan/${k}" aria-pressed="${k === selected}">${dayShort(d)}<b>${d.getDate()}</b></a>`;
    }).join('')}</div>`;
}

function planTab(selected) {
  const calm = S().prefs.calm;
  const { list } = dayStatus(selected);
  const isToday = selected === dayKey();
  const planned = list.reduce((a, x) => a + (x.info.kcal || 0), 0);
  const rows = list.map((x) => {
    const r = x.info.recipe;
    const state = x.state;
    const stateCls = state === 'done' ? 'done' : state === 'now' || state === 'soon' ? 'now' : state === 'skip' ? 'skip' : '';
    const sub = `${kindName(x.slot.kind)}${state === 'done' ? ` · ${tr('eaten', 'spist')}` : state === 'skip' ? ` · ${tr('skipped', 'hoppet over')}` : (state === 'now' || state === 'soon') && isToday ? ` · ${tr('now', 'nå')}` : ''}`;
    return `<div class="item ${stateCls === 'now' ? 'now' : ''} ${state === 'done' ? 'done' : ''}">
      <span class="time">${x.time}</span>
      <span class="state ${stateCls}">${state === 'done' ? icon('check', 13, 'stroke-width="3.2"') : ''}</span>
      <a class="grow" href="${r ? `#/recipe/${r.id}/${selected}/${x.slot.id}` : '#/food'}" style="color:inherit;text-decoration:none;min-width:0">
        <span class="s" style="display:block">${sub}</span><span class="t" style="display:block">${esc(x.info.title)}</span></a>
      ${state !== 'done' ? `<button class="icon-btn" style="width:38px;height:38px;background:transparent;color:var(--muted)" data-act="swap" data-slot="${x.slot.id}" aria-label="${tr('Swap', 'Bytt')} ${esc(x.info.title)}">${icon('swap', 18)}</button>` : ''}
    </div>`;
  }).join('');
  const snacks = [...new Set([...POOLS.snack, ...GENTLE])].map(recipeById).filter(Boolean);
  return `${weekStrip(selected)}
    <section class="card" style="padding:6px 16px" aria-label="${tr('Meals', 'Måltider')}">
      <div class="list timeline">${rows || `<p class="small muted" style="padding:14px 0">${tr('No meal times are switched on.', 'Ingen måltider er slått på.')}</p>`}</div>
    </section>
    <div class="row between small muted" style="padding:0 4px">
      <span>${tr('Tap ⇄ to swap anything', 'Trykk ⇄ for å bytte')}</span>${calm ? '' : `<span class="num">≈ ${n0(planned)} kcal ${tr('planned', 'planlagt')}</span>`}</div>
    <div class="section-title"><h2 class="h2">${tr('Snack ideas', 'Mellommåltider')}</h2><a class="link-btn" href="#/food/recipes">${tr('All recipes', 'Alle oppskrifter')}</a></div>
    <div class="hscroll">${snacks.map((r) => recipeCard(r)).join('')}</div>`;
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

function shopItems() {
  const today = dayKey();
  const end = shopRange === 'week' ? addDays(startOfWeek(today), 6) : addDays(today, 6);
  const raw = [];
  for (let k = today; k <= end; k = addDays(k, 1)) {
    const { list } = dayStatus(k);
    for (const x of list) {
      if (x.done || x.skipped || (k === today && x.state === 'missed')) continue;
      const r = x.info.recipe;
      if (!r) continue;
      for (const [q, unit, name] of r.ing) raw.push({ q: q == null ? null : q / r.serves, unit, name });
    }
  }
  const { list, pantry } = buildShopping(raw);
  list.sort((a, b) => L(a.name).localeCompare(L(b.name), S().prefs.lang === 'nb' ? 'nb' : 'en'));
  return { items: list, pantry, end };
}

function shopTab() {
  const { items, pantry, end } = shopItems();
  const checked = S().shopping.checked || {};
  const label = shopRange === 'week' ? tr('Rest of this week', 'Resten av uka') : tr('Next 7 days', 'Neste 7 dager');
  const left = items.filter((it) => !checked[it.key]).length;
  return `<header class="head"><a class="icon-btn surface" href="#/food" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</a>
      <div class="grow"><h1 class="h2">${tr('Shopping list', 'Handleliste')}</h1><p class="small muted">${label} · ${tr('until', 'til')} ${shortDate(parseKey(end))}</p></div>
      ${items.length ? `<span class="badge accent">${left} ${tr('left', 'igjen')}</span>` : ''}</header>
    <div class="seg"><button aria-pressed="${shopRange === 'week'}" data-act="range" data-r="week">${tr('This week', 'Denne uka')}</button><button aria-pressed="${shopRange === '7'}" data-act="range" data-r="7">${tr('Next 7 days', 'Neste 7 dager')}</button></div>
    <section class="card" style="padding:4px 16px">
      ${items.length ? `<div class="list">${items.map((it) => {
        const on = !!checked[it.key];
        return `<button class="item" data-act="tick" data-id="${esc(it.key)}" aria-pressed="${on}">
          <span class="state ${on ? 'done' : ''}" style="border-radius:7px">${on ? icon('check', 13, 'stroke-width="3.2"') : ''}</span>
          <span class="grow" style="${on ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(L(it.name))}</span>
          <span class="small muted num">${it.q != null ? esc(fmtQty(it.q, it.unit)) : ''}</span></button>`;
      }).join('')}</div>` : `<div class="empty-state">${icon('cart', 32)}<p>${tr('Nothing left to buy for this period.', 'Ingenting igjen å kjøpe for denne perioden.')}</p></div>`}
    </section>
    ${pantry.length ? `<section class="card tight"><h2 class="h3">${tr('Check the cupboard', 'Sjekk skapet')}</h2>
      <p class="small soft" style="line-height:1.5">${esc(pantry.map((n) => L(n)).join(', '))}</p></section>` : ''}
    <div class="btns"><button class="btn secondary" data-act="clearTicks">${tr('Clear ticks', 'Fjern haker')}</button><a class="btn outline" href="#/food">${tr('Back to plan', 'Til planen')}</a></div>
    <p class="tiny muted center" style="line-height:1.5">${tr('Based on the meals left in your plan, rounded up to what you buy. Choose lactose-free dairy and check labels for onion and garlic.', 'Basert på måltidene som er igjen i planen, rundet opp til det du kjøper. Velg laktosefrie meieriprodukter og sjekk etiketter for løk og hvitløk.')}</p>`;
}

export function render(ctx) {
  const [tab, arg] = ctx.params;
  if (tab === 'shop') return `<div class="screen">${shopTab()}</div>${tabbar('food')}`;
  const isRecipes = tab === 'recipes';
  const selected = tab === 'plan' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : dayKey();
  return `<div class="screen">
    <div class="blob b1"></div>
    <header class="head"><h1 class="h1">${tr('Food', 'Mat')}</h1>
      <a class="btn small secondary" href="#/food/shop">${icon('cart', 17)} ${tr('Shopping list', 'Handleliste')}</a></header>
    <div class="seg" role="tablist">
      <a role="tab" href="#/food" aria-selected="${!isRecipes}">${tr('Meal plan', 'Måltidsplan')}</a>
      <a role="tab" href="#/food/recipes" aria-selected="${isRecipes}">${tr('Recipes', 'Oppskrifter')}</a></div>
    ${isRecipes ? recipesTab() : planTab(selected)}
  </div>${tabbar('food')}`;
}

export const actions = {
  swap: (el, e, ctx) => {
    const [tab, arg] = ctx.params;
    const key = tab === 'plan' && arg ? arg : dayKey();
    const slot = S().slots.find((s) => s.id === el.dataset.slot);
    if (slot) swapSheet(key, slot);
  },
  cat: (el) => { cat = el.dataset.cat; nav.rerender(); },
  quick: () => { quick = !quick; nav.rerender(); },
  rq: (el) => {
    const q = norm(el.value.trim());
    document.querySelectorAll('#rgrid > [data-name]').forEach((c) => c.classList.toggle('hidden', !!q && !c.dataset.name.includes(q)));
  },
  range: (el) => { shopRange = el.dataset.r; nav.rerender(); },
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
};
