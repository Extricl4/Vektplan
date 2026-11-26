// Edit one of your sessions: name, muscle groups, exercises (sets × reps, order), and which days.
// Also home of the exercise picker, used here and in the workout runner.
import { S } from '../store.js';
import { tr, L, dayShort } from '../i18n.js';
import { icon, openSheet, closeSheet, toast, confirmSheet } from '../ui.js';
import { GROUPS, GROUP_ORDER, EQUIP } from '../data/exercises.js';
import {
  sessionById, updateSession, deleteSession, refillSession, setDay, training, getEx, exName, groupName, pickList, addCustomExercise, available, bestSet, resolveList,
} from '../training.js';
import { REPS } from '../data/programs.js';
import { howToSheet } from './howto.js';
import { esc, parseKey, addDays, startOfWeek, dayKey } from '../util.js';
import { nav } from '../nav.js';

const WEEKDAYS = () => Array.from({ length: 7 }, (_, i) => dayShort(parseKey(addDays(startOfWeek(dayKey()), i))));

// ---------- Exercise picker ----------
export function exercisePicker({ title, group = 'all', onPick }) {
  const f = { group, onlyMine: true, q: '' };
  const rows = () => {
    const ids = pickList(f).slice(0, 80);
    if (!ids.length) return `<p class="small muted">${tr('Nothing here. Try "Everything" or make your own exercise.', 'Ingenting her. Prøv «Alt» eller lag din egen øvelse.')}</p>`;
    return `<div class="list">${ids.map((id) => {
      const ex = getEx(id);
      const eq = ex.custom ? tr('Your own', 'Din egen') : ex.equip.map((e) => L(EQUIP[e])).join(' / ');
      return `<button class="item" data-act="pick" data-id="${id}"><span class="grow"><span class="t" style="display:block;font-weight:500">${esc(L(ex.name))}</span>
        <span class="s">${esc(ex.groups.slice(0, 2).map(groupName).join(' · '))} · ${esc(eq)}${!ex.custom && !available(id) ? ` · ${tr('not your equipment', 'ikke ditt utstyr')}` : ''}</span></span>${icon('plus', 18, 'style="color:var(--accent)"')}</button>`;
    }).join('')}</div>`;
  };
  const filters = () => `<div class="chips scroll">${['all', ...GROUP_ORDER].map((g) => `<button class="chip solid" aria-pressed="${f.group === g}" data-act="g" data-g="${g}">${g === 'all' ? tr('All', 'Alle') : esc(groupName(g))}</button>`).join('')}</div>
    <div class="seg" role="tablist"><button aria-pressed="${f.onlyMine}" data-act="mine" data-v="1">${tr('My equipment', 'Mitt utstyr')}</button><button aria-pressed="${!f.onlyMine}" data-act="mine" data-v="0">${tr('Everything', 'Alt')}</button></div>`;
  const refresh = (sheet) => {
    sheet.querySelector('#pk-f').innerHTML = filters();
    sheet.querySelector('#pk-list').innerHTML = rows();
  };
  openSheet({
    title: title || tr('Add an exercise', 'Legg til en øvelse'),
    html: `<div class="search">${icon('search', 18)}<label class="sr-only" for="pk-q">${tr('Search', 'Søk')}</label>
      <input id="pk-q" class="input" type="search" autocomplete="off" placeholder="${tr('Search exercises', 'Søk i øvelser')}" data-input="q"></div>
      <div id="pk-f" class="col" style="gap:10px">${filters()}</div>
      <div id="pk-list">${rows()}</div>
      <button class="btn outline" data-act="own">${icon('pencil', 18)} ${tr('Make your own exercise', 'Lag din egen øvelse')}</button>`,
    actions: {
      q: (el, e, sheet) => { f.q = el.value; sheet.querySelector('#pk-list').innerHTML = rows(); },
      g: (el, e, sheet) => { f.group = el.dataset.g; refresh(sheet); },
      mine: (el, e, sheet) => { f.onlyMine = el.dataset.v === '1'; refresh(sheet); },
      pick: (el) => { closeSheet(); onPick(el.dataset.id); },
      own: () => customExerciseSheet((id) => onPick(id), f.group !== 'all' ? f.group : 'chest'),
    },
  });
}

function customExerciseSheet(onDone, group = 'chest') {
  const d = { name: '', group, equip: training().place === 'gym' ? 'machine' : training().place === 'dumbbells' ? 'dumbbell' : 'none', mode: 'reps' };
  const draw = () => `<div class="field"><label for="cx-name">${tr('Name', 'Navn')}</label>
      <input id="cx-name" class="input" type="text" maxlength="60" autocomplete="off" value="${esc(d.name)}" placeholder="${tr('For example: Pec deck', 'For eksempel: Pec deck')}"></div>
    <div class="field"><span class="label">${tr('Main muscle group', 'Hovedmuskelgruppe')}</span>
      <div class="chips">${GROUP_ORDER.filter((g) => g !== 'mobility').map((g) => `<button class="chip solid" aria-pressed="${d.group === g}" data-act="grp" data-g="${g}">${esc(groupName(g))}</button>`).join('')}</div></div>
    <div class="field"><span class="label">${tr('Equipment', 'Utstyr')}</span>
      <div class="chips">${Object.keys(EQUIP).map((e) => `<button class="chip solid" aria-pressed="${d.equip === e}" data-act="eq" data-e="${e}">${esc(L(EQUIP[e]))}</button>`).join('')}</div></div>
    <div class="seg"><button aria-pressed="${d.mode === 'reps'}" data-act="mode" data-v="reps">${tr('Reps', 'Reps')}</button><button aria-pressed="${d.mode === 'time'}" data-act="mode" data-v="time">${tr('Seconds', 'Sekunder')}</button></div>
    <button class="btn primary" data-act="save">${icon('check', 18)} ${tr('Save exercise', 'Lagre øvelsen')}</button>`;
  const redraw = (sheet) => { d.name = sheet.querySelector('#cx-name').value; sheet.querySelector('.col').innerHTML = draw(); };
  openSheet({
    title: tr('Your own exercise', 'Din egen øvelse'),
    html: draw(),
    actions: {
      grp: (el, e, sheet) => { d.group = el.dataset.g; redraw(sheet); },
      eq: (el, e, sheet) => { d.equip = el.dataset.e; redraw(sheet); },
      mode: (el, e, sheet) => { d.mode = el.dataset.v; redraw(sheet); },
      save: (el, e, sheet) => {
        d.name = sheet.querySelector('#cx-name').value.trim();
        if (!d.name) { toast(tr('Give it a name first.', 'Gi den et navn først.')); return; }
        const id = addCustomExercise({ name: d.name, group: d.group, equip: d.equip, mode: d.mode, def: d.mode === 'time' ? 30 : 10 });
        closeSheet();
        toast(tr('Exercise saved.', 'Øvelsen er lagret.'));
        onDone(id);
      },
    },
  });
}

// Sets × reps for one exercise in a session.
function setsRepsSheet(sid, i) {
  const s = sessionById(sid);
  const item = s?.ex[i];
  if (!item) return;
  const ex = getEx(item.id);
  const isTime = ex?.mode === 'time';
  const ranged = !isTime && item.lo && item.hi;
  const v = { sets: item.sets || 3, reps: ranged ? item.hi : item.reps || ex?.def || 10 };
  const draw = () => `<div class="row between"><span class="h3">${tr('Sets', 'Sett')}</span>
      <div class="stepper"><button data-act="d" data-k="sets" data-d="-1" aria-label="${tr('Fewer', 'Færre')}">−</button><span class="v num">${v.sets}</span><button data-act="d" data-k="sets" data-d="1" aria-label="${tr('More', 'Flere')}">+</button></div></div>
    <div class="row between"><span class="h3">${isTime ? tr('Seconds', 'Sekunder') : tr('Reps', 'Reps')}</span>
      <div class="stepper"><button data-act="d" data-k="reps" data-d="${isTime ? -5 : -1}" aria-label="${tr('Fewer', 'Færre')}">−</button><span class="v num">${ranged ? `${Math.max(1, v.reps - (item.hi - item.lo))}–${v.reps}` : v.reps}</span><button data-act="d" data-k="reps" data-d="${isTime ? 5 : 1}" aria-label="${tr('More', 'Flere')}">+</button></div></div>
    <p class="tiny muted">${tr('For muscle: 8–12 reps where the last two feel hard but clean. 2 sets is plenty while you are eating little.', 'For muskler: 8–12 reps der de to siste føles tunge men fine. 2 sett holder mens du spiser lite.')}</p>
    <button class="btn primary" data-act="ok">${tr('Done', 'Ferdig')}</button>`;
  openSheet({
    title: esc(exName(item.id)),
    html: draw(),
    actions: {
      d: (el, e, sheet) => {
        const k = el.dataset.k;
        v[k] = Math.max(1, Math.min(k === 'sets' ? 8 : isTime ? 600 : 50, v[k] + Number(el.dataset.d)));
        sheet.querySelector('.col').innerHTML = draw();
      },
      ok: () => {
        updateSession(sid, (x) => {
          const it = x.ex[i];
          it.sets = v.sets;
          it.reps = v.reps;
          if (ranged) { it.lo = Math.max(1, v.reps - (item.hi - item.lo)); it.hi = v.reps; }
        });
        closeSheet();
        nav.rerender();
      },
    },
  });
}

// ---------- Screen ----------
let sid = null;
export function enter(ctx) {
  sid = ctx.params[0];
}

export function render() {
  const s = sessionById(sid);
  if (!s) {
    return `<div class="screen no-tabs"><p>${tr('That session is gone.', 'Den økten finnes ikke lenger.')}</p><a class="btn primary" href="#/train">${tr('Back to training', 'Til trening')}</a></div>`;
  }
  const t = training();
  const days = WEEKDAYS();
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <div class="titles grow"><p class="eyebrow">${tr('Edit session', 'Endre økt')}</p><h1 class="h1" style="font-size:26px">${esc(s.name)}</h1></div></header>

    <section class="card">
      <div class="field"><label for="se-name">${tr('Name', 'Navn')}</label>
        <input id="se-name" class="input" type="text" maxlength="40" value="${esc(s.name)}" data-change="name"></div>
      <div class="field"><span class="label">${tr('Muscle groups', 'Muskelgrupper')}</span>
        <div class="chips">${GROUP_ORDER.filter((g) => g !== 'mobility').map((g) => `<button class="chip solid" aria-pressed="${s.groups.includes(g)}" data-act="grp" data-g="${g}">${esc(groupName(g))}</button>`).join('')}</div></div>
      <button class="btn secondary small" data-act="refill">${icon('refresh', 16)} ${tr('Fill with exercises for these groups', 'Fyll med øvelser for disse gruppene')}</button>
    </section>

    <section class="card" aria-label="${tr('Exercises', 'Øvelser')}">
      <div class="row between"><h2 class="h3">${tr('Exercises', 'Øvelser')}</h2><span class="small muted">${s.ex.length}</span></div>
      ${s.ex.length ? `<div class="exlist">${s.ex.map((e0, i) => {
        const shown = resolveList(s.ex, training().place || 'home');
        const e = shown.length === s.ex.length ? shown[i] : e0;
        const ex = getEx(e.id);
        const best = bestSet(e.id);
        return `<div class="exrow"><span class="n">${i + 1}</span>
          <div class="grow" style="min-width:0"><button class="howrow" data-act="how" data-id="${esc(e.id)}"><span style="font-weight:600;line-height:1.3">${esc(exName(e.id))}</span><span class="q" aria-hidden="true">?</span></button>
            <p class="tiny muted">${esc((ex?.groups || []).slice(0, 2).map(groupName).join(' · '))}${best ? ` · ${tr('best', 'beste')} ${best.kg} kg` : ''}</p></div>
          <button class="btn tiny secondary num" data-act="sr" data-i="${i}">${e.sets} × ${e.lo && e.hi && ex?.mode !== 'time' ? `${e.lo}–${e.hi}` : e.reps}${ex?.mode === 'time' ? 's' : ''}</button>
          <div class="col" style="gap:2px"><button class="mini" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${tr('Move up', 'Flytt opp')}">${icon('chevL', 14, 'style="transform:rotate(90deg)"')}</button>
            <button class="mini" data-act="down" data-i="${i}" ${i === s.ex.length - 1 ? 'disabled' : ''} aria-label="${tr('Move down', 'Flytt ned')}">${icon('chevD', 14)}</button></div>
          <button class="mini" data-act="rm" data-i="${i}" aria-label="${tr('Remove', 'Fjern')}">${icon('x', 15)}</button></div>`;
      }).join('')}</div>` : `<p class="small muted">${tr('No exercises yet.', 'Ingen øvelser ennå.')}</p>`}
      <button class="btn outline" data-act="add">${icon('plus', 18)} ${tr('Add an exercise', 'Legg til en øvelse')}</button>
    </section>

    <section class="card">
      <h2 class="h3">${tr('Which days?', 'Hvilke dager?')}</h2>
      <div class="daypick">${days.map((d, i) => {
        const on = t.schedule?.[i] === s.id;
        const other = !on && t.schedule?.[i] ? sessionById(t.schedule[i]) : null;
        return `<button class="dp" aria-pressed="${on}" data-act="day" data-d="${i}" title="${other ? esc(other.name) : ''}"><span>${esc(d)}</span>${other ? '<i></i>' : ''}</button>`;
      }).join('')}</div>
      <p class="tiny muted">${tr('A dot means another session is on that day. Tapping it puts this one there instead.', 'En prikk betyr at en annen økt ligger på den dagen. Trykker du, flyttes denne dit i stedet.')}</p>
    </section>

    <a class="btn primary" href="#/workout/${s.id}">${icon('play', 18)} ${tr('Start this session', 'Start denne økten')}</a>
    <button class="link-btn" style="color:var(--red);align-self:center" data-act="del">${tr('Delete this session', 'Slett denne økten')}</button>
  </div>`;
}

export const actions = {
  how: (el) => howToSheet(el.dataset.id),
  back: () => nav.back('train'),
  name: (el) => {
    const v = el.value.trim();
    if (v) updateSession(sid, (x) => { x.name = v.slice(0, 40); });
    nav.rerender();
  },
  grp: (el) => {
    const g = el.dataset.g;
    updateSession(sid, (x) => { x.groups = x.groups.includes(g) ? x.groups.filter((q) => q !== g) : [...x.groups, g]; });
    nav.rerender();
  },
  refill: async () => {
    const s = sessionById(sid);
    if (!s.groups.length) { toast(tr('Pick at least one muscle group.', 'Velg minst én muskelgruppe.')); return; }
    if (s.ex.length) {
      const ok = await confirmSheet({
        title: tr('Replace the exercises?', 'Bytte ut øvelsene?'),
        text: tr('The list is filled again from the muscle groups you picked. Your history stays.', 'Lista fylles på nytt fra muskelgruppene du valgte. Historikken din blir værende.'),
        yes: tr('Replace', 'Bytt ut'),
      });
      if (!ok) return;
    }
    refillSession(sid);
    toast(tr('New exercises in.', 'Nye øvelser er lagt inn.'));
    nav.rerender();
  },
  sr: (el) => setsRepsSheet(sid, Number(el.dataset.i)),
  up: (el) => {
    const i = Number(el.dataset.i);
    updateSession(sid, (x) => { if (i > 0) [x.ex[i - 1], x.ex[i]] = [x.ex[i], x.ex[i - 1]]; });
    nav.rerender();
  },
  down: (el) => {
    const i = Number(el.dataset.i);
    updateSession(sid, (x) => { if (i < x.ex.length - 1) [x.ex[i + 1], x.ex[i]] = [x.ex[i], x.ex[i + 1]]; });
    nav.rerender();
  },
  rm: (el) => {
    const i = Number(el.dataset.i);
    updateSession(sid, (x) => { x.ex.splice(i, 1); });
    nav.rerender();
  },
  add: () => {
    const s = sessionById(sid);
    exercisePicker({
      group: s.groups[0] || 'all',
      onPick: (id) => {
        const ex = getEx(id);
        const t = training();
        const r = REPS[t.program?.reps] || null;
        updateSession(sid, (x) => { x.ex.push({ id, sets: t.level === 'normal' ? 3 : 2, reps: r && ex?.mode !== 'time' ? r.hi : ex?.def || 10, ...(r ? { lo: r.lo, hi: r.hi } : {}) }); });
        toast(tr(`${exName(id)} added.`, `${exName(id)} er lagt til.`));
        nav.rerender();
      },
    });
  },
  day: (el) => {
    const d = Number(el.dataset.d);
    const on = training().schedule?.[d] === sid;
    setDay(d, on ? null : sid);
    nav.rerender();
  },
  del: async () => {
    const ok = await confirmSheet({
      title: tr('Delete this session?', 'Slette denne økten?'),
      text: tr('It disappears from your plan. Workouts you already did stay in your history.', 'Den forsvinner fra planen. Økter du allerede har gjort blir liggende i historikken.'),
      yes: tr('Delete', 'Slett'),
      danger: true,
    });
    if (!ok) return;
    deleteSession(sid);
    toast(tr('Session deleted.', 'Økten er slettet.'));
    nav.go('train');
  },
};
