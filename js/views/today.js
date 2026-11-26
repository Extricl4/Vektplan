import { S, peekDay, day, mutate, latestWeight } from '../store.js';
import { dayStatus, totals, streak, plannedActivity, workoutsOn, makeRestGentle } from '../planner.js';
import { tr, L, n0, n1, greeting, longDate, minutesLeft, kindName } from '../i18n.js';
import { icon, ring, mealsBar, fodmapBadge, sparkline, plate, toast, sheetOpen, tabbar } from '../ui.js';
import { eatSheet, smallerSheet, skipCurrent, editLogSheet, recipeShort, swapSheet } from '../meals.js';
import { sortedMeals, mealsFor, kcalLine } from '../mymeals.js';
import { workoutDef } from '../training.js';
import { WORDS } from '../data/words.js';
import { esc, dayKey, nowMinutes, clock, dayNum, isIOS, isStandalone } from '../util.js';
import { nav } from '../nav.js';
import { update, applyUpdate } from '../updates.js';
import { getLang } from '../i18n.js';
import { hasHealth, healthDay, fmtSleepCompact, sleepWindow, latestRestingHR, syncedToday, lastSync } from '../health.js';
import { syncHealth } from './health.js';
import { shortcutURL, markPending } from '../health.js';
import { suppsCard, tickSupp, suppsSheet } from './supps.js';
import { todayLine } from '../encourage.js';

const LEVELS = [
  ['good', () => tr('Good', 'Bra')],
  ['okay', () => tr('Okay', 'Ok')],
  ['queasy', () => tr('Queasy', 'Kvalm')],
  ['rough', () => tr('Rough', 'Dårlig')],
];

function latestStomach(d) {
  const c = d.stomach?.[d.stomach.length - 1];
  if (!c) return null;
  return Date.now() - c.ts < 4 * 3600 * 1000 ? c : null;
}

function progressCard(list, t) {
  const st = S();
  const calm = st.prefs.calm;
  const goal = st.profile.goalKcal;
  let frac;
  let center;
  let side;
  const mealsLine = `<div><span class="small muted" style="display:block;margin-bottom:7px">${tr('Meals', 'Måltider')} · ${t.done} ${tr('of', 'av')} ${t.total}</span>${mealsBar(list)}</div>`;
  if (!calm && goal) {
    frac = t.kcal / goal;
    center = `<span class="v num">${Math.round(frac * 100)}%</span><span class="tiny muted">${tr('of your goal', 'av målet')}</span>`;
    side = `<div><span class="small muted" style="display:block">${tr('Eaten today', 'Spist i dag')}</span>
      <span class="num" style="font-size:24px;font-weight:700;letter-spacing:-0.02em">${n0(t.kcal)}</span><span class="small muted num"> / ${n0(goal)} kcal</span></div>`;
  } else if (!calm) {
    frac = t.total ? t.done / t.total : 0;
    center = `<span class="v num">${t.done}/${t.total}</span><span class="tiny muted">${tr('meals', 'måltider')}</span>`;
    side = `<div><span class="small muted" style="display:block">${tr('Eaten today', 'Spist i dag')}</span>
      <span class="num" style="font-size:24px;font-weight:700;letter-spacing:-0.02em">${n0(t.kcal)} kcal</span></div>`;
  } else {
    frac = t.total ? t.done / t.total : 0;
    center = `<span class="v num">${t.done}/${t.total}</span><span class="tiny muted">${tr('meals', 'måltider')}</span>`;
    const msg = frac >= 1 ? tr('Every meal done. Brilliant.', 'Alle måltider gjort. Strålende.')
      : frac >= 0.5 ? tr('Halfway. Nice and steady.', 'Halvveis. Fint og jevnt.')
      : frac > 0 ? tr('Good start. Keep it gentle.', 'God start. Ta det rolig.')
      : tr("Let's start small.", 'Vi starter smått.');
    side = `<div><span class="small muted" style="display:block">${tr('Calm mode', 'Rolig modus')}</span><span style="font-size:18px;font-weight:600;line-height:1.3">${msg}</span></div>`;
  }
  return `<section class="card hero" aria-label="${tr("Today's progress", 'Fremgang i dag')}">
    ${ring(frac, center)}
    <div class="col grow" style="gap:12px">${side}${mealsLine}</div>
  </section>`;
}

// The next meal, as a calm idea rather than an order. You can always eat your own thing.
function nextCard(current, list) {
  const calm = S().prefs.calm;
  if (!list.length) {
    return `<section class="card soft"><p class="h3">${tr('No meal times set', 'Ingen måltider satt opp')}</p>
      <a class="btn primary" href="#/settings">${tr('Set meal times', 'Sett opp måltider')}</a></section>`;
  }
  if (!current) {
    return `<section class="card soft" aria-label="${tr('All done', 'Ferdig')}">
      <div class="row">${icon('check', 22)}<p class="h3">${tr('That was every meal today.', 'Det var alle dagens måltider.')}</p></div>
      <p class="small soft">${tr('Hungry later? A little something is always welcome.', 'Sulten senere? Litt ekstra er alltid velkomment.')}</p>
      <a class="btn secondary" href="#/log">${icon('plus', 18)} ${tr('Log something', 'Logg noe')}</a></section>`;
  }
  const now = nowMinutes();
  const kind = kindName(current.slot.kind);
  const label = current.state === 'now'
    ? `${kind} ${tr('around', 'rundt')} ${current.time}`
    : current.state === 'soon'
      ? `${kind} ${tr('soon', 'snart')} · ${current.time}`
      : `${tr('Next', 'Neste')}: ${kind.toLowerCase()} ${current.time} · ${minutesLeft(current.min - now)}`;
  const info = current.info;
  const r = info.recipe;
  const title = info.free ? tr('Whatever you feel like', 'Det du har lyst på') : r ? `<a href="#/recipe/${r.id}" style="color:inherit;text-decoration:none">${esc(info.title)}</a>` : esc(info.title);
  const desc = info.free ? tr('Something small is plenty.', 'Noe lite er mer enn nok.') : r ? esc(recipeShort(r)) : info.mine ? esc(info.mine.note || tr('From your own food', 'Fra din egen mat')) : '';
  const visual = r ? plate(r, 48) : `<span class="plate-mini" style="width:48px;height:48px" aria-hidden="true">${icon(info.mine ? 'heart' : 'sparkle', 20)}</span>`;
  const quick = info.free ? sortedMeals(mealsFor(current.slot.kind)).slice(0, 4) : [];
  return `<section class="card" aria-label="${tr('Next meal', 'Neste måltid')}">
    <div class="row between"><span class="small" style="color:var(--accent);font-weight:600">${label}</span>
      <button class="link-btn small" data-act="swapNow">${icon('swap', 15)} ${tr('Change', 'Endre')}</button></div>
    <div class="row" style="gap:12px">${visual}
      <div class="grow">${info.free ? '' : `<p class="tiny muted">${tr('An idea', 'Et forslag')}</p>`}<h2 style="font-size:19px;font-weight:700;letter-spacing:-0.01em;line-height:1.25">${title}</h2>
      ${desc ? `<p class="small soft" style="margin-top:3px;line-height:1.4">${desc}</p>` : ''}</div></div>
    ${quick.length ? `<div class="chips">${quick.map((m) => `<button class="chip" data-act="quickMy" data-id="${m.id}">${icon('heart', 14)} ${esc(m.name)}</button>`).join('')}</div>` : ''}
    ${!info.free && (r || info.kcal) ? `<div class="row wrap" style="gap:6px">${info.mine ? '' : fodmapBadge(info.fodmap || 'low')}${r ? `<span class="badge">${r.min} min</span>` : ''}${!calm && info.kcal ? `<span class="badge num">${n0(info.kcal)} kcal</span>` : ''}</div>` : ''}
    <div class="btns"><button class="btn primary" data-act="ate">${tr("I've eaten", 'Jeg har spist')}</button>
      <button class="btn secondary" data-act="smaller">${tr('Just a little', 'Bare litt')}</button></div>
    <div class="row between"><a class="link-btn small" href="#/coach">${tr('Not hungry? Ask the coach', 'Ikke sulten? Spør coachen')}</a>
      <button class="link-btn small" style="color:var(--muted)" data-act="skip">${tr('Skip this one', 'Hopp over')}</button></div>
  </section>`;
}

// A gentle way in to the Apple Watch, until it is connected or dismissed.
function watchHint() {
  if (hasHealth() || S().health?.setup || S().prefs.watchHint === false) return '';
  return `<div class="note">${icon('watch', 18)}<div class="grow col" style="gap:8px">
    <span>${tr('Connect your Apple Watch to see sleep, pulse and calories burned here.', 'Koble til Apple Watch for å se søvn, puls og forbrente kalorier her.')}</span>
    <div class="row" style="gap:8px"><a class="btn small primary" href="#/health">${tr('Set it up', 'Sett opp')}</a><button class="btn small secondary" data-act="hideWatchHint">${tr('Not now', 'Ikke nå')}</button></div></div></div>`;
}

function tiles() {
  const key = dayKey();
  const w = latestWeight();
  const ws = S().weights;
  const first = ws[0];
  const recent = ws.slice(-10);
  const change = w && first && ws.length > 1 ? w.kg - first.kg : null;
  const weightTile = w
    ? `<a class="tile" href="#/progress/trends"><span class="small muted">${tr('Weight', 'Vekt')}</span>
        <span class="big num">${n1(w.kg)} kg</span>${sparkline(recent)}
        <span class="tiny" style="font-weight:600;color:var(--accent);margin-top:auto">${change != null ? `${change >= 0 ? '+' : ''}${n1(change)} kg ${tr('since start', 'siden start')}` : tr('Your starting point', 'Startpunktet ditt')}</span></a>`
    : `<a class="tile" href="#/progress/trends"><span class="small muted">${tr('Weight', 'Vekt')}</span>
        <span class="big">${icon('scale', 26)}</span><span class="tiny" style="font-weight:600;color:var(--accent)">${tr('Log your weight', 'Logg vekten din')}</span></a>`;
  const act = plannedActivity(key);
  const done = workoutsOn(key);
  const wk = workoutDef(act);
  const watchMin = healthDay(key)?.exerciseMin || 0;
  const status = done.length
    ? (done.some((x) => x.wid === act) ? `${tr('Done', 'Ferdig')} ✓` : `${tr('Did', 'Gjorde')}: ${esc(done.map((x) => workoutDef(x.wid)?.name || x.name || x.wid).join(', '))} ✓`)
    : watchMin >= 20 ? `${tr('Watch', 'Klokka')}: ${watchMin} ${tr('active min', 'aktive min')} ✓`
    : act === 'rest' ? tr('Rest is part of growing', 'Hvile er en del av å vokse') : tr('Tap to start', 'Trykk for å starte');
  const trainTile = `<a class="tile" href="#/train"><span class="small muted">${tr('Training today', 'Trening i dag')}</span>
      <span class="big" style="font-size:20px">${act === 'rest' || !wk ? tr('Rest day', 'Hviledag') : esc(wk.name)}</span>
      <span class="small soft">${act === 'rest' || !wk ? tr('Recover and refuel', 'Hvil og spis godt') : `${wk.minutes} min`}</span>
      <span class="tiny" style="margin-top:auto;font-weight:600;color:var(--accent)">${status}</span></a>`;
  return `<div class="grid2">${weightTile}${trainTile}</div>`;
}

// Sleep, pulse and movement from the Apple Watch (via the Shortcut). Only shown once connected.
function watchCard() {
  if (!hasHealth() && !S().health?.setup) return '';
  const calm = S().prefs.calm;
  const h = healthDay(dayKey()) || {};
  const rhr = latestRestingHR();
  const stale = !syncedToday();
  const moved = calm
    ? (h.exerciseMin != null ? `${h.exerciseMin} min` : '–')
    : (h.activeKcal != null ? `${n0(h.activeKcal)} kcal` : '–');
  let note = '';
  if (h.sleepMin != null && h.sleepMin < 360 && !h.sleepGuess) {
    note = `<div class="note amber">${icon('bed', 18)}<span>${tr('Short night. Go easy on yourself today: small, gentle meals, and a walk or a stretch counts as training if you feel tired.', 'Kort natt. Vær snill med deg selv i dag: små, milde måltider, og en gåtur eller tøying teller som trening hvis du er sliten.')}</span></div>`;
  } else if ((h.activeKcal || 0) >= 500 || (h.exerciseMin || 0) >= 45) {
    note = `<div class="note">${icon('flame', 18)}<span>${calm
      ? tr('You have been really active today. An extra snack helps your body keep up.', 'Du har vært skikkelig aktiv i dag. Et ekstra mellommåltid hjelper kroppen å henge med.')
      : tr(`You have moved a lot today (${n0(h.activeKcal || 0)} kcal). Your body needs a little extra to keep gaining, so an extra snack is a great idea.`, `Du har beveget deg mye i dag (${n0(h.activeKcal || 0)} kcal). Kroppen trenger litt ekstra for å fortsette å gå opp, så et ekstra mellommåltid er en god idé.`)}</span></div>`;
  }
  return `<section class="card tight" aria-label="Apple Watch">
    <div class="row between"><h2 class="h3 row" style="gap:8px">${icon('watch', 19)} ${tr('From your Watch', 'Fra klokka')}</h2>
      <a class="link-btn row" style="gap:5px;text-decoration:none" href="${esc(shortcutURL())}" data-act="runShortcut">${icon('refresh', 16)} ${tr('Sync', 'Hent')}</a></div>
    <div class="wstats">
      <a class="wstat" href="#/health" style="text-decoration:none;color:inherit"><span class="tiny muted">${tr('Last night', 'I natt')}</span><span class="v num">${h.sleepMin != null ? fmtSleepCompact(h.sleepMin) : '–'}</span><span class="tiny muted num">${esc(sleepWindow(h)) || '&nbsp;'}</span></a>
      <a class="wstat" href="#/health" style="text-decoration:none;color:inherit"><span class="tiny muted">${tr('Resting pulse', 'Hvilepuls')}</span><span class="v num">${rhr ? rhr.bpm : '–'}</span><span class="tiny muted">${rhr ? tr('beats/min', 'slag/min') : '&nbsp;'}</span></a>
      <a class="wstat" href="#/health" style="text-decoration:none;color:inherit"><span class="tiny muted">${calm ? tr('Active today', 'Aktiv i dag') : tr('Moved today', 'Bevegelse i dag')}</span><span class="v num">${moved}</span><span class="tiny muted num">${h.steps != null ? `${n0(h.steps)} ${tr('steps', 'skritt')}` : '&nbsp;'}</span></a>
    </div>
    ${stale ? `<p class="tiny muted">${lastSync() ? tr('Not synced today yet. Run the Vektplan Health shortcut, then tap Sync.', 'Ikke hentet i dag ennå. Kjør snarveien Vektplan Health, og trykk så Hent.') : tr('Run the Vektplan Health shortcut, then tap Sync.', 'Kjør snarveien Vektplan Health, og trykk så Hent.')}</p>` : ''}
    ${note}
  </section>`;
}

function stomachCard(d) {
  const last = latestStomach(d);
  return `<section class="card tight" aria-label="${tr('Stomach check-in', 'Magesjekk')}">
    <h2 class="h3">${tr("How's your stomach right now?", 'Hvordan er magen akkurat nå?')}</h2>
    <div class="grid2" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">
      ${LEVELS.map(([id, label]) => `<button class="chip ${last?.level === id ? 'on' : ''}" style="justify-content:center;min-height:44px;border-radius:14px" aria-pressed="${last?.level === id}" data-act="stomach" data-level="${id}">${label()}</button>`).join('')}
    </div></section>`;
}

function gentleNote(d, current) {
  const last = latestStomach(d);
  if (!last || (last.level !== 'queasy' && last.level !== 'rough') || !current) return '';
  if (d.gentleAt && d.gentleAt > last.ts) return '';
  return `<div class="note amber">${icon('leaf', 18)}<div class="grow col" style="gap:8px">
    <span>${tr('Rough stomach? I can switch the rest of today to the gentlest options: cold smoothie, soup, butter rice.', 'Dårlig mage? Jeg kan bytte resten av dagen til de mildeste valgene: kald smoothie, suppe, smørris.')}</span>
    <div class="row" style="gap:8px"><button class="btn small primary" data-act="gentle">${tr('Make it gentle', 'Gjør det mildt')}</button><a class="btn small secondary" href="#/coach">${tr('Talk to coach', 'Snakk med coach')}</a></div></div></div>`;
}

function eatenList(d) {
  const calm = S().prefs.calm;
  const logs = d.logs.slice().sort((a, b) => a.ts - b.ts);
  return `<section class="card" aria-label="${tr('Eaten today', 'Spist i dag')}">
    <div class="row between"><h2 class="h3">${tr('Eaten today', 'Spist i dag')}</h2><a class="link-btn" href="#/log">${icon('plus', 16)} ${tr('Add', 'Legg til')}</a></div>
    ${logs.length ? `<div class="list">${logs.map((l) => `<button class="item" data-act="editlog" data-id="${l.id}">
        <span class="small muted num" style="width:42px">${clock(l.ts)}</span>
        <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(l.title)}</span>
        ${l.portion && l.portion < 1 ? `<span class="s">${l.portion === 0.25 ? tr('a few bites', 'noen biter') : l.portion === 0.5 ? tr('half', 'halvparten') : '¾'}</span>` : ''}</span>
        ${calm ? '' : `<span class="small num soft">${n0(l.kcal)}</span>`}</button>`).join('')}</div>`
      : `<p class="small muted">${tr('Nothing logged yet today. Your first meal is the hardest, and it can be small.', 'Ingenting logget ennå i dag. Det første måltidet er tyngst, og det kan være lite.')}</p>`}
  </section>`;
}

function wordsCard() {
  const st = S();
  const idx = (dayNum(dayKey()) + (st.wordOffset || 0)) % WORDS.length;
  const w = WORDS[idx];
  return `<button class="card flat" style="background:transparent;padding:4px 4px 0;text-align:left;border:none" data-act="word" aria-label="${tr('Show another', 'Vis en annen')}">
    <p style="font-size:18px;font-weight:600;line-height:1.4;color:var(--soft)">${esc(getLang() === 'nb' ? w[1] : w[0])}</p>
    <span class="tiny muted">${tr('Tap for another', 'Trykk for en ny')}</span></button>`;
}

function installNote() {
  if (!isIOS() || isStandalone() || S().prefs.hideInstall) return '';
  return `<div class="note">${icon('phone', 18)}<div class="grow"><span>${tr('Put Vektplan on your Home Screen: tap the Share button in Safari, then "Add to Home Screen".', 'Legg Vektplan på Hjem-skjermen: trykk Del-knappen i Safari, og så «Legg til på Hjem-skjerm».')}</span>
    <button class="link-btn" data-act="hideInstall" style="display:block">${tr('Got it', 'Skjønner')}</button></div></div>`;
}

function updateBanner() {
  if (update.status !== 'ready' && update.status !== 'available') return '';
  return `<button class="banner" data-act="update">${icon('refresh', 20)}<span class="grow">${tr('A new version of Vektplan is ready. Tap to update.', 'En ny versjon av Vektplan er klar. Trykk for å oppdatere.')}</span></button>`;
}

export function render() {
  const st = S();
  const key = dayKey();
  const d = peekDay(key);
  const { list, current } = dayStatus(key);
  const t = totals(key);
  const s = streak();
  const name = st.profile.name ? `, ${esc(st.profile.name)}` : '';
  return `<div class="screen">
    <div class="blob b1"></div><div class="blob b2"></div>
    ${updateBanner()}
    <header class="head">
      <div class="titles"><p class="eyebrow">${longDate()}${s >= 2 ? ` · <span style="color:var(--accent);font-weight:600">${icon('flame', 13, 'style="vertical-align:-2px"')} ${s} ${tr('days in a row', 'dager på rad')}</span>` : ''}</p>
      <h1 class="h1">${greeting()}${name}</h1></div>
      <div class="row" style="gap:8px">
        <a class="icon-btn surface accent" href="#/coach" aria-label="${tr('Coach', 'Coach')}">${icon('sparkle')}</a>
        <a class="icon-btn surface" href="#/settings" aria-label="${tr('Settings', 'Innstillinger')}">${icon('sliders')}</a>
      </div>
    </header>
    ${installNote()}
    ${progressCard(list, t)}
    <p class="cheer-line">${esc(todayLine(key))}</p>
    ${gentleNote(d, current)}
    ${nextCard(current, list)}
    ${tiles()}
    ${suppsCard(key)}
    ${watchHint()}
    ${watchCard()}
    ${stomachCard(d)}
    ${eatenList(d)}
    ${wordsCard()}
  </div>${tabbar('today')}`;
}

let timer = null;
export function mount() {
  clearInterval(timer);
  timer = setInterval(() => {
    const a = document.activeElement;
    if (sheetOpen() || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) return;
    nav.rerender();
  }, 60_000);
}
export function unmount() {
  clearInterval(timer);
}

export const actions = {
  supp: (el) => tickSupp(el),
  suppEdit: () => suppsSheet(),
  ate: () => {
    const { current } = dayStatus();
    if (current) eatSheet(dayKey(), current);
  },
  smaller: () => {
    const { current } = dayStatus();
    if (current) smallerSheet(dayKey(), current);
  },
  skip: () => {
    const { current } = dayStatus();
    if (current) skipCurrent(dayKey(), current);
  },
  stomach: (el) => {
    const level = el.dataset.level;
    mutate(() => day().stomach.push({ ts: Date.now(), level }));
    const msg = {
      good: tr('Love that. Keep riding the good wave.', 'Herlig. Nyt den gode dagen.'),
      okay: tr('Okay is good enough. Small and steady.', 'Ok er godt nok. Lite og jevnt.'),
      queasy: tr('Sorry. Cold, plain and small helps. Sip, don’t rush.', 'Så kjipt. Kaldt, enkelt og lite hjelper. Små slurker, ingen hast.'),
      rough: tr('That sounds hard. Be gentle with yourself today.', 'Det høres tøft ut. Vær snill med deg selv i dag.'),
    }[level];
    toast(msg, 3000);
    nav.rerender();
  },
  gentle: () => {
    const n = makeRestGentle();
    toast(n ? tr('Done. The rest of today is extra gentle.', 'Ferdig. Resten av dagen er ekstra mild.') : tr('Nothing left to change today.', 'Ingenting igjen å endre i dag.'));
    nav.rerender();
  },
  editlog: (el) => editLogSheet(dayKey(), el.dataset.id),
  word: () => {
    mutate((s) => { s.wordOffset = (s.wordOffset || 0) + 1; });
    nav.rerender();
  },
  hideInstall: () => {
    mutate((s) => { s.prefs.hideInstall = true; });
    nav.rerender();
  },
  update: () => applyUpdate(),
  syncHealth: () => syncHealth(),
  runShortcut: () => { markPending(); location.href = shortcutURL(); },
  swapNow: () => {
    const { current } = dayStatus();
    if (current) swapSheet(dayKey(), current.slot);
  },
  quickMy: (el) => {
    const { current } = dayStatus();
    if (current) eatSheet(dayKey(), current, { kind: 'my', id: el.dataset.id });
  },
  hideWatchHint: () => { mutate((s) => { s.prefs.watchHint = false; }); nav.rerender(); },
};
