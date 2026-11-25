// Your own food: things you actually eat (mum's dinner, your usual sandwich, a snack you like).
// Save them once, then log them in one tap or let the plan suggest them.
import { S, mutate, addLog } from './store.js';
import { tr, n0 } from './i18n.js';
import { openSheet, closeSheet, toast, icon } from './ui.js';
import { esc, uid } from './util.js';

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
  mutate((s) => {
    const i = s.myMeals.findIndex((x) => x.id === m.id);
    if (i >= 0) s.myMeals[i] = { ...s.myMeals[i], ...m };
    else s.myMeals.unshift({ id: 'm-' + uid(), created: Date.now(), used: 0, ...m });
  });
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
    baseKcal: meal.kcal || 0,
    portion,
    myId: meal.id,
    items: meal.items || [],
    fodmap: meal.fodmap || 'low',
    source: 'mine',
  });
}

export function kcalLine(m) {
  if (S().prefs.calm) return '';
  return m.kcal ? `${n0(m.kcal)} kcal` : tr('kcal not set', 'kcal ikke satt');
}

// Editor for one of your foods. `prefill` can come from a logged meal or the log cart.
export function myMealSheet(existing = null, { prefill = {}, onSaved } = {}) {
  const m = { name: '', kcal: '', when: ['breakfast', 'lunch', 'dinner', 'snack'], fodmap: 'low', note: '', ...prefill, ...(existing || {}) };
  const draw = () => `<div class="field"><label for="mm-name">${tr('What is it?', 'Hva er det?')}</label>
      <input id="mm-name" class="input" type="text" autocomplete="off" maxlength="80" value="${esc(m.name)}" placeholder="${tr('For example: Chicken wrap like mum makes it', 'For eksempel: Kyllingwrap slik mamma lager den')}"></div>
    <div class="field"><label for="mm-kcal">${tr('About how many kcal in a normal portion? (optional)', 'Omtrent hvor mange kcal i en vanlig porsjon? (valgfritt)')}</label>
      <input id="mm-kcal" class="input" type="number" inputmode="numeric" min="0" max="3000" value="${m.kcal || ''}" placeholder="${tr("Leave empty if you don't know", 'La stå tom hvis du ikke vet')}"></div>
    <div class="field"><span class="label">${tr('When do you eat it?', 'Når spiser du det?')}</span>
      <div class="chips">${WHEN.map(([k, l]) => `<button class="chip solid" aria-pressed="${m.when.includes(k)}" data-act="when" data-k="${k}">${l()}</button>`).join('')}</div></div>
    <div class="field"><span class="label">${tr('How does your stomach like it?', 'Hvordan liker magen det?')}</span>
      <div class="chips">${STOMACH.map(([k, l]) => `<button class="chip solid" aria-pressed="${m.fodmap === k}" data-act="fod" data-k="${k}">${l()}</button>`).join('')}</div></div>
    <div class="field"><label for="mm-note">${tr('Note (optional)', 'Notat (valgfritt)')}</label>
      <textarea id="mm-note" class="textarea filled" rows="2" maxlength="300" placeholder="${tr('What is in it, how you make it...', 'Hva er i den, hvordan du lager den...')}">${esc(m.note || '')}</textarea></div>
    <button class="btn primary" data-act="save">${icon('check', 18)} ${existing ? tr('Save changes', 'Lagre endringer') : tr('Save to My food', 'Lagre i Min mat')}</button>
    ${existing ? `<button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button>` : ''}`;
  const keep = (sheet) => {
    m.name = sheet.querySelector('#mm-name').value;
    m.kcal = sheet.querySelector('#mm-kcal').value;
    m.note = sheet.querySelector('#mm-note').value;
  };
  const redraw = (sheet) => { keep(sheet); sheet.querySelector('.col').innerHTML = draw(); };
  openSheet({
    title: existing ? tr('Edit your food', 'Endre maten din') : tr('Add your own food', 'Legg til din egen mat'),
    html: draw(),
    actions: {
      when: (el, e, sheet) => {
        const k = el.dataset.k;
        m.when = m.when.includes(k) ? m.when.filter((x) => x !== k) : [...m.when, k];
        redraw(sheet);
      },
      fod: (el, e, sheet) => { m.fodmap = el.dataset.k; redraw(sheet); },
      save: (el, e, sheet) => {
        keep(sheet);
        const name = m.name.trim();
        if (!name) { toast(tr('Give it a name first.', 'Gi den et navn først.')); return; }
        const kcal = Math.max(0, Math.min(3000, Math.round(Number(m.kcal) || 0)));
        const out = { name, kcal, when: m.when.length ? m.when : ['breakfast', 'lunch', 'dinner', 'snack'], fodmap: m.fodmap, note: m.note.trim(), items: m.items || [] };
        if (existing) out.id = existing.id;
        saveMyMeal(out);
        closeSheet();
        toast(existing ? tr('Saved.', 'Lagret.') : tr(`${name} is in My food now.`, `${name} ligger nå i Min mat.`));
        onSaved?.(out);
      },
      del: () => {
        deleteMyMeal(existing.id);
        closeSheet();
        toast(tr('Deleted.', 'Slettet.'));
        onSaved?.(null);
      },
    },
  });
}
