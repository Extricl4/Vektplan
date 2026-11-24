// Finds possible links between what you ate/did and how you felt — all on the phone, no AI needed.
import { peekDay, hasJournal, activeSlots } from './store.js';
import { workoutsOn } from './planner.js';
import { tr } from './i18n.js';
import { dayKey, addDays, clock } from './util.js';
import { healthDay } from './health.js';

const TRIGGERS = ['wheat', 'lactose', 'garlic_onion', 'fructose', 'polyol', 'gos', 'fatty', 'spicy', 'caffeine', 'fizzy', 'few_meals', 'late_meal', 'high_fodmap', 'short_sleep'];
const HELPS = ['breakfast_early', 'meals5', 'workout', 'good_sleep', 'active_day'];
const SYMPTOMS = ['nausea', 'bloating', 'pain', 'gas', 'diarrhea', 'reflux', 'low_energy'];

export function featureLabel(f) {
  return {
    wheat: tr('wheat (bread, pasta)', 'hvete (brød, pasta)'),
    lactose: tr('regular milk products', 'vanlige melkeprodukter'),
    garlic_onion: tr('garlic or onion', 'hvitløk eller løk'),
    fructose: tr('high-fructose foods', 'mat med mye fruktose'),
    polyol: tr('polyols (some fruit, mushrooms, sweeteners)', 'polyoler (noe frukt, sopp, søtstoff)'),
    gos: tr('beans, lentils or cashews', 'bønner, linser eller cashew'),
    fatty: tr('fatty or fried food', 'fet eller frityrstekt mat'),
    spicy: tr('spicy food', 'sterk mat'),
    caffeine: tr('coffee or caffeine', 'kaffe eller koffein'),
    fizzy: tr('fizzy drinks', 'kullsyreholdig drikke'),
    few_meals: tr('fewer than 3 meals', 'færre enn 3 måltider'),
    late_meal: tr('eating after 22:00', 'mat etter kl. 22'),
    high_fodmap: tr('a high-FODMAP food', 'mat med mye FODMAP'),
    breakfast_early: tr('breakfast before 10:00', 'frokost før kl. 10'),
    meals5: tr('5 or more meals', '5 eller flere måltider'),
    workout: tr('a workout', 'en treningsøkt'),
    short_sleep: tr('under 6 hours of sleep the night before', 'under 6 timer søvn natten før'),
    good_sleep: tr('7½ hours of sleep or more', '7½ time søvn eller mer'),
    active_day: tr('30+ active minutes on the Watch', '30+ aktive minutter på klokka'),
  }[f] || f;
}

export function symptomLabel(s) {
  return {
    nausea: tr('Nausea', 'Kvalme'),
    bloating: tr('Bloating', 'Oppblåsthet'),
    pain: tr('Stomach pain', 'Magesmerter'),
    gas: tr('Gas', 'Luft i magen'),
    diarrhea: tr('Diarrhea', 'Diaré'),
    constipation: tr('Constipation', 'Forstoppelse'),
    reflux: tr('Reflux', 'Sure oppstøt'),
    low_energy: tr('Low energy', 'Lite energi'),
    anxiety: tr('Food anxiety', 'Matangst'),
    good: tr('Good day', 'God dag'),
  }[s] || s;
}

function features(key) {
  const d = peekDay(key);
  const f = new Set();
  for (const l of d.logs) {
    (l.tags || []).forEach((t) => f.add(t));
    (l.items || []).forEach((it) => (it.tags || []).forEach((t) => f.add(t)));
    if (l.fodmap === 'high' || (l.items || []).some((it) => it.fodmap === 'high')) f.add('high_fodmap');
    const t = clock(l.ts);
    if (t < '10:00' && t >= '04:00') f.add('breakfast_early');
    if (t >= '22:00') f.add('late_meal');
  }
  const slotsDone = activeSlots().filter((s) => d.logs.some((l) => l.slot === s.id)).length;
  if (slotsDone >= 5) f.add('meals5');
  if (d.logs.length < 3) f.add('few_meals');
  if (workoutsOn(key).length) f.add('workout');
  const h = healthDay(key);
  if (h?.sleepMin != null && !h.sleepGuess) {
    if (h.sleepMin < 360) f.add('short_sleep');
    if (h.sleepMin >= 450) f.add('good_sleep');
  }
  if ((h?.exerciseMin || 0) >= 30) f.add('active_day');
  return f;
}

function symptoms(key) {
  const d = peekDay(key);
  const s = new Set();
  const j = d.journal;
  if (j) {
    (j.symptoms || []).forEach((x) => s.add(x));
    const lv = j.levels || {};
    if (lv.nausea >= 3) s.add('nausea');
    if (lv.bloating >= 3) s.add('bloating');
    if (lv.pain >= 3) s.add('pain');
    if (lv.energy && lv.energy <= 2) s.add('low_energy');
  }
  if ((d.stomach || []).some((c) => c.level === 'queasy' || c.level === 'rough')) s.add('nausea');
  return s;
}

function observed(key) {
  const d = peekDay(key);
  return hasJournal(key) || (d.stomach || []).length > 0;
}

export function analyze(range = 60) {
  const today = dayKey();
  const rows = [];
  for (let i = 0; i < range; i++) {
    const k = addDays(today, -i);
    if (!observed(k)) continue;
    rows.push({ key: k, f: features(k), s: symptoms(k) });
  }
  const results = [];
  for (const s of SYMPTOMS) {
    const total = rows.filter((r) => r.s.has(s)).length;
    if (total < 2) continue;
    for (const f of [...TRIGGERS, ...HELPS]) {
      const withF = rows.filter((r) => r.f.has(f));
      const without = rows.filter((r) => !r.f.has(f));
      const n = withF.length;
      const m = without.length;
      if (n < 3 || m < 2) continue;
      const a = withF.filter((r) => r.s.has(s)).length;
      const b = without.filter((r) => r.s.has(s)).length;
      const diff = a / n - b / m;
      if (TRIGGERS.includes(f) && diff >= 0.3 && a >= 2) results.push({ kind: 'trigger', f, s, a, n, b, m, score: diff * Math.sqrt(Math.min(n, m)) });
      if (HELPS.includes(f) && diff <= -0.3 && b >= 2) results.push({ kind: 'helps', f, s, a, n, b, m, score: -diff * Math.sqrt(Math.min(n, m)) });
    }
  }
  results.sort((x, y) => y.score - x.score);
  const seen = new Set();
  const top = [];
  for (const r of results) {
    const k = `${r.kind}:${r.f}`;
    if (seen.has(k)) continue;
    seen.add(k);
    top.push(r);
    if (top.length >= 5) break;
  }
  return { observed: rows.length, results: top };
}

export function patternText(r) {
  const S = symptomLabel(r.s);
  const F = featureLabel(r.f);
  if (r.kind === 'trigger') {
    return tr(
      `${S} showed up on ${r.a} of ${r.n} days with ${F}, compared with ${r.b} of ${r.m} days without.`,
      `${S} kom på ${r.a} av ${r.n} dager med ${F}, mot ${r.b} av ${r.m} dager uten.`
    );
  }
  return tr(
    `${S} showed up less on days with ${F}: ${r.a} of ${r.n}, compared with ${r.b} of ${r.m} days without.`,
    `${S} kom sjeldnere på dager med ${F}: ${r.a} av ${r.n}, mot ${r.b} av ${r.m} dager uten.`
  );
}

// Plain-text diary summary for the optional AI deep-dive.
export function diarySummary(range = 30) {
  const today = dayKey();
  const lines = [];
  for (let i = range - 1; i >= 0; i--) {
    const k = addDays(today, -i);
    const d = peekDay(k);
    if (!d.logs.length && !hasJournal(k) && !(d.stomach || []).length) continue;
    const foods = d.logs.map((l) => `${clock(l.ts)} ${l.title}${l.tags?.length ? ` [${l.tags.join(',')}]` : ''}`).join('; ');
    const j = d.journal || {};
    const lv = Object.entries(j.levels || {}).map(([a, b]) => `${a} ${b}/5`).join(', ');
    const st = (d.stomach || []).map((c) => `${clock(c.ts)} ${c.level}`).join(', ');
    const h = healthDay(k);
    const watch = h ? [h.sleepMin != null ? `sleep night before ${Math.floor(h.sleepMin / 60)}h${String(Math.round(h.sleepMin % 60)).padStart(2, '0')}` : '', h.restingHR ? `resting HR ${h.restingHR}` : '', h.exerciseMin != null ? `exercise ${h.exerciseMin} min` : ''].filter(Boolean).join(', ') : '';
    lines.push(`${k} | ate: ${foods || 'nothing logged'} | symptoms: ${(j.symptoms || []).join(', ') || 'none'}${lv ? ` | levels: ${lv}` : ''}${st ? ` | stomach check-ins: ${st}` : ''}${watch ? ` | watch: ${watch}` : ''}${j.note ? ` | note: ${j.note.slice(0, 200)}` : ''}`);
  }
  return lines.join('\n');
}
