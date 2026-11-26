// Meal actions shared by Today, Food and Recipe screens.
import { S, peekDay, day, mutate, addLog, activeSlots } from './store.js';
import { dayStatus, totals, setPlan, skipSlot, itemInfo } from './planner.js';
import { RECIPES, POOLS, GENTLE, recipeById } from './data/recipes.js';
import { tr, L, n0, kindName } from './i18n.js';
import { icon, openSheet, closeSheet, toast, plate, fodmapBadge } from './ui.js';
import { esc, dayKey, clock, norm, addDays } from './util.js';
import { myMeals, sortedMeals, mealsFor, logMyMeal, myMealSheet, kcalLine, whenOf } from './mymeals.js';
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
  if (!t.done) return tr('Logged. Every bite counts.', 'Logget. Hver bit teller.');
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
  if (info.mine) { logMyMeal(key, info.mine, entry.slot.id, portion); return; }
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
  const mine = sortedMeals(mealsFor(slot.kind));
  const others = sortedMeals(myMeals().filter((m) => !mine.includes(m)));
  const myRow = (m) => `<button class="item" data-act="pickMy" data-id="${m.id}" data-name="${esc(norm(m.name))}">
      <span class="plate-mini" aria-hidden="true">${icon('heart', 18)}</span><span class="grow"><span class="t" style="display:block">${esc(m.name)}</span>
      <span class="s">${tr('My meals', 'Mine måltider')}${kcalLine(m) ? ` · ${kcalLine(m)}` : ''}</span></span></button>`;
  openSheet({
    title: `${tr('Change', 'Endre')} ${kindName(slot.kind).toLowerCase()}`,
    html: `<div class="search">${icon('search', 18)}<label class="sr-only" for="swap-q">${tr('Search', 'Søk')}</label>
      <input id="swap-q" class="input" type="search" placeholder="${tr('Search your food and recipes', 'Søk i maten din og oppskrifter')}" data-input="filter" autocomplete="off"></div>
      <button class="item" data-act="free" style="border:1px dashed var(--line);border-radius:16px"><span class="plate-mini" aria-hidden="true">${icon('sparkle', 18)}</span>
        <span class="grow"><span class="t" style="display:block">${tr('No idea needed, I choose myself', 'Trenger ikke forslag, jeg velger selv')}</span><span class="s">${tr('Just keep the time', 'Bare behold tidspunktet')}</span></span></button>
      <p class="label">${tr('My meals', 'Mine måltider')}</p>
      ${mine.length || others.length ? `<div class="list" id="swap-m">${[...mine, ...others].map(myRow).join('')}</div>` : `<p class="small muted">${tr('Save the food you actually like to eat, and it shows up here.', 'Lagre maten du faktisk liker å spise, så dukker den opp her.')}</p>`}
      <button class="btn outline small" data-act="newMy">${icon('plus', 16)} ${tr('New meal', 'Nytt måltid')}</button>
      <p class="label">${tr('Recipes good for', 'Oppskrifter som passer til')} ${kindName(slot.kind).toLowerCase()}</p>
      <div class="list" id="swap-a">${pool.map((id) => recipeById(id)).filter(Boolean).map(row).join('')}</div>
      <p class="label">${tr('Everything else', 'Alt annet')}</p>
      <div class="list" id="swap-b">${rest.map(row).join('')}</div>
      <button class="btn outline" data-act="clear">${tr('Back to the suggestion', 'Tilbake til forslaget')}</button>`,
    actions: {
      pick: (el) => { setPlan(key, slot.id, { rid: el.dataset.id }); closeSheet(); toast(tr('Plan updated.', 'Planen er oppdatert.')); nav.rerender(); },
      pickMy: (el) => { setPlan(key, slot.id, { my: el.dataset.id }); closeSheet(); toast(tr('Plan updated.', 'Planen er oppdatert.')); nav.rerender(); },
      free: () => { setPlan(key, slot.id, { free: true }); closeSheet(); toast(tr('Okay, you choose.', 'Greit, du velger.')); nav.rerender(); },
      newMy: () => { closeSheet(true); myMealSheet(null, { prefill: { when: [whenOf(slot.kind)], plan: { key, slotId: slot.id } } }); },
      clear: () => { mutate(() => { delete day(key).plan[slot.id]; }); closeSheet(); nav.rerender(); },
      filter: (el, e, sheet) => {
        const q = norm(el.value.trim());
        sheet.querySelectorAll('[data-act="pick"], [data-act="pickMy"]').forEach((b) => { b.classList.toggle('hidden', !!q && !b.dataset.name.includes(q)); });
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
      <option value="" ${!slotId ? 'selected' : ''}>${tr('Extra (no meal slot)', 'Ekstra (uten måltid)')}</option></select></div>
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

// Recently logged things (newest first, one per name).
export function recentLogs(max = 6) {
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

// "I've eaten": the idea, your own food, recent things, or anything else.
export function eatSheet(key, entry, preselect = null) {
  const info = itemInfo(entry.item);
  const calm = S().prefs.calm;
  const fits = sortedMeals(mealsFor(entry.slot.kind));
  const mine = [...fits, ...sortedMeals(myMeals()).filter((m) => !fits.includes(m))].filter((m) => m.id !== info.mine?.id).slice(0, 8);
  const recent = recentLogs(5).filter((l) => norm(l.title) !== norm(info.title));
  let chosen = preselect; // { kind: 'idea'|'my'|'recent', id }
  const pick = () => {
    if (!chosen) return '';
    const title = chosen.kind === 'idea' ? info.title : chosen.kind === 'my' ? myMeals().find((m) => m.id === chosen.id)?.name : recent.find((l) => l.id === chosen.id)?.title;
    return `<div class="card tight" style="background:var(--surface2)"><p class="small muted">${tr('How much of', 'Hvor mye av')}</p><p class="h3">${esc(title || '')}</p>${portionButtons(1)}
      <button class="link-btn" data-act="back" style="align-self:flex-start">${icon('chevL', 14)} ${tr('Something else', 'Noe annet')}</button></div>`;
  };
  const list = () => `${!info.free ? `<div class="list"><button class="item" data-act="choose" data-k="idea" data-id="">
      ${info.recipe ? plate(info.recipe, 44) : `<span class="plate-mini" aria-hidden="true">${icon(info.mine ? 'heart' : 'sparkle', 18)}</span>`}
      <span class="grow"><span class="t" style="display:block;font-weight:600">${esc(info.title)}</span><span class="s">${tr('The idea for now', 'Forslaget for nå')}${!calm && info.kcal ? ` · ${n0(info.kcal)} kcal` : ''}</span></span>${icon('chevR', 16)}</button></div>` : ''}
    ${mine.length ? `<p class="label">${tr('My meals', 'Mine måltider')}</p><div class="list">${mine.map((m) => `<button class="item" data-act="choose" data-k="my" data-id="${m.id}">
      <span class="plate-mini" aria-hidden="true">${icon('heart', 18)}</span><span class="grow"><span class="t" style="display:block">${esc(m.name)}</span>${kcalLine(m) ? `<span class="s">${kcalLine(m)}</span>` : ''}</span>${icon('chevR', 16)}</button>`).join('')}</div>` : ''}
    ${recent.length ? `<p class="label">${tr('Recently', 'Nylig')}</p><div class="list">${recent.map((l) => `<button class="item" data-act="choose" data-k="recent" data-id="${l.id}">
      <span class="plate-mini" aria-hidden="true">${icon('clock', 18)}</span><span class="grow"><span class="t" style="display:block">${esc(l.title)}</span>${calm ? '' : `<span class="s">${n0(l.baseKcal ?? l.kcal)} kcal</span>`}</span>${icon('chevR', 16)}</button>`).join('')}</div>` : ''}
    <div class="btns"><button class="btn secondary" data-act="other">${icon('search', 18)} ${tr('Something else', 'Noe annet')}</button>
      <button class="btn secondary" data-act="newMy">${icon('plus', 18)} ${tr('New meal', 'Nytt måltid')}</button></div>`;
  const draw = () => (chosen ? pick() : list());
  openSheet({
    title: tr('What did you eat?', 'Hva spiste du?'),
    html: draw(),
    actions: {
      choose: (el, e, sheet) => { chosen = { kind: el.dataset.k, id: el.dataset.id }; sheet.querySelector('.col').innerHTML = draw(); },
      back: (el, e, sheet) => { chosen = null; sheet.querySelector('.col').innerHTML = draw(); },
      portion: (el) => {
        const p = Number(el.dataset.p);
        if (chosen.kind === 'idea') logPlanned(key, entry, p);
        else if (chosen.kind === 'my') {
          const m = myMeals().find((x) => x.id === chosen.id);
          if (m) logMyMeal(key, m, entry.slot.id, p);
        } else {
          const l = recent.find((x) => x.id === chosen.id);
          if (l) addLog(key, { slot: entry.slot.id, title: l.title, baseKcal: l.baseKcal ?? l.kcal, portion: p, items: l.items || [], tags: l.tags || [], fodmap: l.fodmap || 'low', rid: l.rid || null, myId: l.myId || null, source: 'recent' });
        }
        closeSheet();
        toast(cheer(key));
        nav.rerender();
      },
      other: () => { closeSheet(true); nav.go(`log/${entry.slot.id}`); },
      newMy: () => { closeSheet(true); myMealSheet(null, { prefill: { when: [whenOf(entry.slot.kind)], logTo: { key, slotId: entry.slot.id } } }); },
    },
  });
}
