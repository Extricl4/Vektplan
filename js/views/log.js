// Log food: build what you ate from ingredients with everyday amounts (or grams),
// pick one of your own meals, or snap a photo / type it. Simple first, details when you want them.
import { S, peekDay, day, mutate, activeSlots } from '../store.js';
import { logItems } from '../nutrition.js';
import { bestSlotFor } from '../planner.js';
import { RECIPES, recipeById } from '../data/recipes.js';
import { BOOSTS } from '../data/amounts.js';
import { tr, L, n0, kindName, shortDate } from '../i18n.js';
import { icon, openSheet, closeSheet, toast } from '../ui.js';
import { cheer } from '../meals.js';
import { hasAI, estimateMeal } from '../ai.js';
import { esc, dayKey, addDays, norm, readFileAsDataURL, shrinkImage, parseKey, nowMinutes } from '../util.js';
import { nav } from '../nav.js';
import { myMeals, sortedMeals, saveMyMeal, myMealSheet, whenOf } from '../mymeals.js';
import {
  allFoods, foodById, foodItem, recipeItem, mealItem, freeItem, restoreItem, packItem, itemKcal, itemFodmap, itemAmountText, itemMacros, macroLine,
  amountSheet, newFoodSheet, searchFoods, mealKcal,
} from '../amount.js';

let st = null;
function fresh(date) {
  return { date: date || dayKey(), time: null, q: '', cart: [], mode: null, photo: null, busy: false, est: null, error: '', text: '', unmatched: [], saveAs: false, saveName: '' };
}

export function enter(ctx) {
  const p = ctx.params[0];
  st = fresh(/^\d{4}-\d{2}-\d{2}$/.test(p || '') && p <= dayKey() ? p : undefined);
  // Logging for an earlier day: start at a sensible time instead of "now".
  if (st.date !== dayKey()) st.time = 12 * 60;
  if (p === 'photo') st.mode = 'photo';
}

const RANK = { low: 0, check: 1, moderate: 2, high: 3 };
const worst = (fs) => fs.reduce((w, f) => (RANK[f] > RANK[w] ? f : w), 'low');
const COMMON = ['egg', 'spelt-bread', 'cheese', 'butter', 'lf-milk', 'oats', 'rice', 'potatoes', 'chicken-breast', 'salmon', 'banana-firm', 'peanut-butter', 'lf-yogurt', 'rice-cakes'];

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

function recentLogs(max = 6) {
  const out = [];
  const seen = new Set(myMeals().map((m) => norm(m.name)));
  for (let i = 0; i < 21 && out.length < max; i++) {
    const d = peekDay(addDays(dayKey(), -i));
    for (const l of d.logs.slice().reverse()) {
      const k = norm(l.title);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(l);
      if (out.length >= max) break;
    }
  }
  return out;
}

const row = (act, id, title, sub, f = 'low', lead = '') => `<button class="item" data-act="${act}" data-id="${esc(id)}">
  ${lead || `<span class="dot ${f}" aria-hidden="true"></span>`}
  <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(title)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ''}</span>
  ${icon('plus', 18, 'style="color:var(--accent)"')}</button>`;

const heart = `<span class="plate-mini" style="width:36px;height:36px" aria-hidden="true">${icon('heart', 16)}</span>`;

function foodSub(f) {
  const it = foodItem(f);
  const calm = S().prefs.calm;
  return `${itemAmountText(it)}${calm ? '' : ` · ${n0(itemKcal(it))} kcal`}`;
}

function results() {
  const calm = S().prefs.calm;
  const q = norm(st.q.trim());
  const mine = sortedMeals(myMeals());
  const mealSub = (m) => [(m.items || []).length ? `${m.items.length} ${tr('ingredients', 'ingredienser')}` : tr('My meal', 'Mitt måltid'), calm || !mealKcal(m) ? '' : `${n0(mealKcal(m))} kcal`].filter(Boolean).join(' · ');
  if (!q) {
    const rec = recentLogs(6);
    return `<div class="row between"><p class="label">${tr('My meals', 'Mine måltider')}</p><button class="link-btn small" data-act="newMeal">${icon('plus', 14)} ${tr('New meal', 'Nytt måltid')}</button></div>
      ${mine.length ? `<div class="list">${mine.slice(0, 6).map((m) => row('addMeal', m.id, m.name, mealSub(m), m.fodmap, heart)).join('')}</div>`
        : `<button class="card tight link" data-act="newMeal" style="flex-direction:row;align-items:center;gap:12px;text-align:left">${heart}<span class="grow"><span style="display:block;font-weight:600">${tr('Save a meal you often eat', 'Lagre et måltid du ofte spiser')}</span>
          <span class="small muted">${tr('Put in what is in it once. Next time it is one tap.', 'Legg inn hva som er i det én gang. Neste gang er det ett trykk.')}</span></span>${icon('chevR', 16)}</button>`}
      ${rec.length ? `<p class="label">${tr('Recently', 'Nylig')}</p><div class="list">${rec.map((l) => row('addRecent', l.id, l.title, calm ? '' : `${n0(l.baseKcal ?? l.kcal)} kcal`, l.fodmap || 'low')).join('')}</div>` : ''}
      <p class="label">${tr('Common foods', 'Vanlig mat')}</p>
      <div class="chips">${COMMON.map((id) => foodById(id)).filter(Boolean).map((f) => `<button class="chip" data-act="addFood" data-id="${f.id}">${esc(L(f.n).replace(/\s*\(.*\)$/, ''))}</button>`).join('')}</div>`;
  }
  const meals = mine.filter((m) => norm(m.name).includes(q)).slice(0, 5);
  const foods = searchFoods(st.q, 12);
  const recipes = RECIPES.filter((r) => norm(r.name.en).includes(q) || norm(r.name.nb).includes(q)).slice(0, 5);
  return `${meals.length ? `<p class="label">${tr('My meals', 'Mine måltider')}</p><div class="list">${meals.map((m) => row('addMeal', m.id, m.name, mealSub(m), m.fodmap, heart)).join('')}</div>` : ''}
    ${foods.length ? `<p class="label">${tr('Foods', 'Matvarer')}</p><div class="list">${foods.map((f) => row('addFood', f.id, L(f.n), f.custom ? tr('Your own', 'Din egen') : foodSub(f), f.f)).join('')}</div>` : ''}
    ${recipes.length ? `<p class="label">${tr('Recipes', 'Oppskrifter')}</p><div class="list">${recipes.map((r) => row('addRecipe', r.id, L(r.name), calm ? '' : `1 ${tr('portion', 'porsjon')} · ${n0(r.kcal)} kcal`)).join('')}</div>` : ''}
    <button class="item" data-act="newFood" style="border:1px dashed var(--line);border-radius:16px;margin-top:6px">${icon('plus', 18)}<span class="grow">${tr('Add', 'Legg til')} <b>«${esc(st.q.trim())}»</b> ${tr('as something new', 'som noe nytt')}</span></button>`;
}

function photoCard() {
  const inputs = `<input id="cam" class="sr-only" type="file" accept="image/*" capture="environment" data-change="photo">
    <input id="lib" class="sr-only" type="file" accept="image/*" data-change="photo">`;
  if (!hasAI()) {
    return `<section class="card soft"><div class="row between"><h2 class="h3">${tr('Photo', 'Bilde')}</h2><button class="icon-btn" data-act="mode" data-mode="" aria-label="${tr('Close', 'Lukk')}">${icon('x', 18)}</button></div>
      <p class="small soft" style="line-height:1.5">${tr('Photo guesses need an AI key (Settings → AI). Until then, search for the foods above, it only takes a few taps.', 'Bildegjetting trenger en AI-nøkkel (Innstillinger → AI). Fram til da kan du søke opp maten over, det tar bare noen trykk.')}</p>
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
    <textarea id="meal-text" class="textarea" rows="3" data-input="text" placeholder="${tr('e.g. 2 slices of bread with cheese, 1 glass of lactose-free milk', 'f.eks. 2 skiver brød med ost, 1 glass laktosefri melk')}">${esc(st.text)}</textarea>
    <button class="btn ${ai ? 'primary' : 'secondary'}" data-act="estimate" ${st.busy ? 'disabled' : ''}>${icon(ai ? 'sparkle' : 'search', 18)} ${st.busy ? tr('Thinking…', 'Tenker…') : ai ? tr('Estimate with AI', 'Estimer med AI') : tr('Find these foods', 'Finn disse matvarene')}</button>
    ${st.error ? `<div class="note amber">${icon('info', 18)}<span>${esc(st.error)}</span></div>` : ''}</section>`;
}

function cartMac() {
  const ms = st.cart.map(itemMacros).filter(Boolean);
  return ms.length ? ms.reduce((a, x) => a.map((v, j) => v + x[j]), [0, 0, 0]) : null;
}

function cartCard() {
  const calm = S().prefs.calm;
  if (!st.cart.length && !st.unmatched.length) return '';
  const total = st.cart.reduce((a, i) => a + itemKcal(i), 0);
  const inCart = new Set(st.cart.map((i) => i.fid).filter(Boolean));
  const boosts = BOOSTS.filter((b) => !inCart.has(b.id) && foodById(b.id)).slice(0, 4);
  return `<section class="card" aria-label="${tr('Your meal', 'Måltidet ditt')}">
    <div class="row between"><h2 class="h3">${st.est?.title ? esc(st.est.title) : tr('Your meal', 'Måltidet ditt')}</h2>
      ${calm ? '' : `<span class="num" style="font-size:20px;font-weight:700">≈ ${n0(total)} kcal</span>`}</div>
    ${!calm && cartMac() ? `<p class="small soft num" style="margin-top:-6px">${esc(macroLine(cartMac()))}</p>` : ''}
    ${st.est?.question ? `<div class="note amber">${icon('info', 18)}<span>${esc(st.est.question)}</span></div>` : ''}
    ${st.cart.length ? `<div class="list">${st.cart.map((it) => {
      const f = itemFodmap(it);
      return `<button class="item" data-act="editItem" data-k="${it.k}" style="align-items:flex-start">
      <span class="dot ${f}" style="margin-top:7px" aria-hidden="true"></span>
      <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(it.name)}</span>
        <span class="s">${esc(it.portionText || itemAmountText(it))}${calm ? '' : ` · ${n0(itemKcal(it))} kcal${itemMacros(it) ? ` · ${esc(macroLine(itemMacros(it), true))}` : ''}`}</span>
        ${f !== 'low' && it.why ? `<span class="s" style="display:block;color:var(--amber)">${esc(it.why)}</span>` : ''}</span>
      <span class="small" style="color:var(--accent);font-weight:600;white-space:nowrap">${tr('Change', 'Endre')}</span></button>`;
    }).join('')}</div>` : ''}
    ${st.unmatched.length ? `<div class="note amber">${icon('info', 18)}<div class="grow col" style="gap:6px"><span>${tr('Not found:', 'Fant ikke:')} ${st.unmatched.map((u) => `<b>${esc(u)}</b>`).join(', ')}</span>
      <div class="row wrap" style="gap:6px">${st.unmatched.map((u, i) => `<button class="btn tiny secondary" data-act="newFoodFor" data-i="${i}">${tr('Add', 'Legg til')} «${esc(u)}»</button>`).join('')}</div></div></div>` : ''}
    ${boosts.length && st.cart.length ? `<div class="boosts"><p class="small soft" style="line-height:1.4">${tr('Get full fast? A little of these adds energy without much more food:', 'Blir du fort mett? Litt av dette gir mer energi uten mye mer mat:')}</p>
      <div class="chips">${boosts.map((b) => `<button class="chip" data-act="boost" data-id="${b.id}">${icon('plus', 13)} ${esc(L(foodById(b.id).n).replace(/\s*\(.*\)$/, ''))}</button>`).join('')}</div></div>` : ''}
    ${st.cart.length ? `<label class="row" style="gap:10px;cursor:pointer;margin-top:2px"><span class="switch"><input type="checkbox" ${st.saveAs ? 'checked' : ''} data-change="saveAs"><span></span></span>
      <span class="small">${tr('Also save it to My meals', 'Lagre det også i Mine måltider')}</span></label>
      ${st.saveAs ? `<input id="save-name" class="input" type="text" maxlength="80" autocomplete="off" data-input="saveName" value="${esc(st.saveName)}" placeholder="${tr('Name, e.g. My usual breakfast', 'Navn, f.eks. Vanlig frokost')}">` : ''}` : ''}
  </section>`;
}

export function render() {
  if (!st) st = fresh();
  const calm = S().prefs.calm;
  const total = st.cart.reduce((a, i) => a + itemKcal(i), 0);
  return `<div class="screen no-tabs">
    <header class="head">
      <button class="icon-btn surface" data-act="close" aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button>
      <h1 class="h2 grow">${tr('Log food', 'Logg mat')}</h1>
      <button class="chip on" data-act="slot">${icon('clock', 15)} ${esc(slotLabel())}</button>
    </header>
    ${cartCard()}
    ${st.cart.length ? `<button class="btn primary block" data-act="save" style="min-height:56px;font-size:16px">${icon('check', 18)} ${tr('Save', 'Lagre')}${calm ? '' : ` · ≈ ${n0(total)} kcal`}</button>` : ''}
    ${st.mode === 'photo' ? photoCard() : st.mode === 'type' ? typeCard() : ''}
    <div class="search">${icon('search', 18)}<label class="sr-only" for="log-q">${tr('Search', 'Søk')}</label>
      <input id="log-q" class="input" type="search" autocomplete="off" placeholder="${st.cart.length ? tr('Add more: bread, egg, milk…', 'Legg til mer: brød, egg, melk…') : tr('What did you eat? Search food or your meals', 'Hva spiste du? Søk mat eller måltidene dine')}" value="${esc(st.q)}" data-input="q"></div>
    ${st.mode ? '' : `<div class="row" style="gap:8px"><button class="btn small secondary" data-act="mode" data-mode="photo" style="flex:1">${icon('camera', 16)} ${tr('Photo', 'Bilde')}</button>
      <button class="btn small secondary" data-act="mode" data-mode="type" style="flex:1">${icon('pencil', 16)} ${tr('Type it', 'Skriv det')}</button></div>`}
    <div id="log-results" class="col" style="gap:8px">${results()}</div>
  </div>`;
}

function refreshResults() {
  const box = document.getElementById('log-results');
  if (box) box.innerHTML = results();
}

function addItem(it, msg = true) {
  st.cart.push(it);
  st.q = '';
  if (msg) toast(tr('Added', 'Lagt til'), 1000);
  nav.rerender();
}

function askAmount(it, opts = {}) {
  amountSheet({ item: it, add: tr('Add to meal', 'Legg til i måltidet'), onDone: (x) => addItem(x), ...opts });
}

// ---------- Typing without AI: "2 slices bread, 1 glass milk" ----------
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
};
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
    st.cart = res.items.map((x) => freeItem(x.name, x.kcal, { m: x.m, portionText: x.portion, fodmap: x.fodmap || 'low', why: x.reason || '', tags: x.tags || [] }));
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
  mode: (el) => { st.mode = el.dataset.mode || null; st.error = ''; nav.rerender(); },
  slot: () => whenSheet(),
  oldSlot: () => {
    const slots = activeSlots();
    openSheet({
      title: tr('Which meal is this?', 'Hvilket måltid er dette?'),
      html: `<div class="col">${slots.map((s) => `<button class="choice" aria-pressed="${s.id === st.slot}" data-act="pick" data-id="${s.id}">${icon('clock', 18)}<span class="grow">${kindName(s.kind)}</span><span class="muted small">${s.time}</span></button>`).join('')}
        <button class="choice" aria-pressed="${!st.slot}" data-act="pick" data-id="">${icon('plus', 18)}<span class="grow">${tr('Extra (no meal time)', 'Ekstra (uten måltid)')}</span></button></div>`,
      actions: { pick: (b) => { st.slot = b.dataset.id || null; closeSheet(); nav.rerender(); } },
    });
  },
  q: (el) => { st.q = el.value; refreshResults(); },
  addFood: (el) => {
    const f = foodById(el.dataset.id);
    if (f) askAmount(foodItem(f));
  },
  addRecipe: (el) => {
    const r = recipeById(el.dataset.id);
    if (r) askAmount(recipeItem(r));
  },
  addMeal: (el) => {
    const m = myMeals().find((x) => x.id === el.dataset.id);
    if (!m) return;
    const hasItems = (m.items || []).length > 0;
    amountSheet({
      item: mealItem(m),
      title: tr('How much did you eat?', 'Hvor mye spiste du?'),
      add: tr('Add to meal', 'Legg til i måltidet'),
      onDone: (x) => addItem(x),
      extraHTML: hasItems ? `<button class="btn secondary" data-act="expand">${icon('list', 18)} ${tr('Change what is in it this time', 'Endre innholdet denne gangen')}</button>` : '',
      extraActions: {
        expand: () => {
          closeSheet(true);
          for (const i of m.items) st.cart.push(restoreItem(i));
          st.q = '';
          toast(tr('Change any amount below.', 'Endre en mengde under.'), 1800);
          nav.rerender();
        },
      },
    });
  },
  addRecent: (el) => {
    let l = null;
    for (let i = 0; i < 21 && !l; i++) l = peekDay(addDays(dayKey(), -i)).logs.find((x) => x.id === el.dataset.id);
    if (!l) return;
    askAmount(freeItem(l.title, l.baseKcal ?? l.kcal, { fodmap: l.fodmap || 'low', tags: l.tags || [], rid: l.rid || null, myId: l.myId || null }));
  },
  editItem: (el) => {
    const i = st.cart.findIndex((c) => c.k === el.dataset.k);
    if (i < 0) return;
    amountSheet({
      item: st.cart[i],
      add: tr('Done', 'Ferdig'),
      onDone: (x) => { st.cart[i] = x; nav.rerender(); },
      onRemove: () => { st.cart.splice(i, 1); nav.rerender(); },
    });
  },
  boost: (el) => {
    const b = BOOSTS.find((x) => x.id === el.dataset.id);
    const f = foodById(b?.id);
    if (!f) return;
    const it = foodItem(f, b.amount, b.unit);
    it.why = L(b.why);
    askAmount(it);
  },
  newFood: () => newFoodSheet(st.q.trim(), (food) => askAmount(foodItem(food))),
  newFoodFor: (el) => {
    const i = Number(el.dataset.i);
    const name = st.unmatched[i] || '';
    newFoodSheet(name, (food) => {
      st.unmatched = st.unmatched.filter((_, j) => j !== i);
      askAmount(foodItem(food));
    });
  },
  newMeal: () => { const items = st.cart.map(packItem); myMealSheet(null, { prefill: { name: '', items, when: null } }); },
  saveAs: (el) => {
    st.saveAs = el.checked;
    if (st.saveAs && !st.saveName) st.saveName = st.est?.title || (st.cart.length === 1 ? st.cart[0].name : '');
    nav.rerender();
    if (st.saveAs) setTimeout(() => document.getElementById('save-name')?.focus(), 50);
  },
  saveName: (el) => { st.saveName = el.value; },
  photo: async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const raw = await readFileAsDataURL(file);
      st.photo = await shrinkImage(raw);
      st.cart = [];
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
    if (!st.cart.length) return;
    const key = st.date;
    const title = st.est?.title || (st.saveAs && st.saveName.trim()) || '';
    const single = st.cart.length === 1 ? st.cart[0] : null;
    const log = logItems(key, st.cart, { title, ts: whenTs(), source: st.mode || 'search', myId: single?.myId || null, rid: single?.rid || null });
    if (st.saveAs && log) {
      const items = st.cart.map(packItem);
      const fod = log.fodmap;
      const name = st.saveName.trim() || log.title;
      const myId = saveMyMeal({ name, items, kcal: log.baseKcal, when: ['breakfast', 'lunch', 'dinner', 'snack'], fodmap: fod === 'high' ? 'moderate' : fod, note: '' });
      mutate(() => { const l = day(key).logs.find((x) => x.id === log.id); if (l) l.myId = myId; });
    }
    const usedMine = st.cart.filter((c) => c.myId).map((c) => c.myId);
    if (usedMine.length) mutate((s) => { for (const m of s.myMeals) if (usedMine.includes(m.id)) { m.used = (m.used || 0) + 1; m.last = Date.now(); } });
    const flagged = (log?.items || []).filter((i) => i.fodmap === 'high');
    const saved = st.saveAs;
    const past = key !== dayKey();
    st = null;
    const names = flagged.map((i) => i.name).join(', ');
    toast(flagged.length ? tr(`Logged. Heads up: ${names} ${flagged.length > 1 ? 'are' : 'is'} high FODMAP.`, `Logget. Obs: ${names} har mye FODMAP.`)
      : saved ? tr('Logged, and saved to My meals.', 'Logget, og lagret i Mine måltider.') : cheer(key), 3200);
    nav.go(past ? `food/diary/${key}` : 'today');
  },
};
