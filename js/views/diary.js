// The food diary: what you ate, when, and how much (calories, protein, fat, carbs),
// plus ideas on the side. Shared by Today and the Food tab.
import { S, peekDay, day, mutate } from '../store.js';
import { tr, L, n0 } from '../i18n.js';
import { icon, openSheet, closeSheet, toast, plate } from '../ui.js';
import { esc, dayKey, clock, parseKey } from '../util.js';
import { nav } from '../nav.js';
import { dayTotals, logMac, logItems, proteinGoal, proteinSuggestion } from '../nutrition.js';
import { ideasFor } from '../ideas.js';
import { macroBar, legend } from './charts.js';
import { recipeById } from '../data/recipes.js';
import { myMealById } from '../mymeals.js';
import { amountSheet, recipeItem, mealItem, macroLine, amountText, restoreItem } from '../amount.js';
import { portionButtons, cheer } from '../meals.js';
import { toggleSupp, suppCheer, suppList } from '../supps.js';

const g = (v) => `${Math.round(v)} g`;
const bar = (v, goal) => (goal ? `<div class="mbar"><i style="width:${Math.min(100, Math.round((v / goal) * 100))}%"></i></div>` : '');

// Calories and macros for a day. Calm mode shows how often you ate instead of numbers.
export function totalsCard(key = dayKey(), { link = true } = {}) {
  const st = S();
  const t = dayTotals(key);
  const isToday = key === dayKey();
  if (st.prefs.calm) {
    return `<section class="card hero-today" aria-label="${tr('Eaten', 'Spist')}">
      <span class="small muted">${isToday ? tr('Today', 'I dag') : ''}</span>
      <p class="h2" style="line-height:1.3">${t.n ? tr(`You have eaten ${t.n} ${t.n === 1 ? 'time' : 'times'}${isToday ? ' today' : ''}.`, `Du har spist ${t.n} ${t.n === 1 ? 'gang' : 'ganger'}${isToday ? ' i dag' : ''}.`) : tr('Nothing logged yet. Something small is a great start.', 'Ingenting logget ennå. Noe lite er en fin start.')}</p>
      ${link && isToday ? `<a class="link-btn small" href="#/food/diary">${tr('See the diary', 'Se dagboka')} →</a>` : ''}</section>`;
  }
  const kGoal = st.profile.goalKcal;
  const pGoal = proteinGoal();
  return `<section class="card hero-today" aria-label="${tr('Eaten', 'Spist')}">
    <div class="row between"><span class="small muted">${isToday ? tr('Eaten today', 'Spist i dag') : tr('Eaten', 'Spist')}</span>
      ${link && isToday ? `<a class="link-btn small" href="#/food/diary">${tr('Diary', 'Dagbok')} →</a>` : ''}</div>
    <p class="kcal num"><b>${n0(t.kcal)}</b> <span>kcal${kGoal ? ` / ${n0(kGoal)}` : ''}</span></p>
    ${bar(t.kcal, kGoal)}
    <div class="macros">
      <div class="mac p"><span class="tiny muted">${tr('Protein', 'Protein')}</span><span class="v num">${g(t.p)}${pGoal ? `<span class="tiny muted"> / ${pGoal}</span>` : ''}</span>${bar(t.p, pGoal)}</div>
      <div class="mac f"><span class="tiny muted">${tr('Fat', 'Fett')}</span><span class="v num">${g(t.f)}</span></div>
      <div class="mac c"><span class="tiny muted">${tr('Carbs', 'Karbo')}</span><span class="v num">${g(t.c)}</span></div>
    </div>
    ${t.p + t.f + t.c > 0 ? `${macroBar([t.p, t.f, t.c], 8)}${legend()}` : ''}
    ${t.unknown ? `<p class="tiny muted">${tr(`${t.unknown} ${t.unknown === 1 ? 'entry has' : 'entries have'} no protein info (older or own foods).`, `${t.unknown} ${t.unknown === 1 ? 'oppføring mangler' : 'oppføringer mangler'} proteininfo (eldre eller egne).`)}</p>` : ''}
    ${!pGoal && isToday && proteinSuggestion() && !st.prefs.hideProteinTip ? `<button class="link-btn small" data-act="goalP" style="align-self:flex-start">${icon('sparkle', 14)} ${tr('Set a protein goal (optional)', 'Sett et proteinmål (valgfritt)')}</button>` : ''}
  </section>`;
}

const portionWord = (p) => (p === 0.25 ? tr('a few bites', 'noen biter') : p === 0.5 ? tr('half', 'halvparten') : p === 0.75 ? '¾' : '');

// Everything eaten on a day, by time.
export function timeline(key = dayKey(), { empty = true } = {}) {
  const calm = S().prefs.calm;
  const logs = peekDay(key).logs.slice().sort((a, b) => a.ts - b.ts);
  if (!logs.length) {
    return empty ? `<section class="card tight"><p class="small muted" style="line-height:1.5">${key === dayKey() ? tr('Nothing logged yet today. Tap "Log what you ate" when you have had something, even a few bites.', 'Ingenting logget ennå i dag. Trykk «Logg det du spiste» når du har fått i deg noe, selv noen biter.') : tr('Nothing logged this day.', 'Ingenting logget denne dagen.')}</p></section>` : '';
  }
  const maxK = Math.max(1, ...logs.map((l) => l.kcal || 0));
  return `<section class="card" style="padding:8px 16px" aria-label="${tr('What you ate', 'Det du spiste')}"><div class="list">${logs.map((l) => {
    const m = logMac(l);
    const sub = [
      l.items?.length > 1 ? l.items.slice(0, 3).map((i) => `${i.name.replace(/\s*\(.*\)$/, '').split(',')[0]}${i.amount && i.unit ? ` ${amountText(i.amount, i.unit)}` : ''}`).join(' · ') + (l.items.length > 3 ? ' …' : '') : l.items?.length === 1 && l.items[0].amount ? amountText(l.items[0].amount, l.items[0].unit) : '',
      portionWord(l.portion),
    ].filter(Boolean).join(' · ');
    return `<button class="item" data-act="entry" data-k="${key}" data-id="${l.id}" style="align-items:flex-start">
      <span class="small muted num" style="width:44px;flex:none;padding-top:2px">${clock(l.ts)}</span>
      <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(l.title)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ''}
        ${!calm && m ? `<span class="entry-bar" style="display:block;width:${Math.max(18, Math.min(100, (l.kcal / maxK) * 100)).toFixed(0)}%">${macroBar(m, 6)}</span>` : ''}</span>
      ${calm ? '' : `<span class="col" style="align-items:flex-end;gap:1px;flex:none"><span class="small num" style="font-weight:600">${n0(l.kcal)}</span>${m ? `<span class="tiny muted num">${Math.round(m[0])} g P</span>` : ''}</span>`}</button>`;
  }).join('')}</div></section>`;
}

// Ideas on the side: swipe through, tap to log.
export function ideasCard(key = dayKey()) {
  const calm = S().prefs.calm;
  const { why, items } = ideasFor(key);
  if (!items.length) return '';
  return `<section class="ideas" aria-label="${tr('Ideas', 'Ideer')}">
    <div class="row between" style="padding:0 4px"><h2 class="h3">${tr('Ideas, if you want one', 'Ideer, hvis du vil')}</h2><a class="link-btn small" href="#/food/recipes">${tr('All recipes', 'Alle oppskrifter')}</a></div>
    ${why ? `<p class="tiny soft" style="padding:0 4px;line-height:1.4">${esc(why)}</p>` : ''}
    <div class="idea-row hscroll">${items.map((x) => {
      const r = x.t === 'recipe' ? recipeById(x.id) : null;
      const pic = r ? plate(r, 44) : `<span class="plate-mini" style="width:44px;height:44px" aria-hidden="true">${icon(x.t === 'shake' ? 'pill' : 'heart', 20)}</span>`;
      const nums = calm ? '' : [x.kcal ? `${n0(x.kcal)} kcal` : '', x.p != null ? `${Math.round(x.p)} g ${tr('protein', 'protein')}` : ''].filter(Boolean).join(' · ');
      return `<button class="idea" data-act="idea" data-t="${x.t}" data-id="${esc(x.id)}">${pic}
        <span class="t">${esc(typeof x.title === 'string' ? x.title : L(x.title))}</span>
        ${nums ? `<span class="tiny muted num">${nums}</span>` : ''}${x.tag ? `<span class="badge" style="align-self:flex-start">${esc(x.tag)}</span>` : ''}</button>`;
    }).join('')}</div></section>`;
}

function logNow(item, key = dayKey()) {
  logItems(key, [item], { source: item.src === 'recipe' ? 'recipe' : item.src === 'my' ? 'mine' : 'idea' });
  if (item.myId) mutate((s) => { const m = s.myMeals.find((x) => x.id === item.myId); if (m) { m.used = (m.used || 0) + 1; m.last = Date.now(); } });
  toast(cheer(key));
  nav.rerender();
}

export function ideaTap(el) {
  const { t, id } = el.dataset;
  if (t === 'shake') {
    const r = toggleSupp(suppList().find((x) => x.kind === 'protein')?.id || 'protein');
    toast(suppCheer(r));
    nav.rerender();
    return;
  }
  const item = t === 'recipe' ? (recipeById(id) && recipeItem(recipeById(id))) : t === 'my' ? (myMealById(id) && mealItem(myMealById(id))) : null;
  if (!item) return;
  amountSheet({
    item,
    title: tr('How much did you eat?', 'Hvor mye spiste du?'),
    add: tr('Log it', 'Logg det'),
    onDone: (x) => logNow(x),
    extraHTML: t === 'recipe' ? `<button class="btn secondary" data-act="see">${icon('book', 18)} ${tr('See the recipe', 'Se oppskriften')}</button>` : '',
    extraActions: { see: () => { closeSheet(true); nav.go(`recipe/${id}`); } },
  });
}

// Tap a diary entry: change how much or when, eat it again, or delete it.
export function entrySheet(key, id) {
  const log = peekDay(key).logs.find((l) => l.id === id);
  if (!log) return;
  const calm = S().prefs.calm;
  const base = log.baseKcal ?? log.kcal / (log.portion || 1);
  const m = logMac(log);
  const hm = clock(log.ts);
  openSheet({
    title: esc(log.title),
    html: `<p class="small muted num">${hm}${calm ? '' : ` · ${n0(log.kcal)} kcal${m ? ` · ${esc(macroLine(m))}` : ''}`}</p>
      ${log.items?.length ? `<div class="list">${log.items.map((i) => `<div class="item" style="padding:9px 0;gap:10px"><span class="grow" style="min-width:0">${esc(i.name)}</span>
        <span class="small muted num" style="white-space:nowrap">${i.amount && i.unit ? esc(amountText(i.amount, i.unit)) : ''}${calm ? '' : ` · ${n0(i.kcal)} kcal`}</span></div>`).join('')}</div>` : ''}
      <p class="label">${tr('How much of it did you eat?', 'Hvor mye av det spiste du?')}</p>
      ${portionButtons(log.portion ?? 1)}
      <div class="field"><label for="e-time">${tr('Time', 'Klokkeslett')}</label><input id="e-time" class="input" type="time" value="${hm}" data-change="time"></div>
      <div class="btns"><button class="btn secondary" data-act="again">${icon('refresh', 18)} ${tr('Log it again now', 'Logg det igjen nå')}</button>
        <button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button></div>`,
    actions: {
      portion: (el) => {
        const p = Number(el.dataset.p);
        mutate(() => { const l = day(key).logs.find((x) => x.id === id); if (l) { l.portion = p; l.baseKcal = base; l.kcal = Math.round(base * p); } });
        closeSheet(); toast(tr('Updated.', 'Oppdatert.')); nav.rerender();
      },
      time: (el) => {
        const [h, mm] = String(el.value || '').split(':').map(Number);
        if (!(h >= 0 && mm >= 0)) return;
        const d = parseKey(key);
        d.setHours(h, mm, 0, 0);
        mutate(() => { const l = day(key).logs.find((x) => x.id === id); if (l) l.ts = d.getTime(); });
        toast(tr('Time changed.', 'Klokkeslett endret.'), 1200); nav.rerender();
      },
      again: () => {
        const items = (log.items || []).map(restoreItem);
        if (items.length) logItems(dayKey(), items, { title: log.title, source: 'again', myId: log.myId, rid: log.rid });
        else logItems(dayKey(), [{ ...restoreItem({ name: log.title, kcal: base, p: log.mac?.[0], f: log.mac?.[1], c: log.mac?.[2] }) }], { title: log.title, source: 'again', rid: log.rid, myId: log.myId });
        closeSheet(); toast(cheer()); nav.rerender();
      },
      del: () => {
        mutate(() => { const dd = day(key); dd.logs = dd.logs.filter((x) => x.id !== id); });
        closeSheet(); toast(tr('Deleted.', 'Slettet.')); nav.rerender();
      },
    },
  });
}

export function proteinGoalSheet() {
  const sug = proteinSuggestion();
  openSheet({
    title: tr('Protein goal', 'Proteinmål'),
    html: `<p class="soft" style="line-height:1.5">${tr(`Protein is what muscles are built from. A common guide for building muscle is about 1.6 g per kg of body weight a day. For you that is about <b>${sug} g</b>. It is only a guide: any step up from where you are helps, and a doctor or dietitian can set one with you.`, `Protein er det musklene bygges av. En vanlig pekepinn for å bygge muskler er rundt 1,6 g per kg kroppsvekt om dagen. For deg er det rundt <b>${sug} g</b>. Det er bare en pekepinn: hvert lille steg opp hjelper, og lege eller ernæringsfysiolog kan sette et mål sammen med deg.`)}</p>
      <div class="field"><label for="pg">${tr('Grams a day', 'Gram om dagen')}</label><input id="pg" class="input" type="number" inputmode="numeric" min="20" max="300" value="${sug}"></div>
      <button class="btn primary" data-act="ok">${tr('Use this goal', 'Bruk dette målet')}</button>
      <button class="link-btn" style="align-self:center;color:var(--muted)" data-act="no">${tr('No goal, just show the numbers', 'Ikke noe mål, bare vis tallene')}</button>`,
    actions: {
      ok: (b, e, sheet) => {
        const v = Math.round(Number(sheet.querySelector('#pg').value));
        if (!(v >= 20 && v <= 300)) { toast(tr('Pick a number between 20 and 300.', 'Velg et tall mellom 20 og 300.')); return; }
        mutate((s) => { s.profile.goalProtein = v; });
        closeSheet(); toast(tr('Protein goal saved. You can change it in Settings.', 'Proteinmålet er lagret. Du kan endre det i Innstillinger.')); nav.rerender();
      },
      no: () => { mutate((s) => { s.prefs.hideProteinTip = true; }); closeSheet(); nav.rerender(); },
    },
  });
}

export const diaryActions = {
  entry: (el) => entrySheet(el.dataset.k || dayKey(), el.dataset.id),
  idea: (el) => ideaTap(el),
  goalP: () => proteinGoalSheet(),
};
