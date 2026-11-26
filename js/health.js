// Apple Health / Apple Watch data.
// Web apps can't read HealthKit, so a small Shortcut in Apple's Shortcuts app reads the
// samples and copies them as text, one sample per line:
//   Type;Start date;End date;Value;Unit
// This file turns that text into a few calm daily numbers (sleep, resting pulse, active
// energy, steps, exercise minutes, weight) and keeps them on the phone with the rest.
import { S, mutate, addWeight } from './store.js';
import { dayKey, addDays, norm, clock } from './util.js';
import { tr } from './i18n.js';

export const HEADER = 'VEKTPLAN';
const KEEP_DAYS = 400;

// ---------- Numbers and dates ----------
export function parseNum(raw) {
  let s = String(raw ?? '').replace(/[   ]/g, ' ').trim();
  const m = s.match(/-?[\d][\d\s.,]*/);
  if (!m) return null;
  s = m[0].trim();
  if (/^-?\d{1,3}( \d{3})+([.,]\d+)?$/.test(s)) s = s.replace(/ /g, ''); // 12 345 or 12 345,6
  s = s.replace(/\s/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); // 12,345.6
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 12.345,6
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mai: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11,
};
function monthOf(word) {
  const w = norm(word).slice(0, 4).replace(/\.$/, '');
  return MONTHS[w] ?? MONTHS[w.slice(0, 3)];
}
function at(y, mo, d, h = 0, mi = 0, sec = 0, ampm = '') {
  let hh = Number(h);
  const ap = String(ampm || '').toLowerCase();
  if (ap === 'pm' && hh < 12) hh += 12;
  if (ap === 'am' && hh === 12) hh = 0;
  let yy = Number(y);
  if (yy < 100) yy += 2000;
  const dt = new Date(yy, mo, Number(d), hh, Number(mi), Number(sec || 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// ISO 8601 is what the guide asks for; the other shapes are Shortcuts' default date text
// in English and Norwegian, in case the format step was skipped.
export function parseDate(raw) {
  const s = String(raw ?? '').replace(/[   ]/g, ' ').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (m) {
    if (m[7] || m[4] == null) {
      const d = new Date(m[4] == null ? `${m[1]}-${m[2]}-${m[3]}T00:00:00` : s.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
      if (!Number.isNaN(d.getTime())) return d;
    }
    return at(m[1], Number(m[2]) - 1, m[3], m[4], m[5], m[6]);
  }
  const t = s.toLowerCase();
  // 24. nov. 2026 kl. 07:12 · 24 Nov 2026 at 07:12 · 24. november 2026, 07:12
  m = t.match(/(\d{1,2})\.?\s*([a-zæøå]{3,})\.?,?\s*(\d{4})(?:\s*(?:,|kl\.?|at|um|à)\s*|\s+)(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
  if (m && monthOf(m[2]) != null) return at(m[3], monthOf(m[2]), m[1], m[4], m[5], m[6], m[7]);
  // Nov 24, 2026 at 7:12 AM
  m = t.match(/([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})(?:\s*(?:,|at)\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (m && monthOf(m[1]) != null) return at(m[3], monthOf(m[1]), m[2], m[4], m[5], m[6], m[7]);
  // 24.11.2026, 07:12 (Norwegian short)
  m = t.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s*(?:kl\.?\s*)?(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
  if (m) return at(m[3], Number(m[2]) - 1, m[1], m[4], m[5], m[6]);
  // 11/24/26, 7:12 AM (US short)
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/);
  if (m) return at(m[3], Number(m[1]) - 1, m[2], m[4], m[5], m[6], m[7]);
  // A date without a time (grouped by day)
  m = t.match(/(\d{1,2})\.?\s*([a-zæøå]{3,})\.?,?\s*(\d{4})/);
  if (m && monthOf(m[2]) != null) return at(m[3], monthOf(m[2]), m[1]);
  m = t.match(/([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && monthOf(m[1]) != null) return at(m[3], monthOf(m[1]), m[2]);
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) return at(m[3], Number(m[2]) - 1, m[1]);
  return null;
}

// ---------- What kind of sample is this? ----------
const SLEEP_WORDS = /bed|seng|asleep|sleep|sover|sovn|core|kjerne|deep|dyp|rem|awake|vaken|unspecified|uspesifisert/;

export function kindOf(type, unit, value) {
  const t = norm(type);
  const u = norm(unit).trim();
  if (/sleep|sovn/.test(t)) {
    if (/temp|breath|pust|disturb|forstyrr|apnea|apne/.test(t)) return 'other';
    const n = parseNum(value);
    if (n != null && String(value).trim() !== '' && /^[\d\s.,]+$/.test(String(value).trim()) && !(Number.isInteger(n) && n >= 0 && n <= 5)) return 'other';
    return 'sleep';
  }
  if (/energy|energi|kalori|calori/.test(t)) return /basal|resting|hvile|kvile|stoffskift/.test(t) ? 'basal' : 'active';
  if (/variab|hrv|variasjon/.test(t)) return 'hrv';
  if (/heart|puls|hjerte/.test(t) || /^hr\b/.test(t)) {
    if (/walk|gang|ga-|gaing/.test(t)) return 'other';
    if (/recover|gjenoppr/.test(t)) return 'other';
    if (/resting|hvile|kvile/.test(t)) return 'restingHR';
    return 'hr';
  }
  if (/step|skritt|steg/.test(t)) return 'steps';
  if (/exercise|trening/.test(t)) return 'exercise';
  if (/index|indeks|bmi|fat|fett|lean|mager/.test(t)) return 'other';
  if (/body mass|weight|vekt/.test(t)) return 'weight';
  if (t.trim()) {
    // A type we know but don't use (distance, flights, stand hours...)
    if (/distance|distanse|flight|etasj|stand|sta-|oxygen|oksygen|respirat|pust|audio|lyd|temperatur|vo2|cycling|sykkel|swim|svom/.test(t)) return 'other';
  }
  // Fall back on the unit.
  if (/kcal|^cal|kj/.test(u)) return 'active';
  if (/count\/min|bpm|slag/.test(u)) return 'hr';
  if (u === 'ms') return 'hrv';
  if (/^(kg|lb|lbs)$/.test(u)) return 'weight';
  if (/^min/.test(u)) return 'exercise';
  if (/^(count|antall|steps|skritt)$/.test(u)) return 'steps';
  if (!u && value != null && parseNum(value) == null && SLEEP_WORDS.test(norm(value))) return 'sleep';
  return 'other';
}

export function sleepStage(value) {
  const s = norm(value).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n === 0 ? 'inbed' : n === 2 ? 'awake' : 'asleep';
  }
  if (/bed|seng/.test(s)) return 'inbed';
  if (/awake|vaken|vakne/.test(s)) return 'awake';
  return 'asleep';
}

// The night belongs to the day you wake up. Anything ending after 19:00 counts for the next day.
const nightOf = (end) => dayKey(new Date(end.getTime() + 5 * 3600 * 1000));

function unionMinutes(intervals) {
  const xs = intervals.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  let total = 0;
  let cur = null;
  for (const [a, b] of xs) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else if (b > cur[1]) cur[1] = b;
  }
  if (cur) total += cur[1] - cur[0];
  return total / 60000;
}

function splitLine(line) {
  if (line.includes(';')) return line.split(';');
  if (line.includes('\t')) return line.split('\t');
  if (line.includes('|')) return line.split('|');
  return null;
}

// ---------- Parse the copied text ----------
export function parseHealthText(text) {
  const lines = String(text || '').replace(/\r/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const sums = {}; // day -> metric -> number
  const avgs = {}; // day -> metric -> [values]
  const sleep = {}; // night -> { asleep: [[a,b]], inbed: [[a,b]] }
  const weights = {}; // day -> { kg, ts }
  let used = 0;
  let skipped = 0;
  let unknown = 0;
  const kinds = new Set();
  const add = (o, k, f, v) => { (o[k] ||= {}); o[k][f] = (o[k][f] || 0) + v; };
  const push = (o, k, f, v) => { (o[k] ||= {}); (o[k][f] ||= []).push(v); };

  for (const line of lines) {
    if (norm(line).replace(/[^a-z]/g, '') === norm(HEADER)) continue;
    const parts = splitLine(line);
    if (!parts || parts.length < 3) { skipped++; continue; }
    const f = parts.map((p) => p.trim());
    const [type] = f;
    let start;
    let end;
    let value;
    let unit = '';
    if (f.length === 3) {
      start = parseDate(f[1]);
      end = start;
      value = f[2];
    } else {
      start = parseDate(f[1]);
      end = parseDate(f[2]) || start;
      value = f[3];
      unit = f[4] || '';
      if (!start && end) start = end;
    }
    if (!start) { skipped++; continue; }
    // A value like "512 kcal" carries its own unit.
    if (!unit) {
      const um = String(value).match(/[\d.,\s]+\s*([a-zA-Z/]+)\s*$/);
      if (um) unit = um[1];
    }
    const kind = kindOf(type, unit, value);
    if (kind === 'other') { unknown++; continue; }
    kinds.add(kind);
    const key = dayKey(start);
    if (kind === 'sleep') {
      if (!end || end <= start) { skipped++; continue; }
      const night = nightOf(end);
      const stage = sleepStage(value);
      sleep[night] ||= { asleep: [], inbed: [] };
      if (stage === 'asleep') sleep[night].asleep.push([start.getTime(), end.getTime()]);
      else if (stage === 'inbed') sleep[night].inbed.push([start.getTime(), end.getTime()]);
      used++;
      continue;
    }
    let n = parseNum(value);
    if (n == null) { skipped++; continue; }
    const u = norm(unit);
    if (kind === 'active' || kind === 'basal') {
      if (/kj/.test(u)) n /= 4.184;
      add(sums, key, kind === 'basal' ? 'basalKcal' : 'activeKcal', n);
    } else if (kind === 'steps') add(sums, key, 'steps', n);
    else if (kind === 'exercise') add(sums, key, 'exerciseMin', /^(s|sec|sek)/.test(u) ? n / 60 : /^(h|hr|t)$/.test(u) ? n * 60 : n);
    else if (kind === 'restingHR') push(avgs, key, 'restingHR', n);
    else if (kind === 'hrv') push(avgs, key, 'hrv', n);
    else if (kind === 'hr') push(avgs, key, 'hr', n);
    else if (kind === 'weight') {
      const kg = /lb/.test(u) ? n * 0.4536 : /^g$/.test(u) ? n / 1000 : n;
      if (kg > 25 && kg < 300 && (!weights[key] || weights[key].ts < start.getTime())) weights[key] = { kg, ts: start.getTime() };
    }
    used++;
  }

  const days = {};
  const day = (k) => (days[k] ||= {});
  for (const [k, o] of Object.entries(sums)) Object.assign(day(k), o);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  for (const [k, o] of Object.entries(avgs)) {
    if (o.restingHR) day(k).restingHR = mean(o.restingHR);
    if (o.hrv) day(k).hrv = mean(o.hrv);
    if (o.hr) {
      day(k).hrAvg = mean(o.hr);
      day(k).hrMin = Math.min(...o.hr);
      day(k).hrMax = Math.max(...o.hr);
    }
  }
  for (const [k, o] of Object.entries(sleep)) {
    const asleep = unionMinutes(o.asleep);
    const inbed = unionMinutes(o.inbed);
    const src = o.asleep.length ? o.asleep : o.inbed;
    if (!src.length) continue;
    const d = day(k);
    d.sleepMin = asleep || inbed;
    if (!asleep) d.sleepGuess = true;
    if (inbed) d.inBedMin = inbed;
    d.sleepStart = Math.min(...src.map((x) => x[0]));
    d.sleepEnd = Math.max(...src.map((x) => x[1]));
  }
  return { days, weights, used, skipped, unknown, kinds: [...kinds] };
}

export function looksLikeHealth(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (norm(t.slice(0, 40)).includes(norm(HEADER))) return true;
  return parseHealthText(t).used > 0;
}

// ---------- Store ----------
const SUM_FIELDS = ['activeKcal', 'basalKcal', 'steps', 'exerciseMin'];
const AVG_FIELDS = ['restingHR', 'hrv', 'hrAvg', 'hrMin', 'hrMax'];

export function importHealth(text) {
  const p = parseHealthText(text);
  if (!p.used) {
    const err = new Error('nothing');
    err.parsed = p;
    throw err;
  }
  let newWeights = 0;
  mutate((s) => {
    s.health ||= { days: {}, lastSync: null };
    s.health.days ||= {};
    for (const [k, v] of Object.entries(p.days)) {
      const old = s.health.days[k] || {};
      const n = { ...old };
      // Totals only grow during a day; a later sync (or a window that cut the first hour) never lowers them.
      for (const f of SUM_FIELDS) if (v[f] != null) n[f] = Math.round(Math.max(old[f] || 0, v[f]));
      for (const f of AVG_FIELDS) if (v[f] != null) n[f] = Math.round(v[f]);
      if (v.sleepMin != null && (old.sleepMin == null || v.sleepMin >= old.sleepMin || old.sleepGuess)) {
        n.sleepMin = Math.round(v.sleepMin);
        n.sleepStart = v.sleepStart;
        n.sleepEnd = v.sleepEnd;
        if (v.inBedMin) n.inBedMin = Math.round(v.inBedMin);
        if (v.sleepGuess) n.sleepGuess = true;
        else delete n.sleepGuess;
      }
      s.health.days[k] = n;
    }
    const cutoff = addDays(dayKey(), -KEEP_DAYS);
    for (const k of Object.keys(s.health.days)) if (k < cutoff) delete s.health.days[k];
    s.health.lastSync = Date.now();
    s.health.lastCount = p.used;
    s.health.lastKinds = p.kinds;
    s.health.setup = true;
  });
  // Weigh-ins from a scale or the Health app, only for days without one in Vektplan.
  for (const [k, w] of Object.entries(p.weights)) {
    if (!S().weights.some((x) => x.date === k)) {
      addWeight(w.kg, k);
      newWeights++;
    }
  }
  return { ...p, newWeights, dayCount: Object.keys(p.days).length };
}

export function clearHealth() {
  mutate((s) => { s.health = { days: {}, lastSync: null }; });
}

export const healthDays = () => S().health?.days || {};
export const healthDay = (key = dayKey()) => healthDays()[key] || null;
export const hasHealth = () => Object.keys(healthDays()).length > 0;
export const lastSync = () => S().health?.lastSync || null;
export const syncedToday = () => {
  const t = lastSync();
  return !!t && dayKey(new Date(t)) === dayKey();
};

// The Shortcut can be started straight from Vektplan. iOS then shows "◀ Vektplan" in the corner
// to come back, and Vektplan offers to bring the data in (reading the clipboard needs a tap).
export const shortcutName = () => S().prefs.shortcutName || 'Vektplan Health';
export const shortcutURL = () => `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName())}`;
const PENDING_KEY = 'vektplan.healthPending';
export function markPending() {
  try { sessionStorage.setItem(PENDING_KEY, String(Date.now())); } catch (e) { /* private mode */ }
  try { localStorage.setItem(PENDING_KEY, String(Date.now())); } catch (e) { /* ignore */ }
}
export function takePending() {
  let t = 0;
  try { t = Number(localStorage.getItem(PENDING_KEY)) || 0; localStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
  try { sessionStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
  return t && Date.now() - t < 15 * 60 * 1000;
}

export const KIND_LIST = [
  ['sleep', () => tr('Sleep', 'Søvn')],
  ['restingHR', () => tr('Resting pulse', 'Hvilepuls')],
  ['hrv', () => tr('Heart rate variability', 'Pulsvariasjon')],
  ['active', () => tr('Active calories', 'Aktive kalorier')],
  ['basal', () => tr('Resting calories', 'Hvilekalorier')],
  ['steps', () => tr('Steps', 'Skritt')],
  ['exercise', () => tr('Exercise minutes', 'Treningsminutter')],
  ['weight', () => tr('Weight', 'Vekt')],
];

export async function readClipboard() {
  if (!navigator.clipboard?.readText) throw new Error('noclip');
  return navigator.clipboard.readText();
}

// ---------- Words ----------
export function fmtSleep(min) {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return tr(`${h} h ${m} min`, `${h} t ${m} min`);
}
export function fmtSleepCompact(min) {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return tr(`${h}h ${m}m`, `${h}t ${m}m`);
}
export function fmtSleepShort(min) {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
export const sleepWindow = (d) => (d?.sleepStart && d?.sleepEnd ? `${clock(d.sleepStart)}–${clock(d.sleepEnd)}` : '');

// Last night's sleep, plus the most recent resting pulse within a few days.
export function latestRestingHR(key = dayKey()) {
  for (let i = 0; i < 4; i++) {
    const d = healthDays()[addDays(key, -i)];
    if (d?.restingHR) return { bpm: d.restingHR, key: addDays(key, -i) };
  }
  return null;
}

// Short text for the AI coach and the AI pattern search.
export function healthContext(key = dayKey(), days = 3) {
  const lines = [];
  for (let i = 0; i < days; i++) {
    const k = addDays(key, -i);
    const d = healthDays()[k];
    if (!d) continue;
    const bits = [];
    if (d.sleepMin != null) bits.push(`slept ${fmtSleepShort(d.sleepMin)} h the night before${d.sleepGuess ? ' (time in bed)' : ''}`);
    if (d.restingHR) bits.push(`resting HR ${d.restingHR}`);
    if (d.hrv) bits.push(`HRV ${d.hrv} ms`);
    if (d.activeKcal) bits.push(`active energy ${d.activeKcal} kcal`);
    if (d.exerciseMin) bits.push(`exercise ${d.exerciseMin} min`);
    if (d.steps) bits.push(`${d.steps} steps`);
    if (bits.length) lines.push(`${k}: ${bits.join(', ')}`);
  }
  return lines.length ? `Apple Watch (from Apple Health):\n${lines.join('\n')}` : '';
}
