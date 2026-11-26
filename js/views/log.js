// Log a meal: add each ingredient and how much (grams, slices, glasses…), then log it all together.
// Or type it ("150 g beef, 50 g rice") or snap a photo. Nothing is saved as a template: you type what you ate.
import { S, peekDay } from '../store.js';
import { logItems } from '../nutrition.js';
import { RECIPES, recipeById } from '../data/recipes.js';
import { BOOSTS } from '../data/amounts.js';
import { SOURCE } from '../data/foodbase.js';
import { tr, L, n0, shortDate } from '../i18n.js';
import { icon, openSheet, closeSheet, toast } from '../ui.js';
import { cheer } from '../meals.js';
import { hasAI, estimateMeal } from '../ai.js';
import { esc, dayKey, addDays, norm, readFileAsDataURL, shrinkImage, parseKey, nowMinutes } from '../util.js';
import { nav } from '../nav.js';
import {
  foodById, foodItem, recipeItem, freeItem, restoreItem, itemKcal, itemFodmap, itemMacros, macroLine, unitName, amountText,
  newFoodSheet, searchFoods, foodsIn, stepAmount, snap,
} from '../amount.js';
import { macroBar } from './charts.js';

let st = null;
function fresh(date) {
  return { date: date || dayKey(), time: null, q: '', cat: null, cart: [], name: '', mode: null, photo: null, busy: false, est: null, error: '', text: '', unmatched: [], focus: null };
}

export function enter(ctx) {
  const p = ctx.params[0];
  st = fresh(/^\d{4}-\d{2}-\d{2}$/.test(p || '') && p <= dayKey() ? p : undefined);
  // Logging for an earlier day: start at a sensible time instead of "now".
  if (st.date !== dayKey()) st.time = 12 * 60;
  if (p === 'photo') st.mode = 'photo';
  if (p === 'type') st.mode = 'type';
}

const CATS = [
  ['meat', () => tr('Meat & chicken', 'Kjøtt og kylling')], ['fish', () => tr('Fish', 'Fisk')], ['egg', () => tr('Eggs', 'Egg')],
  ['dairy', () => tr('Dairy', 'Meieri')], ['grain', () => tr('Rice, pasta, bread, potatoes', 'Ris, pasta, brød, poteter')], ['veg', () => tr('Vegetables', 'Grønnsaker')],
  ['fruit', () => tr('Fruit & berries', 'Frukt og bær')], ['nuts', () => tr('Nuts, seeds, beans', 'Nøtter, frø, bønner')], ['fat', () => tr('Oils, sauces, spreads', 'Olje, saus, pålegg')],
  ['sweet', () => tr('Sweet & snacks', 'Søtt og snacks')], ['drink', () => tr('Drinks', 'Drikke')], ['dish', () => tr('Ready dishes', 'Ferdigretter')],
];

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function whenTs() {
  const d = parseKey(st.date);
  const m = st.time ?? nowMinutes();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return Math.min(d.getTime(), Date.now());
}
function slotLabel() {
  const today = st.date === dayKey();
  const day = today ? '' : st.date === addDays(dayKey(), -1) ? `${tr('Yesterday', 'I går')} · ` : `${shortDate(parseKey(st.date))} · `;
  return st.time == null && today ? tr('Now', 'Nå') : `${day}${hhmm(st.time ?? nowMinutes())}`;
}

// Single foods you logged lately (not whole meals), for quick re-adding.
function recentFoods(max = 12) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < 30 && out.length < max; i++) {
    for (const l of peekDay(addDays(dayKey(), -i)).logs.slice().reverse()) {
      for (const it of l.items || []) {
        if (!it.fid || seen.has(it.fid) || !foodById(it.fid)) continue;
        seen.add(it.fid);
        out.push(foodById(it.fid));
        if (out.length >= max) break;
      }
    }
  }
  return out;
}

const shortName = (f) => L(f.n).replace(/\s*\(.*\)$/, '');
const cartMac = () => {
  const ms = st.cart.map(itemMacros).filter(Boolean);
  return ms.length ? ms.reduce((a, x) => a.map((v, j) => v + x[j]), [0, 0, 0]) : null;
};
const cartKcal = () => st.cart.reduce((a, i) => a + Math.round(itemKcal(i)), 0);
const fmtAmt = (v) => (v == null ? '' : String(Math.round(v * 100) / 100).replace('.', S().prefs.lang === 'nb' ? ',' : '.'));

function foodRow(f) {
  const calm = S().prefs.calm;
  const it = foodItem(f);
  const m = itemMacros(it);
  const per100 = f.custom ? '' : (() => {
    const g = it.units.find((u) => u.u === 'g' || u.u === 'ml');
    if (!g) return '';
    const x = foodItem(f, 100, g.u);
    const mm = itemMacros(x);
    return `100 ${g.u}: ${n0(itemKcal(x))} kcal${mm ? ` · ${fmtAmt(Math.round(mm[0] * 10) / 10)} g P` : ''}`;
  })();
  return `<button class="item" data-act="add" data-id="${esc(f.id)}">
    <span class="dot ${f.f || 'low'}" aria-hidden="true"></span>
    <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(L(f.n))}</span>
      <span class="s">${f.custom ? tr('Your own', 'Din egen') : calm ? '' : esc(per100)}${!calm && m && !per100 ? '' : ''}</span></span>
    ${icon('plus', 20, 'style="color:var(--accent);flex:none"')}</button>`;
}

function results() {
  const q = norm(st.q.trim());
  if (!q) {
    const rec = recentFoods();
    return `${rec.length ? `<p class="label">${tr('Used lately', 'Brukt nylig')}</p><div class="chips">${rec.map((f) => `<button class="chip" data-act="add" data-id="${esc(f.id)}">${icon('plus', 13)} ${esc(shortName(f))}</button>`).join('')}</div>` : ''}
      <p class="label">${tr('Browse', 'Bla gjennom')}</p>
      <div class="chips">${CATS.map(([k, l]) => `<button class="chip solid" aria-pressed="${st.cat === k}" data-act="cat" data-v="${k}">${esc(l())}</button>`).join('')}</div>
      ${st.cat ? `<div class="list">${foodsIn(st.cat).map(foodRow).join('')}</div>` : ''}
      <p class="tiny muted" style="margin-top:4px">${esc(L(SOURCE))}</p>`;
  }
  const foods = searchFoods(st.q, 16);
  const recipes = RECIPES.filter((r) => norm(r.name.en).includes(q) || norm(r.name.nb).includes(q)).slice(0, 4);
  return `${foods.length ? `<div class="list">${foods.map(foodRow).join('')}</div>` : ''}
    ${recipes.length ? `<p class="label">${tr('Recipes', 'Oppskrifter')}</p><div class="list">${recipes.map((r) => `<button class="item" data-act="addRecipe" data-id="${r.id}"><span class="grow"><span class="t" style="display:block;font-weight:500">${esc(L(r.name))}</span><span class="s">${tr('1 portion', '1 porsjon')}${S().prefs.calm ? '' : ` · ${n0(r.kcal)} kcal`}</span></span>${icon('plus', 20, 'style="color:var(--accent)"')}</button>`).join('')}</div>` : ''}
    <button class="item" data-act="newFood" style="border:1px dashed var(--line);border-radius:16px;margin-top:6px">${icon('plus', 18)}<span class="grow">${tr('Not here? Add', 'Finner du det ikke? Legg til')} <b>«${esc(st.q.trim())}»</b></span></button>`;
}

function photoCard() {
  const inputs = `<input id="cam" class="sr-only" type="file" accept="image/*" capture="environment" data-change="photo">
    <input id="lib" class="sr-only" type="file" accept="image/*" data-change="photo">`;
  if (!hasAI()) {
    return `<section class="card soft"><div class="row between"><h2 class="h3">${tr('Photo', 'Bilde')}</h2><button class="icon-btn" data-act="mode" data-mode="" aria-label="${tr('Close', 'Lukk')}">${icon('x', 18)}</button></div>
      <p class="small soft" style="line-height:1.5">${tr('Photo guesses need an AI key (Settings → AI). Until then, search for the foods below, it only takes a few taps.', 'Bildegjetting trenger en AI-nøkkel (Innstillinger → AI). Fram til da kan du søke opp maten under, det tar bare noen trykk.')}</p>
      <a class="btn secondary small" href="#/settings/ai">${tr('Set up AI', 'Sett opp AI')}</a></section>`;
  }
  if (!st.photo) {
    return `<section class="card">${inputs}<div class="row between"><h2 class="h3">${tr('Photo of your plate', 'Bilde av tallerkenen')}</h2><button class="icon-btn" data-act="mode" data-mode="" aria-label="${tr('Close', 'Lukk')}">${icon('x', 18)}</button></div>
      <p class="small soft">${tr('The AI guesses what is on it and how much. You can fix every amount after.', 'AI-en gjetter hva som er på den og hvor mye. Du kan rette hver mengde etterpå.')}</p>
      <div class="btns"><label class="btn primary" for="cam">${icon('camera', 18)} ${tr('Take photo', 'Ta bilde')}</label>
      <label class="btn secondary" for="lib">${icon('image', 18)} ${tr('Choose photo', 'Velg bilde')}</label></div></section>`;
  }
  return `<section class="card">${inputs}<div class="photo ${st.busy ? 'scanning' : ''}"><img src="${st.photo}" alt="${tr('Your meal', 'Måltidet ditt')}">
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>
    ${st.busy ? `<p class="center small muted">${tr('Looking at your meal…', 'Ser på måltidet ditt…')}</p>` : ''}
    ${st.error ? `<div class="note amber">${icon('info', 18)}<div class="grow">${esc(st.error)} <button class="link-btn" data-act="retry">${tr('Try again', 'Prøv igjen')}</button></div></div>` : ''}
    ${!st.busy ? `<div class="btns"><label class="btn secondary small" for="cam">${icon('camera', 16)} ${tr('New photo', 'Nytt bilde')}</label><label class="btn secondary small" for="lib">${icon('image', 16)} ${tr('Library', 'Bibliotek')}</label></div>` : ''}</section>`;
}

function typeCard() {
  const ai = hasAI();
  return `<section class="card"><div class="row between"><h2 class="h3">${tr('Type it', 'Skriv det')}</h2><button class="icon-btn" data-act="mode" data-mode="" aria-label="${tr('Close', 'Lukk')}">${icon('x', 18)}</button></div>
    <label class="sr-only" for="meal-text">${tr('What did you eat?', 'Hva spiste du?')}</label>
    <textarea id="meal-text" class="textarea" rows="3" data-input="text" placeholder="${tr('e.g. 150 g beef, 50 g rice, 1 glass of lactose-free milk', 'f.eks. 150 g biff, 50 g ris, 1 glass laktosefri melk')}">${esc(st.text)}</textarea>
    <button class="btn ${ai ? 'primary' : 'secondary'}" data-act="estimate" ${st.busy ? 'disabled' : ''}>${icon(ai ? 'sparkle' : 'search', 18)} ${st.busy ? tr('Thinking…', 'Tenker…') : ai ? tr('Estimate with AI', 'Estimer med AI') : tr('Find these foods', 'Finn disse matvarene')}</button>
    <p class="tiny muted">${tr('Write grams or everyday amounts. Each part ends up as its own ingredient that you can adjust.', 'Skriv gram eller vanlige mengder. Hver del blir en egen ingrediens du kan justere.')}</p>
    ${st.error ? `<div class="note amber">${icon('info', 18)}<span>${esc(st.error)}</span></div>` : ''}</section>`;
}

// One ingredient: name, amount you can type, unit, and what it gives.
function ingRow(it, i) {
  const calm = S().prefs.calm;
  const m = itemMacros(it);
  const f = itemFodmap(it);
  const pair = it.pair && foodById(it.pair);
  const isRaw = /-raw$/.test(it.fid || '');
  const units = it.units || [];
  return `<div class="ing" data-k="${it.k}">
    <div class="ing-top"><span class="dot ${f}" id="dot-${it.k}" aria-hidden="true"></span>
      <span class="ing-name">${esc(it.name)}</span>
      <button class="icon-btn" style="width:34px;height:34px;flex:none" data-act="rm" data-k="${it.k}" aria-label="${tr('Remove', 'Fjern')} ${esc(it.name)}">${icon('x', 16)}</button></div>
    <div class="ing-bot">
      <button class="ing-step" data-act="dec" data-k="${it.k}" aria-label="${tr('Less', 'Mindre')}">−</button>
      <input class="ing-amt num" id="amt-${it.k}" type="text" inputmode="decimal" autocomplete="off" value="${fmtAmt(it.amount)}" data-input="amt" data-change="amtDone" data-k="${it.k}" aria-label="${tr('Amount of', 'Mengde')} ${esc(it.name)}">
      ${units.length > 1 ? `<select class="ing-unit" data-change="unit" data-k="${it.k}" aria-label="${tr('Unit', 'Enhet')}">${units.map((u) => `<option value="${u.u}" ${u.u === it.unit ? 'selected' : ''}>${esc(unitName(u.u, it.amount))}</option>`).join('')}</select>`
        : `<span class="ing-unit fixed">${esc(it.portionText || unitName(it.unit, it.amount))}</span>`}
      <button class="ing-step" data-act="inc" data-k="${it.k}" aria-label="${tr('More', 'Mer')}">+</button>
      ${calm ? '' : `<span class="ing-out num" id="out-${it.k}">${n0(itemKcal(it))} kcal${m ? `<br><b>${Math.round(m[0])} g P</b>` : ''}</span>`}
    </div>
    ${pair ? `<button class="chip tiny-chip" data-act="twin" data-k="${it.k}">${icon('swap', 13)} ${isRaw ? tr('Weighed cooked? Switch', 'Veid kokt/stekt? Bytt') : tr('Weighed raw/dry? Switch', 'Veid rå/tørr? Bytt')}</button>` : ''}
    <div id="note-${it.k}">${noteHTML(it, f)}</div>
  </div>`;
}

function noteHTML(it, f = itemFodmap(it)) {
  if (f !== it.fodmap && it.lowMax) return `<p class="tiny" style="color:var(--amber)">${tr(`Low FODMAP up to about ${it.lowMax} g.`, `Lav-FODMAP opp til ca. ${it.lowMax} g.`)}</p>`;
  if (f !== 'low' && it.why) return `<p class="tiny" style="color:var(--amber)">${esc(it.why)}</p>`;
  return '';
}

function mealCard() {
  const calm = S().prefs.calm;
  const has = st.cart.length > 0;
  const total = cartKcal();
  const mac = cartMac();
  return `<section class="card meal" aria-label="${tr('Your meal', 'Måltidet ditt')}">
    <div class="row between"><h2 class="h3">${st.est?.title && !st.name ? esc(st.est.title) : tr('Your meal', 'Måltidet ditt')}</h2>
      <span class="small muted">${st.cart.length} ${st.cart.length === 1 ? tr('ingredient', 'ingrediens') : tr('ingredients', 'ingredienser')}</span></div>
    ${has ? `<div class="ings">${st.cart.map(ingRow).join('')}</div>`
      : `<p class="small soft" style="line-height:1.5">${tr('Search below and tap each thing you ate. Then type how much: 150 g, 2 slices, 1 glass…', 'Søk under og trykk på hver ting du spiste. Skriv så hvor mye: 150 g, 2 skiver, 1 glass…')}</p>`}
    ${st.unmatched.length ? `<div class="note amber">${icon('info', 18)}<div class="grow col" style="gap:6px"><span>${tr('Not found:', 'Fant ikke:')} ${st.unmatched.map((u) => `<b>${esc(u)}</b>`).join(', ')}</span>
      <div class="row wrap" style="gap:6px">${st.unmatched.map((u, i) => `<button class="btn tiny secondary" data-act="newFoodFor" data-i="${i}">${tr('Add', 'Legg til')} «${esc(u)}»</button>`).join('')}</div></div></div>` : ''}
    ${has && !calm ? `<div class="meal-total" id="meal-total">${totalHTML(total, mac)}</div>` : ''}
    ${has ? `<input id="meal-name" class="input" type="text" maxlength="60" autocomplete="off" data-input="name" value="${esc(st.name)}" placeholder="${tr('Name it (optional), e.g. Beef and rice', 'Gi det et navn (valgfritt), f.eks. Biff og ris')}">
      <button class="btn primary" data-act="save" style="min-height:56px;font-size:16px">${icon('check', 18)} ${tr('Log this meal', 'Logg måltidet')}</button>` : ''}
    ${has ? boostsHTML() : ''}
  </section>`;
}

function totalHTML(total, mac) {
  return `<div class="row between" style="align-items:baseline"><span class="small muted">${tr('Total', 'Totalt')}</span><span class="num" style="font-size:22px;font-weight:700">${n0(total)} kcal</span></div>
    ${mac ? `${macroBar(mac)}<p class="small soft num">${esc(macroLine(mac))}</p>` : ''}`;
}

function boostsHTML() {
  const inCart = new Set(st.cart.map((i) => i.fid).filter(Boolean));
  const boosts = BOOSTS.filter((b) => !inCart.has(b.id) && foodById(b.id)).slice(0, 4);
  if (!boosts.length) return '';
  return `<div class="boosts"><p class="tiny soft" style="line-height:1.4">${tr('Get full fast? A little of these adds energy without much more food:', 'Blir du fort mett? Litt av dette gir mer energi uten mye mer mat:')}</p>
    <div class="chips">${boosts.map((b) => `<button class="chip" data-act="boost" data-id="${b.id}">${icon('plus', 13)} ${esc(shortName(foodById(b.id)))}</button>`).join('')}</div></div>`;
}

export function render() {
  if (!st) st = fresh();
  return `<div class="screen no-tabs">
    <header class="head">
      <button class="icon-btn surface" data-act="close" aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button>
      <h1 class="h2 grow">${tr('Log a meal', 'Logg et måltid')}</h1>
      <button class="chip on" data-act="slot">${icon('clock', 15)} ${esc(slotLabel())}</button>
    </header>
    ${mealCard()}
    ${st.mode === 'photo' ? photoCard() : st.mode === 'type' ? typeCard() : ''}
    <div class="search">${icon('search', 18)}<label class="sr-only" for="log-q">${tr('Search', 'Søk')}</label>
      <input id="log-q" class="input" type="search" autocomplete="off" placeholder="${st.cart.length ? tr('Add more: rice, egg, milk…', 'Legg til mer: ris, egg, melk…') : tr('Search: beef, rice, egg, milk…', 'Søk: biff, ris, egg, melk…')}" value="${esc(st.q)}" data-input="q"></div>
    ${st.mode ? '' : `<div class="row" style="gap:8px"><button class="btn small secondary" data-act="mode" data-mode="type" style="flex:1">${icon('pencil', 16)} ${tr('Type it all', 'Skriv alt')}</button>
      <button class="btn small secondary" data-act="mode" data-mode="photo" style="flex:1">${icon('camera', 16)} ${tr('Photo', 'Bilde')}</button></div>`}
    <div id="log-results" class="col" style="gap:8px">${results()}</div>
  </div>`;
}

export function mount() {
  if (st?.focus) {
    const k = st.focus;
    st.focus = null;
    setTimeout(() => {
      const el = document.getElementById(`amt-${k}`);
      if (!el) return;
      el.closest('.ing')?.scrollIntoView({ block: 'center' });
      el.focus();
      el.select();
    }, 60);
  }
}

function refreshResults() {
  const box = document.getElementById('log-results');
  if (box) box.innerHTML = results();
}

const find = (k) => st.cart.find((x) => x.k === k);

function addItem(it, focus = true) {
  st.cart.push(it);
  st.q = '';
  if (focus) st.focus = it.k;
  nav.rerender();
  mount();
}

// Update one row's numbers and the total without re-drawing (keeps the keyboard open).
function refreshNumbers(it) {
  const out = document.getElementById(`out-${it.k}`);
  const m = itemMacros(it);
  if (out) out.innerHTML = `${n0(itemKcal(it))} kcal${m ? `<br><b>${Math.round(m[0])} g P</b>` : ''}`;
  const tot = document.getElementById('meal-total');
  if (tot) tot.innerHTML = totalHTML(cartKcal(), cartMac());
  // Small things that depend on the amount, changed in place so a tap on another button still lands.
  const f = itemFodmap(it);
  const dot = document.getElementById(`dot-${it.k}`);
  if (dot) dot.className = `dot ${f}`;
  const note = document.getElementById(`note-${it.k}`);
  if (note) note.innerHTML = noteHTML(it, f);
  const sel = document.querySelector(`select[data-k="${it.k}"]`);
  if (sel) [...sel.options].forEach((o) => { o.textContent = unitName(o.value, it.amount); });
}

const UNIT_WORDS = {
  slice: 'slice', slices: 'slice', skive: 'slice', skiver: 'slice', glass: 'glass', glasses: 'glass', dl: 'dl', g: 'g', gram: 'g', grams: 'g', gr: 'g',
  ml: 'ml', ss: 'tbsp', tbsp: 'tbsp', spiseskje: 'tbsp', spiseskjeer: 'tbsp', ts: 'tsp', tsp: 'tsp', teskje: 'tsp', stk: 'piece', piece: 'piece', pieces: 'piece',
  stykk: 'piece', stykker: 'piece', neve: 'handful', never: 'handful', handful: 'handful', handfuls: 'handful', boks: 'can', bokser: 'can', can: 'can', cans: 'can',
  bolle: 'bowl', boller: 'bowl', bowl: 'bowl', bowls: 'bowl', kopp: 'cup', kopper: 'cup', cup: 'cup', cups: 'cup', beger: 'tub', tub: 'tub', kule: 'scoop', kuler: 'scoop',
  scoop: 'scoop', rute: 'square', ruter: 'square', square: 'square', squares: 'square', fedd: 'clove', clove: 'clove', flaske: 'bottle', bottle: 'bottle', porsjon: 'portion', portion: 'portion',
};
const STOP = new Set(['some', 'the', 'and', 'with', 'had', 'ate', 'little', 'bit', 'litt', 'noen', 'en', 'et', 'ei', 'av', 'med', 'til', 'of', 'a', 'an']);
const ALIAS = {
  rice: 'rice', ris: 'rice', milk: 'lf-milk', melk: 'lf-milk', cola: 'soda', coke: 'soda', pepsi: 'soda', brus: 'soda', soda: 'soda',
  egg: 'egg', eggs: 'egg', potato: 'potatoes', potatoes: 'potatoes', potet: 'potatoes', poteter: 'potatoes', bread: 'spelt-bread', brod: 'spelt-bread',
  banana: 'banana-firm', banan: 'banana-firm', coffee: 'coffee', kaffe: 'coffee', tea: 'tea', te: 'tea', cheese: 'cheese', ost: 'cheese',
  butter: 'butter', smor: 'butter', yogurt: 'lf-yogurt', yoghurt: 'lf-yogurt', chicken: 'chicken-breast', kylling: 'chicken-breast',
  salmon: 'salmon', laks: 'salmon', pasta: 'pasta', chips: 'chips', potetgull: 'chips', chocolate: 'dark-choc', sjokolade: 'dark-choc',
  juice: 'oj', oatmeal: 'porridge', porridge: 'porridge', havregrot: 'porridge', grot: 'porridge', peanuts: 'peanuts', peanotter: 'peanuts',
  tuna: 'tuna', tunfisk: 'tuna', apple: 'apple', eple: 'apple', orange: 'orange', appelsin: 'orange', havregryn: 'oats', oats: 'oats',
  beef: 'beef-raw', biff: 'beef-raw', storfe: 'beef-raw', storfekjott: 'beef-raw', kjottdeig: 'mince-raw', mince: 'mince-raw', karbonadedeig: 'mince-lean-raw',
  steak: 'steak-raw', entrecote: 'steak-raw', svin: 'pork-tenderloin-raw', pork: 'pork-tenderloin-raw', svinefilet: 'pork-tenderloin-raw',
  kalkun: 'turkey-breast-raw', turkey: 'turkey-breast-raw', torsk: 'cod-raw', cod: 'cod-raw', sei: 'saithe-raw', orret: 'trout-raw',
  kyllingfilet: 'chicken-breast-raw', kyllinglar: 'chicken-thigh-raw', basmati: 'basmati-raw', jasmin: 'jasmine-raw', jasmine: 'jasmine-raw',
  quinoa: 'quinoa', skyr: 'skyr', kvarg: 'quark', fløte: 'cream', flote: 'cream', cream: 'cream', olje: 'oil', oil: 'oil', mais: 'corn', corn: 'corn',
  nudler: 'rice-noodles', noodles: 'rice-noodles', sotpotet: 'sweet-potato', lompe: 'lompe', pommes: 'french-fries', fries: 'french-fries',
};
// Cooked foods with a dry/raw twin: a small gram amount usually means it was weighed dry.
const DRY_TWIN = { rice: 'rice-raw', pasta: 'pasta-raw', 'gf-pasta': 'gf-pasta-raw', basmati: 'basmati-raw', jasmine: 'jasmine-raw', quinoa: 'quinoa-raw', 'rice-noodles': 'rice-noodles-raw' };
const RAW_FIRST = { 'chicken-breast': 'chicken-breast-raw', 'chicken-thigh': 'chicken-thigh-raw', mince: 'mince-raw', salmon: 'salmon-raw', cod: 'cod-raw', potatoes: 'potatoes-raw' };
const NUM = { half: 0.5, halv: 0.5, halvt: 0.5, one: 1, en: 1, ett: 1, ei: 1, two: 2, to: 2, three: 3, tre: 3, four: 4, fire: 4 };

function parseAmount(raw) {
  let s = raw.replace(/½/g, ' 0.5 ').replace(/¼/g, ' 0.25 ').replace(/¾/g, ' 0.75 ').replace(/(\d)\s*\/\s*(\d)/g, (m, a, b) => String(Number(a) / Number(b))).trim();
  let qty = null;
  let m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:(\d+(?:[.,]\d+)?))?/);
  if (m) {
    qty = parseFloat(m[1].replace(',', '.')) + (m[2] ? parseFloat(m[2].replace(',', '.')) : 0);
    s = s.slice(m[0].length);
  } else {
    const first = norm(s.split(/\s+/)[0] || '');
    if (NUM[first] != null) { qty = NUM[first]; s = s.split(/\s+/).slice(1).join(' '); }
  }
  // "2g" style
  let unit = null;
  const words = norm(s).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length && UNIT_WORDS[words[0]]) { unit = UNIT_WORDS[words[0]]; words.shift(); }
  return { qty, unit, words: words.filter((w) => !STOP.has(w)) };
}

function localParse(text) {
  const pieces = text.split(/,|;|\+|\n|\band\b|\bog\b|\bwith\b|\bmed\b/i).map((x) => x.trim()).filter(Boolean);
  const found = [];
  const unmatched = [];
  for (const raw of pieces) {
    const { qty, unit, words } = parseAmount(raw);
    if (!words.length) continue;
    const phrase = words.join(' ');
    let f = words.length === 1 && ALIAS[words[0]] ? foodById(ALIAS[words[0]]) : null;
    if (!f) f = searchFoods(phrase, 1)[0] || null;
    if (!f && words.length > 1) for (const w of words) { f = (ALIAS[w] && foodById(ALIAS[w])) || (w.length >= 4 ? searchFoods(w, 1)[0] : null); if (f) break; }
    const r = !f ? RECIPES.find((x) => [x.name.en, x.name.nb].some((n) => norm(n).includes(phrase))) : null;
    if (f && unit === 'g' && qty != null) {
      // "50 g rice" is almost always dry rice; "150 g chicken" is usually weighed raw before cooking.
      const twin = (qty <= 100 && DRY_TWIN[f.id]) || RAW_FIRST[f.id];
      if (twin && foodById(twin)) f = foodById(twin);
    }
    if (f) {
      const it = foodItem(f);
      if (unit && it.units.some((u) => u.u === unit)) { it.unit = unit; it.amount = qty ?? 1; }
      else if (qty != null) {
        const base = it.units[0];
        it.unit = base.u;
        it.amount = ['piece', 'slice', 'glass', 'cup', 'can', 'tub', 'bowl', 'scoop', 'square', 'clove', 'bottle', 'mscoop', 'handful'].includes(base.u) ? qty : it.amount * qty;
      }
      found.push(it);
    } else if (r) found.push(recipeItem(r, qty || 1));
    else {
      // Keep the name, drop the amount ("en neve rosiner" → "rosiner").
      const toks = raw.split(/\s+/);
      while (toks.length > 1 && (/^[\d.,½¼¾/]+$/.test(toks[0]) || NUM[norm(toks[0])] != null || UNIT_WORDS[norm(toks[0])] || STOP.has(norm(toks[0])))) toks.shift();
      unmatched.push(toks.join(' '));
    }
  }
  return { found, unmatched };
}

async function runEstimate() {
  st.busy = true;
  st.error = '';
  nav.rerender();
  try {
    const res = await estimateMeal({ image: st.mode === 'photo' ? st.photo : null, text: st.mode === 'type' ? st.text : '' });
    st.est = res;
    st.cart = [...st.cart.filter((x) => !x.ai), ...res.items.map((x) => freeItem(x.name, x.kcal, { ai: true, m: x.m, portionText: x.portion, fodmap: x.fodmap || 'low', why: x.reason || '', tags: x.tags || [] }))];
    if (!res.items.length) st.error = tr('I could not see any food. Try another photo or type it instead.', 'Jeg så ingen mat. Prøv et nytt bilde eller skriv det inn.');
  } catch (e) {
    st.error = e.message || String(e);
  }
  st.busy = false;
  nav.rerender();
}

function whenSheet() {
  const today = dayKey();
  const yest = addDays(today, -1);
  const draw = () => `<div class="seg"><button aria-pressed="${st.date === today}" data-act="day" data-v="${today}">${tr('Today', 'I dag')}</button>
      <button aria-pressed="${st.date === yest}" data-act="day" data-v="${yest}">${tr('Yesterday', 'I går')}</button></div>
    ${st.date === today ? `<div class="chips">${[[null, tr('Now', 'Nå')], [30, tr('30 min ago', '30 min siden')], [60, tr('1 hour ago', '1 time siden')], [120, tr('2 hours ago', '2 timer siden')]].map(([ago, l]) => `<button class="chip solid" aria-pressed="${ago == null ? st.time == null : false}" data-act="ago" data-v="${ago ?? ''}">${l}</button>`).join('')}</div>` : ''}
    <div class="field"><label for="w-time">${tr('Time', 'Klokkeslett')}</label><input id="w-time" class="input" type="time" value="${hhmm(st.time ?? nowMinutes())}" data-change="t"></div>
    <button class="btn primary" data-act="ok">${tr('Done', 'Ferdig')}</button>`;
  openSheet({
    title: tr('When did you eat it?', 'Når spiste du det?'),
    html: draw(),
    actions: {
      day: (b, e, sheet) => { st.date = b.dataset.v; if (st.date !== today && st.time == null) st.time = nowMinutes(); sheet.querySelector('.col').innerHTML = draw(); },
      ago: (b) => {
        st.time = b.dataset.v ? Math.max(0, nowMinutes() - Number(b.dataset.v)) : null;
        closeSheet(); nav.rerender();
      },
      t: (el) => { const [h, m] = String(el.value || '').split(':').map(Number); if (h >= 0 && m >= 0) st.time = h * 60 + m; },
      ok: (b, e, sheet) => {
        const v = sheet.querySelector('#w-time').value;
        const [h, m] = String(v || '').split(':').map(Number);
        if (h >= 0 && m >= 0) {
          const t = h * 60 + m;
          st.time = st.date === today && Math.abs(t - nowMinutes()) <= 1 ? null : t;
        }
        closeSheet(); nav.rerender();
      },
    },
  });
}


export const actions = {
  close: () => { st = null; nav.back('today'); },
  mode: (el) => { st.mode = el.dataset.mode || null; st.error = ''; nav.rerender(); if (st.mode === 'type') setTimeout(() => document.getElementById('meal-text')?.focus(), 80); },
  slot: () => whenSheet(),
  q: (el) => { st.q = el.value; refreshResults(); },
  cat: (el) => { st.cat = st.cat === el.dataset.v ? null : el.dataset.v; refreshResults(); },
  add: (el) => { const f = foodById(el.dataset.id); if (f) addItem(foodItem(f)); },
  addRecipe: (el) => { const r = recipeById(el.dataset.id); if (r) addItem(recipeItem(r)); },
  newFood: () => newFoodSheet(st.q.trim(), (food) => addItem(foodItem(food))),
  newFoodFor: (el) => {
    const i = Number(el.dataset.i);
    newFoodSheet(st.unmatched[i] || '', (food) => { st.unmatched = st.unmatched.filter((_, j) => j !== i); addItem(foodItem(food)); });
  },
  amt: (el) => {
    const it = find(el.dataset.k);
    if (!it) return;
    const v = parseFloat(String(el.value).replace(',', '.'));
    if (v >= 0 && v < 100000) { it.amount = v; refreshNumbers(it); }
  },
  amtDone: (el) => {
    const it = find(el.dataset.k);
    if (!it) return;
    const v = parseFloat(String(el.value).replace(',', '.'));
    if (!(v >= 0)) el.value = fmtAmt(it.amount);
    refreshNumbers(it);
  },
  dec: (el) => { const it = find(el.dataset.k); if (it) { it.amount = Math.max(0, stepAmount(it.amount, it.unit, -1)); nav.rerender(); } },
  inc: (el) => { const it = find(el.dataset.k); if (it) { it.amount = stepAmount(it.amount, it.unit, 1); nav.rerender(); } },
  unit: (el) => {
    const it = find(el.dataset.k);
    if (!it) return;
    const from = it.units.find((u) => u.u === it.unit) || it.units[0];
    const to = it.units.find((u) => u.u === el.value);
    if (!to) return;
    it.amount = from.g && to.g ? snap((from.g * it.amount) / to.g, to.u) : to.u === 'g' || to.u === 'ml' ? 100 : 1;
    it.unit = to.u;
    nav.rerender();
  },
  twin: (el) => {
    const i = st.cart.findIndex((x) => x.k === el.dataset.k);
    const it = st.cart[i];
    const f = it && foodById(it.pair);
    if (!f) return;
    const unit = it.unit === 'g' || it.unit === 'ml' ? it.unit : undefined;
    st.cart[i] = { ...foodItem(f, unit ? it.amount : undefined, unit), k: it.k };
    toast(tr(`Switched to ${L(f.n).toLowerCase()}.`, `Byttet til ${L(f.n).toLowerCase()}.`), 1600);
    nav.rerender();
  },
  rm: (el) => { st.cart = st.cart.filter((x) => x.k !== el.dataset.k); nav.rerender(); },
  boost: (el) => {
    const b = BOOSTS.find((x) => x.id === el.dataset.id);
    const f = foodById(b?.id);
    if (f) addItem(foodItem(f, b.amount, b.unit), false);
  },
  name: (el) => { st.name = el.value; },
  photo: async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const raw = await readFileAsDataURL(file);
      st.photo = await shrinkImage(raw);
      st.est = null;
      runEstimate();
    } catch (e) {
      st.error = tr('Could not read that photo.', 'Klarte ikke lese bildet.');
      nav.rerender();
    }
  },
  retry: () => runEstimate(),
  text: (el) => { st.text = el.value; },
  estimate: () => {
    const text = (document.getElementById('meal-text')?.value || st.text).trim();
    st.text = text;
    if (!text) { toast(tr('Write what you ate first.', 'Skriv hva du spiste først.')); return; }
    if (hasAI()) { runEstimate(); return; }
    const { found, unmatched } = localParse(text);
    st.cart.push(...found);
    st.unmatched = unmatched;
    if (found.length) { st.mode = null; st.text = ''; }
    if (!found.length && !unmatched.length) toast(tr('Nothing found.', 'Fant ingenting.'));
    nav.rerender();
  },
  save: () => {
    const items = st.cart.filter((x) => (x.amount || 0) > 0);
    if (!items.length) { toast(tr('Add an amount first.', 'Legg inn en mengde først.')); return; }
    const key = st.date;
    const title = st.name.trim() || st.est?.title || '';
    const log = logItems(key, items, { title, ts: whenTs(), source: st.mode || 'search' });
    const flagged = (log?.items || []).filter((i) => i.fodmap === 'high');
    const past = key !== dayKey();
    st = null;
    const names = flagged.map((i) => i.name).join(', ');
    toast(flagged.length ? tr(`Logged. Heads up: ${names} ${flagged.length > 1 ? 'are' : 'is'} high FODMAP.`, `Logget. Obs: ${names} har mye FODMAP.`) : cheer(key), 3200);
    nav.go(past ? `food/diary/${key}` : 'today');
  },
};
