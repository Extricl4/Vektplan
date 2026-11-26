// Small charts for food: a bar split by protein / carbs / fat, and one stacked bar per day.
import { tr, n0, dayShort, shortDate } from '../i18n.js';
import { esc, parseKey } from '../util.js';
import { dayTotals } from '../nutrition.js';
import { S } from '../store.js';

// Energy from each macro: protein and carbs 4 kcal/g, fat 9 kcal/g.
const parts = (m) => [m[0] * 4, m[2] * 4, m[1] * 9];
export const MACRO_COLORS = ['var(--c-protein)', 'var(--c-carbs)', 'var(--c-fat)'];
const NAMES = () => [tr('Protein', 'Protein'), tr('Carbs', 'Karbo'), tr('Fat', 'Fett')];

// One horizontal bar: how a meal's energy splits between protein, carbs and fat.
export function macroBar(m, height = 10) {
  if (!m) return '';
  const p = parts(m);
  const sum = p.reduce((a, b) => a + b, 0) || 1;
  return `<div class="mbar-stack" style="height:${height}px" role="img" aria-label="${esc(NAMES().map((n, i) => `${n} ${Math.round((p[i] / sum) * 100)} %`).join(', '))}">
    ${p.map((v, i) => (v > 0 ? `<i style="width:${((v / sum) * 100).toFixed(1)}%;background:${MACRO_COLORS[i]}"></i>` : '')).join('')}</div>`;
}

export function legend(extra = []) {
  return `<div class="row wrap legend" style="gap:12px">${NAMES().map((n, i) => `<span class="tiny row" style="gap:5px"><i class="sw" style="background:${MACRO_COLORS[i]}"></i>${n}</span>`).join('')}
    ${extra.map(([n, css]) => `<span class="tiny row" style="gap:5px"><i class="sw" style="${css}"></i>${n}</span>`).join('')}</div>`;
}

// One bar per day: total calories, coloured by where they came from. Protein grams under each bar.
// opts.burned: { key: kcal } to draw a thin outline bar of calories burned next to each day.
export function dayChart(keys, { burned = null, label = '', selected = null } = {}) {
  const goal = S().profile.goalKcal || null;
  const rows = keys.map((k) => {
    const t = dayTotals(k);
    const known = parts([t.p, t.f, t.c]);
    const knownSum = known.reduce((a, b) => a + b, 0);
    return { k, kcal: t.kcal, seg: [...known, Math.max(0, t.kcal - knownSum)], p: t.p, b: burned?.[k] ?? null };
  });
  const W = 320;
  const H = 190;
  const padL = 34;
  const padR = 6;
  const padT = 10;
  const showP = keys.length <= 10;
  const padB = showP ? 38 : 22;
  const max = Math.max(1000, goal || 0, ...rows.map((r) => Math.max(r.seg.reduce((a, b) => a + b, 0), r.b || 0)));
  const top = Math.ceil(max / 500) * 500;
  const y = (v) => padT + (1 - v / top) * (H - padT - padB);
  const n = rows.length;
  const gw = (W - padL - padR) / n;
  const hasB = rows.some((r) => r.b != null);
  const bw = Math.max(2, Math.min(26, gw * (hasB ? 0.5 : 0.62)));
  const grid = [0, top / 2, top].map((v) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="0" y="${(y(v) + 4).toFixed(1)}">${v >= 1000 ? `${(v / 1000).toLocaleString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB')}k` : v}</text>`).join('');
  const colors = [...MACRO_COLORS, 'var(--c-unknown)'];
  const bars = rows.map((r, i) => {
    const x = padL + i * gw + (gw - bw - (hasB ? bw * 0.45 + 2 : 0)) / 2;
    let acc = 0;
    const segs = r.seg.map((v, j) => {
      if (v <= 0) return '';
      const y1 = y(acc + v);
      const h = y(acc) - y1;
      acc += v;
      return `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, h).toFixed(1)}" fill="${colors[j]}"/>`;
    }).join('');
    const b = r.b != null ? `<rect class="bar-burn" x="${(x + bw + 2).toFixed(1)}" y="${y(r.b).toFixed(1)}" width="${(bw * 0.45).toFixed(1)}" height="${(y(0) - y(r.b)).toFixed(1)}" rx="2"/>` : '';
    const sel = r.k === selected ? `<rect x="${(padL + i * gw + 1).toFixed(1)}" y="${padT - 4}" width="${(gw - 2).toFixed(1)}" height="${(H - padB - padT + 6).toFixed(1)}" rx="6" class="day-sel"/>` : '';
    const hit = `<a href="#/food/diary/${r.k}"><rect x="${(padL + i * gw).toFixed(1)}" y="0" width="${gw.toFixed(1)}" height="${H}" fill="transparent"><title>${esc(`${shortDate(parseKey(r.k))}: ${n0(r.kcal)} kcal, ${Math.round(r.p)} g protein`)}</title></rect></a>`;
    return sel + segs + b + hit;
  }).join('');
  const cx = (i) => padL + i * gw + gw / 2;
  const labels = n <= 10
    ? rows.map((r, i) => `<text x="${cx(i).toFixed(1)}" y="${H - (showP ? 22 : 4)}" text-anchor="middle">${esc(n <= 7 ? dayShort(parseKey(r.k)) : String(parseKey(r.k).getDate()))}</text>`).join('')
    : `<text x="${padL}" y="${H - 4}">${esc(shortDate(parseKey(rows[0].k)))}</text><text x="${W - padR}" y="${H - 4}" text-anchor="end">${esc(shortDate(parseKey(rows[n - 1].k)))}</text>`;
  const prot = showP ? rows.map((r, i) => `<text class="p" x="${cx(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${r.p ? `${Math.round(r.p)}g` : '–'}</text>`).join('') : '';
  const goalLine = goal ? `<line class="goal" x1="${padL}" x2="${W - padR}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}"/>` : '';
  return `<svg class="chart daychart" style="height:${H}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}${goalLine}${bars}${labels}${prot}</svg>`;
}
