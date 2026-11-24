// Shared UI pieces: icons, bottom sheets, toasts, plates, rings, charts, tab bar.
import { tr, n0, n1, shortDate } from './i18n.js';
import { esc, parseKey } from './util.js';

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3-3 6v4h3v8"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  leaf: '<path d="M5 19C5 10 11 5 20 5c0 9-6 15-15 14z"/><path d="M5 19l8-8"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="M9 21l2-6 3 3v3M7 12l3-4 4 1 3 3M11 15l-1-4"/>',
  stretch: '<circle cx="12" cy="5" r="2"/><path d="M4 9l8 2 8-2M12 11v4l-4 6M12 15l4 6"/>',
  bike: '<circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-8h5l3 8M10 9l2-3h3"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  flame: '<path d="M12 3c.5 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1 2.5 2 3 .5-2.5.5-5.5.5-8z"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  send: '<path d="M4 12l16-8-6 16-3-6z"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  skip: '<path d="M6 5l8 7-8 7z"/><path d="M18 5v14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8.5 10a4 4 0 0 1 7 0"/><path d="M12 10l1.5-2"/>',
  bed: '<path d="M3 18V8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  book: '<path d="M6 4h12v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 8h6M8 12h6"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  watch: '<rect x="6" y="6" width="12" height="12" rx="3.5"/><path d="M9 6l.8-3h4.4l.8 3M9 18l.8 3h4.4l.8-3M12 9.5V12l1.5 1"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/>',
};

export function icon(name, size = 22, extra = '') {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`;
}

// ---------- Tab bar ----------
export function tabbar(active) {
  const tab = (id, href, ic, label) =>
    `<a href="${href}" ${active === id ? 'aria-current="page"' : ''}><span class="pill">${icon(ic)}</span>${label}</a>`;
  return `<nav class="tabbar" aria-label="${tr('Main', 'Hovedmeny')}">
    ${tab('today', '#/today', 'home', tr('Today', 'I dag'))}
    ${tab('food', '#/food', 'food', tr('Food', 'Mat'))}
    <a href="#/log" class="log" aria-label="${tr('Log a meal', 'Logg et måltid')}">${icon('camera', 26)}</a>
    ${tab('train', '#/train', 'dumbbell', tr('Train', 'Trening'))}
    ${tab('progress', '#/progress', 'trend', tr('Progress', 'Fremgang'))}
  </nav>`;
}

// ---------- Badges ----------
export function fodmapBadge(f) {
  const label = {
    low: tr('Low FODMAP', 'Lav FODMAP'),
    moderate: tr('Moderate FODMAP', 'Moderat FODMAP'),
    high: tr('High FODMAP', 'Høy FODMAP'),
    check: tr('Check FODMAP', 'Sjekk FODMAP'),
  }[f] || tr('Unknown', 'Ukjent');
  return `<span class="badge ${esc(f)}">${label}</span>`;
}

export function fodmapWord(f) {
  return { low: tr('low', 'lav'), moderate: tr('moderate', 'moderat'), high: tr('high', 'høy'), check: tr('check', 'sjekk') }[f] || f;
}

// ---------- Food visuals ----------
const SPOTS = [
  [16, 20, 44, 36],
  [52, 18, 32, 28],
  [22, 58, 30, 22],
  [56, 52, 26, 26],
];
export function plate(recipe, size = 64) {
  if (recipe?.glass) {
    const c = recipe.colors?.[0] || '#E7A3A0';
    return `<span class="glass-vis" aria-hidden="true" style="position:relative;display:inline-block;width:${size}px;height:${size}px">
      <span style="position:absolute;left:${size * 0.3}px;top:${size * 0.16}px;width:${size * 0.4}px;height:${size * 0.72}px;border-radius:6px 6px ${size * 0.12}px ${size * 0.12}px;background:${c};box-shadow:inset 0 0 0 3px #FBFBF9"></span>
      <span style="position:absolute;left:${size * 0.56}px;top:${size * 0.02}px;width:4px;height:${size * 0.3}px;border-radius:2px;background:var(--accent-line);transform:rotate(14deg)"></span>
    </span>`;
  }
  const colors = recipe?.colors || ['#E8D3A8'];
  const blobs = colors
    .slice(0, 4)
    .map((c, i) => {
      const [l, t, w, h] = SPOTS[i];
      return `<i style="left:${l}%;top:${t}%;width:${w}%;height:${h}%;background:${c}"></i>`;
    })
    .join('');
  return `<span class="plate" aria-hidden="true" style="width:${size}px;height:${size}px;display:inline-block">${blobs}</span>`;
}

// ---------- Ring ----------
export function ring(fraction, centerHTML, size = 124) {
  const r = 51;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction || 0));
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="${r}" fill="none" stroke-width="11"/>
    <circle class="bar" cx="60" cy="60" r="${r}" fill="none" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - f)).toFixed(1)}" ${f === 0 ? 'opacity="0"' : ''}/></svg>
    <div class="center">${centerHTML}</div></div>`;
}

export function mealsBar(list) {
  return `<div class="meals-bar" aria-hidden="true">${list
    .map((x) => `<span class="${x.state === 'done' ? 'done' : x.state === 'now' || x.state === 'soon' ? 'now' : x.state === 'skip' ? 'skip' : ''}"></span>`)
    .join('')}</div>`;
}

// ---------- Weight chart ----------
export function weightChart(points, { height = 150, label = '' } = {}) {
  if (!points.length) return '';
  const W = 320;
  const H = height;
  const padL = 30;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const vals = points.map((p) => p.kg);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < 2) {
    const mid = (max + min) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  min = Math.floor(min * 2) / 2 - 0.5;
  max = Math.ceil(max * 2) / 2 + 0.5;
  const t0 = parseKey(points[0].date).getTime();
  const t1 = parseKey(points[points.length - 1].date).getTime();
  const span = Math.max(1, t1 - t0);
  const x = (p) => (points.length === 1 ? (padL + W - padR) / 2 : padL + ((parseKey(p.date).getTime() - t0) / span) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points[points.length - 1]).toFixed(1)} ${H - padB} L${x(points[0]).toFixed(1)} ${H - padB} Z`;
  const ticks = [min, (min + max) / 2, max];
  const grid = ticks
    .map((v) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="0" y="${(y(v) + 4).toFixed(1)}">${n1(v)}</text>`)
    .join('');
  const first = points[0];
  const last = points[points.length - 1];
  const xl = `<text x="${padL}" y="${H - 4}">${esc(shortDate(parseKey(first.date)))}</text>` +
    (points.length > 1 ? `<text x="${W - padR}" y="${H - 4}" text-anchor="end">${esc(shortDate(parseKey(last.date)))}</text>` : '');
  const lp = last;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}
    ${points.length > 1 ? `<path class="area" d="${area}"/>` : ''}<path class="line" d="${line}"/>
    <circle class="pt" cx="${x(lp).toFixed(1)}" cy="${y(lp.kg).toFixed(1)}" r="5"/>${xl}</svg>`;
}

export function sparkline(points, w = 140, h = 28) {
  if (points.length < 2) return '';
  const vals = points.map((p) => p.kg);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const r = max - min || 1;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * w).toFixed(1)} ${(h - 3 - ((v - min) / r) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg aria-hidden="true" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="var(--accent-line)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

// ---------- Sheets ----------
let sheetState = null;

export function openSheet({ title = '', html = '', actions = {}, onClose = null, onMount = null, label = '' }) {
  closeSheet(true);
  const layer = document.getElementById('layer');
  layer.innerHTML = `<div class="backdrop" data-sheet-close></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label || title)}">
      <div class="grab"></div>
      ${title ? `<div class="sheet-head"><h2 class="h2">${title}</h2><button class="icon-btn" data-sheet-close aria-label="${tr('Close', 'Lukk')}">${icon('x', 20)}</button></div>` : ''}
      <div class="col" style="gap:14px">${html}</div>
    </div>`;
  const sheet = layer.querySelector('.sheet');
  const handler = (type) => (e) => {
    if (type === 'click' && e.target.closest('[data-sheet-close]')) {
      e.preventDefault();
      closeSheet();
      return;
    }
    const attr = type === 'click' ? 'act' : type;
    const el = e.target.closest(`[data-${attr}]`);
    if (!el || !layer.contains(el)) return;
    const fn = actions[el.dataset[attr]];
    if (fn) {
      if (type === 'click') e.preventDefault();
      fn(el, e, sheet);
    }
  };
  layer.onclick = handler('click');
  layer.oninput = handler('input');
  layer.onchange = handler('change');
  sheetState = { onClose, layer };
  document.body.style.overflow = 'hidden';
  // drag the grab handle down to close
  let startY = null;
  sheet.addEventListener('touchstart', (e) => {
    if (sheet.scrollTop <= 0) startY = e.touches[0].clientY;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && sheet.scrollTop <= 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (startY == null) return;
    const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
    startY = null;
    if (dy > 110) closeSheet();
    else sheet.style.transform = '';
  });
  onMount?.(sheet);
  return sheet;
}

export function closeSheet(immediate = false) {
  const layer = document.getElementById('layer');
  if (!layer || !layer.innerHTML) return;
  const st = sheetState;
  sheetState = null;
  document.body.style.overflow = '';
  const closing = layer.querySelector('.sheet');
  const done = () => {
    // Another sheet may have opened during the closing animation: leave that one alone.
    if (layer.querySelector('.sheet') === closing) {
      layer.innerHTML = '';
      layer.onclick = layer.oninput = layer.onchange = null;
    }
    st?.onClose?.();
  };
  if (immediate) return done();
  layer.querySelector('.sheet')?.classList.add('closing');
  layer.querySelector('.backdrop')?.classList.add('closing');
  setTimeout(done, 190);
}

export const sheetOpen = () => !!sheetState;

export function confirmSheet({ title, text, yes, no = tr('Cancel', 'Avbryt'), danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet({
      title,
      html: `<p class="soft" style="line-height:1.5">${text}</p>
        <div class="btns"><button class="btn secondary" data-act="no">${no}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">${yes}</button></div>`,
      actions: {
        yes: () => { answered = true; closeSheet(); resolve(true); },
        no: () => { answered = true; closeSheet(); resolve(false); },
      },
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

// ---------- Toast ----------
let toastTimer = null;
export function toast(msg, ms = 2400) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, ms);
}

export function kcalText(v) {
  return `${n0(v)} kcal`;
}

export function emptyState(ic, text) {
  return `<div class="empty-state">${icon(ic, 34)}<p>${text}</p></div>`;
}
