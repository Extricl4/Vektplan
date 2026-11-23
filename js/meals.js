// Meal actions shared by Today, Food and Recipe screens.
import { S, peekDay, day, mutate, addLog, activeSlots } from './store.js';
import { dayStatus, totals, setPlan, skipSlot, itemInfo } from './planner.js';
import { RECIPES, POOLS, GENTLE, recipeById } from './data/recipes.js';
import { tr, L, n0, kindName } from './i18n.js';
import { icon, openSheet, closeSheet, toast, plate, fodmapBadge } from './ui.js';
import { esc, dayKey, clock, norm } from './util.js';
import { nav } from './nav.js';

const PORTIONS = [
  [1, () => tr('All of it', 'Alt')],
  [0.75, () => '¾'],
  [0.5, () => '½'],
  [0.25, () => tr('A few bites', 'Noen biter')],
];

export function portionButtons(selected = 1, act = 'portion') {
  return `<div class="grid2">${PORTIONS.map(([p, label]) =>
    `<button class="btn ${p === selected ? 'primary' : 'secondary'}" data-act="${act}" data-p="${p}">${label()}</button>`).join('')}</div>`;
}

export function cheer(key = dayKey()) {
  const t = totals(key);
  const left = t.total - t.done;
  if (t.total && left === 0) return tr('Logged. That is every meal today. Amazing.', 'Logget. Alle dagens måltider er gjort. Sterkt.');
  const lines = [
    tr(`Logged. ${t.done} of ${t.total} meals done.`, `Logget. ${t.done} av ${t.total} måltider gjort.`),
    tr(`Nice. ${t.done} of ${t.total} done, keep it steady.`, `Fint. ${t.done} av ${t.total} gjort, fortsett jevnt.`),
    tr(`Good job. ${t.done} of ${t.total} meals so far.`, `Bra jobba. ${t.done} av ${t.total} måltider så langt.`),
  ];
  return lines[(t.done + t.logs) % lines.length];
}

// Log the planned item for a slot.
export function logPlanned(key, entry, portion = 1) {
  const info = itemInfo(entry.item);
  addLog(key, {
    slot: entry.slot.id,
    title: info.title,
    baseKcal: info.kcal,
    portion,
    rid: info.recipe?.id || null,
    items: info.recipe ? [] : entry.item?.food?.items || [],
    tags: entry.item?.food?.tags || [],
    fodmap: info.fodmap || 'low',
    source: 'plan',
  });
}

export function atePlannedSheet(key, entry) {
  const info = itemInfo(entry.item);
  const calm = S().prefs.calm;
  openSheet({
    title: tr('How much did you eat?', 'Hvor mye spiste du?'),
    html: `<div class="row" style="gap:14px">${plate(info.recipe, 52)}<div class="grow"><p class="h3">${esc(info.title)}</p>
      ${calm ? '' : `<p class="small muted">${n0(info.kcal)} kcal ${tr('for a full portion', 'for en hel porsjon')}</p>`}</div></div>
      ${portionButtons(1)}
      <p class="small muted center">${tr('Every bite counts. Log what you actually ate.', 'Hver bit teller. Logg det du faktisk spiste.')}</p>`,
    actions: {
      portion: (el) => {
        logPlanned(key, entry, Number(el.dataset.p));
        closeSheet();
        toast(cheer(key));
        nav.rerender();
      },
    },
  });
}

function gentleChoices(kind, exclude) {
  const ids = GENTLE.filter((id) => id !== exclude);
  const preferred = kind === 'lunch' || kind === 'dinner' ? ['chicken-soup', 'butter-rice', 'smoothie'] : ['smoothie', 'ricecakes-pb', 'cheese-crackers', 'eggs-toast'];
  return [...new Set([...preferred.filter((id) => id !== exclude), ...ids])].slice(0, 3).map(recipeById).filter(Boolean);
}

export function smallerSheet(key, entry) {
  const info = itemInfo(entry.item);
  const calm = S().prefs.calm;
  const alts = gentleChoices(entry.slot.kind, info.recipe?.id);
  openSheet({
    title: tr('Smaller option', 'Mindre alternativ'),
    html: `<p class="soft small">${tr('Feeling full or queasy? Something small is still a win.', 'Mett eller kvalm? Litt er fortsatt en seier.')}</p>
      <div class="btns">
        <button class="btn secondary" data-act="half">${tr('I ate half', 'Jeg spiste halvparten')}</button>
        <button class="btn secondary" data-act="bites">${tr('Just a few bites', 'Bare noen biter')}</button>
      </div>
      <p class="label">${tr('Or swap to something gentler', 'Eller bytt til noe mildere')}</p>
      <div class="list">${alts.map((r) => `<button class="item" data-act="swap" data-id="${r.id}">
        ${plate(r, 44)}<span class="grow"><span class="t" style="display:block">${esc(L(r.name))}</span>
        <span class="s">${r.min} min${calm ? '' : ` · ${n0(r.kcal)} kcal`}</span></span>${icon('swap', 18)}</button>`).join('')}</div>`,
    actions: {
      half: () => { logPlanned(key, entry, 0.5); closeSheet(); toast(tr('Half counts. Logged.', 'Halvparten teller. Logget.')); nav.rerender(); },
      bites: () => { logPlanned(key, entry, 0.25); closeSheet(); toast(tr('A few bites is a start. Logged.', 'Noen biter er en start. Logget.')); nav.rerender(); },
      swap: (el) => { setPlan(key, entry.slot.id, { rid: el.dataset.id }); closeSheet(); toast(tr('Swapped.', 'Byttet.')); nav.rerender(); },
    },
  });
}

export function swapSheet(key, slot) {
  const calm = S().prefs.calm;
  const pool = POOLS[slot.kind] || POOLS.snack;
  const rest = RECIPES.filter((r) => !pool.includes(r.id));
  const row = (r) => `<button class="item" data-act="pick" data-id="${r.id}" data-name="${esc(norm(L(r.name)))}">
      ${plate(r, 44)}<span class="grow"><span class="t" style="display:block">${esc(L(r.name))}</span>
      <span class="s">${r.min} min${calm ? '' : ` · ${n0(r.kcal)} kcal`}${r.gentle ? ` · ${tr('gentle', 'mild')}` : ''}</span></span></button>`;
  openSheet({
    title: `${tr('Swap', 'Bytt')} ${kindName(slot.kind).toLowerCase()}`,
    html: `<div class="search">${icon('search', 18)}<label class="sr-only" for="swap-q">${tr('Search', 'Søk')}</label>
      <input id="swap-q" class="input" type="search" placeholder="${tr('Search recipes', 'Søk i oppskrifter')}" data-input="filter" autocomplete="off"></div>
      <p class="label">${tr('Good for', 'Passer til')} ${kindName(slot.kind).toLowerCase()}</p>
      <div class="list" id="swap-a">${pool.map((id) => recipeById(id)).filter(Boolean).map(row).join('')}</div>
      <p class="label">${tr('Everything else', 'Alt annet')}</p>
      <div class="list" id="swap-b">${rest.map(row).join('')}</div>
      <button class="btn outline" data-act="clear">${tr('Back to the suggestion', 'Tilbake til forslaget')}</button>`,
    actions: {
      pick: (el) => { setPlan(key, slot.id, { rid: el.dataset.id }); closeSheet(); toast(tr('Plan updated.', 'Planen er oppdatert.')); nav.rerender(); },
      clear: () => { mutate(() => { delete day(key).plan[slot.id]; }); closeSheet(); nav.rerender(); },
      filter: (el, e, sheet) => {
        const q = norm(el.value.trim());
        sheet.querySelectorAll('[data-act="pick"]').forEach((b) => { b.classList.toggle('hidden', !!q && !b.dataset.name.includes(q)); });
      },
    },
  });
}

export function editLogSheet(key, id) {
  const d = peekDay(key);
  const log = d.logs.find((l) => l.id === id);
  if (!log) return;
  const calm = S().prefs.calm;
  const base = log.baseKcal ?? log.kcal / (log.portion || 1);
  const slots = activeSlots();
  openSheet({
    title: esc(log.title),
    html: `<p class="small muted">${clock(log.ts)}${calm ? '' : ` · ${n0(log.kcal)} kcal`}${log.items?.length ? ` · ${log.items.map((i) => esc(i.name)).join(', ')}` : ''}</p>
      <p class="label">${tr('How much did you eat?', 'Hvor mye spiste du?')}</p>
      ${portionButtons(log.portion ?? 1)}
      <div class="field"><label for="log-slot">${tr('Meal', 'Måltid')}</label>
      <select id="log-slot" class="select" data-change="slot"><option value="">${tr('Extra (no meal slot)', 'Ekstra (uten måltid)')}</option>
      ${slots.map((s) => `<option value="${s.id}" ${s.id === log.slot ? 'selected' : ''}>${kindName(s.kind)} · ${s.time}</option>`).join('')}</select></div>
      <button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button>`,
    actions: {
      portion: (el) => {
        const p = Number(el.dataset.p);
        mutate(() => { const l = day(key).logs.find((x) => x.id === id); if (l) { l.portion = p; l.baseKcal = base; l.kcal = Math.round(base * p); } });
        closeSheet(); toast(tr('Updated.', 'Oppdatert.')); nav.rerender();
      },
      slot: (el) => {
        mutate(() => { const l = day(key).logs.find((x) => x.id === id); if (l) l.slot = el.value || null; });
        toast(tr('Moved.', 'Flyttet.')); nav.rerender();
      },
      del: () => {
        mutate(() => { const dd = day(key); dd.logs = dd.logs.filter((x) => x.id !== id); });
        closeSheet(); toast(tr('Deleted.', 'Slettet.')); nav.rerender();
      },
    },
  });
}

export function skipCurrent(key, entry) {
  skipSlot(key, entry.slot.id, true);
  const { current } = dayStatus(key);
  toast(current ? tr(`Okay. Next one at ${current.time}.`, `Greit. Neste er kl. ${current.time}.`) : tr('Okay, skipped.', 'Greit, hoppet over.'));
  nav.rerender();
}

export function logRecipeSheet(key, recipe, slotId) {
  const slots = activeSlots();
  openSheet({
    title: tr('Log this meal', 'Logg dette måltidet'),
    html: `<div class="row" style="gap:14px">${plate(recipe, 52)}<p class="h3 grow">${esc(L(recipe.name))}</p></div>
      <div class="field"><label for="lr-slot">${tr('Meal', 'Måltid')}</label>
      <select id="lr-slot" class="select">${slots.map((s) => `<option value="${s.id}" ${s.id === slotId ? 'selected' : ''}>${kindName(s.kind)} · ${s.time}</option>`).join('')}
      <option value="">${tr('Extra (no meal slot)', 'Ekstra (uten måltid)')}</option></select></div>
      <p class="label">${tr('How much did you eat?', 'Hvor mye spiste du?')} <span class="muted">(${tr('1 portion', '1 porsjon')})</span></p>
      ${portionButtons(1)}`,
    actions: {
      portion: (el, e, sheet) => {
        const slot = sheet.querySelector('#lr-slot').value || null;
        addLog(key, { slot, title: L(recipe.name), baseKcal: recipe.kcal, portion: Number(el.dataset.p), rid: recipe.id, fodmap: 'low', source: 'recipe' });
        closeSheet(); toast(cheer(key)); nav.rerender();
      },
    },
  });
}

export function recipeShort(r) {
  return r.ing.slice(0, 4).map((i) => L(i[2])).join(', ');
}

export function fodmapLine(f) {
  return fodmapBadge(f);
}
