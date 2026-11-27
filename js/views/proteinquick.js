// Protein in one tap: a row of small, stomach-friendly protein foods you can log instantly,
// with an "undo" for a few seconds. Used on Today and after a workout.
import { S, mutate } from '../store.js';
import { tr, L } from '../i18n.js';
import { icon, toast } from '../ui.js';
import { esc, dayKey } from '../util.js';
import { nav } from '../nav.js';
import { foodById, foodItem, itemMacros } from '../amount.js';
import { logItems, proteinSuggestion, proteinGoal } from '../nutrition.js';
import { suppList, shakeProtein, addOne, decSupp } from '../supps.js';

const N = (en, nb) => ({ en, nb });
// All low FODMAP (Monash) at these amounts.
const QUICK = [
  { id: 'egg2', fid: 'egg', amount: 2, unit: 'piece', name: N('2 eggs', '2 egg') },
  { id: 'milk', fid: 'lf-milk', amount: 1, unit: 'glass', name: N('Glass of LF milk', 'Glass LF-melk') },
  { id: 'cheese', fid: 'cheese', amount: 2, unit: 'slice', name: N('2 slices of cheese', '2 skiver ost') },
  { id: 'tuna', fid: 'tuna', amount: 1, unit: 'can', name: N('Can of tuna', 'Boks tunfisk') },
];

const shakeSupp = () => suppList().find((x) => x.kind === 'protein') || null;

function quickItem(q) {
  const f = foodById(q.fid);
  return f ? foodItem(f, q.amount, q.unit) : null;
}
const gramsOf = (q) => {
  if (q.id === 'shake') { const x = shakeSupp(); return x ? Math.round(shakeProtein(x)) : 0; }
  const it = quickItem(q);
  return it ? Math.round(itemMacros(it)?.[0] || 0) : 0;
};

export function quickList() {
  const list = [];
  const x = shakeSupp();
  if (x) list.push({ id: 'shake', name: N('Protein shake', 'Proteinshake') });
  for (const q of QUICK) if (foodById(q.fid)) list.push(q);
  return list;
}

let last = null; // { key, logId | supp, name, until }

export function quickChips({ key = dayKey() } = {}) {
  const calm = S().prefs.calm;
  const undo = last && last.until > Date.now() && last.key === key;
  return `<div class="pq" role="group" aria-label="${tr('Add protein in one tap', 'Legg til protein med ett trykk')}">
    ${quickList().map((q) => `<button class="pq-chip" data-act="pq" data-id="${q.id}" data-k="${key}">${icon('plus', 14)} ${esc(L(q.name))}${calm ? '' : ` <b>${gramsOf(q)} g</b>`}</button>`).join('')}
  </div>
  ${undo ? `<button class="link-btn small pq-undo" data-act="pqUndo">${tr(`Undo "${last.name}"`, `Angre «${last.name}»`)}</button>` : ''}`;
}

// Today's protein: big bar, what's left, one-tap foods. Goal is optional and only set by you.
export function proteinBlock(t, { key = dayKey(), quick = true } = {}) {
  const st = S();
  const goal = proteinGoal();
  const sug = proteinSuggestion();
  const p = Math.round(t.p || 0);
  const left = goal ? Math.max(0, goal - p) : 0;
  const pct = goal ? Math.min(100, Math.round((p / goal) * 100)) : 0;
  const line = !goal ? ''
    : p >= goal ? tr('Protein goal reached today. Your muscles have what they need.', 'Proteinmålet er nådd i dag. Musklene har det de trenger.')
      : p === 0 ? tr('Start small: one tap below is a good first step.', 'Start smått: ett trykk under er et fint første steg.')
        : tr(`${left} g to go. Small things add up.`, `${left} g igjen. Små ting teller.`);
  return `<div class="pblock">
    <div class="row between" style="align-items:baseline"><span class="pb-title">${tr('Protein', 'Protein')}</span>
      <span class="num"><b class="pb-v">${p}</b> <span class="muted">${goal ? `/ ${goal} g` : 'g'}</span></span></div>
    ${goal ? `<div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${p}"><i style="width:${pct}%"></i></div>
      <p class="small ${p >= goal ? '' : 'soft'}" style="${p >= goal ? 'color:var(--accent);font-weight:600' : ''}">${esc(line)}</p>`
      : key === dayKey() && sug && !st.prefs.hideProteinTip ? `<div class="pgoal-tip"><span class="small soft" style="line-height:1.45">${tr(`Want a goal to aim for? For building muscle, about ${sug} g a day fits your weight (1.6 g per kg).`, `Vil du ha et mål å sikte mot? For å bygge muskler passer ca. ${sug} g om dagen for vekten din (1,6 g per kg).`)}</span>
        <div class="row" style="gap:8px"><button class="btn small primary" data-act="pGoalSet" data-v="${sug}">${tr(`Use ${sug} g`, `Bruk ${sug} g`)}</button><button class="btn small secondary" data-act="goalP">${tr('Other number', 'Annet tall')}</button></div></div>` : ''}
    ${quick && key === dayKey() ? `<p class="tiny muted" style="margin:2px 0 -2px">${tr('Add protein in one tap:', 'Legg til protein med ett trykk:')}</p>${quickChips({ key })}` : ''}
  </div>`;
}

export const proteinActions = {
  pq: (el) => {
    const key = el.dataset.k || dayKey();
    const id = el.dataset.id;
    if (id === 'shake') {
      const x = shakeSupp();
      if (!x) return;
      addOne(x.id, key);
      last = { key, supp: x.id, name: tr('Protein shake', 'Proteinshake'), until: Date.now() + 8000 };
      toast(tr(`+${gramsOf({ id })} g protein. Nice!`, `+${gramsOf({ id })} g protein. Fint!`), 1800);
    } else {
      const q = QUICK.find((x) => x.id === id);
      const it = q && quickItem(q);
      if (!it) return;
      const log = logItems(key, [it], { title: L(q.name), source: 'quick' });
      last = { key, logId: log?.id, name: L(q.name), until: Date.now() + 8000 };
      toast(tr(`+${gramsOf(q)} g protein. Nice!`, `+${gramsOf(q)} g protein. Fint!`), 1800);
    }
    nav.rerender();
    setTimeout(() => { if (last && last.until <= Date.now()) nav.rerender(); }, 8200);
  },
  pqUndo: () => {
    if (!last) return;
    if (last.supp) decSupp(last.supp, last.key);
    else if (last.logId) mutate((s) => { const d = s.days[last.key]; if (d) d.logs = d.logs.filter((l) => l.id !== last.logId); });
    last = null;
    toast(tr('Undone.', 'Angret.'), 1200);
    nav.rerender();
  },
  pGoalSet: (el) => {
    const v = Math.round(Number(el.dataset.v));
    if (!(v >= 20 && v <= 300)) return;
    mutate((s) => { s.profile.goalProtein = v; });
    toast(tr(`Protein goal: ${v} g a day. Change it any time in Settings.`, `Proteinmål: ${v} g om dagen. Endre når du vil i Innstillinger.`), 2600);
    nav.rerender();
  },
};
