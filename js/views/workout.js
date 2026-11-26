// Workout runner: one exercise at a time, reps and weight per set, what you did last time,
// rest timer, swap or add exercises on the fly, and a calm summary with refuel ideas at the end.
import { S, mutate } from '../store.js';
import { tr, L, n1, shortDate } from '../i18n.js';
import { icon, toast, confirmSheet, openSheet, closeSheet } from '../ui.js';
import { workoutDef, getEx, exName, groupName, lastLog, progressHint, alternatives, restSeconds, saveWorkout, activityName, newBests, kgFmt, currentPlace, setTodayPlace, resolveList, easierOf, harderOf } from '../training.js';
import { PLACES, PLACE_ORDER } from '../data/exercises.js';
import { workoutCheer } from '../encourage.js';
import { howToSheet, needsLine } from './howto.js';
import { weighted, kgStep } from '../data/exercises.js';
import { esc, parseKey, dayKey } from '../util.js';
import { nav } from '../nav.js';
import { exercisePicker } from './session.js';
import { refuelSheet } from './fuel.js';

let tick = null;
let rest = null; // { until, total }
let countdown = null; // { until, total }
const lastValue = {}; // reps/seconds you last chose per exercise (this session)
const lastKg = {};

// Where the reps stepper starts: what you did last time (within the range), else the middle of the range.
function startValue(exId, item, ex) {
  if (ex?.mode === 'time') return item.reps || ex.def;
  if (item.lo && item.hi) {
    const prev = lastLog(exId)?.sets?.[0]?.r;
    return prev ? Math.max(item.lo, Math.min(item.hi, prev)) : Math.round((item.lo + item.hi) / 2);
  }
  return item.reps || ex?.def || 10;
}

// Minutes for a strength session. If it was left open (phone locked, forgot to finish),
// count about 3 minutes per set instead of the hours since it started.
function setCount(a) {
  return Object.values(a.sets || {}).reduce((n, arr) => n + arr.length, 0);
}
function sessionMinutes(a) {
  const elapsed = (Date.now() - a.started) / 60000;
  return elapsed > 120 ? Math.max(5, Math.min(90, setCount(a) * 3)) : elapsed;
}
function walkElapsed(a) {
  return (a.walkMs || 0) + (a.walkStart ? Date.now() - a.walkStart : 0);
}
function walkMinutes(a) {
  const m = walkElapsed(a) / 60000;
  return m > 300 ? 60 : m;
}
function listOf(a) {
  if (Array.isArray(a.list) && a.list.length) return a.list;
  return workoutDef(a.id)?.ex || [];
}
function buildLog(a) {
  const log = {};
  for (const [exId, reps] of Object.entries(a.sets || {})) {
    if (!reps.length) continue;
    log[exId] = reps.map((r, i) => {
      const kg = a.kg?.[exId]?.[i];
      return kg ? { r, kg } : { r };
    });
  }
  return log;
}

function saveActive(a, quiet = false) {
  if (a.id === 'walk') {
    saveWorkout('walk', Math.max(1, walkMinutes(a)));
    return null;
  }
  const log = buildLog(a);
  const ts = Date.now();
  const bests = newBests(log, ts);
  saveWorkout(a.id, sessionMinutes(a), setCount(a), Object.keys(log).length ? { log } : {});
  return quiet ? null : { minutes: Math.max(1, Math.round(sessionMinutes(a))), sets: setCount(a), bests, exercises: Object.keys(log).length, cheer: workoutCheer(setCount(a), bests.length) };
}

export function enter(ctx) {
  const id = ctx.params[0];
  const light = ctx.params[1] === 'light';
  const def = workoutDef(id);
  if (!def) return;
  const a = S().activeWorkout;
  if (a && a.id !== id) {
    // Starting something else: keep what was already done in the other session.
    if (a.id === 'walk' ? walkElapsed(a) >= 60000 : setCount(a) > 0) {
      saveActive(a, true);
      toast(tr(`Saved your ${activityName(a.id)} first.`, `Lagret ${activityName(a.id)} først.`), 2600);
    }
  }
  if (!a || a.id !== id) {
    rest = null;
    countdown = null;
    mutate((s) => {
      s.activeWorkout = { id, started: Date.now(), ex: 0, list: def.ex.map((e) => ({ ...e, ...(light ? { sets: 1 } : {}) })), sets: {}, kg: {}, walkStart: null, walkMs: 0, light, place: def.place || null };
    });
  }
}

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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

function kgText(kg) {
  return kg ? kgFmt(kg) : tr('body weight', 'kroppsvekt');
}

function lastTimeLine(exId, isTime) {
  const last = lastLog(exId);
  if (!last) return '';
  const reps = last.sets.map((x) => x.r).join(' · ');
  const kgs = last.sets.map((x) => x.kg || 0);
  const top = Math.max(0, ...kgs);
  const when = last.date === dayKey() ? tr('earlier today', 'tidligere i dag') : shortDate(parseKey(last.date));
  return `<p class="small soft">${icon('clock', 14, 'style="vertical-align:-2px"')} ${tr('Last time', 'Sist')} (${when}): <b class="num">${reps}</b> ${isTime ? 's' : tr('reps', 'reps')}${top ? ` · ${tr('up to', 'opptil')} <b class="num">${kgFmt(top)}</b>` : ''}</p>`;
}

function exerciseView(a) {
  const def = workoutDef(a.id);
  const list = listOf(a);
  const idx = Math.min(a.ex, list.length - 1);
  const item = list[idx];
  if (!item) return emptyView(a, def);
  const exId = item.id;
  const ex = getEx(exId) || { name: { en: exId, nb: exId }, groups: [], mode: 'reps', def: 10, cue: { en: '', nb: '' }, equip: ['none'] };
  const sets = a.sets?.[exId] || [];
  const kgs = a.kg?.[exId] || [];
  const isTime = ex.mode === 'time';
  const range = !isTime && item.lo && item.hi ? { lo: item.lo, hi: item.hi } : null;
  const target = { sets: item.sets || 3, reps: item.reps || ex.def, ...(range || {}) };
  const value = lastValue[exId] ?? startValue(exId, item, ex);
  const inList = new Set(list.map((e) => e.id));
  const easier = !inList.has(easierOf(exId)) ? easierOf(exId) : null;
  const harder = !inList.has(harderOf(exId)) ? harderOf(exId) : null;
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name?.en || exId} exercise proper form`)}`;
  const wantsKg = weighted(ex);
  const hint = wantsKg ? progressHint(exId, target) : null;
  const lastTop = Math.max(0, ...(lastLog(exId)?.sets || []).map((x) => x.kg || 0));
  const kg = lastKg[exId] ?? (kgs.length ? kgs[kgs.length - 1] : lastTop || 0);
  const mins = Math.max(1, Math.round((Date.now() - a.started) / 60000));
  const isLast = idx === list.length - 1;
  const mobility = def.kind === 'mobility';
  const goalMet = sets.length >= target.sets;
  return `<div class="screen no-tabs">
    <header class="col" style="gap:12px">
      <div class="row"><button class="icon-btn surface" data-act="leave" aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button>
        <div class="grow" style="min-width:0"><h1 class="h2">${esc(def.name)}</h1><p class="small muted">${tr('Exercise', 'Øvelse')} ${idx + 1} ${tr('of', 'av')} ${list.length} · ${mins} min${a.light ? ` · ${tr('light day', 'lett dag')}` : ''}${def.slots ? ` · <button class="link-btn small" data-act="placePick" style="display:inline;padding:0;min-height:0">${esc(L(PLACES[a.place || currentPlace()]?.name || PLACES.home.name))} ${icon('chevD', 12, 'style="vertical-align:-1px"')}</button>` : ''}</p></div>
        <button class="icon-btn surface" data-act="overview" aria-label="${tr('All exercises', 'Alle øvelser')}">${icon('list', 20)}</button></div>
      <div class="meals-bar">${list.map((e, i) => `<span class="${(a.sets?.[e.id] || []).length >= (e.sets || 1) ? 'done' : i === idx ? 'now' : ''}"></span>`).join('')}</div>
    </header>
    <section class="card">
      <div class="row between top"><div class="grow"><p class="small muted">${esc((ex.groups || []).slice(0, 2).map(groupName).join(' · '))}</p>
        <h2 class="h1" style="font-size:25px">${esc(L(ex.name))}</h2></div>
        ${mobility ? '' : `<button class="btn tiny secondary" data-act="swap">${icon('swap', 15)} ${tr('Swap', 'Bytt')}</button>`}</div>
      ${L(ex.cue) ? `<p class="soft" style="line-height:1.55">${esc(L(ex.cue))}</p>` : ''}
      ${idx === 0 && !sets.length && !mobility ? `<p class="small soft">${icon('dumbbell', 14, 'style="vertical-align:-2px"')} <b>${tr('Today you need', 'I dag trenger du')}:</b> ${esc(needsLine(list.map((e) => e.id)))}</p>` : ''}
      <div class="row wrap" style="gap:8px">
        <button class="btn tiny primary" data-act="how">${icon('book', 14)} ${tr('How to', 'Slik gjør du')}</button>
        <a class="link-btn small" href="${esc(video)}" target="_blank" rel="noopener">${icon('play', 14)} ${tr('Video', 'Video')}</a>
        ${easier && !mobility ? `<button class="btn tiny secondary" data-act="variant" data-id="${easier}">${tr('Easier', 'Lettere')}</button>` : ''}
        ${harder && !mobility ? `<button class="btn tiny secondary" data-act="variant" data-id="${harder}">${tr('Harder', 'Tyngre')}</button>` : ''}</div>
      <div class="row wrap" style="gap:6px"><span class="badge accent">${tr('Goal', 'Mål')}: ${target.sets} × ${range ? `${range.lo}–${range.hi}` : target.reps}${isTime ? ' s' : ''}</span>
        ${item.focus ? `<span class="badge">${tr('Focus', 'Fokus')}</span>` : ''}
        ${wantsKg && lastTop ? `<span class="badge num">${tr('Best', 'Beste')} ${kgFmt(lastTop)}</span>` : ''}</div>
      ${lastTimeLine(exId, isTime)}
      ${range && !sets.length ? `<p class="small soft" style="line-height:1.45">${wantsKg ? tr(`Pick a weight you can lift ${range.lo}–${range.hi} times with good form.`, `Velg en vekt du klarer ${range.lo}–${range.hi} ganger med fin teknikk.`) : tr(`Aim for ${range.lo}–${range.hi}. Fewer is fine while you build up.`, `Sikt på ${range.lo}–${range.hi}. Færre er greit mens du bygger deg opp.`)}</p>` : ''}
      ${hint?.kg ? `<div class="note">${icon('sparkle', 18)}<div class="grow col" style="gap:6px"><span>${tr(`You reached the top of the range on every set last time. Want to try ${kgFmt(hint.kg)}? Only if it feels good.`, `Du nådde toppen av området i alle settene sist. Vil du prøve ${kgFmt(hint.kg)}? Bare hvis det føles bra.`)}</span>
        <button class="btn tiny secondary" style="align-self:flex-start" data-act="useKg" data-kg="${hint.kg}">${tr(`Use ${kgFmt(hint.kg)}`, `Bruk ${kgFmt(hint.kg)}`)}</button></div></div>` : ''}
      ${hint?.harder ? `<div class="note">${icon('sparkle', 18)}<div class="grow col" style="gap:6px"><span>${tr(`You reached the top of the range on every set last time. Ready for ${exName(hint.harder)}?`, `Du nådde toppen av området i alle settene sist. Klar for ${exName(hint.harder)}?`)}</span>
        <button class="btn tiny secondary" style="align-self:flex-start" data-act="variant" data-id="${hint.harder}">${tr('Try it today', 'Prøv i dag')}</button></div></div>` : ''}
      ${hint?.tempo ? `<div class="note">${icon('sparkle', 18)}<span>${tr('You reached the top of the range last time. Make it harder: lower slowly (3 seconds) and pause at the bottom.', 'Du nådde toppen av området sist. Gjør det tyngre: senk sakte (3 sekunder) og ta en pause nederst.')}</span></div>` : ''}
    </section>
    <section class="card" aria-label="${tr('Sets', 'Sett')}">
      <div class="row between"><h2 class="h3">${sets.length ? `${sets.length} ${tr('of', 'av')} ${target.sets} ${tr('sets', 'sett')}` : tr('Log your first set', 'Logg første sett')}</h2>
        <span class="small muted">${tr('Stop 2–3 reps before it gets hard', 'Stopp 2–3 reps før det blir tungt')}</span></div>
      ${sets.length ? `<div class="sets">${sets.map((v, i) => `<div class="set"><span class="n">${i + 1}</span><span class="grow num">${isTime ? `${v} s` : `${v} ${tr('reps', 'reps')}`}${wantsKg ? ` · ${kgText(kgs[i])}` : ''}</span>
        <button class="icon-btn" style="width:34px;height:34px;background:transparent" data-act="unset" data-i="${i}" aria-label="${tr('Remove set', 'Fjern sett')}">${icon('x', 16)}</button></div>`).join('')}</div>` : ''}
      <div class="row between"><span class="small muted">${isTime ? tr('Seconds', 'Sekunder') : tr('Reps', 'Reps')}</span>
        <div class="stepper"><button data-act="val" data-d="${isTime ? -5 : -1}" aria-label="${tr('Less', 'Mindre')}">−</button>
        <span class="v num" style="font-size:20px">${value}</span>
        <button data-act="val" data-d="${isTime ? 5 : 1}" aria-label="${tr('More', 'Mer')}">+</button></div></div>
      ${wantsKg ? `<div class="row between"><span class="small muted">${tr('Weight', 'Vekt')}</span>
        <div class="stepper"><button data-act="kg" data-d="${-kgStep(ex)}" aria-label="${tr('Lighter', 'Lettere')}">−</button>
        <span class="v num kgv" role="button" tabindex="0" data-act="kgType" style="font-size:20px;min-width:80px" aria-label="${tr('Type the weight', 'Skriv inn vekten')}">${kg ? kgFmt(kg) : '– kg'}</span>
        <button data-act="kg" data-d="${kgStep(ex)}" aria-label="${tr('Heavier', 'Tyngre')}">+</button></div></div>` : ''}
      ${isTime ? `<div class="btns"><button class="btn ${goalMet ? 'secondary' : 'primary'}" data-act="countdown">${icon('clock', 18)} ${countdown ? `<span id="cd-v">${mmss(countdown.until - Date.now())}</span>` : `${tr('Start', 'Start')} ${value} s`}</button>
          <button class="btn secondary" data-act="logset">${tr('Log it', 'Logg')}</button></div>`
        : `<button class="btn ${goalMet ? 'secondary' : 'primary'}" data-act="logset">${icon('check', 18)} ${goalMet ? tr('Log an extra set', 'Logg et ekstra sett') : tr('Log set', 'Logg sett')}</button>`}
    </section>
    ${rest ? `<div class="card tight" style="flex-direction:row;align-items:center;gap:12px">
      <div class="timer-ring"><svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="23" fill="none" stroke="var(--surface2)" stroke-width="5"/>
        <circle id="rest-ring" cx="28" cy="28" r="23" fill="none" stroke="var(--accent-line)" stroke-width="5" stroke-linecap="round" stroke-dasharray="144.5" stroke-dashoffset="0"/></svg>
        <span class="v" id="rest-v">${mmss(rest.until - Date.now())}</span></div>
      <div class="grow"><p class="h3">${tr('Rest', 'Pause')}</p><p class="small muted">${tr('Breathe. Sip some water.', 'Pust. Ta en slurk vann.')}</p></div>
      <div class="col" style="gap:6px"><button class="btn tiny secondary" data-act="restPlus">+15 s</button><button class="btn tiny secondary" data-act="skipRest">${tr('Skip', 'Hopp over')}</button></div></div>` : ''}
    ${goalMet && !rest && !isLast ? `<div class="note">${icon('check', 18)}<span>${tr('Goal reached for this one. On to the next when you are ready.', 'Målet er nådd for denne. Videre til neste når du er klar.')}</span></div>` : ''}
    <div class="btns">
      <button class="btn secondary" data-act="prev" ${idx === 0 ? 'disabled' : ''}>${icon('chevL', 18)} ${tr('Back', 'Tilbake')}</button>
      ${isLast ? `<button class="btn primary" data-act="finish">${icon('check', 18)} ${tr('Finish', 'Ferdig')}</button>`
        : `<button class="btn ${goalMet ? 'primary' : 'secondary'}" data-act="next">${tr('Next', 'Neste')} ${icon('chevR', 18)}</button>`}</div>
    <button class="link-btn" style="align-self:center" data-act="finish">${tr('Feeling sick or tired? End here. It still counts.', 'Kvalm eller sliten? Avslutt her. Det teller likevel.')}</button>
  </div>`;
}

function emptyView(a, def) {
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="leave" aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button><h1 class="h2 grow">${esc(def.name)}</h1></header>
    <section class="card"><p class="soft">${tr('This session has no exercises yet.', 'Denne økten har ingen øvelser ennå.')}</p>
      <button class="btn primary" data-act="addEx">${icon('plus', 18)} ${tr('Add an exercise', 'Legg til en øvelse')}</button></section></div>`;
}

export function render(ctx) {
  const a = S().activeWorkout;
  if (!a || !workoutDef(a.id) || a.id !== ctx.params[0]) {
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
        try { navigator.vibrate?.(200); } catch (e) { /* not on iOS */ }
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
  const list = listOf(a);
  const idx = Math.min(a.ex, list.length - 1);
  const item = list[idx];
  return { a, def: workoutDef(a.id), list, idx, item, exId: item?.id, ex: getEx(item?.id) };
}

function logSet() {
  const { exId, ex, item, def } = current();
  if (!exId) return;
  const value = lastValue[exId] ?? startValue(exId, item, ex);
  const kgs = S().activeWorkout.kg?.[exId] || [];
  const lastTop = Math.max(0, ...(lastLog(exId)?.sets || []).map((x) => x.kg || 0));
  const kg = weighted(ex) ? lastKg[exId] ?? (kgs.length ? kgs[kgs.length - 1] : lastTop || 0) : 0;
  mutate((s) => {
    const a = s.activeWorkout;
    (a.sets[exId] ||= []).push(value);
    a.kg ||= {};
    (a.kg[exId] ||= []).push(kg || 0);
  });
  const restSec = def.kind === 'mobility' ? 0 : restSeconds();
  if (restSec) rest = { until: Date.now() + restSec * 1000, total: restSec * 1000 };
  nav.rerender();
}

function finish() {
  const a = S().activeWorkout;
  if (!a) return;
  const summary = saveActive(a);
  mutate((s) => { s.activeWorkout = null; });
  rest = null;
  countdown = null;
  nav.go('train');
  setTimeout(() => refuelSheet(summary), 120);
}

function overviewSheet() {
  const a = S().activeWorkout;
  const list = listOf(a);
  openSheet({
    title: tr('Exercises', 'Øvelser'),
    html: `<div class="list">${list.map((e, i) => {
      const done = (a.sets?.[e.id] || []).length;
      return `<button class="item" data-act="jump" data-i="${i}"><span class="n num" style="width:26px;font-weight:700;color:${i === a.ex ? 'var(--accent)' : 'var(--muted)'}">${i + 1}</span>
        <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(exName(e.id))}</span><span class="s">${e.sets} × ${e.lo && e.hi && getEx(e.id)?.mode !== 'time' ? `${e.lo}–${e.hi}` : e.reps}</span></span>
        <span class="small num ${done >= e.sets ? '' : 'muted'}" style="${done >= e.sets ? 'color:var(--accent);font-weight:700' : ''}">${done}/${e.sets}${done >= e.sets ? ' ✓' : ''}</span></button>`;
    }).join('')}</div>
      <button class="btn outline" data-act="add">${icon('plus', 18)} ${tr('Add an exercise to this workout', 'Legg til en øvelse i økten')}</button>`,
    actions: {
      jump: (el) => {
        const i = Number(el.dataset.i);
        rest = null;
        countdown = null;
        mutate((s) => { s.activeWorkout.ex = i; });
        closeSheet(true);
        nav.rerender();
        nav.scrollTo(0);
      },
      add: () => { closeSheet(true); addExercise(); },
    },
  });
}

function addExercise() {
  exercisePicker({
    title: tr('Add to this workout', 'Legg til i økten'),
    onPick: (id) => {
      const ex = getEx(id);
      mutate((s) => {
        const a = s.activeWorkout;
        a.list = listOf(a).map((e) => ({ ...e }));
        a.list.push({ id, sets: 2, reps: ex?.def || 10 });
        a.ex = a.list.length - 1;
      });
      toast(tr('Added.', 'Lagt til.'));
      nav.rerender();
    },
  });
}

function swapSheet() {
  const { exId, idx } = current();
  const taken = new Set(listOf(S().activeWorkout).map((e) => e.id));
  const alts = alternatives(exId, S().activeWorkout.place || currentPlace()).filter((id) => !taken.has(id)).slice(0, 12);
  openSheet({
    title: tr('Swap for today', 'Bytt for i dag'),
    html: `<p class="small soft">${tr('Same muscles, different exercise. Your plan stays as it is.', 'Samme muskler, annen øvelse. Planen din blir som den er.')}</p>
      ${alts.length ? `<div class="list">${alts.map((id) => `<button class="item" data-act="pick" data-id="${id}"><span class="grow"><span class="t" style="display:block;font-weight:500">${esc(exName(id))}</span>
        <span class="s">${esc(getEx(id).groups.slice(0, 2).map(groupName).join(' · '))}</span></span>${icon('chevR', 16)}</button>`).join('')}</div>`
        : `<p class="small muted">${tr('No other exercises for these muscles with your equipment.', 'Ingen andre øvelser for disse musklene med utstyret ditt.')}</p>`}
      <button class="btn outline" data-act="any">${tr('Pick any exercise', 'Velg en hvilken som helst øvelse')}</button>`,
    actions: {
      pick: (el) => { doSwap(idx, el.dataset.id); closeSheet(); },
      any: () => {
        closeSheet(true);
        exercisePicker({ title: tr('Swap for today', 'Bytt for i dag'), onPick: (id) => doSwap(idx, id) });
      },
    },
  });
}

function doSwap(idx, id) {
  const ex = getEx(id);
  mutate((s) => {
    const a = s.activeWorkout;
    a.list = listOf(a).map((e) => ({ ...e }));
    const old = a.list[idx];
    a.list[idx] = { id, sets: old.sets, reps: ex?.mode === 'time' ? ex.def : old.hi || ex?.def || old.reps, ...(old.lo ? { lo: old.lo, hi: old.hi } : {}), ...(old.focus ? { focus: true } : {}) };
  });
  rest = null;
  countdown = null;
  toast(tr(`Swapped to ${exName(id)}.`, `Byttet til ${exName(id)}.`));
  nav.rerender();
}

export const actions = {
  leave: () => nav.go('train'),
  variant: (el) => { const { idx } = current(); doSwap(idx, el.dataset.id); },
  how: () => { const { exId } = current(); howToSheet(exId); },
  placePick: () => {
    const a = S().activeWorkout;
    const cur = a.place || currentPlace();
    openSheet({
      title: tr('Where are you training?', 'Hvor trener du?'),
      html: `<p class="small soft">${tr('Exercises you have not started change to fit the equipment there.', 'Øvelser du ikke har begynt på, endres så de passer utstyret der.')}</p>
        <div class="col">${PLACE_ORDER.map((p) => `<button class="choice" aria-pressed="${cur === p}" data-act="p" data-v="${p}">${esc(L(PLACES[p].name))}</button>`).join('')}</div>`,
      actions: {
        p: (b) => {
          const place = b.dataset.v;
          setTodayPlace(place);
          mutate((s) => {
            const w = s.activeWorkout;
            // Keep exercises you've already logged sets for; re-pick the rest for this place.
            const marked = listOf(w).map((e) => ((w.sets?.[e.id] || []).length && e.slot ? { ...e, slot: undefined, keepSlot: e.slot } : e));
            w.list = resolveList(marked, place).map(({ keepSlot, ...e }) => (keepSlot ? { ...e, slot: keepSlot } : e));
            w.place = place;
          });
          closeSheet();
          toast(tr('Updated for where you are.', 'Tilpasset der du er.'));
          nav.rerender();
        },
      },
    });
  },
  overview: () => overviewSheet(),
  addEx: () => addExercise(),
  swap: () => swapSheet(),
  val: (el) => {
    const { exId, ex, item } = current();
    const cur = lastValue[exId] ?? startValue(exId, item, ex);
    lastValue[exId] = Math.max(1, Math.min(ex.mode === 'time' ? 600 : 100, cur + Number(el.dataset.d)));
    nav.rerender();
  },
  kg: (el) => {
    const { exId, a } = current();
    const kgs = a.kg?.[exId] || [];
    const lastTop = Math.max(0, ...(lastLog(exId)?.sets || []).map((x) => x.kg || 0));
    const cur = lastKg[exId] ?? (kgs.length ? kgs[kgs.length - 1] : lastTop || 0);
    lastKg[exId] = Math.max(0, Math.min(400, Math.round((cur + Number(el.dataset.d)) * 10) / 10));
    nav.rerender();
  },
  kgType: () => {
    const { exId, ex, a } = current();
    const kgs = a.kg?.[exId] || [];
    const cur = lastKg[exId] ?? (kgs.length ? kgs[kgs.length - 1] : 0);
    openSheet({
      title: tr('Weight', 'Vekt'),
      html: `<div class="field"><label for="kg-in">${esc(exName(exId))} (kg)</label>
        <input id="kg-in" class="input" type="text" inputmode="decimal" autocomplete="off" value="${cur ? String(cur).replace('.', S().prefs.lang === 'nb' ? ',' : '.') : ''}"></div>
        <button class="btn primary" data-act="ok">${tr('Use this weight', 'Bruk denne vekten')}</button>`,
      actions: {
        ok: (b, e, sheet) => {
          const v = parseFloat(String(sheet.querySelector('#kg-in').value).replace(',', '.'));
          if (!(v >= 0 && v <= 400)) { toast(tr('That weight looks off.', 'Den vekten ser feil ut.')); return; }
          lastKg[exId] = Math.round(v * 10) / 10;
          closeSheet();
          nav.rerender();
        },
      },
      onMount: (sheet) => setTimeout(() => sheet.querySelector('#kg-in')?.select(), 250),
    });
  },
  useKg: (el) => {
    const { exId } = current();
    lastKg[exId] = Number(el.dataset.kg);
    nav.rerender();
  },
  logset: () => { countdown = null; logSet(); },
  unset: (el) => {
    const { exId } = current();
    const i = Number(el.dataset.i);
    mutate((s) => {
      s.activeWorkout.sets[exId]?.splice(i, 1);
      s.activeWorkout.kg?.[exId]?.splice(i, 1);
    });
    nav.rerender();
  },
  countdown: () => {
    if (countdown) { countdown = null; nav.rerender(); return; }
    const { exId, ex, item } = current();
    const secs = lastValue[exId] ?? item.reps ?? ex.def;
    rest = null;
    countdown = { until: Date.now() + secs * 1000, total: secs * 1000 };
    nav.rerender();
  },
  skipRest: () => { rest = null; nav.rerender(); },
  restPlus: () => {
    if (rest) { rest.until += 15000; rest.total += 15000; }
    nav.rerender();
  },
  next: () => {
    rest = null;
    countdown = null;
    mutate((s) => { s.activeWorkout.ex = Math.min(listOf(s.activeWorkout).length - 1, s.activeWorkout.ex + 1); });
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
    if (!a) return;
    if (!setCount(a) && a.id !== 'walk') {
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
