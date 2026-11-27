// Train, made simple: what to do today (one big Start button), your week as a plain list,
// your own extra training, history, and a few things to learn. No plan yet? Three questions make one.
import { S, mutate } from '../store.js';
import { plannedActivity, weekSummary } from '../planner.js';
import { PLACES, PLACE_ORDER, EQUIP } from '../data/exercises.js';
import { PROGRAMS, FOCUS, FOCUS_ORDER, normFocus } from '../data/programs.js';
import { equipChips, toggleGear } from './program.js';
import { howToSheet, needsLine } from './howto.js';
import { tr, L, dayShort, shortDate } from '../i18n.js';
import { icon, tabbar, openSheet, closeSheet, toast } from '../ui.js';
import { esc, dayKey, addDays, startOfWeek, parseKey } from '../util.js';
import { nav } from '../nav.js';
import { healthDay, fmtSleep } from '../health.js';
import {
  programReady, training, sessions, workoutDef, activityName, exName, groupsText, lastLog, saveWorkout, kgFmt,
  currentPlace, setTodayPlace, allowedEquip, planWorkoutsOn, ownWorkoutsOn, ownIcon, buildProgram, applyProgram, niceName, goalText, nextTraining,
} from '../training.js';

export { activityName, saveWorkout, niceName, goalText };

const iconFor = (id) => (id === 'walk' ? 'walk' : id === 'stretch' ? 'stretch' : id === 'rest' ? 'bed' : 'dumbbell');

function exList(def, { numbers = true } = {}) {
  // "extra" only makes sense when some exercises are extra (not on a day that is all focus).
  const mark = def.ex.some((e) => e.focus) && !def.ex.every((e) => e.focus);
  return `<ol class="ex-steps">${def.ex.map((e, i) => {
    const last = lastLog(e.id);
    const top = last ? Math.max(0, ...last.sets.map((x) => x.kg || 0)) : 0;
    return `<li><button class="ex-step" data-act="how" data-id="${esc(e.id)}">
      ${numbers ? `<span class="n" aria-hidden="true">${i + 1}</span>` : ''}
      <span class="grow" style="min-width:0"><span class="t">${esc(exName(e.id))}${mark && e.focus ? ` <span class="badge accent" style="font-size:10px;padding:1px 7px;vertical-align:1px">${tr('extra', 'ekstra')}</span>` : ''}</span>
        <span class="s">${goalText(e)}${top ? ` · ${tr('last time', 'sist')} ${kgFmt(top)}` : ''}</span></span>
      <span class="q" aria-label="${tr('How to do it', 'Slik gjør du')}">?</span></button></li>`;
  }).join('')}</ol>`;
}

const DAY_FULL = (k) => {
  const s = parseKey(k).toLocaleDateString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB', { weekday: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function placeLine() {
  const place = currentPlace();
  const gear = allowedEquip(place).filter((e) => e !== 'none');
  const all = Object.keys(EQUIP).filter((e) => e !== 'none').every((e) => gear.includes(e));
  return `<button class="place-line" data-act="placeSheet">${icon('home', 15)} <b>${esc(L(PLACES[place].name))}</b>
    <span class="muted">· ${all ? tr('all equipment', 'alt utstyr') : gear.length ? esc(gear.map((e) => L(EQUIP[e])).join(', ').toLowerCase()) : tr('body weight only', 'bare kroppsvekt')}</span>
    <span class="link">${tr('Change', 'Endre')}</span></button>`;
}

// ---------- Today ----------
function todayCard() {
  const key = dayKey();
  const act = plannedActivity(key);
  const done = planWorkoutsOn(key);
  const own = ownWorkoutsOn(key);
  const ownLine = own.length ? `<p class="small" style="color:var(--accent);font-weight:600">${icon('check', 14, 'style="vertical-align:-2px"')} ${tr('Also logged today', 'Også logget i dag')}: ${esc(own.map((w) => `${w.name} · ${w.minutes} min`).join(', '))}</p>` : '';
  const head = `<p class="eyebrow" style="margin:0">${tr('Today', 'I dag')} · ${esc(S().prefs.lang === 'nb' ? DAY_FULL(key).toLowerCase() : DAY_FULL(key))}</p>`;

  if (done.length) {
    return `<section class="card hero-train done">
      ${head}
      <div class="row" style="gap:12px"><span class="big-check" aria-hidden="true">${icon('check', 26, 'stroke-width="3"')}</span>
        <div><h2 class="h1" style="font-size:24px">${tr('Done for today', 'Ferdig for i dag')}</h2>
        <p class="small soft">${esc(done.map((w) => niceName(activityName(w.wid, w.name))).join(', '))} · ${done.reduce((a, w) => a + (w.minutes || 0), 0)} min</p></div></div>
      ${ownLine}
      <p class="small soft" style="line-height:1.5">${tr('Great job. Your muscles grow now, while you rest and eat. A meal or a shake in the next hours helps.', 'Bra jobba. Nå vokser musklene, mens du hviler og spiser. Et måltid eller en shake de neste timene hjelper.')}</p>
      <a class="btn secondary" href="#/fuel">${icon('leaf', 18)} ${tr('What to eat after training', 'Hva du kan spise etter trening')}</a>
    </section>`;
  }

  if (act === 'rest' || !workoutDef(act)) {
    const nx = nextTraining(key);
    return `<section class="card hero-train">
      ${head}
      <h2 class="h1" style="font-size:26px">${tr('Rest day', 'Hviledag')}</h2>
      ${ownLine}
      <p class="small soft" style="line-height:1.5">${tr('No training planned today. Muscles grow on rest days, so this is part of the plan.', 'Ingen trening i dag. Muskler vokser på hviledager, så dette er en del av planen.')}</p>
      ${nx ? `<div class="next-up">${icon('calendar', 18)}<span class="grow"><span class="tiny muted" style="display:block">${tr('Next training', 'Neste trening')}</span>
        <b>${nx.i === 1 ? tr('Tomorrow', 'I morgen') : esc(DAY_FULL(nx.k))}: ${esc(niceName(nx.def.name))}</b></span></div>` : ''}
      <p class="tiny muted">${tr('Want to move a little anyway? Optional:', 'Lyst til å bevege deg litt likevel? Helt valgfritt:')}</p>
      <div class="btns"><a class="btn secondary" href="#/workout/walk">${icon('walk', 18)} ${tr('Walk', 'Gåtur')}</a><a class="btn secondary" href="#/workout/stretch">${icon('stretch', 18)} ${tr('Stretch', 'Tøying')}</a></div>
    </section>`;
  }

  const def = workoutDef(act);
  const h = healthDay(key) || {};
  const tired = h.sleepMin != null && h.sleepMin < 360 && !h.sleepGuess && def.kind === 'strength';
  if (def.kind !== 'strength') {
    return `<section class="card hero-train">
      ${head}
      <h2 class="h1" style="font-size:26px">${esc(def.name)}</h2>
      <p class="small soft">${esc(def.sub)} · ${tr('about', 'ca.')} ${def.minutes} min</p>
      ${ownLine}
      <a class="btn primary big-start" href="#/workout/${act}">${icon('play', 20)} ${tr('Start', 'Start')}</a>
      <p class="tiny muted">${tr('A light day in your plan. Easy on the stomach.', 'En lett dag i planen din. Snill mot magen.')}</p>
    </section>`;
  }
  return `<section class="card hero-train" aria-label="${tr("Today's training", 'Dagens trening')}">
    ${head}
    <div><h2 class="h1" style="font-size:26px">${esc(niceName(def.name))}</h2>
      <p class="small soft">${def.ex.length} ${tr('exercises', 'øvelser')} · ${tr('about', 'ca.')} ${def.minutes} min</p></div>
    ${ownLine}
    <a class="btn primary big-start" href="#/workout/${act}">${icon('play', 20)} ${tr('Start training', 'Start treningen')}</a>
    ${tired ? `<div class="note amber">${icon('bed', 18)}<span>${tr(`Short night (${fmtSleep(h.sleepMin)}). The short version below is just as good today.`, `Kort natt (${fmtSleep(h.sleepMin)}). Kortversjonen under er like bra i dag.`)}</span></div>` : ''}
    <div class="col" style="gap:6px">
      <p class="label" style="margin:0">${tr("What you'll do", 'Dette skal du gjøre')}</p>
      ${exList(def)}
      <p class="tiny muted">${tr('Tap an exercise to see how. A round = do the movement that many times, then rest.', 'Trykk på en øvelse for å se hvordan. En runde = gjør bevegelsen så mange ganger, så pause.')}</p>
    </div>
    <p class="small" style="line-height:1.45">${icon('dumbbell', 15, 'style="vertical-align:-3px"')} <b>${tr('You need', 'Du trenger')}:</b> ${esc(needsLine(def.ex.map((e) => e.id)))}</p>
    ${def.own ? placeLine() : ''}
    <a class="link-btn small" href="#/workout/${act}/light" style="align-self:flex-start">${tr('Low on energy? Do the short version (1 round of each)', 'Lite energi? Ta kortversjonen (1 runde av hver)')} →</a>
  </section>`;
}

// ---------- The week as a plain list ----------
function weekCard() {
  const start = startOfWeek(dayKey());
  const today = dayKey();
  let planned = 0;
  let doneN = 0;
  const rows = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(start, i);
    const act = plannedActivity(k);
    const def = workoutDef(act);
    const done = planWorkoutsOn(k).length > 0;
    const own = ownWorkoutsOn(k);
    const isStrength = def?.kind === 'strength';
    if (isStrength) { planned++; if (done) doneN++; }
    const past = k < today;
    const label = act === 'rest' || !def ? tr('Rest', 'Hvile') : isStrength ? niceName(def.name) : `${def.name} ${tr('(optional)', '(valgfritt)')}`;
    const sub = isStrength ? `${def.ex.length} ${tr('exercises', 'øvelser')} · ~${def.minutes} min` : '';
    const state = done ? `<span class="wk-state ok">${icon('check', 14, 'stroke-width="3"')} ${tr('Done', 'Gjort')}</span>`
      : k === today && def ? `<span class="wk-state now">${tr('Today', 'I dag')}</span>` : '';
    const ownTxt = own.length ? `<span class="wk-own">+ ${esc(own.map((w) => w.name).join(', '))}</span>` : '';
    const tag = def ? 'button' : 'div';
    return `<${tag} class="wk-row ${k === today ? 'today' : ''} ${isStrength ? 'train' : 'light'} ${done ? 'done' : ''} ${past && !done ? 'past' : ''}" ${def ? `data-act="dayView" data-k="${k}"` : ''}>
      <span class="wk-day"><b>${esc(dayShort(parseKey(k)))}</b><span>${parseKey(k).getDate()}.</span></span>
      <span class="wk-ic" aria-hidden="true">${done ? icon('check', 15, 'stroke-width="3"') : icon(isStrength ? 'dumbbell' : iconFor(act), 15)}</span>
      <span class="grow" style="min-width:0"><span class="wk-name">${esc(label)}</span>${sub ? `<span class="wk-sub">${sub}</span>` : ''}${ownTxt}</span>
      ${state}${def ? icon('chevR', 16) : ''}</${tag}>`;
  }).join('');
  return `<section class="card" aria-label="${tr('Your week', 'Uka di')}">
    <div class="row between"><h2 class="h3">${tr('Your week', 'Uka di')}</h2>
      ${planned ? `<span class="small muted">${doneN} ${tr('of', 'av')} ${planned} ${tr('done', 'gjort')}</span>` : ''}</div>
    ${planned ? `<div class="wk-bar" aria-hidden="true">${Array.from({ length: planned }, (_, i) => `<i class="${i < doneN ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    <div class="wk-list">${rows}</div>
    <p class="tiny muted">${tr('Missed a day? No problem, just do the next one. You can also do any day now: tap it.', 'Gikk glipp av en dag? Helt greit, bare ta den neste. Du kan også ta en hvilken som helst dag nå: trykk på den.')}</p>
  </section>`;
}

// ---------- No plan yet: three questions ----------
let wiz = null;
const wizCfg = () => {
  const id = wiz.days === 2 ? 'start2' : wiz.days === 4 ? 'ul4' : wiz.focus.length ? 'focus3' : 'full3';
  return { id, place: wiz.place, focus: wiz.focus, days: PROGRAMS[id].days, level: 'gentle', reps: 'grow', rest: 'mix' };
};

function setupCard() {
  if (!wiz) wiz = { days: 2, place: training().place || 'home', focus: [] };
  const plan = buildProgram(wizCfg());
  const byId = Object.fromEntries(plan.sessions.map((s) => [s.id, s]));
  const DAYS = [[2, tr('2 days', '2 dager'), tr('Best start', 'Beste start')], [3, tr('3 days', '3 dager'), ''], [4, tr('4 days', '4 dager'), tr('When eating is steady', 'Når maten går fint')]];
  return `<section class="card hero-train">
    <p class="eyebrow" style="margin:0">${tr('Your training plan', 'Treningsplanen din')}</p>
    <h2 class="h1" style="font-size:24px">${tr("Let's make your plan", 'La oss lage planen din')}</h2>
    <p class="small soft" style="line-height:1.5">${tr('Three quick questions. You can change everything later.', 'Tre raske spørsmål. Du kan endre alt senere.')}</p>

    <div class="q-block"><p class="q-title"><span class="q-n">1</span>${tr('How many days a week?', 'Hvor mange dager i uka?')}</p>
      <div class="opt-row">${DAYS.map(([n, l, s]) => `<button class="opt" aria-pressed="${wiz.days === n}" data-act="wDays" data-v="${n}"><b>${l}</b>${s ? `<span>${s}</span>` : ''}</button>`).join('')}</div></div>

    <div class="q-block"><p class="q-title"><span class="q-n">2</span>${tr('Where do you train?', 'Hvor trener du?')}</p>
      <div class="seg">${PLACE_ORDER.map((p) => `<button aria-pressed="${wiz.place === p}" data-act="wPlace" data-v="${p}">${esc(L(PLACES[p].name))}</button>`).join('')}</div>
      ${wiz.place === 'home' ? `<p class="tiny muted" style="margin:2px 0 0">${tr('What do you have at home? Nothing is fine too.', 'Hva har du hjemme? Ingenting er også helt fint.')}</p>${equipChips('home')}` : ''}</div>

    <div class="q-block"><p class="q-title"><span class="q-n">3</span>${tr('Any muscles you want most? (optional)', 'Noen muskler du vil ha mest? (valgfritt)')}</p>
      <div class="chips">${FOCUS_ORDER.map((f) => `<button class="chip solid" aria-pressed="${wiz.focus.includes(f)}" data-act="wFocus" data-v="${f}">${wiz.focus.includes(f) ? icon('check', 13) + ' ' : ''}${esc(L(FOCUS[f].name))}</button>`).join('')}</div></div>

    <div class="plan-preview"><p class="label" style="margin:0">${tr('Your plan', 'Planen din')}</p>
      ${plan.days.map((d) => {
        const s = byId[plan.schedule[d]];
        const name = new Date(2024, 0, 1 + d).toLocaleDateString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB', { weekday: 'long' });
        return `<div class="pp-row"><b>${esc(name.charAt(0).toUpperCase() + name.slice(1))}</b><span>${esc(niceName(s.name))}</span><span class="muted">${s.ex.length} ${tr('exercises', 'øvelser')}</span></div>`;
      }).join('')}
      <p class="tiny muted" style="margin:0">${tr('The other days are rest days.', 'De andre dagene er hviledager.')}</p></div>

    <button class="btn primary big-start" data-act="wUse">${icon('check', 20)} ${tr('Use this plan', 'Bruk denne planen')}</button>
    <a class="link-btn small center" href="#/workout/strengthA">${tr('Just want to train right now? Start a gentle full-body session', 'Vil du bare trene nå? Start en rolig helkroppsøkt')}</a>
  </section>`;
}

// ---------- Own training, history, learn, plan ----------
function ownButton() {
  return `<a class="own-btn" href="#/trainlog">${icon('plus', 20)}<span class="grow"><b>${tr('Trained something else?', 'Trent noe annet?')}</b>
    <span>${tr('Log it here: arms for 25 min, a run, football…', 'Logg det her: armer i 25 min, løping, fotball…')}</span></span>${icon('chevR', 18)}</a>`;
}

let showAll = false;
function historyCard() {
  const all = S().workouts.slice().reverse();
  if (!all.length) return '';
  const list = all.slice(0, showAll ? 30 : 4);
  const sum = weekSummary();
  return `<section class="card">
    <div class="row between"><h2 class="h3">${tr('What you have done', 'Det du har gjort')}</h2>
      <span class="small muted">${tr('This week', 'Denne uka')}: ${sum.minutes} min</span></div>
    <div class="list">${list.map((w) => `<button class="item" data-act="editW" data-id="${w.id}">
      <span class="plate-mini" style="width:36px;height:36px;${w.own ? 'background:var(--accent-soft);color:var(--accent)' : ''}" aria-hidden="true">${icon(w.own ? ownIcon(w.type) : iconFor(w.wid), 17)}</span>
      <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(w.own ? w.name : niceName(activityName(w.wid, w.name)))}${w.own ? ` <span class="badge" style="font-size:10px;padding:2px 7px;vertical-align:1px">${tr('own', 'egen')}</span>` : ''}</span>
      <span class="s">${shortDate(parseKey(w.date))} · ${w.minutes} min${w.sets ? ` · ${w.sets} ${w.sets === 1 ? tr('round', 'runde') : tr('rounds', 'runder')}` : ''}${w.own && w.muscles?.length ? ` · ${esc(w.muscles.map((m) => L(FOCUS[m]?.name || { en: m, nb: m })).join(', '))}` : ''}</span></span>${icon('chevR', 16)}</button>`).join('')}</div>
    ${all.length > 4 ? `<button class="link-btn small" data-act="more">${showAll ? tr('Show less', 'Vis mindre') : tr(`Show all (${all.length})`, `Vis alle (${all.length})`)}</button>` : ''}
  </section>`;
}

function learnCard() {
  const row = (href, act, ic, t, s) => `<${href ? `a href="${href}"` : `button data-act="${act}"`} class="learn-row">
    <span class="plate-mini" aria-hidden="true">${icon(ic, 18)}</span><span class="grow"><b>${t}</b><span>${s}</span></span>${icon('chevR', 16)}</${href ? 'a' : 'button'}>`;
  return `<section class="card tight">
    <h2 class="h3">${tr('Good to know', 'Greit å vite')}</h2>
    ${row(null, 'rules', 'sparkle', tr('How muscle grows', 'Slik vokser muskler'), tr('The 4 things that matter, in 1 minute', 'De 4 tingene som betyr noe, på 1 minutt'))}
    ${row('#/guide', null, 'book', tr('How to do every exercise', 'Slik gjør du hver øvelse'), tr('Steps, tips and what you need', 'Steg, tips og hva du trenger'))}
    ${row('#/fuel', null, 'leaf', tr('Food and training', 'Mat og trening'), tr('Before and after, protein powder, creatine', 'Før og etter, proteinpulver, kreatin'))}
  </section>`;
}

function planCard() {
  if (!programReady()) return '';
  const t = training();
  const prog = t.program && PROGRAMS[t.program.id];
  const focus = normFocus(t.program?.focus).map((f) => L(FOCUS[f].name).toLowerCase());
  const days = (t.days || Object.keys(t.schedule || {})).length;
  return `<section class="card tight">
    <div class="row between"><h2 class="h3">${tr('Your plan', 'Planen din')}</h2>
      <a class="btn small secondary" href="${prog ? `#/program/${t.program.id}` : '#/plan'}">${icon('sliders', 15)} ${tr('Change', 'Endre')}</a></div>
    <p class="small soft" style="line-height:1.5">${esc(prog ? L(prog.name) : tr('Your own plan', 'Din egen plan'))} · ${days} ${tr('days a week', 'dager i uka')} · ${esc(L(PLACES[t.place || 'home'].name).toLowerCase())}${focus.length ? ` · ${tr('extra', 'ekstra')} ${esc(focus.join(', '))}` : ''}</p>
    <details class="sess-more"><summary class="link-btn small">${tr('Change exercises in a session', 'Endre øvelser i en økt')}</summary>
      <div class="list">${sessions().map((s) => `<a class="item" href="#/session/${s.id}" style="text-decoration:none;color:inherit">
        <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(niceName(s.name))}</span><span class="s">${esc(groupsText(s.groups))}</span></span>${icon('pencil', 16)}</a>`).join('')}</div>
      <a class="link-btn small" href="#/plan">${tr('Move days around', 'Flytt dager')}</a></details>
  </section>`;
}

export function render() {
  const active = S().activeWorkout;
  const ready = programReady();
  return `<div class="screen">
    <div class="blob b1"></div>
    <header class="head"><div class="titles"><p class="eyebrow">${ready ? tr('Your plan, one day at a time', 'Planen din, én dag om gangen') : tr('Get stronger, gently', 'Bli sterkere, rolig')}</p>
      <h1 class="h1">${tr('Train', 'Trening')}</h1></div>
      ${ready ? `<a class="icon-btn surface" href="${training().program ? `#/program/${training().program.id}` : '#/plan'}" aria-label="${tr('Change plan', 'Endre plan')}">${icon('sliders')}</a>` : ''}</header>
    ${active ? `<a class="banner" href="#/workout/${active.id}" style="text-decoration:none">${icon('play', 20)}<span class="grow">${tr('You have a session going', 'Du har en økt i gang')}: ${esc(niceName(activityName(active.id)))}. ${tr('Tap to continue.', 'Trykk for å fortsette.')}</span></a>` : ''}
    ${ready ? todayCard() : setupCard()}
    ${ownButton()}
    ${ready ? weekCard() : ''}
    ${historyCard()}
    ${learnCard()}
    ${planCard()}
  </div>${tabbar('train')}`;
}

function rulesSheet() {
  openSheet({
    title: tr('How muscle grows', 'Slik vokser muskler'),
    html: `<ol class="rules-list">
      <li><b>${tr('Close to hard.', 'Nesten tungt.')}</b> ${tr('The last 2 times in a round should feel heavy, but you still do the movement nicely.', 'De to siste gangene i en runde skal kjennes tunge, men du gjør fortsatt bevegelsen fint.')}</li>
      <li><b>${tr('A little more over time.', 'Litt mer over tid.')}</b> ${tr('When you manage the top number in every round, take a bit more weight next time. The app tells you when.', 'Når du klarer det høyeste tallet i alle rundene, ta litt mer vekt neste gang. Appen sier fra når.')}</li>
      <li><b>${tr('Food and sleep build it.', 'Mat og søvn bygger det.')}</b> ${tr('Muscle is built after training. A snack before and a meal or shake after helps a lot.', 'Muskler bygges etter treningen. Noe lite før og et måltid eller en shake etter hjelper mye.')}</li>
      <li><b>${tr('Show up.', 'Møt opp.')}</b> ${tr('2 sessions every week beats 5 one week and none the next. The short version counts.', '2 økter hver uke slår 5 én uke og ingen den neste. Kortversjonen teller.')}</li>
    </ol>
    <p class="small soft" style="line-height:1.5"><b>${tr('Words:', 'Ord:')}</b> ${tr('A round (also called a set) = doing the movement a number of times in a row, then a short rest. "3 rounds · 8–12 times" = do it 8 to 12 times, rest, three times over.', 'En runde (også kalt et sett) = gjøre bevegelsen et antall ganger på rad, så en kort pause. «3 runder · 8–12 ganger» = gjør den 8 til 12 ganger, pause, tre ganger.')}</p>
    <button class="btn primary" data-act="ok">${tr('Got it', 'Skjønner')}</button>`,
    actions: { ok: () => closeSheet() },
  });
}

function placeSheet() {
  const draw = () => {
    const place = currentPlace();
    return `<p class="small soft" style="line-height:1.45">${tr("Where are you today? The exercises change to fit what's there.", 'Hvor er du i dag? Øvelsene tilpasses det som finnes der.')}</p>
      <div class="seg">${PLACE_ORDER.map((p) => `<button aria-pressed="${place === p}" data-act="pl" data-v="${p}">${esc(L(PLACES[p].name))}</button>`).join('')}</div>
      <p class="label">${tr(`Equipment at ${L(PLACES[place].name).toLowerCase()}`, `Utstyr ${place === 'home' ? 'hjemme' : 'på senteret'}`)}</p>
      ${equipChips(place)}
      <button class="btn primary" data-act="done">${tr('Done', 'Ferdig')}</button>`;
  };
  openSheet({
    title: tr('Place and equipment', 'Sted og utstyr'),
    html: draw(),
    actions: {
      pl: (el, e, sheet) => { setTodayPlace(el.dataset.v); sheet.querySelector('.col').innerHTML = draw(); },
      gear: (el, e, sheet) => { toggleGear(el.dataset.p, el.dataset.e); sheet.querySelector('.col').innerHTML = draw(); },
      done: () => closeSheet(),
    },
    onClose: () => nav.rerender(),
  });
}

// Any day of the week: what it is, and start it now if you like.
function daySheet(k) {
  const act = plannedActivity(k);
  const def = workoutDef(act);
  if (!def) return;
  const done = planWorkoutsOn(k);
  const today = k === dayKey();
  openSheet({
    title: esc(niceName(def.name)),
    html: `<p class="small muted">${esc(DAY_FULL(k))} ${shortDate(parseKey(k))}${def.ex.length ? ` · ${def.ex.length} ${tr('exercises', 'øvelser')}` : ''} · ${tr('about', 'ca.')} ${def.minutes} min</p>
      ${done.length ? `<div class="note">${icon('check', 18)}<span>${tr('Done', 'Gjort')}: ${done.map((w) => `${w.minutes} min`).join(', ')}</span></div>` : ''}
      ${def.ex.length ? exList(def) : `<p class="small soft">${esc(def.sub)}</p>`}
      ${def.ex.length ? `<p class="small" style="line-height:1.45">${icon('dumbbell', 15, 'style="vertical-align:-3px"')} <b>${tr('You need', 'Du trenger')}:</b> ${esc(needsLine(def.ex.map((e) => e.id)))}</p>` : ''}
      <button class="btn primary" data-act="go">${icon('play', 18)} ${today ? tr('Start', 'Start') : tr('Do this one now', 'Ta denne nå')}</button>
      ${!today && !done.length ? `<p class="tiny muted center">${tr('It counts for today.', 'Den teller for i dag.')}</p>` : ''}`,
    actions: {
      how: (el) => howToSheet(el.dataset.id),
      go: () => { closeSheet(); nav.go(`workout/${act}`); },
    },
  });
}

export const actions = {
  how: (el) => howToSheet(el.dataset.id),
  placeSheet: () => placeSheet(),
  rules: () => rulesSheet(),
  dayView: (el) => daySheet(el.dataset.k),
  more: () => { showAll = !showAll; nav.rerender(); },
  wDays: (el) => { wiz.days = Number(el.dataset.v); nav.rerender(); },
  wPlace: (el) => { wiz.place = el.dataset.v; nav.rerender(); },
  wFocus: (el) => { const f = el.dataset.v; wiz.focus = wiz.focus.includes(f) ? wiz.focus.filter((x) => x !== f) : [...wiz.focus, f]; nav.rerender(); },
  gear: (el) => { toggleGear(el.dataset.p, el.dataset.e); nav.rerender(); },
  wUse: () => {
    applyProgram(wizCfg());
    mutate((s) => { s.training.place = wiz.place; });
    wiz = null;
    toast(tr('Your plan is ready. Today is at the top.', 'Planen din er klar. Dagens trening står øverst.'), 2600);
    nav.scrollTo(0);
    nav.rerender();
  },
  editW: (el) => {
    const w = S().workouts.find((x) => x.id === el.dataset.id);
    if (!w) return;
    if (w.own) { nav.go(`trainlog/${w.id}`); return; }
    const log = w.log || {};
    openSheet({
      title: esc(niceName(activityName(w.wid, w.name))),
      html: `<p class="small muted">${shortDate(parseKey(w.date))} · ${w.minutes} min${w.sets ? ` · ${w.sets} ${w.sets === 1 ? tr('round', 'runde') : tr('rounds', 'runder')}` : ''}</p>
        ${Object.keys(log).length ? `<div class="list">${Object.entries(log).map(([exId, sets]) => `<div class="item" style="justify-content:space-between;gap:10px"><span>${esc(exName(exId))}</span>
          <span class="small muted num" style="text-align:right">${sets.map((x) => `${x.r}${x.kg ? ` × ${kgFmt(x.kg)}` : ''}`).join(' · ')}</span></div>`).join('')}</div>` : ''}
        <button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button>`,
      actions: { del: () => { mutate((s) => { s.workouts = s.workouts.filter((x) => x.id !== w.id); }); closeSheet(); toast(tr('Deleted.', 'Slettet.')); nav.rerender(); } },
    });
  },
};

