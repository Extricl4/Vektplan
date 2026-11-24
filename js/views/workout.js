import { S, mutate } from '../store.js';
import { WORKOUTS, EXERCISES } from '../data/workouts.js';
import { tr, L } from '../i18n.js';
import { icon, toast, confirmSheet } from '../ui.js';
import { saveWorkout, activityName } from './train.js';
import { esc, pad } from '../util.js';
import { nav } from '../nav.js';

let tick = null;
let rest = null; // { until, total }
let countdown = null; // { until, total }
const lastValue = {};

// Minutes for a strength session. If it was left open (phone locked, forgot to finish),
// count about 3 minutes per set instead of the hours since it started.
function sessionMinutes(a) {
  const sets = Object.values(a.sets).reduce((n, arr) => n + arr.length, 0);
  const elapsed = (Date.now() - a.started) / 60000;
  return elapsed > 120 ? Math.max(5, Math.min(90, sets * 3)) : elapsed;
}

function walkMinutes(a) {
  const m = walkElapsed(a) / 60000;
  return m > 300 ? 60 : m;
}

export function enter(ctx) {
  const id = ctx.params[0];
  if (!WORKOUTS[id]) return;
  const a = S().activeWorkout;
  if (a && a.id !== id) {
    // Starting something else: keep what was already done in the other session.
    const sets = Object.values(a.sets || {}).reduce((n, arr) => n + arr.length, 0);
    if (a.id === 'walk' ? walkElapsed(a) >= 60000 : sets > 0) {
      if (a.id === 'walk') saveWorkout('walk', Math.max(1, walkMinutes(a)));
      else saveWorkout(a.id, sessionMinutes(a), sets);
      toast(tr(`Saved your ${activityName(a.id)} first.`, `Lagret ${activityName(a.id)} først.`), 2600);
    }
  }
  if (!a || a.id !== id) {
    mutate((s) => { s.activeWorkout = { id, started: Date.now(), ex: 0, sets: {}, walkStart: null, walkMs: 0 }; });
  }
  rest = null;
  countdown = null;
}

function mmss(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

function walkElapsed(a) {
  return a.walkMs + (a.walkStart ? Date.now() - a.walkStart : 0);
}

function walkView(a) {
  const running = !!a.walkStart;
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="leave" aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button>
      <div class="grow"><h1 class="h2">${tr('Walk', 'Gåtur')}</h1><p class="small muted">${tr('Easy pace. Fresh air helps the stomach too.', 'Rolig tempo. Frisk luft hjelper magen også.')}</p></div></header>
    <section class="card" style="align-items:center;padding:34px 18px;gap:18px">
      <div class="ex-visual" style="width:100%">${icon('walk', 56)}</div>
      <p id="walk-time" class="num" style="font-size:56px;font-weight:700;letter-spacing:-0.03em">${mmss(walkElapsed(a))}</p>
      <div class="btns" style="width:100%">
        <button class="btn ${running ? 'secondary' : 'primary'}" data-act="walkToggle">${icon(running ? 'pause' : 'play', 18)} ${running ? tr('Pause', 'Pause') : walkElapsed(a) ? tr('Continue', 'Fortsett') : tr('Start', 'Start')}</button>
        <button class="btn secondary" data-act="walkDone" ${!running && walkElapsed(a) < 1000 ? 'disabled' : ''}>${icon('check', 18)} ${tr('Finish', 'Ferdig')}</button></div>
    </section>
    <p class="small muted center">${tr('The timer keeps going if you lock your phone.', 'Tiden går videre selv om du låser telefonen.')}</p>
  </div>`;
}

function exerciseView(a) {
  const w = WORKOUTS[a.id];
  const exId = w.ex[a.ex];
  const ex = EXERCISES[exId];
  const sets = a.sets[exId] || [];
  const isTime = ex.mode === 'time';
  const value = lastValue[exId] ?? ex.def;
  const mins = Math.max(1, Math.round((Date.now() - a.started) / 60000));
  const last = a.ex === w.ex.length - 1;
  const restSec = w.kind === 'mobility' ? 0 : S().prefs.restSec || 60;
  return `<div class="screen no-tabs">
    <header class="col" style="gap:12px">
      <div class="row"><button class="icon-btn surface" data-act="leave" aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button>
        <div class="grow"><h1 class="h2">${esc(L(w.name))}</h1><p class="small muted">${tr('Exercise', 'Øvelse')} ${a.ex + 1} ${tr('of', 'av')} ${w.ex.length} · ${mins} min</p></div></div>
      <div class="meals-bar">${w.ex.map((id, i) => `<span class="${i < a.ex || (a.sets[id] || []).length ? 'done' : i === a.ex ? 'now' : ''}"></span>`).join('')}</div>
    </header>
    <section class="card">
      <div class="ex-visual">${icon(w.kind === 'mobility' ? 'stretch' : 'dumbbell', 52)}</div>
      <div><p class="small muted">${esc(L(ex.area))}</p><h2 class="h1" style="font-size:25px">${esc(L(ex.name))}</h2></div>
      <p class="soft" style="line-height:1.55">${esc(L(ex.cue))}</p>
    </section>
    <section class="card" aria-label="${tr('Sets', 'Sett')}">
      <div class="row between"><h2 class="h3">${sets.length ? `${sets.length} ${sets.length === 1 ? tr('set done', 'sett gjort') : tr('sets done', 'sett gjort')}` : tr('Log your first set', 'Logg første sett')}</h2>
        <span class="small muted">${tr('Easy pace, 2–3 sets', 'Rolig tempo, 2–3 sett')}</span></div>
      ${sets.length ? `<div class="sets">${sets.map((v, i) => `<div class="set"><span class="n">${i + 1}</span><span class="grow">${isTime ? `${v} s` : `${v} ${tr('reps', 'reps')}`}</span>
        <button class="icon-btn" style="width:34px;height:34px;background:transparent" data-act="unset" data-i="${i}" aria-label="${tr('Remove set', 'Fjern sett')}">${icon('x', 16)}</button></div>`).join('')}</div>` : ''}
      <div class="row between"><span class="small muted">${isTime ? tr('Seconds', 'Sekunder') : tr('Reps you did', 'Antall du tok')}</span>
        <div class="stepper"><button data-act="val" data-d="${isTime ? -5 : -1}" aria-label="${tr('Less', 'Mindre')}">−</button>
        <span class="v num" style="font-size:20px">${value}</span>
        <button data-act="val" data-d="${isTime ? 5 : 1}" aria-label="${tr('More', 'Mer')}">+</button></div></div>
      ${isTime ? `<div class="btns"><button class="btn primary" data-act="countdown">${icon('clock', 18)} ${countdown ? `<span id="cd-v">${mmss(countdown.until - Date.now())}</span>` : `${tr('Start', 'Start')} ${value} s`}</button>
          <button class="btn secondary" data-act="logset">${tr('Log it', 'Logg')}</button></div>`
        : `<button class="btn primary" data-act="logset">${icon('check', 18)} ${tr('Log set', 'Logg sett')}</button>`}
    </section>
    ${rest ? `<div class="card tight" style="flex-direction:row;align-items:center;gap:12px">
      <div class="timer-ring"><svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="23" fill="none" stroke="var(--surface2)" stroke-width="5"/>
        <circle id="rest-ring" cx="28" cy="28" r="23" fill="none" stroke="var(--accent-line)" stroke-width="5" stroke-linecap="round" stroke-dasharray="144.5" stroke-dashoffset="0"/></svg>
        <span class="v" id="rest-v">${mmss(rest.until - Date.now())}</span></div>
      <div class="grow"><p class="h3">${tr('Rest', 'Pause')}</p><p class="small muted">${tr('Breathe. Sip some water.', 'Pust. Ta en slurk vann.')}</p></div>
      <button class="btn tiny secondary" data-act="skipRest">${tr('Skip', 'Hopp over')}</button></div>` : ''}
    <div class="btns">
      <button class="btn secondary" data-act="prev" ${a.ex === 0 ? 'disabled' : ''}>${icon('chevL', 18)} ${tr('Back', 'Tilbake')}</button>
      ${last ? `<button class="btn primary" data-act="finish">${icon('check', 18)} ${tr('Finish', 'Ferdig')}</button>`
        : `<button class="btn primary" data-act="next">${tr('Next', 'Neste')} ${icon('chevR', 18)}</button>`}</div>
    <button class="link-btn" style="align-self:center" data-act="finish">${tr('Feeling sick? End here. It still counts.', 'Kvalm? Avslutt her. Det teller likevel.')}</button>
    <input type="hidden" id="rest-sec" value="${restSec}">
  </div>`;
}

export function render(ctx) {
  const a = S().activeWorkout;
  if (!a || !WORKOUTS[a.id] || a.id !== ctx.params[0]) {
    return `<div class="screen no-tabs"><p>${tr('No workout running.', 'Ingen økt pågår.')}</p><a class="btn primary" href="#/train">${tr('Back to training', 'Til trening')}</a></div>`;
  }
  return a.id === 'walk' ? walkView(a) : exerciseView(a);
}

function startTick() {
  clearInterval(tick);
  tick = setInterval(() => {
    const a = S().activeWorkout;
    if (!a) return;
    if (a.id === 'walk') {
      const el = document.getElementById('walk-time');
      if (el) el.textContent = mmss(walkElapsed(a));
      return;
    }
    if (rest) {
      const left = rest.until - Date.now();
      const el = document.getElementById('rest-v');
      const ringEl = document.getElementById('rest-ring');
      if (el) el.textContent = mmss(left);
      if (ringEl) ringEl.setAttribute('stroke-dashoffset', String(144.5 * (1 - Math.max(0, left) / rest.total)));
      if (left <= 0) {
        rest = null;
        toast(tr('Rest done. Next set when you are ready.', 'Pausen er over. Neste sett når du er klar.'));
        nav.rerender();
      }
    }
    if (countdown) {
      const left = countdown.until - Date.now();
      const el = document.getElementById('cd-v');
      if (el) el.textContent = mmss(left);
      if (left <= 0) {
        countdown = null;
        logSet();
        toast(tr('Time! Set logged.', 'Tiden er ute! Sett logget.'));
      }
    }
  }, 250);
}

export function mount() {
  startTick();
}

export function unmount() {
  clearInterval(tick);
}

function current() {
  const a = S().activeWorkout;
  const w = WORKOUTS[a.id];
  return { a, w, exId: w.ex[a.ex], ex: EXERCISES[w.ex[a.ex]] };
}

function logSet() {
  const { exId, ex, w } = current();
  const value = lastValue[exId] ?? ex.def;
  mutate((s) => {
    const sets = (s.activeWorkout.sets[exId] ||= []);
    sets.push(value);
  });
  const restSec = w.kind === 'mobility' ? 0 : S().prefs.restSec || 60;
  if (restSec) rest = { until: Date.now() + restSec * 1000, total: restSec * 1000 };
  nav.rerender();
}

function finish() {
  const a = S().activeWorkout;
  if (!a) return;
  if (a.id === 'walk') {
    saveWorkout('walk', Math.max(1, walkMinutes(a)));
  } else {
    const sets = Object.values(a.sets).reduce((n, arr) => n + arr.length, 0);
    saveWorkout(a.id, sessionMinutes(a), sets);
  }
  mutate((s) => { s.activeWorkout = null; });
  rest = null;
  countdown = null;
  const name = S().profile.name ? `, ${S().profile.name}` : '';
  toast(tr(`Saved. Well done${name}! Have a snack soon.`, `Lagret. Bra jobba${name}! Spis litt snart.`), 3200);
  nav.go('train');
}

export const actions = {
  leave: () => nav.go('train'),
  val: (el) => {
    const { exId, ex } = current();
    const cur = lastValue[exId] ?? ex.def;
    lastValue[exId] = Math.max(1, Math.min(ex.mode === 'time' ? 600 : 100, cur + Number(el.dataset.d)));
    nav.rerender();
  },
  logset: () => { countdown = null; logSet(); },
  unset: (el) => {
    const { exId } = current();
    mutate((s) => { s.activeWorkout.sets[exId]?.splice(Number(el.dataset.i), 1); });
    nav.rerender();
  },
  countdown: () => {
    if (countdown) { countdown = null; nav.rerender(); return; }
    const { exId, ex } = current();
    const secs = lastValue[exId] ?? ex.def;
    rest = null;
    countdown = { until: Date.now() + secs * 1000, total: secs * 1000 };
    nav.rerender();
  },
  skipRest: () => { rest = null; nav.rerender(); },
  next: () => {
    rest = null;
    countdown = null;
    mutate((s) => { s.activeWorkout.ex = Math.min(WORKOUTS[s.activeWorkout.id].ex.length - 1, s.activeWorkout.ex + 1); });
    nav.rerender();
    nav.scrollTo(0);
  },
  prev: () => {
    rest = null;
    countdown = null;
    mutate((s) => { s.activeWorkout.ex = Math.max(0, s.activeWorkout.ex - 1); });
    nav.rerender();
  },
  finish: async () => {
    const a = S().activeWorkout;
    const total = Object.values(a.sets).reduce((n, arr) => n + arr.length, 0);
    if (!total && a.id !== 'walk') {
      const ok = await confirmSheet({
        title: tr('End the workout?', 'Avslutte økten?'),
        text: tr('No sets are logged yet. Save it anyway as a short session?', 'Ingen sett er logget ennå. Lagre likevel som en kort økt?'),
        yes: tr('Save it', 'Lagre'),
        no: tr('Keep going', 'Fortsett'),
      });
      if (!ok) return;
    }
    finish();
  },
  walkToggle: () => {
    mutate((s) => {
      const a = s.activeWorkout;
      if (a.walkStart) { a.walkMs += Date.now() - a.walkStart; a.walkStart = null; }
      else a.walkStart = Date.now();
    });
    nav.rerender();
  },
  walkDone: () => finish(),
};

export { activityName };
