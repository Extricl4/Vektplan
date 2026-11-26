// Your own training plan: where you train, which days, and how muscle groups are split.
// Before a plan is made, the original built-in rhythm (Strength A/B, walks, stretch) is used.
import { S, mutate } from './store.js';
import { LIB, GROUPS, GROUP_ORDER, PLACES, weighted, kgStep } from './data/exercises.js';
import { WORKOUTS, WEEK_PLAN, OTHER_ACTIVITIES } from './data/workouts.js';
import { L, tr } from './i18n.js';
import { dayKey, weekday, dayNum, startOfWeek, uid } from './util.js';
import { SLOTS, slotIds, slotPick, FOCUS, FOCUS_ORDER, PROGRAMS, REPS, EASIER, HARDER, normFocus } from './data/programs.js';

const N = (en, nb) => ({ en, nb });

export const SPLITS = {
  full: {
    name: N('Full body', 'Hele kroppen'),
    sub: N('Every session trains everything. Best for 2–3 days a week and for getting started.', 'Hver økt trener alt. Best for 2–3 dager i uka og når du skal komme i gang.'),
    templates: [{ key: 'full', groups: ['legs', 'chest', 'back', 'shoulders', 'glutes', 'core'] }],
  },
  ul: {
    name: N('Upper + lower', 'Overkropp + underkropp'),
    sub: N('Upper body one day, legs and core the next. Great for 4 days.', 'Overkropp én dag, bein og kjerne neste. Fint for 4 dager.'),
    templates: [
      { key: 'upper', groups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] },
      { key: 'lower', groups: ['legs', 'glutes', 'core'] },
    ],
  },
  ppl: {
    name: N('Push · Pull · Legs', 'Push · Pull · Bein'),
    sub: N('Chest, shoulders and triceps; back and biceps; legs. Fits 3 or 6 days.', 'Bryst, skuldre og triceps; rygg og biceps; bein. Passer 3 eller 6 dager.'),
    templates: [
      { key: 'push', groups: ['chest', 'shoulders', 'triceps'] },
      { key: 'pull', groups: ['back', 'biceps', 'core'] },
      { key: 'legs', groups: ['legs', 'glutes', 'core'] },
    ],
  },
  custom: {
    name: N('I pick the muscle groups', 'Jeg velger muskelgrupper'),
    sub: N('Choose what each day trains, for example chest + arms on Monday.', 'Velg hva hver dag trener, for eksempel bryst + armer på mandag.'),
    templates: [],
  },
};

const TEMPLATE_NAMES = {
  full: N('Full body', 'Hele kroppen'),
  upper: N('Upper body', 'Overkropp'),
  lower: N('Lower body', 'Underkropp'),
  push: N('Push', 'Push'),
  pull: N('Pull', 'Pull'),
  legs: N('Legs', 'Bein'),
};

export const LENGTHS = {
  short: { n: 4, sets: 2, name: N('Short', 'Kort'), sub: N('About 20 min', 'Cirka 20 min') },
  normal: { n: 6, sets: 3, name: N('Normal', 'Vanlig'), sub: N('About 35 min', 'Cirka 35 min') },
  long: { n: 7, sets: 3, name: N('Long', 'Lang'), sub: N('About 50 min', 'Cirka 50 min') },
};

export const REST_MODES = {
  mix: N('Walks and stretching', 'Gåturer og tøying'),
  walk: N('Easy walks', 'Rolige gåturer'),
  none: N('Just rest', 'Bare hvile'),
};

export const groupName = (g) => L(GROUPS[g] || N(g, g));
export const groupsText = (groups) => groups.filter((g) => GROUPS[g]).map(groupName).join(' · ');
// Built-in exercises plus the ones you made yourself.
export const customEx = () => S().training?.customEx || {};
export const getEx = (id) => LIB[id] || customEx()[id] || null;
export const exById = getEx;
export const exName = (id) => (getEx(id) ? L(getEx(id).name) : id);
export const allEx = () => ({ ...LIB, ...customEx() });
// 20 kg, 22.5 kg (with a decimal comma in Norwegian).
export const kgFmt = (kg) => `${(Math.round(kg * 10) / 10).toLocaleString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB', { maximumFractionDigits: 1 })} kg`;

// Gentle = for when you eat very little: fewer sets, longer rest, stop well before failure.
export const LEVELS = {
  gentle: { sets: 2, maxN: 5, rest: 90, name: N('Gentle', 'Skånsom'), sub: N('Short sessions, 2 sets, long rests. Best while you are eating little: muscle grows from food and rest, not from wearing yourself out.', 'Korte økter, 2 sett, lange pauser. Best mens du spiser lite: muskler vokser av mat og hvile, ikke av å slite deg ut.') },
  normal: { sets: 3, maxN: 7, rest: 75, name: N('Normal', 'Vanlig'), sub: N('3 sets per exercise. For when eating and energy are steady.', '3 sett per øvelse. For når maten og energien er stabil.') },
};
// Never auto-picked: they press on the stomach. You can still add them yourself.
const NO_AUTO = new Set(['crunch', 'legraise', 'cablecrunch']);
// Near-identical movements: a suggested session gets at most one of each family.
const FAMILY = {
  bwsquat: 'squat', squat: 'squat', bbsquat: 'squat', legpress: 'squat',
  pushup: 'pushup', incline: 'pushup', diamond: 'pushup',
  dbpress: 'bench', benchpress: 'bench', chestpress: 'bench',
  dbfly: 'fly', cablefly: 'fly',
  bridge: 'bridge', singlebridge: 'bridge', hipthrust: 'bridge',
  press: 'ohp', machpress: 'ohp', pikepush: 'ohp',
  latpull: 'vpull', pullup: 'vpull', chinup: 'vpull',
  curl: 'curl', bagcurl: 'curl', bbcurl: 'curl', cablecurl: 'curl',
  ohext: 'ext', skull: 'ext', pushdown: 'ext',
  rdl: 'hinge', deadlift: 'hinge',
  plank: 'plank', sideplank: 'plank',
};

export const training = () => S().training || {};
export const programReady = () => (training().sessions || []).length > 0;
export const sessions = () => training().sessions || [];
export const sessionById = (id) => sessions().find((s) => s.id === id) || null;

// ---------- Picking exercises ----------
// The equipment you have at a place (you can tick what you own). Body weight is always there.
export function allowedEquip(place) {
  const own = training().equip?.[place];
  return [...new Set(['none', ...(Array.isArray(own) ? own : (PLACES[place] || PLACES.home).equip)])];
}
export function setEquip(place, list) {
  mutate((s) => {
    s.training ||= {};
    s.training.equip = { ...(s.training.equip || {}), [place]: [...new Set(list)].filter((e) => e !== 'none') };
  });
}
export function available(exId, place = training().place || 'home') {
  const ex = LIB[exId];
  return !!ex && ex.equip.some((e) => allowedEquip(place).includes(e));
}

const HEAVY = new Set(['deadlift', 'bbsquat']);

function poolFor(group, place, gentle = false) {
  // With weights available, body-weight moves come after the loaded ones of the same rank.
  const loaded = allowedEquip(place).some((e) => ['dumbbell', 'kettlebell', 'barbell', 'machine', 'cable'].includes(e));
  const rank = (ex) => ex.pri + (loaded && ex.equip.every((e) => e === 'none' || e === 'band') ? 0.5 : 0);
  return Object.entries(LIB)
    .filter(([id, ex]) => !NO_AUTO.has(id) && !(gentle && HEAVY.has(id)) && ex.groups[0] === group && ex.equip.some((e) => allowedEquip(place).includes(e)))
    .sort((a, b) => rank(a[1]) - rank(b[1]))
    .map(([id]) => id);
}

// Fill a session: round-robin over its muscle groups (big groups first), main lifts first.
// `variant` rotates the choices so Full body A and B don't repeat each other.
export function suggest(groups, place = 'home', n = 6, variant = 0, sets = 3, gentle = (training().level || 'gentle') === 'gentle') {
  const gs = GROUP_ORDER.filter((g) => groups.includes(g) && g !== 'mobility');
  const pools = gs.map((g) => {
    const p = poolFor(g, place, gentle);
    const v = p.length ? variant % p.length : 0;
    return p.slice(v).concat(p.slice(0, v));
  });
  const picked = [];
  const fams = new Set();
  const free = (x) => !picked.includes(x) && !(FAMILY[x] && fams.has(FAMILY[x]));
  for (let round = 0; round < 6 && picked.length < n; round++) {
    gs.forEach((g, gi) => {
      if (picked.length >= n) return;
      const id = pools[gi].find(free);
      if (id) { picked.push(id); if (FAMILY[id]) fams.add(FAMILY[id]); }
    });
  }
  // Small groups may run out of distinct moves: borrow ones that also train them, then allow repeats of a family.
  const ok = (ex) => ex.equip.some((e) => allowedEquip(place).includes(e));
  const secondary = Object.entries(LIB)
    .filter(([id, ex]) => !NO_AUTO.has(id) && !(gentle && HEAVY.has(id)) && ok(ex) && ex.groups.slice(1).some((g) => gs.includes(g)))
    .sort((a, b) => a[1].pri - b[1].pri)
    .map(([id]) => id);
  for (const id of secondary) {
    if (picked.length >= n) break;
    if (free(id)) { picked.push(id); if (FAMILY[id]) fams.add(FAMILY[id]); }
  }
  for (let gi = 0; picked.length < n && gi < gs.length * 3; gi++) {
    const id = pools[gi % gs.length].find((x) => !picked.includes(x));
    if (id) picked.push(id);
  }
  return picked.map((id) => ({ id, sets, reps: LIB[id].def }));
}

// The exercises you could add to a session, best first.
export function pickList({ group = 'all', place = training().place || 'home', onlyMine = true, q = '' } = {}) {
  const needle = String(q || '').toLowerCase().trim();
  return Object.entries(allEx())
    .filter(([, ex]) => group === 'all' || ex.groups.includes(group))
    .filter(([id, ex]) => !onlyMine || ex.custom || ex.equip.some((e) => allowedEquip(place).includes(e)))
    .filter(([, ex]) => !needle || L(ex.name).toLowerCase().includes(needle) || ex.name.en.toLowerCase().includes(needle))
    .sort((a, b) => (a[1].groups[0] === group ? 0 : 1) - (b[1].groups[0] === group ? 0 : 1) || a[1].pri - b[1].pri)
    .map(([id]) => id);
}

export function addCustomExercise({ name, group, equip, mode, def }) {
  const id = 'x-' + uid();
  mutate((s) => {
    s.training ||= {};
    s.training.customEx ||= {};
    s.training.customEx[id] = { groups: [group || 'core'], equip: [equip || 'none'], mode: mode || 'reps', def: Number(def) || (mode === 'time' ? 30 : 10), pri: 5, name: { en: name, nb: name }, cue: { en: '', nb: '' }, custom: true };
  });
  return id;
}

export function alternatives(exId, place = currentPlace()) {
  const ex = getEx(exId);
  if (!ex) return [];
  return Object.entries(allEx())
    .filter(([id, e]) => id !== exId && e.groups[0] === ex.groups[0] && e.equip.some((q) => allowedEquip(place).includes(q)))
    .sort((a, b) => a[1].pri - b[1].pri)
    .map(([id]) => id);
}

// ---------- Building a plan ----------
const nameFromGroups = (groups) => groups.filter((g) => GROUPS[g]).slice(0, 3).map(groupName).join(' + ') || tr('Session', 'Økt');

export function buildPlan(cfg) {
  const place = cfg.place || 'home';
  const lvl = LEVELS[cfg.level] || LEVELS.gentle;
  const base = LENGTHS[cfg.length] || LENGTHS.normal;
  const len = { n: Math.min(base.n, lvl.maxN), sets: Math.min(base.sets, lvl.sets) };
  const days = [...new Set(cfg.days)].sort((a, b) => a - b);
  const out = [];
  const schedule = {};
  if (cfg.split === 'custom') {
    days.forEach((d, i) => {
      const groups = cfg.custom?.[d]?.length ? cfg.custom[d] : SPLITS.full.templates[0].groups;
      const s = { id: 's-' + uid(), name: nameFromGroups(groups), groups, ex: suggest(groups, place, len.n, i, len.sets, cfg.level !== 'normal') };
      out.push(s);
      schedule[d] = s.id;
    });
    // Same name twice (three chest days)? Call them A, B, C.
    const count = {};
    out.forEach((s) => { count[s.name] = (count[s.name] || 0) + 1; });
    const seen = {};
    out.forEach((s) => { if (count[s.name] > 1) { const n = seen[s.name] || 0; seen[s.name] = n + 1; s.name = `${s.name} ${'ABCDEFG'[n]}`; } });
  } else {
    const tpls = (SPLITS[cfg.split] || SPLITS.full).templates;
    const uses = {};
    days.forEach((d, i) => { const t = tpls[i % tpls.length]; uses[t.key] = (uses[t.key] || 0) + 1; });
    const made = {};
    days.forEach((d, i) => {
      const t = tpls[i % tpls.length];
      const rep = Math.floor(i / tpls.length);
      const key = t.key + rep;
      if (!made[key]) {
        const letter = uses[t.key] > 1 ? ` ${'ABCDEFG'[rep]}` : '';
        made[key] = { id: 's-' + uid(), name: L(TEMPLATE_NAMES[t.key]) + letter, groups: t.groups.slice(), ex: suggest(t.groups, place, len.n, rep, len.sets, cfg.level !== 'normal') };
        out.push(made[key]);
      }
      schedule[d] = made[key].id;
    });
  }
  // Rest days: easy walks and stretching, with at least one day fully off.
  const extras = {};
  const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d));
  const restMode = cfg.rest || 'mix';
  free.forEach((d, i) => {
    if (restMode === 'none' || i === free.length - 1) return;
    extras[d] = restMode === 'walk' ? 'walk' : i % 2 === 0 ? 'walk' : 'stretch';
  });
  return { place, days, split: cfg.split, length: cfg.length || 'normal', level: cfg.level || 'gentle', rest: restMode, restSec: lvl.rest, custom: cfg.custom || {}, sessions: out, schedule, extras, made: Date.now() };
}

// Saving a new plan keeps the exercises you made yourself.
export function savePlan(plan) {
  mutate((s) => { s.training = { ...plan, customEx: s.training?.customEx || {}, equip: s.training?.equip, todayPlace: s.training?.todayPlace || null }; });
}

export const restSeconds = () => training().restSec || S().prefs.restSec || 60;

export function updateSession(id, fn) {
  mutate((s) => {
    const x = s.training?.sessions?.find((q) => q.id === id);
    if (x) fn(x);
  });
}

export function addSession(groups = ['chest', 'back']) {
  const t = training();
  const lvl = LEVELS[t.level] || LEVELS.gentle;
  const base = LENGTHS[t.length] || LENGTHS.normal;
  const sess = { id: 's-' + uid(), name: nameFromGroups(groups), groups, ex: suggest(groups, t.place || 'home', Math.min(base.n, lvl.maxN), sessions().length, Math.min(base.sets, lvl.sets)) };
  mutate((s) => {
    s.training ||= {};
    (s.training.sessions ||= []).push(sess);
    s.training.schedule ||= {};
    s.training.extras ||= {};
  });
  return sess;
}

// Fill a session again from its muscle groups (after changing them).
export function refillSession(id) {
  const t = training();
  const lvl = LEVELS[t.level] || LEVELS.gentle;
  const base = LENGTHS[t.length] || LENGTHS.normal;
  updateSession(id, (x) => {
    x.ex = suggest(x.groups, t.place || 'home', Math.min(base.n, lvl.maxN), sessions().findIndex((q) => q.id === id), Math.min(base.sets, lvl.sets));
  });
}

export function deleteSession(id) {
  mutate((s) => {
    const t = s.training;
    if (!t) return;
    t.sessions = (t.sessions || []).filter((x) => x.id !== id);
    for (const [d, v] of Object.entries(t.schedule || {})) if (v === id) delete t.schedule[d];
  });
}

// Put a session on a weekday (or take it off). A weekday holds one session.
export function setDay(weekdayIdx, id) {
  mutate((s) => {
    const t = s.training;
    if (!t) return;
    t.schedule ||= {};
    t.extras ||= {};
    if (id) {
      t.schedule[weekdayIdx] = id;
      delete t.extras[weekdayIdx];
    } else delete t.schedule[weekdayIdx];
    t.days = Object.keys(t.schedule).map(Number).sort();
  });
}

export function setExtra(weekdayIdx, kind) {
  mutate((s) => {
    const t = s.training;
    if (!t) return;
    t.extras ||= {};
    if (kind) t.extras[weekdayIdx] = kind;
    else delete t.extras[weekdayIdx];
  });
}

// ---------- What's planned ----------
function legacyPlanned(key) {
  const type = WEEK_PLAN[weekday(key)];
  if (type !== 'strength') return type;
  const weekNo = Math.floor(dayNum(startOfWeek(key)) / 7);
  const before = WEEK_PLAN.slice(0, weekday(key)).filter((t) => t === 'strength').length;
  return (weekNo + before) % 2 === 0 ? 'strengthA' : 'strengthB';
}

export function plannedFor(key = dayKey()) {
  if (!programReady()) return legacyPlanned(key);
  const t = training();
  const wd = weekday(key);
  const sid = t.schedule?.[wd];
  if (sid && sessionById(sid)) return sid;
  return t.extras?.[wd] || 'rest';
}

function estimateMinutes(ex) {
  const m = ex.reduce((sum, e) => {
    const x = getEx(e.id);
    if (!x) return sum;
    return sum + (e.sets || 1) * (x.mode === 'time' ? (e.reps || x.def) / 60 + 1 : 1.8);
  }, 4);
  return Math.max(10, Math.round(m / 5) * 5);
}

// One shape for every kind of session: your own, the built-in ones, walks.
export function workoutDef(id, place = currentPlace()) {
  if (!id || id === 'rest') return null;
  if (id === 'walk') return { id, name: L(WORKOUTS.walk.name), sub: L(WORKOUTS.walk.sub), kind: 'walk', ex: [], minutes: 20, groups: [] };
  const s = sessionById(id);
  if (s) {
    const ex = resolveList(s.ex.filter((e) => getEx(e.id)), place);
    return { id, name: s.name, sub: groupsText(s.groups), kind: 'strength', ex, minutes: estimateMinutes(ex), groups: s.groups, own: true, slots: ex.some((e) => e.slot), place };
  }
  const w = WORKOUTS[id];
  if (w) {
    const ex = w.ex.map((e) => ({ id: e, sets: w.kind === 'mobility' ? 1 : 3, reps: LIB[e].def }));
    return { id, name: L(w.name), sub: L(w.sub), kind: w.kind, ex, minutes: w.minutes, groups: [] };
  }
  return null;
}

export function activityName(id, saved) {
  if (id === 'rest') return tr('Rest day', 'Hviledag');
  const def = workoutDef(id);
  if (def) return def.name;
  if (saved) return saved;
  const o = OTHER_ACTIVITIES.find((a) => a.id === id);
  return o ? L(o.name) : tr('Workout', 'Økt');
}

// Short label for the week strip.
export function shortName(id) {
  if (id === 'rest') return tr('Rest', 'Hvile');
  if (id === 'walk') return tr('Walk', 'Gå');
  if (id === 'stretch') return tr('Stretch', 'Tøy');
  if (id === 'strengthA' || id === 'strengthB') return tr('Strength', 'Styrke');
  const s = sessionById(id);
  if (!s) return '';
  if (s.kind === 'focus') return tr('Focus', 'Fokus');
  if (s.key && s.kind) {
    const letter = s.key.slice(-1);
    return `${s.kind === 'upper' ? tr('Upper', 'Over') : s.kind === 'lower' ? tr('Lower', 'Under') : tr('Full', 'Hel')} ${letter}`;
  }
  const first = s.name.split(/[ +·]/)[0];
  return first.length > 7 ? first.slice(0, 6) + '.' : first;
}

// ---------- Your history per exercise ----------
export function lastLog(exId, beforeTs = Infinity) {
  const ws = S().workouts;
  for (let i = ws.length - 1; i >= 0; i--) {
    const w = ws[i];
    if (w.ts >= beforeTs) continue;
    const sets = w.log?.[exId];
    if (sets?.length) return { date: w.date, sets };
  }
  return null;
}

// If every set last time reached the target, gently suggest a bit more weight.
// After a session where every set reached the goal (the top of the rep range):
// a little more weight, or the harder version, or slower reps.
export function progressHint(exId, target) {
  const ex = getEx(exId);
  if (!ex || ex.mode === 'time') return null;
  const last = lastLog(exId);
  if (!last) return null;
  const goal = target.hi || target.reps || ex.def;
  const hit = last.sets.length >= Math.min(2, target.sets || 1) && last.sets.every((s) => s.r >= goal);
  if (!hit) return null;
  if (weighted(ex)) {
    const kgs = last.sets.map((s) => s.kg).filter((k) => k > 0);
    if (!kgs.length) return null;
    const top = Math.max(...kgs);
    return { kg: top + kgStep(ex), from: top };
  }
  return HARDER[exId] ? { harder: HARDER[exId] } : { tempo: true };
}

export function bestSet(exId) {
  let best = null;
  for (const w of S().workouts) {
    for (const s of w.log?.[exId] || []) {
      if (s.kg > 0 && (!best || s.kg > best.kg || (s.kg === best.kg && s.r > best.r))) best = { ...s, date: w.date };
    }
  }
  return best;
}

// ---------- Saving ----------
export function saveWorkout(wid, minutes, sets = 0, extra = {}) {
  const name = activityName(wid);
  mutate((s) => {
    s.workouts.push({ id: uid(), date: dayKey(), wid, name, minutes: Math.min(300, Math.max(1, Math.round(minutes))), sets, ts: Date.now(), ...extra });
  });
}

// ---------- Your own training (outside the plan) ----------
// [id, name, muscles it ticks, suggested minutes]. Saved with wid 'own', so it never counts as a planned session.
export const OWN_TYPES = [
  ['arms', N('Arms', 'Armer'), ['biceps', 'triceps'], 25],
  ['upper', N('Upper body', 'Overkropp'), ['chest', 'back', 'shoulders', 'biceps', 'triceps'], 40],
  ['chest', N('Chest', 'Bryst'), ['chest', 'triceps'], 30],
  ['back', N('Back', 'Rygg'), ['back', 'biceps'], 30],
  ['shoulders', N('Shoulders', 'Skuldre'), ['shoulders'], 25],
  ['legs', N('Legs', 'Bein'), ['legs', 'glutes'], 30],
  ['core', N('Core', 'Kjerne'), ['core'], 15],
  ['full', N('Full body', 'Hele kroppen'), ['chest', 'back', 'shoulders', 'legs', 'glutes', 'core'], 45],
  ['walk', N('Walk', 'Gåtur'), [], 30],
  ['run', N('Run', 'Løping'), [], 25],
  ['cycling', N('Cycling', 'Sykling'), [], 30],
  ['football', N('Football', 'Fotball'), [], 60],
  ['swim', N('Swimming', 'Svømming'), [], 30],
  ['stretch', N('Stretching / yoga', 'Tøying / yoga'), [], 15],
];
export const ownIcon = (type) => (type === 'walk' || type === 'run' ? 'walk' : type === 'cycling' ? 'bike' : type === 'stretch' ? 'stretch' : 'dumbbell');

export function saveOwnWorkout(e) {
  const w = {
    id: e.id || uid(), date: e.date || dayKey(), wid: 'own', own: true, type: e.type || null, name: e.name,
    minutes: Math.min(300, Math.max(1, Math.round(e.minutes) || 1)), sets: 0, ts: e.ts || Date.now(),
    muscles: e.muscles || [], exercises: e.exercises || [], otherEx: e.otherEx || [], effort: e.effort || null, note: e.note || '',
  };
  mutate((s) => {
    const i = s.workouts.findIndex((x) => x.id === w.id);
    if (i >= 0) s.workouts[i] = { ...s.workouts[i], ...w };
    else s.workouts.push(w);
    // Keep history in time order (an "earlier" log can be older than the last one).
    s.workouts.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  });
  return w;
}
export const deleteWorkout = (id) => mutate((s) => { s.workouts = s.workouts.filter((x) => x.id !== id); });
// Workouts from the plan (and built-in walks/stretches) vs. your own extra training.
export const planWorkoutsOn = (key) => S().workouts.filter((w) => w.date === key && !w.own);
export const ownWorkoutsOn = (key) => S().workouts.filter((w) => w.date === key && w.own);

// New best weights in a finished workout (compared with everything before it).
export function newBests(log, beforeTs) {
  const out = [];
  for (const [exId, sets] of Object.entries(log || {})) {
    const top = Math.max(0, ...sets.map((x) => x.kg || 0));
    if (!top) continue;
    let prev = 0;
    for (const w of S().workouts) {
      if (w.ts >= beforeTs) continue;
      for (const x of w.log?.[exId] || []) prev = Math.max(prev, x.kg || 0);
    }
    if (prev && top > prev) out.push({ exId, kg: top, prev });
  }
  return out;
}

// ---------- Ready-made programs (js/data/programs.js) ----------
export const easierOf = (id) => EASIER[id] || null;
export const harderOf = (id) => HARDER[id] || null;

// Where you train today: the place you picked for today, or your usual place.
export function currentPlace(key = dayKey()) {
  const t = training();
  if (t.todayPlace?.date === key && PLACES[t.todayPlace.place]) return t.todayPlace.place;
  return PLACES[t.place] ? t.place : 'home';
}
export function setTodayPlace(place, key = dayKey()) {
  if (!PLACES[place]) return;
  mutate((s) => { s.training ||= {}; s.training.todayPlace = { date: key, place }; });
}

const pickFor = (slot, place, used) => slotPick(slot, allowedEquip(place), used);

// Turn slot items into the exercise for this place. Exercises you chose yourself stay as they are.
export function resolveList(items, place = currentPlace()) {
  const isSlot = (e) => e.slot && SLOTS[e.slot] && slotIds(e.slot).includes(e.id);
  const used = new Set(items.filter((e) => !isSlot(e)).map((e) => e.id));
  const out = items.map((e) => {
    if (!isSlot(e)) return e;
    const id = pickFor(e.slot, place, used) || e.id;
    used.add(id);
    if (id === e.id) return e;
    const x = LIB[id];
    return { ...e, id, reps: x?.mode === 'time' ? x.def : e.hi || x?.def || e.reps };
  });
  return out.filter((e, i) => out.findIndex((y) => y.id === e.id) === i);
}

export function buildProgram(cfg) {
  const prog = PROGRAMS[cfg.id] || PROGRAMS.start2;
  const level = LEVELS[cfg.level] ? cfg.level : 'gentle';
  const lvl = LEVELS[level];
  const range = REPS[cfg.reps] || REPS.grow;
  const chosen = normFocus(cfg.focus);
  const focus = FOCUS_ORDER.filter((f) => (chosen.length ? chosen : prog.focusDay ? prog.defaultFocus : []).includes(f));
  const place = PLACES[cfg.place] ? cfg.place : 'home';
  const days = [...new Set((cfg.days?.length ? cfg.days : prog.days).map(Number))].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const made = prog.sessions.map((t, k) => {
    // A focus day: only the focus muscles, taking turns so each muscle rests between its exercises.
    if (t.kind === 'focus') {
      const lists = focus.map((f) => FOCUS[f].day.slice());
      const slots = [];
      for (let round = 0; slots.length < lvl.maxN + 1 && lists.some((l) => l.length); round++) {
        for (const l of lists) if (l.length && slots.length < lvl.maxN + 1) { const x = l.shift(); if (!slots.includes(x)) slots.push(x); }
      }
      const items = slots.map((slot) => ({ id: slotIds(slot)[0], slot, sets: lvl.sets + 1, reps: range.hi, lo: range.lo, hi: range.hi, focus: true }));
      const ex = resolveList(items, place).map((e) => (LIB[e.id]?.mode === 'time' ? { ...e, reps: LIB[e.id].def } : e));
      const name = `${tr('Focus', 'Fokus')}: ${focus.map((f) => L(FOCUS[f].name)).join(' + ')}`;
      return { id: 's-' + uid(), key: t.key, kind: 'focus', name, groups: [...new Set(slots.flatMap((x) => SLOTS[x].g))], ex };
    }
    const slots = t.slots.slice();
    const isFocus = (slot) => focus.some((f) => FOCUS[f].kinds.includes(t.kind) && FOCUS[f].slots.includes(slot));
    // The first three (the big lifts: legs, push, pull) always stay, so the body stays balanced.
    const KEEP = 3;
    // Each focus muscle gets at least two exercises (one for core) in the sessions that train it,
    // placed right after the big lifts so they come while you are fresh.
    let at = Math.min(KEEP, slots.length);
    for (const f of focus) {
      const F = FOCUS[f];
      if (!F.kinds.includes(t.kind)) continue;
      // Arms: always one biceps and one triceps exercise.
      for (const pair of F.each || []) if (!pair.some((x) => slots.includes(x))) slots.splice(at++, 0, pair[k % pair.length]);
      let need = (prog.focusDay ? 1 : F.min ?? 2) - slots.filter((x) => F.slots.includes(x)).length;
      // Rotate the extras between sessions so A and B don't get the same ones.
      const order = F.min === 2 && f === 'arms' ? F.slots : [...F.slots.slice(k % F.slots.length), ...F.slots.slice(0, k % F.slots.length)];
      for (const x of order) {
        if (need <= 0) break;
        if (!slots.includes(x)) { slots.splice(at++, 0, x); need--; }
      }
    }
    // Keep it short: drop the last extras first, then extra focus work. A focus allows one more exercise.
    const max = lvl.maxN + (focus.length ? 1 : 0);
    while (slots.length > max) {
      let i = slots.length - 1;
      while (i >= KEEP && isFocus(slots[i])) i--;
      if (i < KEEP) i = slots.length - 1;
      if (i < KEEP) break;
      slots.splice(i, 1);
    }
    const items = slots.map((slot) => ({ id: slotIds(slot)[0], slot, sets: lvl.sets + (isFocus(slot) && !prog.focusDay ? 1 : 0), reps: range.hi, lo: range.lo, hi: range.hi, ...(isFocus(slot) ? { focus: true } : {}) }));
    const ex = resolveList(items, place).map((e) => (LIB[e.id]?.mode === 'time' ? { ...e, reps: LIB[e.id].def } : e));
    return { id: 's-' + uid(), key: t.key, kind: t.kind, name: L(t.name), groups: [...new Set(slots.flatMap((x) => SLOTS[x].g))], ex };
  });
  const schedule = {};
  days.forEach((d, i) => { schedule[d] = made[i % made.length].id; });
  const used = new Set(Object.values(schedule));
  const sessionsOut = made.filter((x) => used.has(x.id));
  const extras = {};
  const rest = cfg.rest === 'none' ? 'none' : 'mix';
  if (rest === 'mix') {
    const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d));
    free.slice(0, Math.max(0, free.length - 1)).filter((d, i) => i % 2 === 0).slice(0, 2).forEach((d, i) => { extras[d] = i === 0 ? 'walk' : 'stretch'; });
  }
  return {
    program: { id: cfg.id in PROGRAMS ? cfg.id : 'start2', days, place, focus, level, reps: REPS[cfg.reps] ? cfg.reps : 'grow', rest },
    split: 'program', place, level, days, rest, restSec: lvl.rest, sessions: sessionsOut, schedule, extras, made: Date.now(),
  };
}

export function applyProgram(cfg) {
  const plan = buildProgram(cfg);
  mutate((s) => { s.training = { ...plan, customEx: s.training?.customEx || {}, equip: s.training?.equip, todayPlace: s.training?.todayPlace || null }; });
  return plan;
}
