// Make or edit one of your own meals: a name, what is in it (with amounts), when you eat it,
// and how your stomach likes it. Calories add up by themselves.
import { S } from '../store.js';
import { tr, L, n0 } from '../i18n.js';
import { icon, toast, confirmSheet } from '../ui.js';
import { esc, dayKey } from '../util.js';
import { nav } from '../nav.js';
import { setPlan } from '../planner.js';
import { cheer } from '../meals.js';
import { myMealById, saveMyMeal, deleteMyMeal, logMyMeal, takePrefill, WHEN, STOMACH } from '../mymeals.js';
import { foodById, foodItem, restoreItem, packItem, itemKcal, itemFodmap, itemAmountText, amountSheet, newFoodSheet, searchFoods } from '../amount.js';

const COMMON = ['spelt-bread', 'egg', 'cheese', 'butter', 'ham', 'rice', 'potatoes', 'chicken-breast', 'salmon', 'mince', 'gf-pasta', 'lf-milk', 'oats', 'peanut-butter', 'carrot', 'cucumber'];

let ed = null;

export function enter(ctx) {
  const id = ctx.params[0];
  const pre = takePrefill() || {};
  const m = id && id !== 'new' ? myMealById(id) : null;
  ed = {
    id: m?.id || null,
    name: m?.name || pre.name || '',
    items: (m?.items || pre.items || []).map(restoreItem),
    kcal: m?.items?.length ? '' : m?.kcal || '',
    when: m?.when?.length ? m.when.slice() : pre.when?.filter(Boolean).length ? pre.when.filter(Boolean) : ['breakfast', 'lunch', 'dinner', 'snack'],
    fodmap: m?.fodmap || 'low',
    note: m?.note || '',
    q: '',
    plan: pre.plan || null, // { key, slotId }: put it in the plan after saving
    logTo: pre.logTo || null, // { key, slotId }: offer "save and log"
  };
}

function results() {
  const q = ed.q.trim();
  if (!q) {
    return `<div class="chips">${COMMON.map((id) => foodById(id)).filter(Boolean).map((f) => `<button class="chip" data-act="add" data-id="${f.id}">${icon('plus', 13)} ${esc(L(f.n).replace(/\s*\(.*\)$/, ''))}</button>`).join('')}</div>`;
  }
  const foods = searchFoods(q, 8);
  const calm = S().prefs.calm;
  return `${foods.length ? `<div class="list">${foods.map((f) => {
    const it = foodItem(f);
    return `<button class="item" data-act="add" data-id="${f.id}"><span class="dot ${f.f}" aria-hidden="true"></span>
      <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(L(f.n))}</span><span class="s">${f.custom ? tr('Your own', 'Din egen') : `${esc(itemAmountText(it))}${calm ? '' : ` · ${n0(itemKcal(it))} kcal`}`}</span></span>
      ${icon('plus', 18, 'style="color:var(--accent)"')}</button>`;
  }).join('')}</div>` : ''}
    <button class="item" data-act="newFood" style="border:1px dashed var(--line);border-radius:16px">${icon('plus', 18)}<span class="grow">${tr('Add', 'Legg til')} <b>«${esc(q)}»</b> ${tr('as something new', 'som noe nytt')}</span></button>`;
}

export function render() {
  if (!ed) return '';
  const calm = S().prefs.calm;
  const total = ed.items.reduce((a, i) => a + itemKcal(i), 0);
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <div class="titles grow"><p class="eyebrow">${tr('My meals', 'Mine måltider')}</p><h1 class="h1" style="font-size:26px">${ed.id ? tr('Edit meal', 'Endre måltid') : tr('New meal', 'Nytt måltid')}</h1></div></header>

    <section class="card">
      <div class="field"><label for="mm-name">${tr('What do you call it?', 'Hva kaller du det?')}</label>
        <input id="mm-name" class="input" type="text" maxlength="80" autocomplete="off" value="${esc(ed.name)}" data-input="name" placeholder="${tr('e.g. My usual breakfast', 'f.eks. Vanlig frokost')}"></div>
    </section>

    <section class="card" aria-label="${tr("What's in it", 'Hva er i det')}">
      <div class="row between"><h2 class="h3">${tr("What's in it?", 'Hva er i det?')}</h2>${calm || !ed.items.length ? '' : `<span class="num" style="font-weight:700">≈ ${n0(total)} kcal</span>`}</div>
      ${ed.items.length ? `<div class="list">${ed.items.map((it) => `<button class="item" data-act="edit" data-k="${it.k}">
        <span class="dot ${itemFodmap(it)}" aria-hidden="true"></span>
        <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(it.name)}</span><span class="s">${esc(itemAmountText(it))}${calm ? '' : ` · ${n0(itemKcal(it))} kcal`}</span></span>
        <span class="small" style="color:var(--accent);font-weight:600">${tr('Change', 'Endre')}</span></button>`).join('')}</div>`
        : `<p class="small soft" style="line-height:1.45">${tr('Add each thing in it, with about how much. Slices, glasses and spoons are fine, no scale needed.', 'Legg til hver ting i det, med omtrent hvor mye. Skiver, glass og skjeer holder, du trenger ingen vekt.')}</p>`}
      <div class="search">${icon('search', 18)}<label class="sr-only" for="mm-q">${tr('Add an ingredient', 'Legg til en ingrediens')}</label>
        <input id="mm-q" class="input" type="search" autocomplete="off" placeholder="${tr('Add: bread, egg, rice…', 'Legg til: brød, egg, ris…')}" value="${esc(ed.q)}" data-input="q"></div>
      <div id="mm-results" class="col" style="gap:8px">${results()}</div>
      ${!ed.items.length ? `<div class="field" style="margin-top:4px"><label for="mm-kcal">${tr("Or, if you don't want to list it: about how many kcal in total?", 'Eller, hvis du ikke vil liste det opp: omtrent hvor mange kcal totalt?')}</label>
        <input id="mm-kcal" class="input" type="number" inputmode="numeric" min="0" max="4000" value="${esc(String(ed.kcal || ''))}" data-input="kcal" placeholder="${tr('Optional', 'Valgfritt')}"></div>` : ''}
    </section>

    <section class="card">
      <div class="field"><span class="label">${tr('When do you eat it?', 'Når spiser du det?')}</span>
        <div class="chips">${WHEN.map(([k, l]) => `<button class="chip solid" aria-pressed="${ed.when.includes(k)}" data-act="when" data-k="${k}">${l()}</button>`).join('')}</div></div>
      <div class="field"><span class="label">${tr('How does your stomach like it?', 'Hvordan liker magen det?')}</span>
        <div class="chips">${STOMACH.map(([k, l]) => `<button class="chip solid" aria-pressed="${ed.fodmap === k}" data-act="fod" data-k="${k}">${l()}</button>`).join('')}</div></div>
      <div class="field"><label for="mm-note">${tr('Note (optional)', 'Notat (valgfritt)')}</label>
        <textarea id="mm-note" class="textarea filled" rows="2" maxlength="300" data-input="note" placeholder="${tr('How you make it, where you buy it…', 'Hvordan du lager det, hvor du kjøper det…')}">${esc(ed.note)}</textarea></div>
    </section>

    ${ed.logTo ? `<button class="btn primary" data-act="saveLog" style="min-height:56px">${icon('check', 18)} ${tr('Save and log it', 'Lagre og logg det')}</button>
      <button class="btn secondary" data-act="save">${tr('Just save it', 'Bare lagre')}</button>`
      : `<button class="btn primary" data-act="save" style="min-height:56px">${icon('check', 18)} ${tr('Save meal', 'Lagre måltidet')}</button>`}
    ${ed.id ? `<button class="link-btn" style="color:var(--red);align-self:center" data-act="del">${tr('Delete this meal', 'Slett dette måltidet')}</button>` : ''}
  </div>`;
}

function refreshResults() {
  const box = document.getElementById('mm-results');
  if (box) box.innerHTML = results();
}

function addIngredient(it) {
  amountSheet({
    item: it,
    add: tr('Add', 'Legg til'),
    onDone: (x) => { ed.items.push(x); ed.q = ''; nav.rerender(); },
  });
}

function save() {
  const name = ed.name.trim();
  if (!name) {
    toast(tr('Give it a name first.', 'Gi det et navn først.'));
    document.getElementById('mm-name')?.focus();
    return null;
  }
  const items = ed.items.map(packItem);
  const kcal = items.length ? items.reduce((a, i) => a + i.kcal, 0) : Math.max(0, Math.min(4000, Math.round(Number(ed.kcal) || 0)));
  const id = saveMyMeal({ id: ed.id || undefined, name, items, kcal, when: ed.when.length ? ed.when : ['breakfast', 'lunch', 'dinner', 'snack'], fodmap: ed.fodmap, note: ed.note.trim() });
  if (ed.plan) setPlan(ed.plan.key, ed.plan.slotId, { my: id });
  return id;
}

export const actions = {
  back: () => { ed = null; nav.back('food/mine'); },
  name: (el) => { ed.name = el.value; },
  kcal: (el) => { ed.kcal = el.value; },
  note: (el) => { ed.note = el.value; },
  q: (el) => { ed.q = el.value; refreshResults(); },
  add: (el) => { const f = foodById(el.dataset.id); if (f) addIngredient(foodItem(f)); },
  newFood: () => newFoodSheet(ed.q.trim(), (food) => addIngredient(foodItem(food))),
  edit: (el) => {
    const i = ed.items.findIndex((x) => x.k === el.dataset.k);
    if (i < 0) return;
    amountSheet({
      item: ed.items[i],
      add: tr('Done', 'Ferdig'),
      onDone: (x) => { ed.items[i] = x; nav.rerender(); },
      onRemove: () => { ed.items.splice(i, 1); nav.rerender(); },
    });
  },
  when: (el) => {
    const k = el.dataset.k;
    ed.when = ed.when.includes(k) ? ed.when.filter((x) => x !== k) : [...ed.when, k];
    nav.rerender();
  },
  fod: (el) => { ed.fodmap = el.dataset.k; nav.rerender(); },
  save: () => {
    const id = save();
    if (!id) return;
    toast(tr('Saved to My meals.', 'Lagret i Mine måltider.'));
    ed = null;
    nav.back('food/mine');
  },
  saveLog: () => {
    const to = ed.logTo;
    const id = save();
    if (!id) return;
    logMyMeal(to.key || dayKey(), myMealById(id), to.slotId, 1);
    toast(cheer(to.key || dayKey()));
    ed = null;
    nav.go('today');
  },
  del: async () => {
    const ok = await confirmSheet({
      title: tr('Delete this meal?', 'Slette dette måltidet?'),
      text: tr('It disappears from My meals. Days you already logged it stay as they are.', 'Det forsvinner fra Mine måltider. Dager du allerede har logget det blir som de er.'),
      yes: tr('Delete', 'Slett'),
      danger: true,
    });
    if (!ok) return;
    deleteMyMeal(ed.id);
    ed = null;
    toast(tr('Deleted.', 'Slettet.'));
    nav.back('food/mine');
  },
};
