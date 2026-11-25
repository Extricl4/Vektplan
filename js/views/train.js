// Train: your plan for the week, today's session, your sessions, food tips and history.
import { S, mutate } from '../store.js';
import { plannedActivity, workoutsOn, weekSummary } from '../planner.js';
import { OTHER_ACTIVITIES } from '../data/workouts.js';
import { PLACES } from '../data/exercises.js';
import { tr, L, dayShort, shortDate, n0, n1 } from '../i18n.js';
import { icon, tabbar, openSheet, closeSheet, toast } from '../ui.js';
import { esc, dayKey, addDays, startOfWeek, parseKey } from '../util.js';
import { nav } from '../nav.js';
import { hasHealth, healthDay, fmtSleep, syncedToday } from '../health.js';
import { syncHealth } from './health.js';
import { shortcutURL, markPending } from '../health.js';
import {
  programReady, training, sessions, workoutDef, activityName, shortName, exName, groupsText, lastLog, LEVELS, saveWorkout, kgFmt,
} from '../training.js';

export { activityName, saveWorkout };

const iconFor = (id) => (id === 'walk' ? 'walk' : id === 'stretch' ? 'stretch' : id === 'rest' ? 'bed' : 'dumbbell');

function weekStrip() {
  const start = startOfWeek(dayKey());
  const today = dayKey();
  return `<section class="card tight" style="padding:14px 8px" aria-label="${tr('This week', 'Denne uka')}">
    <div class="week">${Array.from({ length: 7 }, (_, i) => {
      const k = addDays(start, i);
      const act = plannedActivity(k);
      const done = workoutsOn(k).length > 0;
      const watch = (healthDay(k)?.exerciseMin || 0) >= 20;
      const own = !!workoutDef(act)?.own;
      const ic = act === 'rest' ? '–' : own ? icon('dumbbell', 16) : act === 'strengthA' ? '<b>A</b>' : act === 'strengthB' ? '<b>B</b>' : icon(iconFor(act), 16);
      return `<a class="col" href="${act !== 'rest' ? `#/workout/${act}` : '#/train'}" style="align-items:center;gap:6px;text-decoration:none;color:inherit;min-width:0">
        <span class="tiny ${k === today ? '' : 'muted'}" style="font-weight:${k === today ? 700 : 500};color:${k === today ? 'var(--accent)' : ''}">${dayShort(parseKey(k))}</span>
        <span style="position:relative;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          ${done ? 'background:var(--accent-fill);color:var(--accent-ink)' : k === today ? 'border:2px solid var(--accent-line);color:var(--ink)' : act === 'rest' ? 'background:var(--surface2);color:var(--muted)' : 'border:2px solid var(--line);color:var(--soft)'}">
          ${done ? icon('check', 16, 'stroke-width="3"') : ic}${watch && !done ? '<i class="wdot" title="Apple Watch"></i>' : ''}</span>
        <span class="tiny muted" style="font-size:10px;max-width:46px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(shortName(act))}</span></a>`;
    }).join('')}</div>
    ${hasHealth() ? `<p class="tiny muted center" style="margin-top:4px"><i class="wdot inline"></i> ${tr('= 20+ active minutes on your Watch', '= 20+ aktive minutter på klokka')}</p>` : ''}
  </section>`;
}

function exercisePreview(def) {
  return `<div class="list">${def.ex.slice(0, 8).map((e) => {
    const last = lastLog(e.id);
    const top = last ? Math.max(0, ...last.sets.map((x) => x.kg || 0)) : 0;
    return `<div class="item" style="justify-content:space-between;gap:10px"><span style="min-width:0">${esc(exName(e.id))}</span>
      <span class="small muted num" style="white-space:nowrap">${e.sets} × ${e.reps}${top ? ` · ${kgFmt(top)}` : ''}</span></div>`;
  }).join('')}</div>`;
}

function todayCard() {
  const key = dayKey();
  const act = plannedActivity(key);
  const done = workoutsOn(key);
  if (done.length) {
    return `<section class="card soft"><div class="row">${icon('check', 22)}<p class="h3">${tr('Training done today', 'Trening gjort i dag')}: ${esc(done.map((w) => activityName(w.wid, w.name)).join(', '))}</p></div>
      <p class="small soft">${tr('Nice work. Something to eat in the next few hours helps your muscles grow.', 'Godt jobba. Litt mat de neste timene hjelper musklene å vokse.')}</p>
      <a class="link-btn" href="#/fuel">${tr('Ideas for after training', 'Forslag til etter trening')} →</a></section>`;
  }
  if (act === 'rest') {
    return `<section class="card"><span class="badge accent" style="align-self:flex-start">${tr('Today', 'I dag')}</span>
      <h2 class="h1" style="font-size:24px">${tr('Rest day', 'Hviledag')}</h2>
      <p class="small soft">${tr('Muscles grow while you rest and eat. Rest is part of the plan, not a break from it.', 'Muskler vokser mens du hviler og spiser. Hvile er en del av planen, ikke en pause fra den.')}</p>
      <div class="btns"><a class="btn secondary" href="#/workout/walk">${icon('walk', 18)} ${tr('Short walk', 'Kort gåtur')}</a><a class="btn secondary" href="#/workout/stretch">${icon('stretch', 18)} ${tr('Stretch', 'Tøy')}</a></div></section>`;
  }
  const def = workoutDef(act);
  if (!def) return '';
  return `<section class="card" aria-label="${tr("Today's workout", 'Dagens økt')}">
    <div class="row between"><span class="badge accent">${tr('Today', 'I dag')}</span>
      ${def.own ? `<a class="link-btn small" href="#/session/${def.id}">${icon('pencil', 14)} ${tr('Edit', 'Endre')}</a>` : `<span class="icon-btn" style="background:var(--accent-soft);color:var(--accent)">${icon(iconFor(act))}</span>`}</div>
    <div><h2 class="h1" style="font-size:24px">${esc(def.name)}</h2><p class="small muted">${esc(def.sub)} · ${tr('about', 'ca.')} ${def.minutes} min</p></div>
    ${def.ex.length ? exercisePreview(def) : ''}
    <div class="btns"><a class="btn primary" href="#/workout/${act}">${icon('play', 18)} ${tr('Start', 'Start')}</a>
      ${act !== 'walk' ? `<a class="btn secondary" href="#/workout/walk">${tr('Walk instead', 'Gå i stedet')}</a>` : `<button class="btn secondary" data-act="quickWalk">${tr('Log a walk', 'Logg en gåtur')}</button>`}</div>
    <p class="small muted" style="line-height:1.5">${def.kind === 'strength' ? tr('Have a small snack 1–2 hours before. Stomach rough? A walk or a stretch still counts.', 'Spis noe lite 1–2 timer før. Dårlig mage? En gåtur eller tøying teller også.') : tr('Stomach rough today? Any movement counts.', 'Dårlig mage i dag? All bevegelse teller.')}</p>
  </section>`;
}

function planCard() {
  if (programReady()) return '';
  return `<section class="card hero-plan" aria-label="${tr('Make your own plan', 'Lag din egen plan')}">
    <div class="row" style="gap:12px"><span class="plate-mini" style="width:48px;height:48px" aria-hidden="true">${icon('dumbbell', 22)}</span>
      <div class="grow"><p class="h3">${tr('Make your own plan', 'Lag din egen plan')}</p>
      <p class="small soft" style="line-height:1.45">${tr('Pick your days and muscle groups (full body, upper/lower, push/pull/legs or your own). Exercises fit where you train.', 'Velg dager og muskelgrupper (hele kroppen, over/under, push/pull/bein eller ditt eget). Øvelsene passer der du trener.')}</p></div></div>
    <a class="btn primary" href="#/plan/new">${icon('sparkle', 18)} ${tr('Build my plan', 'Lag planen min')}</a>
    <p class="tiny muted">${tr('Until then you get the built-in gentle beginner plan.', 'Fram til da får du den innebygde, rolige nybegynnerplanen.')}</p></section>`;
}

function fuelCard() {
  return `<a class="card tight link" href="#/fuel" style="flex-direction:row;align-items:center;gap:12px;text-decoration:none;color:inherit">
    <span class="plate-mini" aria-hidden="true">${icon('leaf', 18)}</span>
    <span class="grow"><span style="display:block;font-weight:600">${tr('Food for training', 'Mat og trening')}</span>
    <span class="small muted">${tr('What to eat before and after, protein powder, creatine, pre-workout', 'Hva du spiser før og etter, proteinpulver, kreatin, pre-workout')}</span></span>${icon('chevR', 18)}</a>`;
}

// What the Apple Watch saw today, or a gentle way in if it isn't connected yet.
function watchCard() {
  if (!hasHealth()) {
    return `<a class="card tight link" href="#/health" style="flex-direction:row;align-items:center;gap:12px">
      <span class="plate-mini" aria-hidden="true">${icon('watch', 18)}</span>
      <span class="grow"><span style="display:block;font-weight:600">${tr('Connect your Apple Watch', 'Koble til Apple Watch')}</span>
      <span class="small muted">${tr('See exercise minutes, active calories, steps and sleep here', 'Se treningsminutter, aktive kalorier, skritt og søvn her')}</span></span>${icon('chevR', 18)}</a>`;
  }
  const calm = S().prefs.calm;
  const key = dayKey();
  const h = healthDay(key) || {};
  const act = plannedActivity(key);
  const def = workoutDef(act);
  const tired = h.sleepMin != null && h.sleepMin < 360 && !h.sleepGuess && def?.kind === 'strength' && !workoutsOn(key).length;
  const sum = weekSummary(key);
  const bits = [
    h.exerciseMin != null ? `<b class="num">${h.exerciseMin}</b> ${tr('exercise min', 'treningsmin')}` : '',
    !calm && h.activeKcal != null ? `<b class="num">${n0(h.activeKcal)}</b> kcal` : '',
    h.steps != null ? `<b class="num">${n0(h.steps)}</b> ${tr('steps', 'skritt')}` : '',
  ].filter(Boolean);
  return `<section class="card tight">
    <div class="row between"><h2 class="h3 row" style="gap:8px">${icon('watch', 19)} ${tr('Watch today', 'Klokka i dag')}</h2>
      <a class="link-btn row" style="gap:5px;text-decoration:none" href="${esc(shortcutURL())}" data-act="runShortcut">${icon('refresh', 16)} ${tr('Sync', 'Hent')}</a></div>
    <p class="small">${bits.length ? bits.join(' · ') : `<span class="muted">${syncedToday() ? tr('Nothing recorded yet today.', 'Ingenting registrert ennå i dag.') : tr('Not synced today yet.', 'Ikke hentet i dag ennå.')}</span>`}</p>
    ${sum.watchMin ? `<p class="tiny muted">${tr('This week on the Watch', 'Denne uka på klokka')}: <b class="num">${sum.watchMin}</b> ${tr('exercise min', 'treningsmin')}${!calm && sum.watchKcal ? ` · <b class="num">${n0(sum.watchKcal)}</b> ${tr('active kcal', 'aktive kcal')}` : ''}</p>` : ''}
    ${!calm && (h.activeKcal || 0) >= 400 ? `<p class="tiny soft">${tr('Active day: an extra snack helps you keep gaining.', 'Aktiv dag: et ekstra mellommåltid hjelper deg å fortsette å gå opp.')}</p>` : ''}
    ${tired ? `<div class="note amber">${icon('bed', 18)}<span>${tr(`Short night (${fmtSleep(h.sleepMin)}). If you feel tired, a walk or a stretch today counts just as much.`, `Kort natt (${fmtSleep(h.sleepMin)}). Er du sliten, teller en gåtur eller tøying like mye i dag.`)}</span></div>` : ''}
  </section>`;
}

function mySessions() {
  if (!programReady()) return '';
  return `<div class="section-title"><h2 class="h2">${tr('Your sessions', 'Øktene dine')}</h2><a class="link-btn" href="#/plan">${icon('sliders', 16)} ${tr('Plan', 'Plan')}</a></div>
    <div class="grid2">${sessions().map((s) => {
      const def = workoutDef(s.id);
      return `<a class="tile" href="#/session/${s.id}">
        <span class="plate-mini" style="width:38px;height:38px" aria-hidden="true">${icon('dumbbell', 18)}</span>
        <span class="h3" style="margin-top:4px">${esc(s.name)}</span><span class="tiny muted">${esc(groupsText(s.groups))}</span>
        <span class="tiny muted">${s.ex.length} ${tr('exercises', 'øvelser')} · ~${def?.minutes || 20} min</span></a>`;
    }).join('')}</div>`;
}

function others() {
  const items = programReady()
    ? [['stretch', 'stretch'], ['walk', 'walk']]
    : [['strengthA', 'dumbbell'], ['strengthB', 'dumbbell'], ['stretch', 'stretch'], ['walk', 'walk']];
  return `<div class="section-title"><h2 class="h2">${tr('Something else', 'Noe annet')}</h2></div>
    <div class="grid2">${items.map(([id, ic]) => {
      const w = workoutDef(id);
      return `<a class="tile" href="#/workout/${id}">
      <span class="plate-mini" style="width:38px;height:38px" aria-hidden="true">${icon(ic, 20)}</span>
      <span class="h3" style="margin-top:4px">${esc(w.name)}</span><span class="tiny muted">${esc(w.sub)} · ${w.minutes} min</span></a>`;
    }).join('')}</div>
    <button class="btn outline" data-act="other">${icon('plus', 18)} ${tr('Log another activity', 'Logg annen aktivitet')}</button>`;
}

function history() {
  const list = S().workouts.slice(-8).reverse();
  const sum = weekSummary();
  return `<section class="card">
    <div class="row between"><h2 class="h3">${tr('History', 'Historikk')}</h2>
      <span class="small muted">${tr('This week', 'Denne uka')}: ${sum.sessions} ${sum.sessions === 1 ? tr('session', 'økt') : tr('sessions', 'økter')} · ${sum.minutes} min</span></div>
    ${list.length ? `<div class="list">${list.map((w) => `<button class="item" data-act="editW" data-id="${w.id}">
      <span class="plate-mini" style="width:36px;height:36px" aria-hidden="true">${icon(iconFor(w.wid), 17)}</span>
      <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(activityName(w.wid, w.name))}</span>
      <span class="s">${shortDate(parseKey(w.date))} · ${w.minutes} min${w.sets ? ` · ${w.sets} ${tr('sets', 'sett')}` : ''}</span></span>${icon('chevR', 16)}</button>`).join('')}</div>`
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

export function render() {
  const active = S().activeWorkout;
  const t = training();
  const eyebrow = programReady()
    ? `${esc(L(PLACES[t.place]?.name || PLACES.home.name))} · ${esc(L(LEVELS[t.level]?.name || LEVELS.gentle.name))}`
    : tr('Gentle beginner plan', 'Rolig nybegynnerplan');
  return `<div class="screen">
    <div class="blob b1"></div>
    <header class="head"><div class="titles"><p class="eyebrow">${eyebrow}</p>
      <h1 class="h1">${tr('Train', 'Trening')}</h1></div>
      <a class="icon-btn surface" href="${programReady() ? '#/plan' : '#/plan/new'}" aria-label="${tr('Your plan', 'Planen din')}">${icon('sliders')}</a></header>
    ${active ? `<a class="banner" href="#/workout/${active.id}" style="text-decoration:none">${icon('play', 20)}<span class="grow">${tr('Workout in progress', 'Økt pågår')}: ${esc(activityName(active.id))}. ${tr('Tap to continue.', 'Trykk for å fortsette.')}</span></a>` : ''}
    ${weekStrip()}
    ${planCard()}
    ${todayCard()}
    ${fuelCard()}
    ${watchCard()}
    ${mySessions()}
    ${others()}
    ${history()}
  </div>${tabbar('train')}`;
}

export const actions = {
  syncHealth: () => syncHealth(),
  runShortcut: () => { markPending(); location.href = shortcutURL(); },
  quickWalk: () => minutesSheet(tr('Log a walk', 'Logg en gåtur'), (m) => { saveWorkout('walk', m); toast(tr('Walk logged. Nice.', 'Gåtur logget. Fint.')); nav.rerender(); })(false),
  other: () => minutesSheet(tr('Log an activity', 'Logg en aktivitet'), (m, a) => { saveWorkout(a, m); toast(tr('Activity logged.', 'Aktivitet logget.')); nav.rerender(); }, 30)(true),
  editW: (el) => {
    const w = S().workouts.find((x) => x.id === el.dataset.id);
    if (!w) return;
    const log = w.log || {};
    openSheet({
      title: esc(activityName(w.wid, w.name)),
      html: `<p class="small muted">${shortDate(parseKey(w.date))} · ${w.minutes} min${w.sets ? ` · ${w.sets} ${tr('sets', 'sett')}` : ''}</p>
        ${Object.keys(log).length ? `<div class="list">${Object.entries(log).map(([exId, sets]) => `<div class="item" style="justify-content:space-between;gap:10px"><span>${esc(exName(exId))}</span>
          <span class="small muted num" style="text-align:right">${sets.map((x) => `${x.r}${x.kg ? ` × ${kgFmt(x.kg)}` : ''}`).join(' · ')}</span></div>`).join('')}</div>` : ''}
        <button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button>`,
      actions: { del: () => { mutate((s) => { s.workouts = s.workouts.filter((x) => x.id !== w.id); }); closeSheet(); toast(tr('Deleted.', 'Slettet.')); nav.rerender(); } },
    });
  },
};
