// One row per day, built from what is already stored (food logs, weigh-ins, workouts,
// supplement ticks, Apple Watch numbers). Nothing extra to save: every day is already kept on the phone.
import { S, peekDay } from './store.js';
import { totals, workoutsOn } from './planner.js';
import { healthDay } from './health.js';
import { suppList } from './supps.js';
import { dayTotals } from './nutrition.js';
import { dayKey, addDays } from './util.js';

export function daySummary(key) {
  const d = peekDay(key);
  const t = totals(key);
  const h = healthDay(key) || {};
  const w = S().weights.find((x) => x.date === key);
  const wo = workoutsOn(key);
  const active = h.activeKcal ?? null;
  const basal = h.basalKcal ?? null;
  const ticked = Object.keys(d.supps || {});
  const tot = dayTotals(key);
  return {
    key,
    eaten: d.logs.reduce((a, l) => a + (l.kcal || 0), 0),
    p: tot.p, f: tot.f, c: tot.c,
    protein: d.logs.filter((l) => (l.tags || []).includes('protein')).length,
    logs: d.logs.length,
    mealsDone: t.done,
    mealsTotal: t.total,
    weight: w ? w.kg : null,
    active,
    basal,
    burned: active != null && basal != null ? active + basal : null,
    steps: h.steps ?? null,
    exerciseMin: h.exerciseMin ?? null,
    sleepMin: h.sleepMin ?? null,
    workouts: wo.length,
    trainMin: wo.reduce((a, x) => a + (x.minutes || 0), 0),
    workoutNames: wo.map((x) => x.name || x.wid),
    suppDone: ticked.length,
    suppAll: suppList().length > 0 && suppList().every((x) => ticked.includes(x.id)),
    symptoms: d.journal?.symptoms || [],
    stomach: d.stomach?.length ? d.stomach[d.stomach.length - 1].level : null,
  };
}

export const hasData = (s) => !!(s.logs || s.weight != null || s.workouts || s.suppDone || s.active != null || s.sleepMin != null || s.symptoms.length);

// Oldest first, ending today.
export function lastDays(n) {
  const today = dayKey();
  return Array.from({ length: n }, (_, i) => daySummary(addDays(today, i - n + 1)));
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function rangeStats(days) {
  // Only count days since you started using the app, so a new start never reads as "missed" days.
  const since = S().created && S().created > days[0].key ? S().created : days[0].key;
  const counted = days.filter((d) => d.key >= since);
  const logged = days.filter((d) => d.logs > 0);
  const burnedDays = days.filter((d) => d.burned != null);
  const both = days.filter((d) => d.burned != null && d.logs > 0);
  const ws = S().weights.filter((w) => w.date >= days[0].key && w.date <= days[days.length - 1].key);
  const before = S().weights.filter((w) => w.date < days[0].key).slice(-1)[0];
  const startW = before || ws[0];
  const endW = ws[ws.length - 1];
  return {
    n: Math.max(counted.length, logged.length),
    loggedDays: logged.length,
    eatenAvg: avg(logged.map((d) => d.eaten)),
    proteinAvg: avg(logged.map((d) => d.p)),
    burnedAvg: avg(burnedDays.map((d) => d.burned)),
    activeAvg: avg(days.filter((d) => d.active != null).map((d) => d.active)),
    bothEaten: avg(both.map((d) => d.eaten)),
    bothBurned: avg(both.map((d) => d.burned)),
    bothDays: both.length,
    workouts: days.reduce((a, d) => a + d.workouts, 0),
    trainDays: days.filter((d) => d.workouts > 0).length,
    trainMin: days.reduce((a, d) => a + d.trainMin, 0),
    suppDays: days.filter((d) => d.suppAll).length,
    sleepAvg: avg(days.filter((d) => d.sleepMin != null).map((d) => d.sleepMin)),
    weightPts: ws,
    weightChange: startW && endW && startW !== endW ? endW.kg - startW.kg : null,
    weightNow: endW ? endW.kg : null,
  };
}

// Weekly averages for long ranges (oldest first).
export function weeks(days) {
  const out = [];
  for (let i = 0; i < days.length; i += 7) {
    const w = days.slice(i, i + 7);
    const logged = w.filter((d) => d.logs > 0);
    const burned = w.filter((d) => d.burned != null);
    out.push({
      key: w[0].key,
      eaten: logged.length ? logged.reduce((a, d) => a + d.eaten, 0) / logged.length : 0,
      burned: burned.length ? burned.reduce((a, d) => a + d.burned, 0) / burned.length : null,
      logs: w.reduce((a, d) => a + d.logs, 0) / w.length,
      frac: { food: logged.length / w.length, train: w.filter((d) => d.workouts).length / w.length, supps: w.filter((d) => d.suppAll).length / w.length },
    });
  }
  return out;
}

const csvCell = (v) => (v == null ? '' : /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

// Every day that has anything, as a spreadsheet-friendly CSV (opens in Excel / Numbers / Google Sheets).
export function historyCSV() {
  const st = S();
  const keys = new Set([...Object.keys(st.days || {}), ...st.weights.map((w) => w.date), ...st.workouts.map((w) => w.date), ...Object.keys(st.health?.days || {})]);
  const rows = [...keys].filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= dayKey()).sort();
  const head = ['date', 'weight_kg', 'eaten_kcal', 'protein_g', 'fat_g', 'carbs_g', 'foods_logged', 'meals_done', 'active_kcal', 'resting_kcal', 'burned_kcal', 'steps', 'sleep_hours', 'workouts', 'training_min', 'supplements_ticked', 'stomach', 'symptoms', 'food'];
  const lines = [head.join(',')];
  for (const k of rows) {
    const s = daySummary(k);
    if (!hasData(s)) continue;
    const foods = peekDay(k).logs.map((l) => l.title).join(' | ');
    lines.push([k, s.weight, s.logs ? Math.round(s.eaten) : '', s.logs ? Math.round(s.p) : '', s.logs ? Math.round(s.f) : '', s.logs ? Math.round(s.c) : '', s.logs, s.mealsDone, s.active, s.basal, s.burned, s.steps, s.sleepMin != null ? (s.sleepMin / 60).toFixed(1) : '', s.workouts, s.trainMin || '', s.suppDone, s.stomach, s.symptoms.join(' '), foods].map(csvCell).join(','));
  }
  return lines.join('\n');
}
