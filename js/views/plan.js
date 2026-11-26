// Training plan: a short wizard to build your own plan, and an overview to change any part of it.
import { S, mutate } from '../store.js';
import { tr, L, dayShort } from '../i18n.js';
import { icon, openSheet, closeSheet, toast, confirmSheet } from '../ui.js';
import { PLACES, PLACE_ORDER, GROUP_ORDER } from '../data/exercises.js';
import { equipSheet } from './program.js';
import {
  SPLITS, LENGTHS, LEVELS, REST_MODES, buildPlan, savePlan, programReady, training, sessions, sessionById, exName, groupName, groupsText,
  addSession, setDay, setExtra, workoutDef, suggest,
} from '../training.js';
import { esc, parseKey, addDays, startOfWeek, dayKey } from '../util.js';
import { nav } from '../nav.js';

const WD = () => Array.from({ length: 7 }, (_, i) => dayShort(parseKey(addDays(startOfWeek(dayKey()), i))));
const WD_LONG = () => {
  const base = startOfWeek(dayKey());
  return Array.from({ length: 7 }, (_, i) => parseKey(addDays(base, i)).toLocaleDateString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB', { weekday: 'long' }));
};

let wiz = null;
let preview = null;
let roll = 0;
const STEPS = 6;

function freshWiz() {
  const t = training();
  return {
    step: 0,
    level: t.level || 'gentle',
    place: t.place || null,
    days: t.days?.length ? t.days.slice() : [0, 2, 4],
    split: t.split || null,
    length: t.length || 'normal',
    rest: t.rest || 'mix',
    custom: JSON.parse(JSON.stringify(t.custom || {})),
  };
}

function recommendSplit(n) {
  if (n <= 3) return 'full';
  if (n === 4) return 'ul';
  return 'ppl';
}

export function enter(ctx) {
  if (ctx.params[0] === 'new' || !programReady()) {
    wiz = freshWiz();
    preview = null;
  } else wiz = null;
}

const choice = (act, v, on, title, sub, extra = '') => `<button class="choice" aria-pressed="${on}" data-act="${act}" data-v="${v}" style="text-align:left;flex-direction:column;align-items:flex-start;gap:0">
  <span style="display:block;font-weight:700">${title}${extra}</span>${sub ? `<span class="small soft" style="display:block;margin-top:3px;line-height:1.4;font-weight:400">${sub}</span>` : ''}</button>`;

function wizStep() {
  const w = wiz;
  switch (w.step) {
    case 0:
      return `<h1 class="h1" style="font-size:28px">${tr('Build your plan', 'Lag planen din')}</h1>
        <p class="soft" style="line-height:1.5">${tr('Six quick questions. Vektplan picks exercises that fit, and you can change every part afterwards.', 'Seks raske spørsmål. Vektplan velger øvelser som passer, og du kan endre alt etterpå.')}</p>
        <p class="label">${tr('How hard?', 'Hvor hardt?')}</p>
        <div class="col">${Object.entries(LEVELS).map(([k, v]) => choice('level', k, w.level === k, esc(L(v.name)), esc(L(v.sub)), k === 'gentle' ? ` <span class="badge accent" style="margin-left:6px">${tr('Recommended', 'Anbefalt')}</span>` : '')).join('')}</div>`;
    case 1:
      return `<h1 class="h1" style="font-size:28px">${tr('Where do you train?', 'Hvor trener du?')}</h1>
        <div class="col">${PLACE_ORDER.map((k) => choice('place', k, w.place === k, esc(L(PLACES[k].name)), esc(L(PLACES[k].sub)))).join('')}</div>
        <button class="link-btn" data-act="equip" style="align-self:flex-start">${icon('dumbbell', 16)} ${tr('Choose your equipment', 'Velg utstyret ditt')}</button>`;
    case 2:
      return `<h1 class="h1" style="font-size:28px">${tr('Which days?', 'Hvilke dager?')}</h1>
        <p class="soft">${w.level === 'gentle' ? tr('2 or 3 days is plenty. Muscles grow on the days in between.', '2 eller 3 dager holder. Musklene vokser dagene imellom.') : tr('3 to 4 days is a good start.', '3 til 4 dager er en god start.')}</p>
        <div class="daypick big">${WD().map((d, i) => `<button class="dp" aria-pressed="${w.days.includes(i)}" data-act="day" data-v="${i}"><span>${esc(d)}</span></button>`).join('')}</div>
        <p class="small muted center">${w.days.length} ${w.days.length === 1 ? tr('day a week', 'dag i uka') : tr('days a week', 'dager i uka')}</p>`;
    case 3: {
      const rec = recommendSplit(w.days.length);
      const customDays = w.split === 'custom' ? w.days.slice().sort((a, b) => a - b) : [];
      return `<h1 class="h1" style="font-size:28px">${tr('How to split it?', 'Hvordan dele det opp?')}</h1>
        <div class="col">${Object.entries(SPLITS).map(([k, v]) => choice('split', k, w.split === k, esc(L(v.name)), esc(L(v.sub)), k === rec ? ` <span class="badge accent" style="margin-left:6px">${tr('Fits your days', 'Passer dagene dine')}</span>` : '')).join('')}</div>
        ${customDays.length ? `<div class="col" style="gap:12px">${customDays.map((d) => `<div class="card tight"><p class="h3" style="text-transform:capitalize">${esc(WD_LONG()[d])}</p>
          <div class="chips">${GROUP_ORDER.filter((g) => g !== 'mobility').map((g) => `<button class="chip solid" aria-pressed="${(w.custom[d] || []).includes(g)}" data-act="cg" data-d="${d}" data-g="${g}">${esc(groupName(g))}</button>`).join('')}</div></div>`).join('')}</div>` : ''}`;
    }
    case 4:
      return `<h1 class="h1" style="font-size:28px">${tr('How long, and rest days?', 'Hvor lenge, og hviledager?')}</h1>
        <p class="label">${tr('Session length', 'Lengde på øktene')}</p>
        <div class="seg">${Object.entries(LENGTHS).map(([k, v]) => `<button aria-pressed="${w.length === k}" data-act="length" data-v="${k}">${esc(L(v.name))}</button>`).join('')}</div>
        <p class="small muted center">${esc(L(LENGTHS[w.length].sub))}${w.level === 'gentle' ? ` · ${tr('max 5 exercises, 2 sets each', 'maks 5 øvelser, 2 sett hver')}` : ''}</p>
        <p class="label">${tr('On the other days', 'De andre dagene')}</p>
        <div class="col">${Object.entries(REST_MODES).map(([k, v]) => choice('rest', k, w.rest === k, esc(L(v)), '')).join('')}</div>
        <p class="tiny muted">${tr('Easy walks are good for the stomach and appetite. Keep them short while you are trying to gain.', 'Rolige gåturer er bra for magen og matlysten. Hold dem korte mens du prøver å gå opp.')}</p>`;
    default: {
      preview ||= buildPlan(w);
      const days = WD();
      return `<h1 class="h1" style="font-size:28px">${tr('Your plan', 'Planen din')}</h1>
        <div class="week-plan">${days.map((d, i) => {
          const sid = preview.schedule[i];
          const s = preview.sessions.find((x) => x.id === sid);
          const ex = preview.extras[i];
          return `<div class="wp ${s ? 'on' : ''}"><span class="d">${esc(d)}</span><span class="t">${s ? esc(s.name) : ex === 'walk' ? tr('Walk', 'Gåtur') : ex === 'stretch' ? tr('Stretch', 'Tøying') : tr('Rest', 'Hvile')}</span></div>`;
        }).join('')}</div>
        ${preview.sessions.map((s) => `<section class="card tight"><div class="row between"><h2 class="h3">${esc(s.name)}</h2><span class="tiny muted">${esc(groupsText(s.groups))}</span></div>
          <div class="list">${s.ex.map((e) => `<div class="item" style="justify-content:space-between"><span>${esc(exName(e.id))}</span><span class="small muted num">${e.sets} × ${e.reps}</span></div>`).join('')}</div></section>`).join('')}
        <p class="small muted center">${tr('Not quite right? Save it and change anything on the next screen.', 'Ikke helt riktig? Lagre og endre hva du vil på neste skjerm.')}</p>`;
    }
  }
}

function canNext() {
  const w = wiz;
  if (w.step === 1) return !!w.place;
  if (w.step === 2) return w.days.length > 0;
  if (w.step === 3) return !!w.split && (w.split !== 'custom' || w.days.every((d) => (w.custom[d] || []).length));
  return true;
}

function wizView() {
  const last = wiz.step === STEPS - 1;
  return `<div class="screen no-tabs setup" style="gap:16px">
    <header class="head" style="margin-bottom:-4px"><button class="icon-btn surface" data-act="wback" aria-label="${tr('Back', 'Tilbake')}">${icon(wiz.step ? 'chevL' : 'x', 20)}</button>
      <div class="steps-dots grow" style="margin:0">${Array.from({ length: STEPS }, (_, i) => `<span class="${i <= wiz.step ? 'on' : ''}"></span>`).join('')}</div></header>
    ${wizStep()}
    <div class="btns" style="margin-top:6px">${last
      ? `<button class="btn secondary" data-act="reroll">${icon('refresh', 18)} ${tr('Other exercises', 'Andre øvelser')}</button><button class="btn primary" data-act="save">${icon('check', 18)} ${tr('Save my plan', 'Lagre planen')}</button>`
      : `<button class="btn primary" data-act="wnext" ${canNext() ? '' : 'disabled'}>${tr('Continue', 'Fortsett')} ${icon('chevR', 18)}</button>`}</div>
  </div>`;
}

// ---------- Overview ----------
function dayLabel(i) {
  const t = training();
  const sid = t.schedule?.[i];
  const s = sid && sessionById(sid);
  if (s) return { text: s.name, kind: 'session', id: s.id };
  const ex = t.extras?.[i];
  if (ex === 'walk') return { text: tr('Walk', 'Gåtur'), kind: 'walk' };
  if (ex === 'stretch') return { text: tr('Gentle stretch', 'Rolig tøying'), kind: 'stretch' };
  return { text: tr('Rest', 'Hvile'), kind: 'rest' };
}

function overview() {
  const t = training();
  const days = WD_LONG();
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <div class="titles grow"><p class="eyebrow">${esc(L(PLACES[t.place]?.name || PLACES.home.name))} · ${esc(L(LEVELS[t.level]?.name || LEVELS.gentle.name))}</p><h1 class="h1">${tr('Your plan', 'Planen din')}</h1></div></header>

    <section class="card" aria-label="${tr('Week', 'Uke')}">
      <h2 class="h3">${tr('Your week', 'Uka di')}</h2>
      <div class="list">${days.map((d, i) => {
        const l = dayLabel(i);
        return `<button class="item" data-act="pickDay" data-d="${i}"><span class="small muted" style="width:76px;text-transform:capitalize">${esc(d)}</span>
          <span class="grow" style="font-weight:${l.kind === 'session' ? 600 : 400};color:${l.kind === 'rest' ? 'var(--muted)' : 'inherit'}">${esc(l.text)}</span>${icon('chevR', 16)}</button>`;
      }).join('')}</div>
    </section>

    <div class="section-title"><h2 class="h2">${tr('Your sessions', 'Øktene dine')}</h2><button class="link-btn" data-act="newSession">${icon('plus', 16)} ${tr('New', 'Ny')}</button></div>
    <div class="col" style="gap:10px">${sessions().map((s) => `<a class="card tight link" href="#/session/${s.id}" style="text-decoration:none;color:inherit">
      <div class="row between"><span class="h3">${esc(s.name)}</span>${icon('pencil', 16)}</div>
      <span class="small muted">${esc(groupsText(s.groups))} · ${s.ex.length} ${tr('exercises', 'øvelser')} · ~${workoutDef(s.id)?.minutes || 20} min</span></a>`).join('')}</div>

    <section class="card">
      <h2 class="h3">${tr('Settings for the plan', 'Innstillinger for planen')}</h2>
      <p class="label">${tr('Level', 'Nivå')}</p>
      <div class="seg">${Object.entries(LEVELS).map(([k, v]) => `<button aria-pressed="${(t.level || 'gentle') === k}" data-act="setLevel" data-v="${k}">${esc(L(v.name))}</button>`).join('')}</div>
      <p class="label">${tr('Rest between sets', 'Pause mellom sett')}</p>
      <div class="seg">${[60, 90, 120].map((v) => `<button aria-pressed="${(t.restSec || 90) === v}" data-act="setRest" data-v="${v}">${v === 60 ? '1 min' : v === 90 ? '1½ min' : '2 min'}</button>`).join('')}</div>
      <p class="label">${tr('Where you train', 'Hvor du trener')}</p>
      <div class="seg">${PLACE_ORDER.map((k) => `<button aria-pressed="${t.place === k}" data-act="setPlace" data-v="${k}">${esc(L(PLACES[k].name))}</button>`).join('')}</div>
      <button class="link-btn" data-act="equip" style="align-self:flex-start">${icon('dumbbell', 16)} ${tr('Your equipment', 'Utstyret ditt')}</button>
      <p class="tiny muted">${tr('Changing where you train only affects new suggestions. Swap single exercises in each session.', 'Endrer du hvor du trener, påvirker det bare nye forslag. Bytt enkeltøvelser i hver økt.')}</p>
    </section>

    <a class="btn secondary" href="#/plan/new">${icon('refresh', 18)} ${tr('Build a new plan', 'Lag en ny plan')}</a>
    <button class="link-btn" style="align-self:center;color:var(--muted)" data-act="builtin">${tr('Go back to the built-in beginner plan', 'Gå tilbake til den innebygde nybegynnerplanen')}</button>
  </div>`;
}

export function render() {
  return wiz ? wizView() : overview();
}

export const actions = {
  equip: () => equipSheet(),
  back: () => nav.back('train'),
  wback: () => {
    if (wiz.step === 0) { wiz = null; nav.back('train'); return; }
    wiz.step--;
    preview = null;
    nav.rerender();
    nav.scrollTo(0);
  },
  wnext: () => {
    if (!canNext()) return;
    if (wiz.step === 2 && !wiz.split) wiz.split = recommendSplit(wiz.days.length);
    wiz.step++;
    preview = null;
    nav.rerender();
    nav.scrollTo(0);
  },
  level: (el) => { wiz.level = el.dataset.v; nav.rerender(); },
  place: (el) => { wiz.place = el.dataset.v; nav.rerender(); },
  day: (el) => {
    const d = Number(el.dataset.v);
    wiz.days = wiz.days.includes(d) ? wiz.days.filter((x) => x !== d) : [...wiz.days, d].sort((a, b) => a - b);
    nav.rerender();
  },
  split: (el) => { wiz.split = el.dataset.v; nav.rerender(); },
  cg: (el) => {
    const d = el.dataset.d;
    const g = el.dataset.g;
    const cur = wiz.custom[d] || [];
    wiz.custom[d] = cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g];
    nav.rerender();
  },
  length: (el) => { wiz.length = el.dataset.v; nav.rerender(); },
  rest: (el) => { wiz.rest = el.dataset.v; nav.rerender(); },
  reroll: () => {
    // Same days and split, the next exercises in the library.
    roll++;
    const lvl = LEVELS[wiz.level] || LEVELS.gentle;
    const len = LENGTHS[wiz.length] || LENGTHS.normal;
    preview = buildPlan(wiz);
    preview.sessions.forEach((x, i) => { x.ex = suggest(x.groups, wiz.place || 'home', Math.min(len.n, lvl.maxN), roll + i, Math.min(len.sets, lvl.sets), wiz.level !== 'normal'); });
    nav.rerender();
  },
  save: async () => {
    if (programReady()) {
      const ok = await confirmSheet({
        title: tr('Replace your current plan?', 'Erstatte planen du har?'),
        text: tr('Your sessions are replaced by the new ones. Your workout history and own exercises stay.', 'Øktene dine byttes ut med de nye. Treningshistorikken og egne øvelser blir værende.'),
        yes: tr('Replace', 'Erstatt'),
      });
      if (!ok) return;
    }
    const plan = preview || buildPlan(wiz);
    savePlan(plan);
    wiz = null;
    preview = null;
    toast(tr('Your plan is ready. Change anything you like.', 'Planen din er klar. Endre det du vil.'), 3000);
    nav.go('train');
  },
  pickDay: (el) => {
    const d = Number(el.dataset.d);
    const t = training();
    const cur = t.schedule?.[d] || t.extras?.[d] || 'rest';
    const opts = [
      ...sessions().map((s) => [s.id, s.name]),
      ['walk', tr('Walk', 'Gåtur')],
      ['stretch', tr('Gentle stretch', 'Rolig tøying')],
      ['rest', tr('Rest', 'Hvile')],
    ];
    openSheet({
      title: esc(WD_LONG()[d]),
      html: `<div class="list">${opts.map(([id, name]) => `<button class="item" data-act="set" data-id="${id}"><span class="grow" style="font-weight:${cur === id ? 700 : 400}">${esc(name)}</span>${cur === id ? icon('check', 18, 'style="color:var(--accent)"') : ''}</button>`).join('')}</div>`,
      actions: {
        set: (b) => {
          const id = b.dataset.id;
          if (id === 'walk' || id === 'stretch') { setDay(d, null); setExtra(d, id); }
          else if (id === 'rest') { setDay(d, null); setExtra(d, null); }
          else setDay(d, id);
          closeSheet();
          nav.rerender();
        },
      },
    });
  },
  newSession: () => {
    const s = addSession(['chest', 'back']);
    nav.go(`session/${s.id}`);
  },
  setLevel: async (el) => {
    const v = el.dataset.v;
    const sets = LEVELS[v].sets;
    mutate((s) => { s.training.level = v; s.training.restSec = LEVELS[v].rest; });
    const ok = await confirmSheet({
      title: tr(`Use ${sets} sets everywhere?`, `Bruke ${sets} sett overalt?`),
      text: tr(`Set every exercise in your sessions to ${sets} sets? You can still change single exercises.`, `Sette alle øvelsene i øktene til ${sets} sett? Du kan fortsatt endre enkeltøvelser.`),
      yes: tr('Yes', 'Ja'),
      no: tr('Keep as is', 'Behold'),
    });
    if (ok) mutate((s) => { for (const x of s.training.sessions || []) for (const e of x.ex) if (e.sets > 1) e.sets = sets; });
    nav.rerender();
  },
  setRest: (el) => { mutate((s) => { s.training.restSec = Number(el.dataset.v); }); nav.rerender(); },
  setPlace: (el) => { mutate((s) => { s.training.place = el.dataset.v; }); nav.rerender(); },
  builtin: async () => {
    const ok = await confirmSheet({
      title: tr('Use the built-in plan?', 'Bruke den innebygde planen?'),
      text: tr('Your own sessions are removed and Strength A/B, walks and stretching come back. Your history stays.', 'Øktene dine fjernes, og Styrke A/B, gåturer og tøying kommer tilbake. Historikken blir værende.'),
      yes: tr('Use built-in', 'Bruk innebygd'),
      danger: true,
    });
    if (!ok) return;
    mutate((s) => { s.training = { customEx: s.training?.customEx || {} }; });
    nav.go('train');
  },
};
