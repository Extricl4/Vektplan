import { S, mutate } from '../store.js';
import { plannedActivity, workoutsOn, programWeek, weekSummary } from '../planner.js';
import { WORKOUTS, EXERCISES, OTHER_ACTIVITIES } from '../data/workouts.js';
import { tr, L, dayShort, shortDate, n0 } from '../i18n.js';
import { icon, tabbar, openSheet, closeSheet, toast } from '../ui.js';
import { esc, dayKey, addDays, startOfWeek, parseKey, uid } from '../util.js';
import { nav } from '../nav.js';
import { hasHealth, healthDay, fmtSleep, syncedToday } from '../health.js';
import { syncHealth } from './health.js';

const ACT_ICON = { strengthA: 'dumbbell', strengthB: 'dumbbell', stretch: 'stretch', walk: 'walk', rest: 'bed' };

export function activityName(id) {
  if (id === 'rest') return tr('Rest day', 'Hviledag');
  const w = WORKOUTS[id];
  if (w) return L(w.name);
  const o = OTHER_ACTIVITIES.find((a) => a.id === id);
  return o ? L(o.name) : id;
}

function weekStrip() {
  const start = startOfWeek(dayKey());
  const today = dayKey();
  return `<section class="card tight" style="padding:14px 10px" aria-label="${tr('This week', 'Denne uka')}">
    <div class="week">${Array.from({ length: 7 }, (_, i) => {
      const k = addDays(start, i);
      const act = plannedActivity(k);
      const done = workoutsOn(k).length > 0;
      const letter = act === 'strengthA' ? 'A' : act === 'strengthB' ? 'B' : '';
      const ic = letter ? `<b style="font-size:14px">${letter}</b>` : act === 'rest' ? '–' : icon(ACT_ICON[act], 16);
      return `<div class="col" style="align-items:center;gap:6px">
        <span class="tiny ${k === today ? '' : 'muted'}" style="font-weight:${k === today ? 700 : 500};color:${k === today ? 'var(--accent)' : ''}">${dayShort(parseKey(k))}</span>
        <span style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          ${done ? 'background:var(--accent-fill);color:var(--accent-ink)' : k === today ? 'border:2px solid var(--accent-line);color:var(--ink)' : act === 'rest' ? 'background:var(--surface2);color:var(--muted)' : 'border:2px solid var(--line);color:var(--soft)'}">
          ${done ? icon('check', 16, 'stroke-width="3"') : ic}</span>
        <span class="tiny muted" style="font-size:10px">${act === 'rest' ? tr('Rest', 'Hvile') : act === 'walk' ? tr('Walk', 'Gå') : act === 'stretch' ? tr('Stretch', 'Tøy') : tr('Strength', 'Styrke')}</span></div>`;
    }).join('')}</div></section>`;
}

function todayCard() {
  const key = dayKey();
  const act = plannedActivity(key);
  const done = workoutsOn(key);
  if (done.length) {
    return `<section class="card soft"><div class="row">${icon('check', 22)}<p class="h3">${tr('Training done today', 'Trening gjort i dag')}: ${esc(done.map((w) => activityName(w.wid)).join(', '))}</p></div>
      <p class="small soft">${tr('Great work. Now refuel: a snack within an hour or two helps your muscles grow.', 'Godt jobba. Nå trenger kroppen påfyll: et mellommåltid innen en time eller to hjelper musklene å vokse.')}</p></section>`;
  }
  if (act === 'rest') {
    return `<section class="card"><span class="badge accent" style="align-self:flex-start">${tr('Today', 'I dag')}</span>
      <h2 class="h1" style="font-size:24px">${tr('Rest day', 'Hviledag')}</h2>
      <p class="small soft">${tr('Muscles grow while you rest and eat. A short walk is a nice bonus if you feel like it.', 'Muskler vokser mens du hviler og spiser. En kort gåtur er en fin bonus hvis du har lyst.')}</p>
      <a class="btn secondary" href="#/workout/walk">${icon('walk', 18)} ${tr('Go for a walk', 'Gå en tur')}</a></section>`;
  }
  const w = WORKOUTS[act];
  return `<section class="card" aria-label="${tr("Today's workout", 'Dagens økt')}">
    <div class="row between"><span class="badge accent">${tr('Today', 'I dag')}</span><span class="icon-btn" style="background:var(--accent-soft);color:var(--accent)">${icon(ACT_ICON[act])}</span></div>
    <div><h2 class="h1" style="font-size:24px">${esc(L(w.name))}</h2><p class="small muted">${esc(L(w.sub))} · ${tr('about', 'ca.')} ${w.minutes} min</p></div>
    ${w.ex.length ? `<div class="list">${w.ex.map((id) => `<div class="item" style="justify-content:space-between"><span>${esc(L(EXERCISES[id].name))}</span><span class="small muted">${esc(L(EXERCISES[id].area))}</span></div>`).join('')}</div>` : ''}
    <div class="btns"><a class="btn primary" href="#/workout/${act}">${icon('play', 18)} ${tr('Start', 'Start')}</a>
      ${act !== 'walk' ? `<a class="btn secondary" href="#/workout/walk">${tr('Walk instead', 'Gå i stedet')}</a>` : `<button class="btn secondary" data-act="quickWalk">${tr('Log a walk', 'Logg en gåtur')}</button>`}</div>
    <p class="small muted" style="line-height:1.5">${tr('Stomach rough today? A walk or a stretch still counts toward your week.', 'Dårlig mage i dag? En gåtur eller litt tøying teller også.')}</p>
  </section>`;
}

// What the Apple Watch saw today, or a gentle way in if it isn't connected yet.
function watchCard() {
  if (!hasHealth()) {
    return `<a class="card tight link" href="#/health" style="flex-direction:row;align-items:center;gap:12px">
      <span class="icon-btn" style="background:var(--accent-soft);color:var(--accent)">${icon('watch', 20)}</span>
      <span class="grow"><span style="display:block;font-weight:600">${tr('Connect your Apple Watch', 'Koble til Apple Watch')}</span>
      <span class="small muted">${tr('See exercise minutes, active calories, steps and sleep here', 'Se treningsminutter, aktive kalorier, skritt og søvn her')}</span></span>${icon('chevR', 18)}</a>`;
  }
  const calm = S().prefs.calm;
  const key = dayKey();
  const h = healthDay(key) || {};
  const act = plannedActivity(key);
  const tired = h.sleepMin != null && h.sleepMin < 360 && !h.sleepGuess && /^strength/.test(act) && !workoutsOn(key).length;
  const bits = [
    h.exerciseMin != null ? `<b class="num">${h.exerciseMin}</b> ${tr('exercise min', 'treningsmin')}` : '',
    !calm && h.activeKcal != null ? `<b class="num">${n0(h.activeKcal)}</b> kcal` : '',
    h.steps != null ? `<b class="num">${n0(h.steps)}</b> ${tr('steps', 'skritt')}` : '',
  ].filter(Boolean);
  return `<section class="card tight">
    <div class="row between"><h2 class="h3 row" style="gap:8px">${icon('watch', 19)} ${tr('Watch today', 'Klokka i dag')}</h2>
      <button class="link-btn row" style="gap:5px" data-act="syncHealth">${icon('refresh', 16)} ${tr('Sync', 'Hent')}</button></div>
    <p class="small">${bits.length ? bits.join(' · ') : `<span class="muted">${syncedToday() ? tr('Nothing recorded yet today.', 'Ingenting registrert ennå i dag.') : tr('Not synced today yet.', 'Ikke hentet i dag ennå.')}</span>`}</p>
    ${tired ? `<div class="note amber">${icon('bed', 18)}<span>${tr(`Short night (${fmtSleep(h.sleepMin)}). If you feel tired, a walk or a stretch today counts just as much.`, `Kort natt (${fmtSleep(h.sleepMin)}). Er du sliten, teller en gåtur eller tøying like mye i dag.`)}</span></div>` : ''}
  </section>`;
}

function others() {
  const items = [
    ['strengthA', 'dumbbell', WORKOUTS.strengthA],
    ['strengthB', 'dumbbell', WORKOUTS.strengthB],
    ['stretch', 'stretch', WORKOUTS.stretch],
    ['walk', 'walk', WORKOUTS.walk],
  ];
  return `<div class="section-title"><h2 class="h2">${tr('Do something else', 'Gjør noe annet')}</h2></div>
    <div class="grid2">${items.map(([id, ic, w]) => `<a class="tile" href="#/workout/${id}">
      <span style="width:38px;height:38px;border-radius:12px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center">${icon(ic, 20)}</span>
      <span class="h3" style="margin-top:4px">${esc(L(w.name))}</span><span class="tiny muted">${esc(L(w.sub))} · ${w.minutes} min</span></a>`).join('')}</div>
    <button class="btn outline" data-act="other">${icon('plus', 18)} ${tr('Log another activity', 'Logg annen aktivitet')}</button>`;
}

function history() {
  const list = S().workouts.slice(-6).reverse();
  const sum = weekSummary();
  return `<section class="card">
    <div class="row between"><h2 class="h3">${tr('This week', 'Denne uka')}</h2>
      <span class="small muted">${sum.sessions} ${sum.sessions === 1 ? tr('session', 'økt') : tr('sessions', 'økter')} · ${sum.minutes} min</span></div>
    ${list.length ? `<div class="list">${list.map((w) => `<button class="item" data-act="editW" data-id="${w.id}">
      <span class="icon-btn" style="width:36px;height:36px;background:var(--surface2);color:var(--accent)">${icon(ACT_ICON[w.wid] || 'flame', 18)}</span>
      <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(activityName(w.wid))}</span>
      <span class="s">${shortDate(parseKey(w.date))} · ${w.minutes} min${w.sets ? ` · ${w.sets} ${tr('sets', 'sett')}` : ''}</span></span></button>`).join('')}</div>`
      : `<p class="small muted">${tr('Your workouts show up here. The first one is the hardest.', 'Øktene dine dukker opp her. Den første er den tyngste.')}</p>`}
  </section>`;
}

function minutesSheet(title, onSave, preset = 20) {
  let mins = preset;
  let actId = 'walk';
  const draw = (withActs) => `${withActs ? `<div class="chips">${OTHER_ACTIVITIES.map((a) => `<button class="chip solid" aria-pressed="${a.id === actId}" data-act="a" data-id="${a.id}">${esc(L(a.name))}</button>`).join('')}</div>` : ''}
    <div class="row between"><span class="h3">${tr('Minutes', 'Minutter')}</span>
    <div class="stepper"><button data-act="m" data-d="-5" aria-label="${tr('Less', 'Mindre')}">−</button><span class="v num">${mins} min</span><button data-act="m" data-d="5" aria-label="${tr('More', 'Mer')}">+</button></div></div>
    <button class="btn primary" data-act="save">${tr('Save', 'Lagre')}</button>`;
  return (withActs) => openSheet({
    title,
    html: draw(withActs),
    actions: {
      a: (b, e, sheet) => { actId = b.dataset.id; sheet.querySelector('.col').innerHTML = draw(withActs); },
      m: (b, e, sheet) => { mins = Math.max(5, Math.min(300, mins + Number(b.dataset.d))); sheet.querySelector('.col').innerHTML = draw(withActs); },
      save: () => { onSave(mins, actId); closeSheet(); },
    },
  });
}

export function saveWorkout(wid, minutes, sets = 0) {
  mutate((s) => {
    s.workouts.push({ id: uid(), date: dayKey(), wid, minutes: Math.max(1, Math.round(minutes)), sets, ts: Date.now() });
  });
}

export function render() {
  const active = S().activeWorkout;
  return `<div class="screen">
    <div class="blob b1"></div>
    <header class="head"><div class="titles"><p class="eyebrow">${tr('Beginner strength', 'Nybegynner styrke')} · ${tr('week', 'uke')} ${programWeek()}</p>
      <h1 class="h1">${tr('Train', 'Trening')}</h1></div></header>
    ${active ? `<a class="banner" href="#/workout/${active.id}" style="text-decoration:none">${icon('play', 20)}<span class="grow">${tr('Workout in progress', 'Økt pågår')}: ${esc(activityName(active.id))}. ${tr('Tap to continue.', 'Trykk for å fortsette.')}</span></a>` : ''}
    ${weekStrip()}
    ${todayCard()}
    ${watchCard()}
    ${others()}
    ${history()}
  </div>${tabbar('train')}`;
}

export const actions = {
  syncHealth: () => syncHealth(),
  quickWalk: () => minutesSheet(tr('Log a walk', 'Logg en gåtur'), (m) => { saveWorkout('walk', m); toast(tr('Walk logged. Nice.', 'Gåtur logget. Fint.')); nav.rerender(); })(false),
  other: () => minutesSheet(tr('Log an activity', 'Logg en aktivitet'), (m, a) => { saveWorkout(a, m); toast(tr('Activity logged.', 'Aktivitet logget.')); nav.rerender(); }, 30)(true),
  editW: (el) => {
    const w = S().workouts.find((x) => x.id === el.dataset.id);
    if (!w) return;
    openSheet({
      title: esc(activityName(w.wid)),
      html: `<p class="small muted">${shortDate(parseKey(w.date))} · ${w.minutes} min${w.sets ? ` · ${w.sets} ${tr('sets', 'sett')}` : ''}</p>
        <button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button>`,
      actions: { del: () => { mutate((s) => { s.workouts = s.workouts.filter((x) => x.id !== w.id); }); closeSheet(); toast(tr('Deleted.', 'Slettet.')); nav.rerender(); } },
    });
  },
};
