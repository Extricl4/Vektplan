// Amounts: how much of something you ate, in everyday units (slices, glasses, spoons...) or grams.
// A meal is a list of items: { k, src, name, units: [{ u, g, k }], amount, unit, fodmap, why, tags, lowMax, ... }
// where each unit has grams per unit (g, if known) and kcal per unit (k).
import { S, mutate } from './store.js';
import { tr, L, n0, getLang } from './i18n.js';
import { FOODS } from './data/foods.js';
import { AMOUNTS, UNIT_NAMES, LIQUID, LOW_MAX, LADDER } from './data/amounts.js';
import { openSheet, closeSheet, icon, fodmapBadge } from './ui.js';
import { esc, uid } from './util.js';

export const allFoods = () => [...(S().custom || []), ...FOODS];
export const foodById = (id) => allFoods().find((f) => f.id === id) || null;

export function unitsForFood(f) {
  if (f.custom) {
    if (f.unit === 'g100') return [{ u: 'g', g: 1, k: (f.kcal || 0) / 100 }];
    if (f.unit) return [{ u: f.unit, g: null, k: f.kcal || 0 }];
    return [{ u: 'portion', g: null, k: f.kcal || 0 }]; // older own foods
  }
  const spec = AMOUNTS[f.id];
  if (!spec) return [{ u: 'portion', g: null, k: f.kcal }];
  const kpg = f.kcal / spec[0];
  const units = spec.slice(1).map((s) => {
    const [u, g] = s.split(':');
    return { u, g: Number(g), k: kpg * Number(g) };
  });
  units.push({ u: LIQUID.has(f.id) ? 'ml' : 'g', g: 1, k: kpg });
  return units;
}

const isMass = (u) => u === 'g' || u === 'ml';
export function snap(amount, unit) {
  if (isMass(unit)) return Math.max(5, Math.round(amount / 5) * 5);
  let best = LADDER[0];
  for (const v of LADDER) if (Math.abs(v - amount) < Math.abs(best - amount)) best = v;
  return best;
}

export function defaultAmount(f, units = unitsForFood(f)) {
  const spec = AMOUNTS[f.id];
  const first = units[0];
  if (!spec || !first.g) return { amount: 1, unit: first.u };
  return { amount: snap(spec[0] / first.g, first.u), unit: first.u };
}

// ---------- Items ----------
export function foodItem(f, amount, unit) {
  const units = unitsForFood(f);
  const d = defaultAmount(f, units);
  return {
    k: uid(), src: 'food', fid: f.id, name: L(f.n), units,
    amount: amount ?? d.amount, unit: unit && units.some((x) => x.u === unit) ? unit : d.unit,
    fodmap: f.f || 'low', why: f.why ? L(f.why) : '', tags: f.tags || [], lowMax: LOW_MAX[f.id] || null,
  };
}

export function recipeItem(r, amount = 1) {
  return { k: uid(), src: 'recipe', rid: r.id, name: L(r.name), units: [{ u: 'portion', g: null, k: r.kcal }], amount, unit: 'portion', fodmap: 'low', why: '', tags: [] };
}

export function mealItem(m, amount = 1) {
  return { k: uid(), src: 'my', myId: m.id, name: m.name, units: [{ u: 'portion', g: null, k: mealKcal(m) }], amount, unit: 'portion', fodmap: m.fodmap || 'low', why: '', tags: [...new Set((m.items || []).flatMap((i) => i.tags || []))] };
}

export function freeItem(name, kcal, extra = {}) {
  return { k: uid(), src: 'free', name, units: [{ u: 'portion', g: null, k: kcal || 0 }], amount: 1, unit: 'portion', fodmap: 'low', why: '', tags: [], ...extra };
}

// Items saved inside a meal are plain objects; old ones were { name, kcal, qty, fodmap }.
export function restoreItem(it) {
  if (it.units && it.unit) return { ...it, k: uid() };
  if (it.fid && foodById(it.fid)) return foodItem(foodById(it.fid), it.amount, it.unit);
  const kcal = it.qty ? (it.kcal || 0) / it.qty : it.kcal || 0;
  return freeItem(it.name, kcal, { amount: it.qty || 1, fodmap: it.fodmap || 'low', tags: it.tags || [] });
}

// Compact form for saving. Foods from the list are rebuilt from their id, so only the amount is kept.
export function packItem(it) {
  const { k, ...rest } = it;
  const kcal = Math.round(itemKcal(it));
  if (it.src === 'food' && it.fid && foodById(it.fid)) {
    return { src: 'food', fid: it.fid, name: it.name, amount: it.amount, unit: it.unit, kcal, fodmap: itemFodmap(it), tags: it.tags || [] };
  }
  return { ...rest, kcal, fodmap: itemFodmap(it) };
}

export const unitOf = (it) => it.units.find((x) => x.u === it.unit) || it.units[0];
export const itemKcal = (it) => (unitOf(it)?.k || 0) * (it.amount || 0);
export const itemGrams = (it) => (unitOf(it)?.g ? unitOf(it).g * it.amount : null);

export function itemFodmap(it) {
  const g = itemGrams(it);
  if (it.lowMax && g != null && g > it.lowMax && (it.fodmap === 'low' || it.fodmap === 'check')) return 'moderate';
  return it.fodmap || 'low';
}

export function mealKcal(m) {
  if (m.items?.length) return Math.round(m.items.reduce((a, i) => a + (i.units ? itemKcal(i) : i.kcal || 0), 0));
  return m.kcal || 0;
}

// ---------- Words ----------
const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
export function numText(n) {
  const whole = Math.floor(n);
  const rest = Math.round((n - whole) * 100) / 100;
  if (FRACTIONS[rest]) return whole ? `${whole}${FRACTIONS[rest]}` : FRACTIONS[rest];
  return n0(n);
}

export function unitName(u, amount = 1) {
  const names = UNIT_NAMES[u]?.[getLang() === 'nb' ? 'nb' : 'en'];
  if (!names) return u;
  return amount > 1 ? names[1] : names[0];
}

export function amountText(amount, unit) {
  if (isMass(unit)) return `${n0(amount)} ${unit}`;
  return `${numText(amount)} ${unitName(unit, amount)}`;
}

export const itemAmountText = (it) => amountText(it.amount, it.unit);

// ---------- The amount sheet ----------
const QUICK = {
  g: [25, 50, 100, 150, 200, 300],
  ml: [100, 200, 250, 330, 500],
};

function stepAmount(amount, unit, dir) {
  if (isMass(unit)) {
    const step = amount < 50 ? 5 : amount < 200 ? 10 : 25;
    return Math.max(5, Math.min(2000, amount + dir * step));
  }
  let i = LADDER.findIndex((v) => v >= amount - 1e-9);
  if (i < 0) i = LADDER.length - 1;
  if (dir > 0 && LADDER[i] <= amount + 1e-9) i++;
  if (dir < 0) i--;
  return LADDER[Math.max(0, Math.min(LADDER.length - 1, i))];
}

// opts: { item, title, add (button text), onDone(item), onRemove(), extraHTML, extraActions }
export function amountSheet({ item, title, add, onDone, onRemove, extraHTML = '', extraActions = {} }) {
  const it = { ...item };
  const calm = S().prefs.calm;
  const quickFor = (u) => QUICK[u] || [0.5, 1, 2, 3];
  const draw = () => {
    const kcal = itemKcal(it);
    const f = itemFodmap(it);
    const over = it.lowMax && f !== it.fodmap;
    return `<div class="row between top" style="gap:10px"><div class="grow" style="min-width:0"><p class="h3" style="line-height:1.3">${esc(it.name)}</p>
        ${it.why ? `<p class="small soft" style="margin-top:4px;line-height:1.4">${esc(it.why)}</p>` : ''}</div>${it.src === 'food' ? fodmapBadge(it.fodmap) : ''}</div>
      ${it.units.length > 1 ? `<div class="chips">${it.units.map((x) => `<button class="chip solid" aria-pressed="${x.u === it.unit}" data-act="unit" data-u="${x.u}">${esc(unitName(x.u, 2))}</button>`).join('')}</div>` : ''}
      <div class="amt">
        <button class="amt-btn" data-act="step" data-d="-1" aria-label="${tr('Less', 'Mindre')}">−</button>
        <div class="amt-v"><span class="num">${esc(amountText(it.amount, it.unit))}</span>${calm ? '' : `<span class="small muted num">≈ ${n0(kcal)} kcal</span>`}</div>
        <button class="amt-btn" data-act="step" data-d="1" aria-label="${tr('More', 'Mer')}">+</button>
      </div>
      <div class="chips" style="justify-content:center">${quickFor(it.unit).map((v) => `<button class="chip" aria-pressed="${v === it.amount}" data-act="set" data-v="${v}">${esc(isMass(it.unit) ? `${v} ${it.unit}` : numText(v))}</button>`).join('')}</div>
      ${over ? `<div class="note amber">${icon('info', 18)}<span>${tr(`Low FODMAP up to about ${amountText(snap(it.lowMax / (unitOf(it).g || 1), it.unit), it.unit)}. A bigger serve can be harder on the stomach.`, `Lav-FODMAP opp til omtrent ${amountText(snap(it.lowMax / (unitOf(it).g || 1), it.unit), it.unit)}. En større porsjon kan være tøffere for magen.`)}</span></div>` : ''}
      ${extraHTML}
      <button class="btn primary" data-act="done" style="min-height:54px">${esc(add || tr('Add', 'Legg til'))}</button>
      ${onRemove ? `<button class="btn danger" data-act="remove">${icon('trash', 18)} ${tr('Remove', 'Fjern')}</button>` : ''}`;
  };
  const redraw = (sheet) => { sheet.querySelector('.col').innerHTML = draw(); };
  openSheet({
    title: title || tr('How much?', 'Hvor mye?'),
    html: draw(),
    actions: {
      unit: (el, e, sheet) => {
        const from = unitOf(it);
        const to = it.units.find((x) => x.u === el.dataset.u);
        if (!to) return;
        it.amount = from.g && to.g ? snap((from.g * it.amount) / to.g, to.u) : isMass(to.u) ? 100 : 1;
        it.unit = to.u;
        redraw(sheet);
      },
      step: (el, e, sheet) => { it.amount = stepAmount(it.amount, it.unit, Number(el.dataset.d)); redraw(sheet); },
      set: (el, e, sheet) => { it.amount = Number(el.dataset.v); redraw(sheet); },
      done: () => { closeSheet(); onDone?.(it); },
      remove: () => { closeSheet(); onRemove?.(); },
      ...extraActions,
    },
  });
}

// ---------- Your own ingredient (when it isn't in the list) ----------
const PER = [['piece', () => tr('1 piece', '1 stk')], ['slice', () => tr('1 slice', '1 skive')], ['portion', () => tr('1 portion', '1 porsjon')], ['g100', () => '100 g']];

export function newFoodSheet(prefill = '', onCreated) {
  const d = { name: prefill, kcal: '', unit: 'portion', f: 'low' };
  const draw = () => `<div class="field"><label for="nf-name">${tr('What is it?', 'Hva er det?')}</label>
      <input id="nf-name" class="input" type="text" autocomplete="off" maxlength="60" value="${esc(d.name)}" placeholder="${tr('For example: Mum\'s meatballs', 'For eksempel: Mammas kjøttkaker')}"></div>
    <div class="field"><span class="label">${tr('Calories are for', 'Kaloriene gjelder for')}</span>
      <div class="chips">${PER.map(([k, l]) => `<button class="chip solid" aria-pressed="${d.unit === k}" data-act="per" data-k="${k}">${l()}</button>`).join('')}</div></div>
    <div class="field"><label for="nf-kcal">${tr('About how many kcal? (a guess is fine, or leave empty)', 'Omtrent hvor mange kcal? (et anslag holder, eller la stå tomt)')}</label>
      <input id="nf-kcal" class="input" type="number" inputmode="numeric" min="0" max="3000" value="${esc(d.kcal)}"></div>
    <div class="field"><span class="label">${tr('How does your stomach like it?', 'Hvordan liker magen det?')}</span>
      <div class="chips">${[['low', tr('Fine', 'Går fint')], ['check', tr('Not sure', 'Usikker')], ['high', tr('Often trouble', 'Ofte trøbbel')]].map(([k, l]) => `<button class="chip solid" aria-pressed="${d.f === k}" data-act="fod" data-k="${k}">${l}</button>`).join('')}</div></div>
    <button class="btn primary" data-act="ok">${tr('Continue', 'Fortsett')}</button>`;
  const keep = (sheet) => { d.name = sheet.querySelector('#nf-name').value; d.kcal = sheet.querySelector('#nf-kcal').value; };
  const redraw = (sheet) => { keep(sheet); sheet.querySelector('.col').innerHTML = draw(); };
  openSheet({
    title: tr('Add something new', 'Legg til noe nytt'),
    html: draw(),
    actions: {
      per: (el, e, sheet) => { d.unit = el.dataset.k; redraw(sheet); },
      fod: (el, e, sheet) => { d.f = el.dataset.k; redraw(sheet); },
      ok: (el, e, sheet) => {
        keep(sheet);
        const name = d.name.trim();
        if (!name) return;
        const food = { id: 'c-' + uid(), n: { en: name, nb: name }, p: { en: '', nb: '' }, kcal: Math.max(0, Math.round(Number(d.kcal) || 0)), unit: d.unit, f: d.f, tags: [], custom: true };
        mutate((s) => { s.custom.unshift(food); s.custom = s.custom.slice(0, 300); });
        closeSheet(true);
        onCreated?.(food);
      },
    },
    onMount: (sheet) => setTimeout(() => sheet.querySelector(prefill ? '#nf-kcal' : '#nf-name')?.focus(), 250),
  });
}

// Search foods by name: whole-word and start-of-word matches first.
// The everyday, stomach-friendly pick for common words (so "brød" finds spelt bread before burgers).
const PREFERRED = {
  brod: 'spelt-bread', bread: 'spelt-bread', skive: 'spelt-bread', ost: 'cheese', cheese: 'cheese', melk: 'lf-milk', milk: 'lf-milk',
  ris: 'rice', rice: 'rice', egg: 'egg', eggs: 'egg', potet: 'potatoes', poteter: 'potatoes', potato: 'potatoes', kylling: 'chicken-breast',
  chicken: 'chicken-breast', laks: 'salmon', salmon: 'salmon', banan: 'banana-firm', banana: 'banana-firm', yoghurt: 'lf-yogurt',
  yogurt: 'lf-yogurt', smor: 'butter', butter: 'butter', pasta: 'gf-pasta', havre: 'oats', oats: 'oats', gryn: 'oats', protein: 'whey', whey: 'whey',
};

export function searchFoods(q, max = 12) {
  const n = String(q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae').trim();
  if (!n) return [];
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae');
  const scored = [];
  for (const f of allFoods()) {
    const names = [norm(f.n.en), norm(f.n.nb)];
    let score = 0;
    for (const name of names) {
      if (name === n) score = Math.max(score, 100);
      else if (name.startsWith(n)) score = Math.max(score, 80);
      else if (name.split(/[^a-z0-9]+/).some((w) => w.startsWith(n))) score = Math.max(score, 60);
      else if (n.length >= 3 && name.includes(n)) score = Math.max(score, 30);
    }
    if (f.custom) score += 5;
    if (score && f.f === 'high') score -= 8;
    if (n.length >= 3 && Object.entries(PREFERRED).some(([k, id]) => id === f.id && k.startsWith(n))) score = Math.max(score, 30) + 50;
    if (score) scored.push([score - f.n.en.length / 100, f]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, max).map(([, f]) => f);
}
