// Meal plan, "eat now" logic, totals, streaks and the weekly training rhythm.
import { S, peekDay, day, activeSlots, mutate } from './store.js';
import { POOLS, recipeById } from './data/recipes.js';
import { WEEK_PLAN } from './data/workouts.js';
import { L } from './i18n.js';
import { dayKey, dayNum, weekday, toMinutes, fromMinutes, nowMinutes, addDays, startOfWeek, daysBetween } from './util.js';

const SEED = { breakfast: 0, snack1: 2, lunch: 1, snack2: 5, dinner: 3, evening: 4 };
const SOON_WINDOW = 45; // minutes before a meal when it becomes "up next"

export function planFor(key) {
  const d = peekDay(key);
  const used = new Set();
  const out = {};
  const n = dayNum(key);
  for (const slot of activeSlots()) {
    let item = d.plan?.[slot.id];
    if (!item) {
      if (slot.kind === 'dinner' && weekday(key) === 4 && !used.has('fredagstaco')) {
        item = { rid: 'fredagstaco' };
      } else {
        const pool = POOLS[slot.kind] || POOLS.snack;
        let i = (n + (SEED[slot.id] ?? 0)) % pool.length;
        for (let k = 0; k < pool.length && used.has(pool[i]); k++) i = (i + 1) % pool.length;
        item = { rid: pool[i] };
      }
    }
    if (item.rid) used.add(item.rid);
    out[slot.id] = item;
  }
  return out;
}

export function itemInfo(item) {
  if (item?.rid) {
    const r = recipeById(item.rid);
    if (r) return { title: L(r.name), kcal: r.kcal, recipe: r, fodmap: 'low' };
  }
  if (item?.food) return { title: item.food.title, kcal: item.food.kcal || 0, fodmap: item.food.fodmap || 'low', recipe: null };
  return { title: '—', kcal: 0, recipe: null, fodmap: 'low' };
}

export function dayStatus(key = dayKey()) {
  const d = peekDay(key);
  const today = dayKey();
  const isToday = key === today;
  const isPast = key < today;
  const now = nowMinutes();
  const plan = planFor(key);
  const list = activeSlots().map((slot) => {
    const logs = d.logs.filter((l) => l.slot === slot.id);
    const min = d.moved?.[slot.id] ?? toMinutes(slot.time);
    return { slot, min, time: fromMinutes(min), item: plan[slot.id], info: itemInfo(plan[slot.id]), logs, done: logs.length > 0, skipped: !!d.skipped?.[slot.id], state: 'later' };
  });
  list.sort((a, b) => a.min - b.min);
  let current = null;
  if (isToday) {
    // Once a later meal is logged or skipped, earlier open ones count as passed.
    const lastHandled = Math.max(-1, ...list.filter((x) => x.done || x.skipped).map((x) => x.min));
    const open = list.filter((x) => !x.done && !x.skipped && x.min > lastHandled);
    const due = open.filter((x) => x.min <= now + SOON_WINDOW);
    if (due.length) {
      current = due[due.length - 1];
      current.state = current.min <= now ? 'now' : 'soon';
    } else if (open.length) {
      current = open[0];
      current.state = 'next';
    }
  }
  for (const x of list) {
    if (x.done) x.state = 'done';
    else if (x.skipped) x.state = 'skip';
    else if (x === current) continue;
    else if (isPast || (isToday && x.min < now)) x.state = 'missed';
    else x.state = 'later';
  }
  return { list, current, plan };
}

export function totals(key = dayKey()) {
  const d = peekDay(key);
  const kcal = d.logs.reduce((a, l) => a + (l.kcal || 0), 0);
  const slots = activeSlots();
  const done = slots.filter((s) => d.logs.some((l) => l.slot === s.id)).length;
  return { kcal, done, total: slots.length, logs: d.logs.length };
}

export function streak() {
  let k = dayKey();
  let count = 0;
  if (!peekDay(k).logs.length) k = addDays(k, -1);
  while (peekDay(k).logs.length && count < 999) {
    count++;
    k = addDays(k, -1);
  }
  return count;
}

export function setPlan(key, slotId, item) {
  mutate(() => {
    day(key).plan[slotId] = item;
  });
}

export function skipSlot(key, slotId, value = true) {
  mutate(() => {
    const d = day(key);
    if (value) d.skipped[slotId] = true;
    else delete d.skipped[slotId];
  });
}

const GENTLE_FOR = { breakfast: 'smoothie', snack: 'smoothie', lunch: 'chicken-soup', dinner: 'chicken-soup', evening: 'risgrot' };
const GENTLE_ALT = { breakfast: 'eggs-toast', snack: 'ricecakes-pb', lunch: 'butter-rice', dinner: 'laks-potet', evening: 'cheese-toast' };

// Swap the rest of today's meals to the mildest options.
export function makeRestGentle() {
  const key = dayKey();
  const { list } = dayStatus(key);
  let changed = 0;
  const used = new Set();
  mutate(() => {
    const d = day(key);
    d.gentleAt = Date.now();
    for (const x of list) {
      if (x.done || x.skipped || x.state === 'missed') continue;
      let rid = GENTLE_FOR[x.slot.kind] || 'smoothie';
      if (used.has(rid)) rid = GENTLE_ALT[x.slot.kind] || 'ricecakes-pb';
      used.add(rid);
      d.plan[x.slot.id] = { rid };
      changed++;
    }
  });
  return changed;
}

// Move the next open meal later by `minutes` (today only).
export function nudgeNext(minutes = 30) {
  const { current } = dayStatus();
  if (!current) return null;
  const t = Math.max(current.min, nowMinutes()) + minutes;
  mutate(() => {
    const d = day();
    d.moved ||= {};
    d.moved[current.slot.id] = t;
  });
  return current;
}

// ---- Training ----
export function plannedActivity(key = dayKey()) {
  const type = WEEK_PLAN[weekday(key)];
  if (type !== 'strength') return type;
  const weekNo = Math.floor(dayNum(startOfWeek(key)) / 7);
  const before = WEEK_PLAN.slice(0, weekday(key)).filter((t) => t === 'strength').length;
  return (weekNo + before) % 2 === 0 ? 'strengthA' : 'strengthB';
}

export function workoutsOn(key) {
  return S().workouts.filter((w) => w.date === key);
}

export function programWeek() {
  const first = S().workouts[0]?.date || S().created || dayKey();
  return Math.max(1, Math.floor(daysBetween(startOfWeek(first), dayKey()) / 7) + 1);
}

export function weekSummary(key = dayKey()) {
  const start = startOfWeek(key);
  let sessions = 0;
  let minutes = 0;
  for (let i = 0; i < 7; i++) {
    for (const w of workoutsOn(addDays(start, i))) {
      sessions++;
      minutes += w.minutes || 0;
    }
  }
  return { sessions, minutes };
}

// Logged-but-unplanned meals still count toward kcal; this finds the slot a new log fits best.
export function bestSlotFor(date = new Date()) {
  const slots = activeSlots();
  if (!slots.length) return null;
  const { current } = dayStatus();
  if (current && current.state !== 'next') return current.slot.id;
  const now = nowMinutes(date);
  let best = slots[0];
  for (const s of slots) if (Math.abs(toMinutes(s.time) - now) < Math.abs(toMinutes(best.time) - now)) best = s;
  return best.id;
}
