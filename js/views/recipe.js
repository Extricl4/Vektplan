import { S, mutate, activeSlots } from '../store.js';
import { setPlan, bestSlotFor } from '../planner.js';
import { recipeById } from '../data/recipes.js';
import { tr, L, n0, kindName, dayShort, shortDate } from '../i18n.js';
import { icon, plate, fodmapBadge, openSheet, closeSheet, toast } from '../ui.js';
import { logRecipeSheet } from '../meals.js';
import { fmtQty } from './food.js';
import { esc, dayKey, addDays, parseKey } from '../util.js';
import { nav } from '../nav.js';

const servingsFor = {};

export function render(ctx) {
  const [id] = ctx.params;
  const r = recipeById(id);
  if (!r) return `<div class="screen no-tabs"><p>${tr('Recipe not found.', 'Fant ikke oppskriften.')}</p><a class="btn primary" href="#/food/recipes">${tr('All recipes', 'Alle oppskrifter')}</a></div>`;
  const calm = S().prefs.calm;
  const fav = S().favorites.includes(r.id);
  const servings = servingsFor[r.id] ?? r.serves;
  const f = servings / r.serves;
  return `<div class="screen no-tabs" style="gap:16px">
    <div style="position:relative;height:210px;border-radius:var(--r-l);background:var(--accent-soft);display:flex;align-items:center;justify-content:center;flex:none">
      ${plate(r, 160)}
      <button class="icon-btn surface" style="position:absolute;left:12px;top:12px" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <button class="icon-btn surface ${fav ? 'accent' : ''}" style="position:absolute;right:12px;top:12px" data-act="fav" aria-pressed="${fav}" aria-label="${fav ? tr('Remove from saved', 'Fjern fra lagret') : tr('Save recipe', 'Lagre oppskrift')}">${icon('bookmark', 20, fav ? 'fill="currentColor"' : '')}</button>
    </div>
    <header class="col" style="gap:8px">
      <h1 class="h1">${esc(L(r.name))}</h1>
      <div class="row wrap" style="gap:6px">${fodmapBadge('low')}<span class="badge">${r.min ? `${r.min} min` : tr('No cooking', 'Ingen matlaging')}</span>
        ${r.gentle ? `<span class="badge accent">${tr('Gentle', 'Mild')}</span>` : ''}${calm ? '' : `<span class="badge num">≈ ${n0(r.kcal)} kcal ${tr('per portion', 'per porsjon')}</span>`}</div>
    </header>
    ${r.kcal >= 480 ? `<div class="note">${icon('sparkle', 18)}<span>${tr('A full plate feels like a lot? Eat half now and the rest a couple of hours later. Both halves count.', 'Føles en full tallerken som mye? Spis halvparten nå og resten et par timer senere. Begge halvdelene teller.')}</span></div>` : ''}
    <section class="card" aria-label="${tr('Ingredients', 'Ingredienser')}">
      <div class="row between"><h2 class="h2">${tr('Ingredients', 'Ingredienser')}</h2>
        <div class="stepper" role="group" aria-label="${tr('Portions', 'Porsjoner')}">
          <button data-act="serv" data-d="-1" aria-label="${tr('Fewer portions', 'Færre porsjoner')}">−</button>
          <span class="v">${servings} ${servings === 1 ? tr('portion', 'porsjon') : tr('portions', 'porsjoner')}</span>
          <button data-act="serv" data-d="1" aria-label="${tr('More portions', 'Flere porsjoner')}">+</button></div></div>
      <div class="list">${r.ing.map(([q, u, name]) => `<div class="item" style="justify-content:space-between"><span>${esc(L(name))}</span><span class="muted small num" style="text-align:right">${q == null ? '' : esc(fmtQty(q * f, u))}</span></div>`).join('')}</div>
    </section>
    <div class="note" style="background:var(--sage-bg)">${icon('leaf', 18, 'style="color:var(--sage)"')}<span><b style="color:var(--sage)">${tr('Why it is gentle', 'Hvorfor den er skånsom')}:</b> ${esc(L(r.note))}</span></div>
    <section class="col" aria-label="${tr('Steps', 'Fremgangsmåte')}">
      <h2 class="h2">${tr('Steps', 'Fremgangsmåte')}</h2>
      ${r.steps.map((s, i) => `<div class="row top" style="gap:12px"><span style="width:30px;height:30px;border-radius:50%;background:var(--surface2);color:var(--accent);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex:none">${i + 1}</span>
        <p style="margin-top:4px;line-height:1.55">${esc(L(s))}</p></div>`).join('')}
    </section>
    <div class="btns" style="margin-top:4px">
      <button class="btn secondary" data-act="plan">${icon('calendar', 18)} ${tr('Add to plan', 'Legg i planen')}</button>
      <button class="btn primary" data-act="log">${icon('check', 18)} ${tr('I ate this', 'Jeg spiste dette')}</button></div>
  </div>`;
}

export const actions = {
  back: () => nav.back('food/recipes'),
  fav: (el, e, ctx) => {
    const id = ctx.params[0];
    mutate((s) => {
      if (s.favorites.includes(id)) s.favorites = s.favorites.filter((x) => x !== id);
      else s.favorites.unshift(id);
    });
    toast(S().favorites.includes(id) ? tr('Saved to your recipes.', 'Lagret i oppskriftene dine.') : tr('Removed.', 'Fjernet.'));
    nav.rerender();
  },
  serv: (el, e, ctx) => {
    const r = recipeById(ctx.params[0]);
    const cur = servingsFor[r.id] ?? r.serves;
    servingsFor[r.id] = Math.max(1, Math.min(12, cur + Number(el.dataset.d)));
    nav.rerender();
  },
  log: (el, e, ctx) => {
    const [id, day, slot] = ctx.params;
    const r = recipeById(id);
    const key = day && day === dayKey() ? day : dayKey();
    logRecipeSheet(key, r, slot || bestSlotFor());
  },
  plan: (el, e, ctx) => {
    const r = recipeById(ctx.params[0]);
    const slots = activeSlots();
    const fit = slots.find((s) => r.kinds.includes(s.kind)) || slots[0];
    let chosenDay = ctx.params[1] || dayKey();
    let chosenSlot = ctx.params[2] || fit?.id;
    const days = Array.from({ length: 7 }, (_, i) => addDays(dayKey(), i));
    const html = () => `<p class="label">${tr('Day', 'Dag')}</p>
      <div class="chips scroll">${days.map((k, i) => `<button class="chip solid" aria-pressed="${k === chosenDay}" data-act="d" data-k="${k}">${i === 0 ? tr('Today', 'I dag') : i === 1 ? tr('Tomorrow', 'I morgen') : `${dayShort(parseKey(k))} ${shortDate(parseKey(k))}`}</button>`).join('')}</div>
      <p class="label">${tr('Meal', 'Måltid')}</p>
      <div class="col">${slots.map((s) => `<button class="choice" aria-pressed="${s.id === chosenSlot}" data-act="s" data-id="${s.id}"><span class="grow">${kindName(s.kind)}</span><span class="small muted">${s.time}</span></button>`).join('')}</div>
      <button class="btn primary" data-act="ok">${tr('Add to plan', 'Legg i planen')}</button>`;
    const refresh = (sheet) => { sheet.querySelector('.col').innerHTML = html(); };
    openSheet({
      title: esc(L(r.name)),
      html: html(),
      actions: {
        d: (b, ev, sheet) => { chosenDay = b.dataset.k; refresh(sheet); },
        s: (b, ev, sheet) => { chosenSlot = b.dataset.id; refresh(sheet); },
        ok: () => {
          if (!chosenSlot) return;
          setPlan(chosenDay, chosenSlot, { rid: r.id });
          closeSheet();
          toast(tr('Added to your plan.', 'Lagt i planen.'));
        },
      },
    });
  },
};
