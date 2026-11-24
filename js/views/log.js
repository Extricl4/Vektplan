import { S, peekDay, mutate, addLog, activeSlots } from '../store.js';
import { bestSlotFor } from '../planner.js';
import { RECIPES, recipeById } from '../data/recipes.js';
import { FOODS } from '../data/foods.js';
import { tr, L, n0, kindName } from '../i18n.js';
import { icon, openSheet, closeSheet, toast, fodmapBadge, plate } from '../ui.js';
import { cheer, portionButtons } from '../meals.js';
import { hasAI, estimateMeal } from '../ai.js';
import { esc, dayKey, addDays, uid, norm, readFileAsDataURL, shrinkImage } from '../util.js';
import { nav } from '../nav.js';

let st = null;
function fresh(slot) {
  return { mode: 'search', slot: slot ?? bestSlotFor(), q: '', cart: [], photo: null, busy: false, est: null, error: '', text: '', portion: 1, unmatched: [] };
}

export function enter(ctx) {
  const slot = ctx.params[0];
  st = fresh(slot && activeSlots().some((s) => s.id === slot) ? slot : undefined);
}

const RANK = { low: 0, check: 1, moderate: 2, high: 3 };
const worst = (items) => items.reduce((w, i) => (RANK[i.fodmap] > RANK[w] ? i.fodmap : w), 'low');

function slotLabel() {
  const s = activeSlots().find((x) => x.id === st.slot);
  return s ? `${kindName(s.kind)} · ${s.time}` : tr('Extra', 'Ekstra');
}

function allFoods() {
  return [...S().custom, ...FOODS];
}

function recentItems() {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < 21 && out.length < 8; i++) {
    const d = peekDay(addDays(dayKey(), -i));
    for (const l of d.logs.slice().reverse()) {
      if (seen.has(l.title)) continue;
      seen.add(l.title);
      out.push(l);
      if (out.length >= 8) break;
    }
  }
  return out;
}

function resultRow(type, id, name, sub, kcal, f) {
  const calm = S().prefs.calm;
  return `<button class="item" data-act="add" data-type="${type}" data-id="${esc(id)}">
    <span class="dot ${f}" aria-hidden="true"></span>
    <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(name)}</span><span class="s">${esc(sub)}</span></span>
    ${calm ? '' : `<span class="small soft num">${n0(kcal)}</span>`}${icon('plus', 18, 'style="color:var(--accent)"')}</button>`;
}

function searchResults() {
  const q = norm(st.q.trim());
  if (!q) {
    const rec = recentItems();
    const recHTML = rec.length
      ? `<p class="label">${tr('Recent', 'Nylig')}</p><div class="list">${rec.map((l) => resultRow('recent', l.id, l.title, l.items?.length ? l.items.map((i) => i.name).join(', ') : tr('logged before', 'logget før'), l.baseKcal ?? l.kcal, l.fodmap || 'low')).join('')}</div>`
      : '';
    const quick = ['egg', 'spelt-bread', 'rice', 'lf-milk', 'banana-firm', 'peanut-butter', 'cheese', 'lf-yogurt', 'rice-cakes', 'chicken-breast'];
    return `${recHTML}<p class="label" style="margin-top:6px">${tr('Quick add', 'Hurtigvalg')}</p><div class="list">${quick.map((id) => FOODS.find((f) => f.id === id)).filter(Boolean).map((f) => resultRow('food', f.id, L(f.n), L(f.p), f.kcal, f.f)).join('')}</div>`;
  }
  const recipes = RECIPES.filter((r) => norm(r.name.en).includes(q) || norm(r.name.nb).includes(q)).slice(0, 8);
  const foods = allFoods().filter((f) => norm(f.n.en).includes(q) || norm(f.n.nb).includes(q)).slice(0, 25);
  if (!recipes.length && !foods.length) {
    return `<div class="empty-state">${icon('search', 30)}<p>${tr('No match. Add it as your own food.', 'Ingen treff. Legg den til som egen matvare.')}</p>
      <button class="btn secondary small" data-act="custom">${icon('plus', 16)} ${tr('Add', 'Legg til')} «${esc(st.q.trim())}»</button></div>`;
  }
  return `${recipes.length ? `<p class="label">${tr('Recipes', 'Oppskrifter')}</p><div class="list">${recipes.map((r) => resultRow('recipe', r.id, L(r.name), tr('1 portion', '1 porsjon'), r.kcal, 'low')).join('')}</div>` : ''}
    ${foods.length ? `<p class="label" style="margin-top:6px">${tr('Foods', 'Matvarer')}</p><div class="list">${foods.map((f) => resultRow('food', f.id, L(f.n), L(f.p), f.kcal, f.f)).join('')}</div>` : ''}`;
}

function searchMode() {
  return `<div class="search">${icon('search', 18)}<label class="sr-only" for="log-q">${tr('Search foods', 'Søk etter mat')}</label>
    <input id="log-q" class="input" type="search" value="${esc(st.q)}" placeholder="${tr('Search: egg, rice, smoothie…', 'Søk: egg, ris, smoothie…')}" data-input="q" autocomplete="off" enterkeyhint="search"></div>
    <section class="card tight" id="log-results">${searchResults()}</section>
    <button class="btn outline" data-act="custom">${icon('plus', 18)} ${tr('Add your own food', 'Legg til egen matvare')}</button>`;
}

function aiOffCard(what) {
  return `<section class="card soft">
    <div class="row">${icon('sparkle', 22, 'style="color:var(--accent)"')}<p class="h3">${what}</p></div>
    <p class="small soft" style="line-height:1.5">${tr('This uses AI. Add your own Claude API key in Settings to switch it on. Your key stays on this phone.', 'Dette bruker AI. Legg inn din egen Claude API-nøkkel i Innstillinger for å slå det på. Nøkkelen blir på denne telefonen.')}</p>
    <a class="btn primary" href="#/settings/ai">${tr('Set up AI', 'Sett opp AI')}</a></section>`;
}

function photoMode() {
  if (!hasAI()) return aiOffCard(tr('Photo estimates', 'Bildeestimat'));
  const inputs = `<input id="cam" class="sr-only" type="file" accept="image/*" capture="environment" data-change="photo">
    <input id="lib" class="sr-only" type="file" accept="image/*" data-change="photo">`;
  if (!st.photo) {
    return `${inputs}<div class="photo"><span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
      <div class="empty">${icon('camera', 36)}<span>${tr('Take a photo of your plate. The AI guesses what is on it, how much, and flags anything that might bother your stomach.', 'Ta bilde av tallerkenen. AI-en gjetter hva som er på den, hvor mye, og sier fra om noe kan plage magen.')}</span></div></div>
      <div class="btns"><label class="btn primary" for="cam">${icon('camera', 18)} ${tr('Take photo', 'Ta bilde')}</label>
      <label class="btn secondary" for="lib">${icon('image', 18)} ${tr('Choose photo', 'Velg bilde')}</label></div>`;
  }
  return `${inputs}<div class="photo ${st.busy ? 'scanning' : ''}"><img src="${st.photo}" alt="${tr('Your meal', 'Måltidet ditt')}">
      <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>
    ${st.busy ? `<p class="center small muted">${tr('Looking at your meal…', 'Ser på måltidet ditt…')}</p>` : ''}
    ${st.error ? `<div class="note amber">${icon('info', 18)}<div class="grow">${esc(st.error)} <button class="link-btn" data-act="retry">${tr('Try again', 'Prøv igjen')}</button></div></div>` : ''}
    ${!st.busy ? `<div class="btns"><label class="btn secondary small" for="cam">${icon('camera', 16)} ${tr('New photo', 'Nytt bilde')}</label><label class="btn secondary small" for="lib">${icon('image', 16)} ${tr('Library', 'Bibliotek')}</label></div>` : ''}`;
}

function typeMode() {
  const ai = hasAI();
  return `<div class="field"><label for="meal-text">${tr('What did you eat?', 'Hva spiste du?')}</label>
    <textarea id="meal-text" class="textarea" rows="3" data-input="text" placeholder="${tr('e.g. half a bowl of salmon and rice, and a glass of lactose-free milk', 'f.eks. en halv bolle laks og ris, og et glass laktosefri melk')}">${esc(st.text)}</textarea></div>
    <button class="btn ${ai ? 'primary' : 'secondary'}" data-act="estimate" ${st.busy ? 'disabled' : ''}>${icon(ai ? 'sparkle' : 'search', 18)} ${st.busy ? tr('Thinking…', 'Tenker…') : ai ? tr('Estimate with AI', 'Estimer med AI') : tr('Find these foods', 'Finn disse matvarene')}</button>
    ${!ai ? `<p class="tiny muted center">${tr('Tip: with an AI key in Settings, it understands any description.', 'Tips: med en AI-nøkkel i Innstillinger forstår den alle beskrivelser.')}</p>` : ''}
    ${st.error ? `<div class="note amber">${icon('info', 18)}<span>${esc(st.error)}</span></div>` : ''}
    ${st.unmatched.length ? `<div class="note amber">${icon('info', 18)}<div class="grow col" style="gap:6px"><span>${tr('I could not find:', 'Fant ikke:')} ${st.unmatched.map((u) => `<b>${esc(u)}</b>`).join(', ')}</span>
      <div class="row wrap" style="gap:6px">${st.unmatched.map((u, i) => `<button class="btn tiny secondary" data-act="customFor" data-i="${i}">${tr('Add', 'Legg til')} «${esc(u)}»</button>`).join('')}</div></div></div>` : ''}`;
}

function cartCard() {
  if (!st.cart.length) return '';
  const calm = S().prefs.calm;
  const total = st.cart.reduce((a, i) => a + i.kcal * i.qty, 0);
  const showPortion = st.mode !== 'search';
  return `<section class="card" aria-label="${tr('This meal', 'Dette måltidet')}">
    <div class="row between"><h2 class="h3">${st.est?.title ? esc(st.est.title) : tr('This meal', 'Dette måltidet')}</h2>
      ${calm ? '' : `<span class="num" style="font-size:20px;font-weight:700">≈ ${n0(total)} kcal</span>`}</div>
    ${st.est?.question ? `<div class="note amber">${icon('info', 18)}<span>${esc(st.est.question)}</span></div>` : ''}
    <div class="list">${st.cart.map((it) => `<div class="item" style="align-items:flex-start">
      <span class="dot ${it.fodmap}" style="margin-top:7px" aria-hidden="true"></span>
      <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(it.name)}</span>
        <span class="s">${esc(it.portion || '')}${calm ? '' : `${it.portion ? ' · ' : ''}${n0(it.kcal * it.qty)} kcal`}</span>
        ${it.fodmap !== 'low' && it.reason ? `<span class="s" style="display:block;color:var(--amber)">${esc(it.reason)}</span>` : ''}</span>
      <span class="stepper" style="transform:scale(0.86);transform-origin:right center">
        <button data-act="qty" data-k="${it.k}" data-d="-0.5" aria-label="${tr('Less', 'Mindre')}">−</button>
        <span class="v num" style="min-width:40px">×${String(it.qty).replace('.', getDecimal())}</span>
        <button data-act="qty" data-k="${it.k}" data-d="0.5" aria-label="${tr('More', 'Mer')}">+</button></span></div>`).join('')}</div>
  </section>
  ${showPortion ? `<p class="label">${tr('How much of it did you eat?', 'Hvor mye av det spiste du?')}</p>${portionButtons(st.portion, 'portion')}` : ''}`;
}

function getDecimal() {
  return S().prefs.lang === 'nb' ? ',' : '.';
}

export function render() {
  if (!st) st = fresh();
  const calm = S().prefs.calm;
  const total = st.cart.reduce((a, i) => a + i.kcal * i.qty, 0) * (st.mode === 'search' ? 1 : st.portion);
  const tabs = [['search', tr('Search', 'Søk')], ['photo', tr('Photo', 'Bilde')], ['type', tr('Type it', 'Skriv')]];
  return `<div class="screen no-tabs">
    <header class="head">
      <button class="icon-btn surface" data-act="close" aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button>
      <h1 class="h2 grow">${tr('Log a meal', 'Logg et måltid')}</h1>
      <button class="chip on" data-act="slot">${icon('clock', 15)} ${esc(slotLabel())}</button>
    </header>
    <div class="seg" role="tablist">${tabs.map(([id, label]) => `<button role="tab" aria-selected="${st.mode === id}" data-act="mode" data-mode="${id}">${label}</button>`).join('')}</div>
    ${st.mode === 'search' ? searchMode() : st.mode === 'photo' ? photoMode() : typeMode()}
    ${cartCard()}
    ${st.cart.length ? `<button class="btn primary block" data-act="save" style="min-height:56px;font-size:16px">${tr('Save meal', 'Lagre måltid')}${calm ? '' : ` · ≈ ${n0(total)} kcal`}</button>` : ''}
  </div>`;
}

function addToCart(item) {
  const existing = st.cart.find((c) => c.ref && c.ref === item.ref);
  if (existing) existing.qty += 1;
  else st.cart.push({ k: uid(), qty: 1, ...item });
}

const STOP = new Set(['some', 'the', 'and', 'with', 'had', 'ate', 'little', 'bit', 'piece', 'pieces', 'litt', 'noen', 'en', 'et', 'ei', 'av', 'med', 'til', 'half', 'halv', 'glass', 'cup', 'bowl', 'bolle', 'kopp']);

// Single words people type a lot → the most likely everyday food.
const ALIAS = {
  rice: 'rice', ris: 'rice', milk: 'lf-milk', melk: 'lf-milk', cola: 'soda', coke: 'soda', pepsi: 'soda', brus: 'soda', soda: 'soda',
  egg: 'egg', eggs: 'egg', potato: 'potatoes', potatoes: 'potatoes', potet: 'potatoes', poteter: 'potatoes',
  banana: 'banana-firm', banan: 'banana-firm', coffee: 'coffee', kaffe: 'coffee', tea: 'tea', cheese: 'cheese', ost: 'cheese',
  butter: 'butter', smor: 'butter', yogurt: 'lf-yogurt', yoghurt: 'lf-yogurt', chicken: 'chicken-breast', kylling: 'chicken-breast',
  salmon: 'salmon', laks: 'salmon', pasta: 'pasta', chips: 'chips', potetgull: 'chips', chocolate: 'dark-choc', sjokolade: 'dark-choc',
  juice: 'oj', oatmeal: 'porridge', porridge: 'porridge', havregrot: 'porridge', grot: 'porridge', peanuts: 'peanuts', peanotter: 'peanuts',
  tuna: 'tuna', tunfisk: 'tuna', apple: 'apple', eple: 'apple', orange: 'orange', appelsin: 'orange',
};

function stems(word) {
  const out = [word];
  if (word.length > 4 && word.endsWith('es')) out.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith('s')) out.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith('er')) out.push(word.slice(0, -2));
  if (word.length > 5 && word.endsWith('ene')) out.push(word.slice(0, -3));
  return out;
}

function localParse(text) {
  const pieces = text.split(/,|;|\+|\n|\band\b|\bog\b|\bwith\b|\bmed\b/i).map((s) => s.trim()).filter(Boolean);
  const pool = [
    ...allFoods().map((f) => ({ type: 'food', f, name: [norm(f.n.en), norm(f.n.nb)], extra: norm(`${f.p.en} ${f.p.nb}`) })),
    ...RECIPES.map((r) => ({ type: 'recipe', r, name: [norm(r.name.en), norm(r.name.nb)], extra: '' })),
  ];
  const found = [];
  const unmatched = [];
  for (const raw of pieces) {
    const numMatch = raw.match(/^(\d+(?:[.,]\d+)?)\s*/);
    const qty = numMatch ? Math.min(10, parseFloat(numMatch[1].replace(',', '.'))) : 1;
    const words = norm(raw.replace(/^(\d+(?:[.,]\d+)?)\s*/, '')).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
    if (!words.length) continue;
    if (words.length === 1 && ALIAS[words[0]]) {
      const f = allFoods().find((x) => x.id === ALIAS[words[0]]);
      if (f) { found.push({ p: { type: 'food', f }, qty: qty > 0 ? qty : 1 }); continue; }
    }
    let best = null;
    let bestScore = 0;
    for (const p of pool) {
      let score = 0;
      let matchedName = 0;
      for (const w of words) {
        const variants = stems(w);
        if (variants.some((v) => p.name.some((n) => n.split(/[^a-z0-9]+/).some((nw) => nw === v || (v.length >= 4 && nw.startsWith(v)))))) { score += w.length * 10; matchedName++; }
        else if (variants.some((v) => v.length >= 5 && p.name.some((n) => n.includes(v)))) { score += w.length * 6; matchedName++; }
        else if (p.extra && variants.some((v) => p.extra.includes(v))) score += w.length * 3;
      }
      if (!matchedName) continue;
      const nameWords = p.name[0].split(/[^a-z0-9]+/).filter(Boolean).length;
      score -= nameWords * 2; // prefer short, exact names
      if (p.type === 'recipe') score -= 8; // prefer plain foods unless the recipe clearly matches
      if (score > bestScore) { best = p; bestScore = score; }
    }
    if (best && bestScore >= 20) found.push({ p: best, qty: qty > 0 ? qty : 1 });
    else unmatched.push(raw);
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
    st.cart = res.items.map((it) => ({ k: uid(), qty: 1, name: it.name, portion: it.portion, kcal: it.kcal, fodmap: it.fodmap, reason: it.reason, tags: it.tags }));
    if (!res.items.length) st.error = tr('I could not see any food. Try another photo or type it instead.', 'Jeg så ingen mat. Prøv et nytt bilde eller skriv det inn.');
  } catch (e) {
    st.error = e.message || String(e);
  }
  st.busy = false;
  nav.rerender();
}

function customSheet(prefill = '') {
  let f = 'low';
  openSheet({
    title: tr('Add your own food', 'Legg til egen matvare'),
    html: `<div class="field"><label for="cf-name">${tr('Name', 'Navn')}</label><input id="cf-name" class="input" value="${esc(prefill)}" autocomplete="off"></div>
      <div class="grid2"><div class="field"><label for="cf-kcal">kcal</label><input id="cf-kcal" class="input" type="number" inputmode="numeric" min="0" placeholder="250"></div>
      <div class="field"><label for="cf-portion">${tr('Portion', 'Porsjon')}</label><input id="cf-portion" class="input" placeholder="${tr('1 bowl', '1 bolle')}"></div></div>
      <p class="label">FODMAP</p>
      <div class="seg" id="cf-f"><button data-act="f" data-f="low" aria-pressed="true">${tr('Low', 'Lav')}</button><button data-act="f" data-f="check" aria-pressed="false">${tr('Not sure', 'Usikker')}</button><button data-act="f" data-f="high" aria-pressed="false">${tr('High', 'Høy')}</button></div>
      <p class="tiny muted">${tr('Saved to your foods so you can find it next time.', 'Lagres blant matvarene dine til neste gang.')}</p>
      <button class="btn primary" data-act="saveCustom">${tr('Add to meal', 'Legg til i måltidet')}</button>`,
    actions: {
      f: (el, e, sheet) => {
        f = el.dataset.f;
        sheet.querySelectorAll('#cf-f button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
      },
      saveCustom: (el, e, sheet) => {
        const name = sheet.querySelector('#cf-name').value.trim();
        const kcal = Math.max(0, Math.round(Number(sheet.querySelector('#cf-kcal').value) || 0));
        const portion = sheet.querySelector('#cf-portion').value.trim();
        if (!name) { toast(tr('Give it a name first.', 'Gi den et navn først.')); return; }
        const food = { id: 'c-' + uid(), n: { en: name, nb: name }, p: { en: portion, nb: portion }, kcal, f, tags: [], custom: true };
        mutate((s) => { s.custom.unshift(food); s.custom = s.custom.slice(0, 200); });
        addToCart({ ref: 'food:' + food.id, name, portion, kcal, fodmap: f, tags: [] });
        st.unmatched = st.unmatched.filter((u) => u !== prefill);
        closeSheet();
        nav.rerender();
      },
    },
    onMount: (sheet) => setTimeout(() => sheet.querySelector(prefill ? '#cf-kcal' : '#cf-name')?.focus(), 250),
  });
}

export const actions = {
  close: () => { st = null; nav.back('today'); },
  mode: (el) => { st.mode = el.dataset.mode; st.error = ''; nav.rerender(); },
  slot: () => {
    const slots = activeSlots();
    openSheet({
      title: tr('Which meal is this?', 'Hvilket måltid er dette?'),
      html: `<div class="col">${slots.map((s) => `<button class="choice" aria-pressed="${s.id === st.slot}" data-act="pick" data-id="${s.id}">${icon('clock', 18)}<span class="grow">${kindName(s.kind)}</span><span class="muted small">${s.time}</span></button>`).join('')}
        <button class="choice" aria-pressed="${!st.slot}" data-act="pick" data-id="">${icon('plus', 18)}<span class="grow">${tr('Extra snack (no meal slot)', 'Ekstra (uten måltid)')}</span></button></div>`,
      actions: { pick: (b) => { st.slot = b.dataset.id || null; closeSheet(); nav.rerender(); } },
    });
  },
  q: (el) => {
    st.q = el.value;
    const box = document.getElementById('log-results');
    if (box) box.innerHTML = searchResults();
  },
  add: (el) => {
    const { type, id } = el.dataset;
    if (type === 'food') {
      const f = allFoods().find((x) => x.id === id);
      if (f) addToCart({ ref: 'food:' + f.id, name: L(f.n), portion: L(f.p), kcal: f.kcal, fodmap: f.f, reason: L(f.why), tags: f.tags || [] });
    } else if (type === 'recipe') {
      const r = recipeById(id);
      if (r) addToCart({ ref: 'recipe:' + r.id, name: L(r.name), portion: tr('1 portion', '1 porsjon'), kcal: r.kcal, fodmap: 'low', tags: [], rid: r.id });
    } else if (type === 'recent') {
      let l = null;
      for (let i = 0; i < 21 && !l; i++) l = peekDay(addDays(dayKey(), -i)).logs.find((x) => x.id === id);
      if (l) addToCart({ ref: 'recent:' + l.title, name: l.title, portion: '', kcal: l.baseKcal ?? l.kcal, fodmap: l.fodmap || 'low', tags: l.tags || [], rid: l.rid || null });
    }
    toast(tr('Added', 'Lagt til'), 1200);
    nav.rerender();
  },
  qty: (el) => {
    const it = st.cart.find((c) => c.k === el.dataset.k);
    if (!it) return;
    it.qty = Math.round((it.qty + Number(el.dataset.d)) * 2) / 2;
    if (it.qty <= 0) st.cart = st.cart.filter((c) => c !== it);
    nav.rerender();
  },
  portion: (el) => { st.portion = Number(el.dataset.p); nav.rerender(); },
  custom: () => customSheet(st.q.trim()),
  customFor: (el) => customSheet(st.unmatched[Number(el.dataset.i)] || ''),
  photo: async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const raw = await readFileAsDataURL(file);
      st.photo = await shrinkImage(raw);
      st.cart = [];
      st.est = null;
      st.portion = 1;
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
    for (const { p, qty } of found) {
      if (p.type === 'food') addToCart({ ref: 'food:' + p.f.id, name: L(p.f.n), portion: L(p.f.p), kcal: p.f.kcal, fodmap: p.f.f, reason: L(p.f.why), tags: p.f.tags || [] });
      else addToCart({ ref: 'recipe:' + p.r.id, name: L(p.r.name), portion: tr('1 portion', '1 porsjon'), kcal: p.r.kcal, fodmap: 'low', tags: [], rid: p.r.id });
      const last = st.cart[st.cart.length - 1];
      if (qty !== 1 && last) last.qty = qty;
    }
    st.unmatched = unmatched;
    if (!found.length && !unmatched.length) toast(tr('Nothing found.', 'Fant ingenting.'));
    nav.rerender();
  },
  save: () => {
    if (!st.cart.length) return;
    const key = dayKey();
    const items = st.cart.map((c) => ({ name: c.name, kcal: Math.round(c.kcal * c.qty), qty: c.qty, fodmap: c.fodmap, tags: c.tags || [] }));
    const base = items.reduce((a, i) => a + i.kcal, 0);
    const portion = st.mode === 'search' ? 1 : st.portion;
    const title = st.est?.title || (items.length === 1 ? items[0].name : items.slice(0, 3).map((i) => i.name).join(', ') + (items.length > 3 ? '…' : ''));
    const tags = [...new Set(items.flatMap((i) => i.tags))];
    const single = st.cart.length === 1 ? st.cart[0] : null;
    addLog(key, { slot: st.slot || null, title, baseKcal: base, portion, items, tags, fodmap: worst(items), source: st.mode, rid: single?.rid || null });
    const flagged = items.filter((i) => i.fodmap === 'high');
    st = null;
    const names = flagged.map((i) => i.name).join(', ');
    toast(flagged.length ? tr(`Logged. Heads up: ${names} ${flagged.length > 1 ? 'are' : 'is'} high FODMAP.`, `Logget. Obs: ${names} har mye FODMAP.`) : cheer(key), 3200);
    nav.go('today');
  },
};
