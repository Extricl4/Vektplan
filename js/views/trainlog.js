// "Log your own training": something you did outside the plan ("arms for 25 min"), with the muscles
// and exercises you ticked off. Saved as a workout with own: true, so it never changes the plan.
import { S } from '../store.js';
import { tr, L, shortDate } from '../i18n.js';
import { icon, toast, confirmSheet } from '../ui.js';
import { esc, dayKey, addDays, parseKey, nowMinutes } from '../util.js';
import { nav } from '../nav.js';
import { FOCUS, FOCUS_ORDER } from '../data/programs.js';
import { GROUPS } from '../data/exercises.js';
import { allEx, available, exName, currentPlace, saveOwnWorkout, deleteWorkout, OWN_TYPES } from '../training.js';
import { workoutCheer } from '../encourage.js';

let st = null;

function fresh(w = null) {
  if (w) {
    const d = new Date(w.ts || Date.now());
    return {
      id: w.id, type: w.type || null, name: w.name || '', minutes: w.minutes || 20,
      muscles: [...(w.muscles || [])], exercises: [...(w.exercises || [])], otherEx: [...(w.otherEx || [])],
      effort: w.effort || null, note: w.note || '', date: w.date, time: d.getHours() * 60 + d.getMinutes(), earlier: true,
      touched: true, allEx: false,
    };
  }
  return { id: null, type: null, name: '', minutes: 20, muscles: [], exercises: [], otherEx: [], effort: null, note: '', date: dayKey(), time: null, earlier: false, touched: false, allEx: false };
}

export function enter(ctx) {
  const id = ctx.params[0];
  const w = id ? S().workouts.find((x) => x.id === id && x.own) : null;
  st = fresh(w);
}

const typeName = (id) => L(OWN_TYPES.find((t) => t[0] === id)?.[1] || { en: '', nb: '' });
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const isEarlier = () => st.earlier || st.date !== dayKey() || st.time != null;

function dayOptions() {
  const list = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(dayKey(), -i);
    const d = parseKey(k);
    const l = i === 0 ? tr('Today', 'I dag') : i === 1 ? tr('Yesterday', 'I går') : `${d.toLocaleDateString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB', { weekday: 'long' })} ${shortDate(d)}`;
    return [k, l.charAt(0).toUpperCase() + l.slice(1)];
  });
  return list.some(([k]) => k === st.date) ? list : [[st.date, shortDate(parseKey(st.date))], ...list];
}

function ts() {
  if (!isEarlier()) return Date.now();
  const d = parseKey(st.date);
  const m = st.time ?? nowMinutes();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return Math.min(d.getTime(), Date.now());
}

// Exercises for the ticked muscles: ones you have the equipment for first.
function exList() {
  const place = currentPlace();
  return Object.entries(allEx())
    .filter(([, x]) => st.muscles.includes(x.groups[0]))
    .sort((a, b) => (available(b[0], place) ? 1 : 0) - (available(a[0], place) ? 1 : 0)
      || st.muscles.indexOf(a[1].groups[0]) - st.muscles.indexOf(b[1].groups[0]) || (a[1].pri || 0) - (b[1].pri || 0))
    .map(([id]) => id);
}

function whatCard() {
  return `<section class="card">
    <h2 class="h3">${tr('What did you do?', 'Hva gjorde du?')}</h2>
    <div class="chips">${OWN_TYPES.map(([id, n]) => `<button class="chip solid" aria-pressed="${st.type === id}" data-act="type" data-id="${id}">${esc(L(n))}</button>`).join('')}</div>
    <label class="sr-only" for="tl-name">${tr('Name', 'Navn')}</label>
    <input id="tl-name" class="input" type="text" maxlength="50" autocomplete="off" value="${esc(st.name)}" data-input="name" placeholder="${tr('Or write it, e.g. Arms at home', 'Eller skriv det, f.eks. Armer hjemme')}">
  </section>`;
}

function howLongCard() {
  return `<section class="card">
    <div class="row between"><h2 class="h3">${tr('How long?', 'Hvor lenge?')}</h2>
      <div class="stepper"><button data-act="min" data-d="-5" aria-label="${tr('Less', 'Mindre')}">−</button>
        <span class="v num"><input id="tl-min" class="tl-min num" type="text" inputmode="numeric" value="${st.minutes}" data-input="minIn" aria-label="${tr('Minutes', 'Minutter')}"> min</span>
        <button data-act="min" data-d="5" aria-label="${tr('More', 'Mer')}">+</button></div></div>
    <div class="chips">${[10, 15, 20, 25, 30, 45, 60, 90].map((m) => `<button class="chip" aria-pressed="${st.minutes === m}" data-act="minSet" data-v="${m}">${m} min</button>`).join('')}</div>
  </section>`;
}

function whenCard() {
  const early = isEarlier();
  return `<section class="card">
    <h2 class="h3">${tr('When?', 'Når?')}</h2>
    <div class="seg"><button aria-pressed="${!early}" data-act="whenNow">${tr('Just finished', 'Nettopp ferdig')}</button>
      <button aria-pressed="${early}" data-act="whenEarlier">${tr('Earlier', 'Tidligere')}</button></div>
    ${early ? `<div class="row" style="gap:8px">
      <label class="field" style="flex:1.3;min-width:0;margin:0"><span class="tiny muted">${tr('Day', 'Dag')}</span>
        <select class="input" data-change="day">${dayOptions().map(([k, l]) => `<option value="${k}" ${k === st.date ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="field" style="flex:1;min-width:0;margin:0"><span class="tiny muted">${tr('Finished at', 'Ferdig kl.')}</span>
        <input class="input num" type="time" value="${hhmm(st.time ?? nowMinutes())}" data-change="time" data-input="time"></label></div>` : ''}
  </section>`;
}

function musclesCard() {
  return `<section class="card">
    <h2 class="h3">${tr('Muscles you trained', 'Musklene du trente')}</h2>
    <p class="tiny muted">${tr('Tick all that fit. Optional.', 'Kryss av alt som passer. Valgfritt.')}</p>
    <div class="chips">${FOCUS_ORDER.map((m) => `<button class="chip solid" aria-pressed="${st.muscles.includes(m)}" data-act="muscle" data-id="${m}">${st.muscles.includes(m) ? icon('check', 13) + ' ' : ''}${esc(L(FOCUS[m].name))}</button>`).join('')}</div>
  </section>`;
}

function exCard() {
  if (!st.muscles.length && !st.exercises.length && !st.otherEx.length) return '';
  const all = exList();
  const ticked = st.exercises.filter((id) => !all.includes(id));
  const shown = st.allEx ? all : all.slice(0, 10);
  // Keep ticked ones visible even when the list is short.
  const rows = [...ticked, ...shown, ...all.slice(10).filter((id) => !st.allEx && st.exercises.includes(id))];
  return `<section class="card">
    <h2 class="h3">${tr('Exercises you did', 'Øvelser du gjorde')}</h2>
    <p class="tiny muted">${tr('Optional. Tap to tick them off.', 'Valgfritt. Trykk for å krysse av.')}</p>
    ${rows.length ? `<div class="list">${rows.map((id) => {
      const on = st.exercises.includes(id);
      const g = allEx()[id]?.groups?.[0];
      return `<button class="item tick-row ${on ? 'on' : ''}" aria-pressed="${on}" data-act="ex" data-id="${esc(id)}">
        <span class="box" aria-hidden="true">${on ? icon('check', 14) : ''}</span>
        <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(exName(id))}</span>
        <span class="s">${esc(L(GROUPS[g] || { en: '', nb: '' }))}</span></span></button>`;
    }).join('')}</div>` : ''}
    ${!st.allEx && all.length > 10 ? `<button class="link-btn small" data-act="allEx">${tr(`Show all ${all.length}`, `Vis alle ${all.length}`)}</button>` : ''}
    ${st.otherEx.length ? `<div class="chips">${st.otherEx.map((x, i) => `<button class="chip on" data-act="rmOther" data-i="${i}" aria-label="${tr('Remove', 'Fjern')} ${esc(x)}">${esc(x)} ${icon('x', 12)}</button>`).join('')}</div>` : ''}
    <div class="row" style="gap:8px"><input id="tl-other" class="input" style="flex:1;min-width:0" type="text" maxlength="40" autocomplete="off" placeholder="${tr('Something else, e.g. Pull-ups', 'Noe annet, f.eks. Pull-ups')}">
      <button class="btn small secondary" data-act="addOther">${icon('plus', 16)} ${tr('Add', 'Legg til')}</button></div>
  </section>`;
}

function feelCard() {
  const E = [['easy', tr('Easy', 'Lett')], ['ok', tr('Just right', 'Passe')], ['hard', tr('Hard', 'Tungt')]];
  return `<section class="card">
    <h2 class="h3">${tr('How did it feel?', 'Hvordan kjentes det?')}</h2>
    <div class="seg">${E.map(([k, l]) => `<button aria-pressed="${st.effort === k}" data-act="effort" data-v="${k}">${l}</button>`).join('')}</div>
    <label class="sr-only" for="tl-note">${tr('Note', 'Notat')}</label>
    <input id="tl-note" class="input" type="text" maxlength="120" autocomplete="off" value="${esc(st.note)}" data-input="note" placeholder="${tr('Note (optional)', 'Notat (valgfritt)')}">
  </section>`;
}

export function render() {
  if (!st) st = fresh();
  return `<div class="screen no-tabs">
    <header class="head">
      <button class="icon-btn surface" data-act="close" aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button>
      <div class="titles grow"><p class="eyebrow">${tr('Separate from your plan', 'Utenom planen din')}</p>
        <h1 class="h2">${st.id ? tr('Edit training', 'Endre trening') : tr('Log your own training', 'Logg egen trening')}</h1></div>
    </header>
    ${whatCard()}
    ${howLongCard()}
    ${whenCard()}
    ${musclesCard()}
    ${exCard()}
    ${feelCard()}
    <button class="btn primary" data-act="save" style="min-height:56px;font-size:16px">${icon('check', 18)} ${st.id ? tr('Save changes', 'Lagre endringer') : tr('Save training', 'Lagre treningen')}</button>
    ${st.id ? `<button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button>` : ''}
  </div>`;
}

const setMinutes = (v) => { st.minutes = Math.max(1, Math.min(300, Math.round(v) || 0)); };

export const actions = {
  close: () => { st = null; nav.back('train'); },
  type: (el) => {
    const t = OWN_TYPES.find((x) => x[0] === el.dataset.id);
    if (!t) return;
    const prevLabel = st.type ? typeName(st.type) : '';
    const same = st.type === t[0];
    st.type = same ? null : t[0];
    if (!st.name.trim() || st.name === prevLabel) st.name = same ? '' : L(t[1]);
    if (!same && (!st.touched || !st.muscles.length)) { st.muscles = [...t[2]]; }
    if (!same && t[3] && st.minutes === 20) st.minutes = t[3];
    nav.rerender();
  },
  name: (el) => { st.name = el.value; },
  note: (el) => { st.note = el.value; },
  min: (el) => { setMinutes(st.minutes + Number(el.dataset.d)); nav.rerender(); },
  minSet: (el) => { setMinutes(Number(el.dataset.v)); nav.rerender(); },
  minIn: (el) => {
    const v = parseInt(el.value, 10);
    if (v > 0) {
      setMinutes(v);
      document.querySelectorAll('[data-act=minSet]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === st.minutes)));
    }
  },
  whenNow: () => { st.date = dayKey(); st.time = null; st.earlier = false; nav.rerender(); },
  whenEarlier: () => {
    if (!isEarlier()) {
      st.earlier = true;
      const d = new Date(Date.now() - 60 * 60000);
      st.date = dayKey(d); st.time = d.getHours() * 60 + d.getMinutes();
    }
    nav.rerender();
  },
  day: (el) => { st.date = el.value; st.earlier = true; if (st.time == null) st.time = nowMinutes(); },
  time: (el) => { const [h, m] = String(el.value || '').split(':').map(Number); if (h >= 0 && m >= 0) { st.time = h * 60 + m; st.earlier = true; } },
  muscle: (el) => {
    const m = el.dataset.id;
    st.touched = true;
    st.muscles = st.muscles.includes(m) ? st.muscles.filter((x) => x !== m) : [...st.muscles, m];
    nav.rerender();
  },
  ex: (el) => {
    const id = el.dataset.id;
    st.exercises = st.exercises.includes(id) ? st.exercises.filter((x) => x !== id) : [...st.exercises, id];
    const on = st.exercises.includes(id);
    // In place, so the list doesn't jump.
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', String(on));
    el.querySelector('.box').innerHTML = on ? icon('check', 14) : '';
  },
  allEx: () => { st.allEx = true; nav.rerender(); },
  addOther: () => {
    const inp = document.getElementById('tl-other');
    const v = inp?.value.trim();
    if (!v) return;
    if (!st.otherEx.includes(v)) st.otherEx.push(v.slice(0, 40));
    nav.rerender();
    setTimeout(() => document.getElementById('tl-other')?.focus(), 50);
  },
  rmOther: (el) => { st.otherEx.splice(Number(el.dataset.i), 1); nav.rerender(); },
  effort: (el) => { st.effort = st.effort === el.dataset.v ? null : el.dataset.v; nav.rerender(); },
  save: () => {
    const inp = document.getElementById('tl-min');
    if (inp && parseInt(inp.value, 10) > 0) setMinutes(parseInt(inp.value, 10));
    const pending = document.getElementById('tl-other')?.value.trim();
    if (pending && !st.otherEx.includes(pending)) st.otherEx.push(pending.slice(0, 40));
    const name = st.name.trim()
      || (st.type ? typeName(st.type) : '')
      || (st.muscles.length ? st.muscles.map((m) => L(FOCUS[m].name)).join(', ') : '')
      || tr('Own training', 'Egen trening');
    const t = ts();
    const w = saveOwnWorkout({
      id: st.id, date: dayKey(new Date(t)), ts: t, type: st.type, name, minutes: st.minutes,
      muscles: st.muscles, exercises: st.exercises, otherEx: st.otherEx, effort: st.effort, note: st.note.trim(),
    });
    const editing = !!st.id;
    st = null;
    toast(editing ? tr('Saved.', 'Lagret.') : workoutCheer(0, 0), 2600);
    nav.go(w.date === dayKey() ? 'train' : 'train');
  },
  del: async () => {
    const ok = await confirmSheet({ title: tr('Delete this training?', 'Slette denne treningen?'), text: tr('It disappears from your history and trends.', 'Den forsvinner fra historikken og utviklingen.'), yes: tr('Delete', 'Slett') });
    if (!ok) return;
    deleteWorkout(st.id);
    st = null;
    toast(tr('Deleted.', 'Slettet.'));
    nav.go('train');
  },
};
