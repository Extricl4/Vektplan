import { S, peekDay, day, mutate, hasJournal, addWeight, latestWeight } from '../store.js';
import { analyze, patternText, symptomLabel, diarySummary } from '../patterns.js';
import { hasAI, deepPatterns } from '../ai.js';
import { tr, n0, n1, longDate, shortDate, dayShort } from '../i18n.js';
import { icon, tabbar, weightChart, openSheet, closeSheet, toast, sparkline } from '../ui.js';
import { esc, dayKey, addDays, parseKey, debounce, clock, download } from '../util.js';
import { lastDays, rangeStats, weeks, daySummary, hasData, historyCSV } from '../history.js';
import { suppList, suppName, ticks } from '../supps.js';
import { dayChart, legend } from './charts.js';
import { nav } from '../nav.js';
import { hasHealth, healthDay, fmtSleep } from '../health.js';

const SYMPTOMS = ['nausea', 'bloating', 'pain', 'gas', 'diarrhea', 'constipation', 'reflux', 'low_energy', 'anxiety', 'good'];
const LEVELS = [
  ['nausea', () => tr('Nausea', 'Kvalme'), false],
  ['bloating', () => tr('Bloating', 'Oppblåsthet'), false],
  ['pain', () => tr('Pain', 'Smerter'), false],
  ['energy', () => tr('Energy', 'Energi'), true],
];

let trange = 30;
let listMax = 14;
let ai = { busy: false, res: null, error: '' };

function journalOf(key) {
  return peekDay(key).journal || {};
}

function ensureJournal(key) {
  const d = day(key);
  d.journal ||= { note: '', symptoms: [], levels: {}, good: '' };
  d.journal.symptoms ||= [];
  d.journal.levels ||= {};
  return d.journal;
}

const saveText = debounce((key, field, value) => {
  mutate(() => { ensureJournal(key)[field] = value; });
  const el = document.getElementById('saved');
  if (el) { el.textContent = tr('Saved', 'Lagret'); el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0'; }, 1400); }
}, 500);

function journalTab(key) {
  const j = journalOf(key);
  const today = dayKey();
  const d = peekDay(key);
  const label = key === today ? tr('Today', 'I dag') : key === addDays(today, -1) ? tr('Yesterday', 'I går') : longDate(parseKey(key));
  const past = [];
  for (let i = 1; i <= 30 && past.length < 8; i++) {
    const k = addDays(today, -i);
    if (hasJournal(k)) past.push(k);
  }
  return `<div class="row between">
      <a class="icon-btn surface" href="#/progress/journal/${addDays(key, -1)}" aria-label="${tr('Previous day', 'Forrige dag')}">${icon('chevL', 20)}</a>
      <span class="h3">${esc(label)}</span>
      ${key < today ? `<a class="icon-btn surface" href="#/progress/journal/${addDays(key, 1)}" aria-label="${tr('Next day', 'Neste dag')}">${icon('chevR', 20)}</a>` : '<span style="width:44px"></span>'}</div>
    <section class="card">
      <div class="row between"><label class="h3" for="j-note">${tr('How do you feel?', 'Hvordan har du det?')}</label><span id="saved" class="tiny" style="color:var(--accent);opacity:0;transition:opacity .3s">${tr('Saved', 'Lagret')}</span></div>
      <textarea id="j-note" class="textarea filled" rows="4" data-input="note" placeholder="${tr('Anything goes. How was your stomach, your mood, your energy? What helped?', 'Skriv fritt. Hvordan var magen, humøret, energien? Hva hjalp?')}">${esc(j.note || '')}</textarea>
      <div class="chips" role="group" aria-label="${tr('Symptoms', 'Symptomer')}">${SYMPTOMS.map((s) => `<button class="chip" aria-pressed="${(j.symptoms || []).includes(s)}" data-act="sym" data-s="${s}">${symptomLabel(s)}</button>`).join('')}</div>
    </section>
    <section class="card" aria-label="${tr('Levels', 'Nivåer')}">
      <div class="row between"><h2 class="h3">${tr('Rate it', 'Gi en score')}</h2><span class="tiny muted">1 = ${tr('low', 'lite')} · 5 = ${tr('a lot', 'mye')}</span></div>
      ${LEVELS.map(([k, label, good]) => `<div class="col" style="gap:6px"><span class="small muted">${label()}</span>
        <div class="levels ${good ? 'good' : ''}">${[1, 2, 3, 4, 5].map((v) => `<button class="${(j.levels?.[k] || 0) >= v ? 'on' : ''}" data-act="lvl" data-k="${k}" data-v="${v}" aria-label="${label()} ${v}">${v}</button>`).join('')}</div></div>`).join('')}
    </section>
    <section class="card tight">
      <label class="h3" for="j-good">${tr('One good thing today', 'En god ting i dag')}</label>
      <input id="j-good" class="input filled" data-input="good" value="${esc(j.good || '')}" placeholder="${tr('Even a tiny one counts', 'Selv en liten en teller')}">
    </section>
    ${d.logs.length ? `<section class="card tight"><h2 class="h3">${tr('What you ate', 'Hva du spiste')}</h2>
      <div class="list">${d.logs.slice().sort((a, b) => a.ts - b.ts).map((l) => `<div class="item"><span class="small muted num" style="width:42px">${clock(l.ts)}</span><span class="grow small">${esc(l.title)}</span>${l.fodmap && l.fodmap !== 'low' ? `<span class="dot ${l.fodmap}"></span>` : ''}</div>`).join('')}</div></section>` : ''}
    ${past.length ? `<div class="section-title"><h2 class="h2">${tr('Earlier', 'Tidligere')}</h2></div>
      <section class="card" style="padding:4px 16px"><div class="list">${past.map((k) => {
        const pj = journalOf(k);
        return `<a class="item" href="#/progress/journal/${k}"><span class="small muted" style="width:62px">${dayShort(parseKey(k))} ${shortDate(parseKey(k))}</span>
          <span class="grow"><span class="t" style="display:block;font-weight:500;font-size:14px">${esc((pj.symptoms || []).map(symptomLabel).join(', ') || tr('Note', 'Notat'))}</span>
          ${pj.note ? `<span class="s" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pj.note)}</span>` : ''}</span>${icon('chevR', 16)}</a>`;
      }).join('')}</div></section>` : ''}`;
}

function heatStrip() {
  const today = dayKey();
  const cells = [];
  for (let i = 13; i >= 0; i--) {
    const k = addDays(today, -i);
    const j = journalOf(k);
    const st = peekDay(k).stomach || [];
    let score = null;
    if (hasJournal(k) || st.length) {
      const lv = j.levels || {};
      score = Math.max(lv.nausea || 0, lv.bloating || 0, lv.pain || 0);
      const bad = (j.symptoms || []).filter((s) => !['good', 'low_energy', 'anxiety'].includes(s)).length;
      if (!score) score = bad ? 3 : 1;
      if (st.some((c) => c.level === 'rough')) score = Math.max(score, 4);
      else if (st.some((c) => c.level === 'queasy')) score = Math.max(score, 3);
    }
    const bg = score == null ? 'var(--surface2)' : score <= 1 ? 'var(--accent-fill)' : score === 2 ? 'var(--accent-mid)' : score === 3 ? 'var(--amber-bar)' : 'var(--red)';
    cells.push(`<span title="${k}" style="height:26px;border-radius:7px;background:${bg};${score == null ? 'opacity:.6' : ''}"></span>`);
  }
  return `<section class="card tight"><div class="row between"><h2 class="h3">${tr('Last 14 days', 'Siste 14 dager')}</h2>
      <span class="tiny muted">${tr('blue = good · amber/red = rough', 'blå = bra · gul/rød = tøft')}</span></div>
    <div style="display:grid;grid-template-columns:repeat(14,minmax(0,1fr));gap:4px">${cells.join('')}</div></section>`;
}

function patternsTab() {
  const { observed, results } = analyze();
  const need = Math.max(0, 7 - observed);
  return `${heatStrip()}
    <section class="card">
      <div class="row between"><h2 class="h2" style="display:flex;gap:8px;align-items:center">${icon('sparkle', 18, 'style="color:var(--accent-line)"')} ${tr('Patterns', 'Mønstre')}</h2>
        <span class="tiny muted">${observed} ${observed === 1 ? tr('day with notes', 'dag med notater') : tr('days with notes', 'dager med notater')}</span></div>
      ${need > 0 ? `<p class="small soft" style="line-height:1.5">${tr(`Write a note or tap your symptoms on ${need} more ${need === 1 ? 'day' : 'days'} and I'll start looking for links between your food and how you feel.`, `Skriv et notat eller trykk symptomene dine ${need} ${need === 1 ? 'dag' : 'dager'} til, så begynner jeg å se etter sammenhenger mellom maten og hvordan du har det.`)}</p>
        <div class="meals-bar">${Array.from({ length: 7 }, (_, i) => `<span class="${i < observed ? 'done' : ''}"></span>`).join('')}</div>` : ''}
      ${results.length ? results.map((r) => `<div class="note ${r.kind === 'trigger' ? 'amber' : ''}" style="flex-direction:column;gap:4px">
          <span class="tiny" style="font-weight:700;color:${r.kind === 'trigger' ? 'var(--amber)' : 'var(--accent)'}">${r.kind === 'trigger' ? tr('Possible trigger', 'Mulig utløser') : tr('Seems to help', 'Ser ut til å hjelpe')}</span>
          <span>${esc(patternText(r))}</span></div>`).join('')
        : need <= 0 ? `<p class="small muted">${tr('No clear patterns yet. That is fine: keep logging and they will show up if they are there.', 'Ingen tydelige mønstre ennå. Det er helt greit: fortsett å logge, så dukker de opp hvis de finnes.')}</p>` : ''}
      <p class="tiny muted" style="line-height:1.5">${tr('These are patterns, not a diagnosis. Worth showing your doctor or dietitian, especially when you start reintroducing foods.', 'Dette er mønstre, ikke en diagnose. Verdt å vise legen eller ernæringsfysiologen, særlig når du begynner å teste ut matvarer igjen.')}</p>
    </section>
    <section class="card">
      <h2 class="h3">${tr('Ask the AI to look deeper', 'Be AI-en se nærmere')}</h2>
      ${hasAI() ? `<p class="small soft">${tr('Sends a summary of your last 30 days of food and notes to Claude and asks for possible links.', 'Sender et sammendrag av de siste 30 dagene med mat og notater til Claude og ber om mulige sammenhenger.')}</p>
        <button class="btn primary" data-act="deep" ${ai.busy ? 'disabled' : ''}>${icon('sparkle', 18)} ${ai.busy ? tr('Looking…', 'Ser etter…') : tr('Find patterns with AI', 'Finn mønstre med AI')}</button>
        ${ai.error ? `<div class="note amber">${icon('info', 18)}<span>${esc(ai.error)}</span></div>` : ''}
        ${ai.res ? `${ai.res.patterns.map((p) => `<div class="note ${p.kind === 'trigger' ? 'amber' : ''}" style="flex-direction:column;gap:4px"><span class="tiny" style="font-weight:700">${p.kind === 'trigger' ? tr('Possible trigger', 'Mulig utløser') : tr('Seems to help', 'Ser ut til å hjelpe')}</span><span>${esc(p.text)}</span></div>`).join('')}
          ${ai.res.tip ? `<p class="small soft"><b>${tr('Tip', 'Tips')}:</b> ${esc(ai.res.tip)}</p>` : ''}` : ''}`
        : `<p class="small soft">${tr('Add an AI key in Settings to get a deeper look at your diary.', 'Legg inn en AI-nøkkel i Innstillinger for å få en grundigere gjennomgang av dagboka.')}</p><a class="btn secondary" href="#/settings/ai">${tr('Set up AI', 'Sett opp AI')}</a>`}
    </section>`;
}

// Sleep and resting pulse from the Apple Watch, if connected.
function watchBody() {
  if (!hasHealth()) {
    return `<a class="card tight link" href="#/health" style="flex-direction:row;align-items:center;gap:12px">
      <span class="icon-btn" style="background:var(--accent-soft);color:var(--accent)">${icon('watch', 20)}</span>
      <span class="grow"><span style="display:block;font-weight:600">${tr('Add sleep and pulse from your Apple Watch', 'Legg til søvn og puls fra Apple Watch')}</span>
      <span class="small muted">${tr('See how sleep and your stomach go together', 'Se hvordan søvn og magen henger sammen')}</span></span>${icon('chevR', 18)}</a>`;
  }
  const today = dayKey();
  const nights = Array.from({ length: 14 }, (_, i) => {
    const k = addDays(today, i - 13);
    return { k, min: healthDay(k)?.sleepMin ?? null };
  });
  const vals = nights.filter((n) => n.min != null).map((n) => n.min);
  const max = Math.max(540, ...vals);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const rhr = [];
  for (let i = 29; i >= 0; i--) {
    const k = addDays(today, -i);
    const v = healthDay(k)?.restingHR;
    if (v) rhr.push({ date: k, kg: v });
  }
  return `<section class="card" aria-label="${tr('Sleep and pulse', 'Søvn og puls')}">
      <div class="row between top"><div><span class="small muted">${tr('Sleep, last 2 weeks', 'Søvn, siste 2 uker')}</span>
        <p class="num" style="font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.15">${avg != null ? fmtSleep(avg) : '–'}</p>
        <span class="small muted">${tr('average per night', 'i snitt per natt')}</span></div>
        <a class="btn small secondary" href="#/health">${icon('watch', 16)} ${tr('Details', 'Detaljer')}</a></div>
      <div class="sleepbars" aria-hidden="true">${nights.map((n) => `<div class="bar"><i class="${n.min == null ? 'empty' : ''}" style="height:${n.min == null ? 4 : Math.max(6, Math.round((n.min / max) * 100))}%"></i><span>${parseKey(n.k).getDate()}</span></div>`).join('')}</div>
      ${rhr.length >= 2 ? `<div class="col" style="gap:4px"><div class="row between"><span class="small muted">${tr('Resting pulse, last 30 days', 'Hvilepuls, siste 30 dager')}</span><span class="small num" style="font-weight:600">${rhr[rhr.length - 1].kg} ${tr('beats/min', 'slag/min')}</span></div>${sparkline(rhr, 300, 36)}</div>` : ''}
      <p class="tiny muted" style="line-height:1.5">${tr('Better sleep often means a calmer stomach and more appetite. The Patterns tab checks this against your journal.', 'Bedre søvn gir ofte roligere mage og mer matlyst. Mønstre-fanen sjekker dette mot dagboka di.')}</p>
    </section>`;
}

// Weight inputs are text with a decimal keypad: iOS number fields can drop a decimal comma.
const kgText = (kg) => (kg == null || kg === '' ? '' : S().prefs.lang === 'nb' ? String(kg).replace('.', ',') : String(kg));

function bmiOf(kg, cm) {
  if (!kg || !cm) return null;
  return kg / ((cm / 100) ** 2);
}

function bodyCard(st) {
  const w = latestWeight();
  const pts = st.weightPts;
  return `<section class="card" aria-label="${tr('Weight', 'Vekt')}">
      <div class="row between top"><div><span class="small muted">${tr('Weight', 'Vekt')}</span>
        <p class="num" style="font-size:34px;font-weight:700;letter-spacing:-0.02em;line-height:1.1">${w ? `${n1(w.kg)} kg` : '–'}</p>
        ${st.weightChange != null ? `<span class="small" style="font-weight:600;color:var(--accent)">${st.weightChange >= 0 ? '+' : ''}${n1(st.weightChange)} kg ${rangeWord()}</span>` : `<span class="small muted">${tr('Weigh in once a week, same time of day', 'Vei deg en gang i uka, til samme tid')}</span>`}</div>
        <button class="btn small primary" data-act="addW">${icon('plus', 16)} ${tr('Log weight', 'Logg vekt')}</button></div>
      ${pts.length ? weightChart(pts, { label: tr('Weight over time', 'Vekt over tid') }) : S().weights.length ? `<p class="small muted">${tr('No weigh-ins in this period.', 'Ingen veiinger i denne perioden.')}</p>` : ''}
      ${S().weights.length ? `<details class="wlist"><summary class="small" style="cursor:pointer;color:var(--accent);font-weight:600">${tr('All weigh-ins', 'Alle veiinger')} (${S().weights.length})</summary>
        <div class="list">${S().weights.slice(-30).reverse().map((p) => `<button class="item" data-act="editW" data-date="${p.date}"><span class="grow">${shortDate(parseKey(p.date))}</span><span class="num" style="font-weight:600">${n1(p.kg)} kg</span>${icon('chevR', 16)}</button>`).join('')}</div></details>` : ''}
    </section>`;
}

const RANGES = [[7, () => tr('7 days', '7 dager')], [30, () => tr('30 days', '30 dager')], [90, () => tr('3 months', '3 mnd')], [365, () => tr('1 year', '1 år')]];
const rangeWord = () => ({ 7: tr('this week', 'denne uka'), 30: tr('in 30 days', 'på 30 dager'), 90: tr('in 3 months', 'på 3 måneder'), 365: tr('in a year', 'på et år') })[trange];

// Eaten (blue) next to burned (amber) per day, or per week for long ranges.
function barChart(items, { calm, label }) {
  const W = 320;
  const H = 170;
  const padL = 34;
  const padR = 6;
  const padT = 10;
  const padB = 22;
  const hasB = !calm && items.some((i) => i.b != null);
  const max = Math.max(calm ? 4 : 500, ...items.map((i) => Math.max(i.a || 0, hasB ? i.b || 0 : 0)));
  const step = calm ? 2 : 500;
  const top = Math.ceil(max / step) * step;
  const n = items.length;
  const gw = (W - padL - padR) / n;
  const bw = Math.max(1.5, Math.min(14, gw * (hasB ? 0.36 : 0.6)));
  const y = (v) => padT + (1 - v / top) * (H - padT - padB);
  const grid = [0, top / 2, top].map((v) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="0" y="${(y(v) + 4).toFixed(1)}">${calm ? v : v >= 1000 ? `${n1(v / 1000)}k` : v}</text>`).join('');
  const bars = items.map((it, i) => {
    const gx = padL + i * gw + (gw - (hasB ? bw * 2 + 1 : bw)) / 2;
    const r = Math.min(3, bw / 2);
    const a = it.a ? `<rect class="bar-a" x="${gx.toFixed(1)}" y="${y(it.a).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y(0) - y(it.a)).toFixed(1)}" rx="${r}"/>` : '';
    const b = hasB && it.b ? `<rect class="bar-b" x="${(gx + bw + 1).toFixed(1)}" y="${y(it.b).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, y(0) - y(it.b)).toFixed(1)}" rx="${r}"/>` : '';
    return a + b;
  }).join('');
  const lab = (i, anchor) => `<text x="${(padL + i * gw + gw / 2).toFixed(1)}" y="${H - 4}" text-anchor="${anchor}">${esc(items[i].label)}</text>`;
  const xl = n <= 7 ? items.map((_, i) => lab(i, 'middle')).join('') : `${lab(0, 'start')}${lab(Math.floor(n / 2), 'middle')}${lab(n - 1, 'end')}`;
  return `<svg class="chart" style="height:170px" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}${bars}${xl}</svg>`;
}

function habitRows(days) {
  const long = days.length > 31;
  const cells = long ? weeks(days).map((w) => [w.frac.food, w.frac.train, w.frac.supps]) : days.map((d) => [d.logs ? 1 : 0, d.workouts ? 1 : 0, d.suppAll ? 1 : 0]);
  const rows = [[tr('Food logged', 'Mat logget'), 0], [tr('Trained', 'Trent'), 1]];
  if (suppList().length) rows.push([tr('Supplements', 'Tilskudd'), 2]);
  return rows.map(([name, i]) => `<div class="habit"><span class="tiny muted">${name}</span>
    <div class="cells" style="grid-template-columns:repeat(${cells.length},minmax(0,1fr))">${cells.map((c) => `<i style="${c[i] ? `background:var(--accent-line);opacity:${(0.35 + 0.65 * c[i]).toFixed(2)}` : ''}"></i>`).join('')}</div></div>`).join('');
}

function summaryLine(st) {
  const calm = S().prefs.calm;
  const parts = [];
  if (st.loggedDays && st.loggedDays >= st.n) parts.push(st.n > 1 ? tr(`You logged food every day (${st.n} days).`, `Du logget mat hver dag (${st.n} dager).`) : tr('You logged food today.', 'Du logget mat i dag.'));
  else if (st.loggedDays && st.n >= 3) parts.push(tr(`You logged food on ${st.loggedDays} of ${st.n} days.`, `Du logget mat ${st.loggedDays} av ${st.n} dager.`));
  if (st.weightChange != null && !calm) {
    if (st.weightChange >= 0.2) parts.push(tr(`+${n1(st.weightChange)} kg. Slow and steady is exactly right.`, `+${n1(st.weightChange)} kg. Rolig og jevnt er akkurat riktig.`));
    else if (st.weightChange <= -0.2) parts.push(tr('Weight dipped a little. That happens (water, a rough stomach week). A shake or a booster on a few meals can nudge it back up.', 'Vekta gikk litt ned. Det skjer (vann, en tung mageuke). En shake eller litt ekstra på noen måltider kan dytte den opp igjen.'));
    else parts.push(tr('Weight is steady.', 'Vekta er stabil.'));
  }
  if (st.workouts) parts.push(tr(`${st.workouts} workout${st.workouts > 1 ? 's' : ''}, nice.`, `${st.workouts} økt${st.workouts > 1 ? 'er' : ''}, fint.`));
  if (!parts.length) return tr('Your days show up here as you log food, training, supplements and weight. It all stays on this phone.', 'Dagene dine dukker opp her etter hvert som du logger mat, trening, tilskudd og vekt. Alt blir liggende på denne telefonen.');
  return parts.join(' ');
}

function dayRow(d) {
  const calm = S().prefs.calm;
  const bits = [];
  if (d.weight != null) bits.push(`${n1(d.weight)} kg`);
  if (d.logs) bits.push(calm ? `${d.logs} ${tr('logged', 'logget')}` : `${n0(d.eaten)} kcal`);
  if (!calm && d.burned != null) bits.push(`${tr('burned', 'forbrent')} ${n0(d.burned)}`);
  return `<button class="item" data-act="day" data-k="${d.key}">
    <span class="small" style="width:74px;flex:none"><b style="font-weight:600">${dayShort(parseKey(d.key))}</b> <span class="muted">${shortDate(parseKey(d.key))}</span></span>
    <span class="grow small soft num" style="min-width:0">${bits.join(' · ') || '–'}</span>
    ${d.workouts ? `<span title="${tr('Trained', 'Trent')}" style="color:var(--accent)">${icon('dumbbell', 16)}</span>` : ''}
    ${d.suppAll ? `<span title="${tr('Supplements', 'Tilskudd')}" style="color:var(--sage)">${icon('pill', 16)}</span>` : ''}
    ${icon('chevR', 16)}</button>`;
}

function trendsTab() {
  const calm = S().prefs.calm;
  const days = lastDays(trange);
  const st = rangeStats(days);
  const long = days.length > 31;
  const items = long
    ? weeks(days).map((w) => ({ a: calm ? w.logs : w.eaten, b: w.burned, label: shortDate(parseKey(w.key)) }))
    : days.map((d) => ({ a: calm ? d.logs : d.eaten, b: d.burned, label: days.length <= 7 ? dayShort(parseKey(d.key)) : shortDate(parseKey(d.key)) }));
  const withData = days.filter(hasData).reverse();
  const burnedLabel = st.burnedAvg != null ? tr('Burned / day', 'Forbrent / dag') : tr('Active / day', 'Aktiv / dag');
  const burnedVal = st.burnedAvg ?? st.activeAvg;
  let note = '';
  if (!calm && st.bothDays >= 2) {
    note = tr(`On days with both numbers you ate about ${n0(st.bothEaten)} kcal and burned about ${n0(st.bothBurned)}.`, `På dager med begge tallene spiste du ca. ${n0(st.bothEaten)} kcal og forbrente ca. ${n0(st.bothBurned)}.`) + ' ' +
      (st.bothEaten < st.bothBurned
        ? tr('To gain weight, eating needs to be a bit above burning over time. Watch numbers are rough estimates, so your weight trend is the real answer.', 'For å gå opp må du over tid spise litt mer enn du forbrenner. Tallene fra klokka er grove anslag, så vektutviklingen er det egentlige svaret.')
        : tr('That is the direction that builds weight. Nice.', 'Det er den retningen som bygger vekt. Fint.'));
  } else if (!calm && st.activeAvg != null && st.burnedAvg == null) {
    note = tr('Burned only shows active calories so far. Add Resting Energy to the Watch shortcut to see your whole day.', 'Forbrent viser bare aktive kalorier foreløpig. Legg til Kvileenergi i snarveien for å se hele dagen.');
  }
  return `<div class="seg" style="grid-auto-columns:minmax(0,1fr)">${RANGES.map(([n, l]) => `<button aria-pressed="${trange === n}" data-act="trange" data-n="${n}">${l()}</button>`).join('')}</div>
    <p class="cheer-line" style="margin-top:0">${esc(summaryLine(st))}</p>
    <div class="grid2">
      <div class="tile"><span class="small muted">${calm ? tr('Days with food', 'Dager med mat') : tr('Eaten / day', 'Spist / dag')}</span>
        <span class="big num">${calm ? `${st.loggedDays}/${st.n}` : st.eatenAvg != null ? n0(st.eatenAvg) : '–'}</span><span class="tiny muted">${calm ? tr('days logged', 'dager logget') : st.eatenAvg != null ? `${tr('kcal', 'kcal')}${st.proteinAvg ? ` · ${Math.round(st.proteinAvg)} g ${tr('protein', 'protein')}` : ''}` : tr('nothing logged yet', 'ingenting logget ennå')}</span></div>
      ${calm ? `<div class="tile"><span class="small muted">${tr('Supplements', 'Tilskudd')}</span><span class="big num">${st.suppDays}/${st.n}</span><span class="tiny muted">${tr('days all ticked', 'dager alt krysset av')}</span></div>`
        : burnedVal != null ? `<a class="tile" href="#/health"><span class="small muted">${burnedLabel}</span><span class="big num">${n0(burnedVal)}</span><span class="tiny muted">${tr('kcal, from your Watch', 'kcal, fra klokka')}</span></a>`
        : `<a class="tile" href="#/health"><span class="small muted">${tr('Burned', 'Forbrent')}</span><span class="big">${icon('watch', 26)}</span><span class="tiny" style="font-weight:600;color:var(--accent)">${tr('Connect your Watch', 'Koble til klokka')}</span></a>`}
      <a class="tile" href="#/train"><span class="small muted">${tr('Training', 'Trening')}</span><span class="big num">${st.workouts}</span><span class="tiny muted">${st.trainMin ? `${st.trainMin} min ${tr('in total', 'til sammen')}` : tr('workouts', 'økter')}</span></a>
      ${calm ? `<div class="tile"><span class="small muted">${tr('Sleep', 'Søvn')}</span><span class="big num">${st.sleepAvg != null ? fmtSleep(st.sleepAvg) : '–'}</span><span class="tiny muted">${tr('average night', 'snitt per natt')}</span></div>`
        : `<div class="tile"><span class="small muted">${tr('Supplements', 'Tilskudd')}</span><span class="big num">${suppList().length ? `${st.suppDays}/${st.n}` : '–'}</span><span class="tiny muted">${suppList().length ? tr('days all ticked', 'dager alt krysset av') : tr('none chosen', 'ingen valgt')}</span></div>`}
    </div>
    ${bodyCard(st)}
    <section class="card" aria-label="${calm ? tr('Food logged', 'Mat logget') : tr('Eaten and burned', 'Spist og forbrent')}">
      <div class="row between"><h2 class="h3">${calm ? tr('Food logged', 'Mat logget') : tr('Eaten and burned', 'Spist og forbrent')}</h2>${long ? `<span class="tiny muted">${tr('weekly average', 'snitt per uke')}</span>` : ''}</div>
      ${!calm && !long ? `${dayChart(days.map((d) => d.key), { burned: Object.fromEntries(days.filter((d) => d.burned != null).map((d) => [d.key, d.burned])), label: tr('Calories per day by protein, carbs and fat, with calories burned', 'Kalorier per dag fordelt på protein, karbo og fett, med forbrenning') })}
        ${legend([[tr('No macro info', 'Uten makroinfo'), 'background:var(--c-unknown)'], ...(days.some((d) => d.burned != null) ? [[tr('Burned (Watch)', 'Forbrent (klokka)'), 'border:1.5px solid var(--muted)']] : [])])}`
        : `${barChart(items, { calm, label: calm ? tr('Foods logged per day', 'Mat logget per dag') : tr('Calories eaten and burned per day', 'Kalorier spist og forbrent per dag') })}
      <div class="row wrap" style="gap:14px"><span class="tiny row" style="gap:6px"><i class="sw a"></i>${calm ? tr('Things logged', 'Ting logget') : tr('Eaten', 'Spist')}</span>
        ${!calm && items.some((i) => i.b != null) ? `<span class="tiny row" style="gap:6px"><i class="sw b"></i>${tr('Burned (Watch)', 'Forbrent (klokka)')}</span>` : ''}</div>`}
      ${note ? `<p class="small soft" style="line-height:1.5">${esc(note)}</p>` : ''}
    </section>
    <section class="card" aria-label="${tr('Habits', 'Vaner')}">
      <h2 class="h3">${tr('Your habits', 'Vanene dine')}</h2>
      ${habitRows(days)}
      ${long ? `<p class="tiny muted">${tr('One square per week. Darker = more days.', 'Én rute per uke. Mørkere = flere dager.')}</p>` : ''}
    </section>
    <section class="card" style="padding:6px 16px" aria-label="${tr('Day by day', 'Dag for dag')}">
      <h2 class="h3" style="padding-top:10px">${tr('Day by day', 'Dag for dag')}</h2>
      ${withData.length ? `<div class="list">${withData.slice(0, listMax).map(dayRow).join('')}</div>
        ${withData.length > listMax ? `<button class="btn secondary small" style="margin:8px 0" data-act="more">${tr('Show more days', 'Vis flere dager')}</button>` : ''}`
        : `<p class="small muted" style="padding-bottom:12px">${tr('Nothing in this period yet.', 'Ingenting i denne perioden ennå.')}</p>`}
    </section>
    ${watchBody()}
    ${bmiCard()}
    <section class="card tight">
      <h2 class="h3">${tr('Your history', 'Historikken din')}</h2>
      <p class="small soft" style="line-height:1.5">${tr('Every day is saved on this phone. Export it as a spreadsheet (one row per day) to keep or show your doctor.', 'Hver dag lagres på denne telefonen. Eksporter som regneark (én rad per dag) for å ta vare på det eller vise legen.')}</p>
      <button class="btn secondary" data-act="csv">${icon('download', 18)} ${tr('Export as spreadsheet (CSV)', 'Eksporter som regneark (CSV)')}</button>
    </section>`;
}

function bmiCard() {
  const st = S();
  const w = latestWeight();
  const height = st.profile.heightCm;
  const bmi = bmiOf(w?.kg, height);
  const pos = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / 20) * 100)) : null;
  return `<section class="card" aria-label="${tr('BMI calculator', 'BMI-kalkulator')}">
      <h2 class="h2">${tr('BMI calculator', 'BMI-kalkulator')}</h2>
      <div class="grid2"><div class="field"><label for="b-h">${tr('Height (cm)', 'Høyde (cm)')}</label><input id="b-h" class="input filled" type="number" inputmode="numeric" value="${height ?? ''}" data-change="height"></div>
        <div class="field"><label for="b-w">${tr('Weight (kg)', 'Vekt (kg)')}</label><input id="b-w" class="input filled" type="text" inputmode="decimal" autocomplete="off" value="${kgText(w?.kg)}" data-input="bmiW"></div></div>
      <div class="row" style="gap:8px;align-items:baseline"><span class="small muted">${tr('BMI', 'BMI')}</span><span id="bmi-v" class="num" style="font-size:30px;font-weight:700">${bmi ? n1(bmi) : '–'}</span></div>
      <div class="bmi-scale" aria-hidden="true"><div class="bars"><span class="under" style="width:17.5%"></span><span class="ok" style="width:32.5%"></span><span style="width:25%"></span><span style="width:25%"></span></div>
        <span id="bmi-m" class="marker" style="left:${pos ?? 0}%;${pos == null ? 'display:none' : ''}"></span>
        <div class="labels"><span style="width:17.5%">15</span><span style="width:32.5%">18.5</span><span style="width:25%">25</span><span style="width:25%">30</span></div></div>
      <p class="small soft" style="line-height:1.5">${tr('For adults, 18.5 to 24.9 is the usual healthy range. BMI is only a rough guide: your trend, strength and how you feel matter more.', 'For voksne er 18,5 til 24,9 det vanlige normalområdet. BMI er bare en grov pekepinn: utviklingen, styrken og hvordan du har det betyr mer.')}</p>
    </section>`;
}

function daySheet(key) {
  const d = daySummary(key);
  const pd = peekDay(key);
  const calm = S().prefs.calm;
  const t = ticks(key);
  const line = (l, v) => `<div class="row between"><span class="small muted">${l}</span><span class="small num" style="font-weight:600">${v}</span></div>`;
  const logs = pd.logs.slice().sort((a, b) => a.ts - b.ts);
  openSheet({
    title: `${dayShort(parseKey(key))} ${shortDate(parseKey(key))}`,
    html: `${d.weight != null ? line(tr('Weight', 'Vekt'), `${n1(d.weight)} kg`) : ''}
      <p class="label">${tr('Food', 'Mat')}${!calm && d.logs ? ` · ${n0(d.eaten)} kcal` : ''}</p>
      ${logs.length ? `<div class="list">${logs.map((l) => `<div class="item"><span class="small muted num" style="width:42px">${clock(l.ts)}</span><span class="grow">${esc(l.title)}</span>${calm ? '' : `<span class="small num soft">${n0(l.kcal)}</span>`}</div>`).join('')}</div>` : `<p class="small muted">${tr('Nothing logged.', 'Ingenting logget.')}</p>`}
      <p class="label">${tr('Training', 'Trening')}</p>
      ${d.workouts ? `<div class="list">${S().workouts.filter((w) => w.date === key).map((w) => `<div class="item">${icon('dumbbell', 18)}<span class="grow">${esc(w.name || w.wid)}</span><span class="small muted">${w.minutes} min${w.sets ? ` · ${w.sets} ${tr('sets', 'sett')}` : ''}</span></div>`).join('')}</div>` : `<p class="small muted">${tr('Rest day.', 'Hviledag.')}</p>`}
      ${suppList().length ? `<p class="label">${tr('Supplements', 'Tilskudd')}</p><div class="chips">${suppList().map((x) => `<span class="chip ${t[x.id] ? 'on' : ''}" style="pointer-events:none">${t[x.id] ? icon('check', 14) : '–'} ${esc(suppName(x))}</span>`).join('')}</div>` : ''}
      ${d.active != null || d.sleepMin != null || d.steps != null ? `<p class="label">Apple Watch</p><div class="col" style="gap:6px">
        ${d.sleepMin != null ? line(tr('Sleep', 'Søvn'), fmtSleep(d.sleepMin)) : ''}
        ${!calm && d.active != null ? line(tr('Active calories', 'Aktive kalorier'), `${n0(d.active)} kcal`) : ''}
        ${!calm && d.basal != null ? line(tr('Resting calories', 'Hvilekalorier'), `${n0(d.basal)} kcal`) : ''}
        ${!calm && d.burned != null ? line(tr('Burned in total', 'Forbrent totalt'), `${n0(d.burned)} kcal`) : ''}
        ${d.steps != null ? line(tr('Steps', 'Skritt'), n0(d.steps)) : ''}</div>` : ''}
      ${d.symptoms.length ? `<p class="label">${tr('Journal', 'Dagbok')}</p><div class="chips">${d.symptoms.map((x) => `<span class="chip" style="pointer-events:none">${esc(symptomLabel(x))}</span>`).join('')}</div>` : ''}
      <button class="btn secondary" data-act="journal">${icon('book', 18)} ${tr('Open the journal for this day', 'Åpne dagboka for denne dagen')}</button>`,
    actions: { journal: () => { closeSheet(true); nav.go(`progress/journal/${key}`); } },
  });
}

export function render(ctx) {
  const [tab, arg] = ctx.params;
  const which = tab === 'journal' ? 'journal' : tab === 'patterns' ? 'patterns' : 'trends';
  const key = which === 'journal' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '') && arg <= dayKey() ? arg : dayKey();
  return `<div class="screen">
    <div class="blob b1"></div>
    <header class="head"><h1 class="h1">${tr('Progress', 'Fremgang')}</h1></header>
    <div class="seg" role="tablist">
      <a role="tab" href="#/progress" aria-selected="${which === 'trends'}">${tr('Trends', 'Utvikling')}</a>
      <a role="tab" href="#/progress/journal" aria-selected="${which === 'journal'}">${tr('Journal', 'Dagbok')}</a>
      <a role="tab" href="#/progress/patterns" aria-selected="${which === 'patterns'}">${tr('Patterns', 'Mønstre')}</a></div>
    ${which === 'journal' ? journalTab(key) : which === 'patterns' ? patternsTab() : trendsTab()}
  </div>${tabbar('progress')}`;
}

function keyFrom(ctx) {
  const [tab, arg] = ctx.params;
  return tab === 'journal' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : dayKey();
}

// edit = true when opened from the list: then changing the date moves that weigh-in.
// Logging a new one never removes another day's weigh-in.
function weightSheet(date = dayKey(), kg = latestWeight()?.kg, edit = false) {
  const existing = S().weights.find((w) => w.date === date);
  openSheet({
    title: edit ? tr('Edit weigh-in', 'Endre veiing') : tr('Log weight', 'Logg vekt'),
    html: `<div class="field"><label for="w-kg">${tr('Weight (kg)', 'Vekt (kg)')}</label>
      <input id="w-kg" class="input" type="text" inputmode="decimal" autocomplete="off" value="${kgText(existing?.kg ?? kg)}"></div>
      <div class="field"><label for="w-date">${tr('Date', 'Dato')}</label><input id="w-date" class="input" type="date" value="${date}" max="${dayKey()}"></div>
      <p class="tiny muted">${tr('Tip: weigh yourself in the morning, before breakfast. Day-to-day changes are mostly water, so look at the trend.', 'Tips: vei deg om morgenen før frokost. Endringer fra dag til dag er mest vann, så se på utviklingen.')}</p>
      <button class="btn primary" data-act="save">${tr('Save', 'Lagre')}</button>
      ${edit && existing ? `<button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button>` : ''}`,
    actions: {
      save: (el, e, sheet) => {
        const v = parseFloat(String(sheet.querySelector('#w-kg').value).replace(',', '.'));
        const dt = sheet.querySelector('#w-date').value || dayKey();
        if (!(v > 25 && v < 300)) { toast(tr('That weight looks off. Try again.', 'Den vekten ser feil ut. Prøv igjen.')); return; }
        if (edit && dt !== date) mutate((s) => { s.weights = s.weights.filter((w) => w.date !== date); });
        addWeight(v, dt);
        closeSheet();
        toast(tr('Weight saved.', 'Vekt lagret.'));
        nav.rerender();
      },
      del: () => {
        mutate((s) => { s.weights = s.weights.filter((w) => w.date !== date); });
        closeSheet();
        nav.rerender();
      },
    },
    onMount: (sheet) => setTimeout(() => sheet.querySelector('#w-kg')?.focus(), 250),
  });
}

export const actions = {
  note: (el, e, ctx) => saveText(keyFrom(ctx), 'note', el.value),
  good: (el, e, ctx) => saveText(keyFrom(ctx), 'good', el.value),
  sym: (el, e, ctx) => {
    const key = keyFrom(ctx);
    const s = el.dataset.s;
    mutate(() => {
      const j = ensureJournal(key);
      j.symptoms = j.symptoms.includes(s) ? j.symptoms.filter((x) => x !== s) : [...j.symptoms, s];
    });
    el.setAttribute('aria-pressed', String(ensureJournal(key).symptoms.includes(s)));
  },
  lvl: (el, e, ctx) => {
    const key = keyFrom(ctx);
    const k = el.dataset.k;
    const v = Number(el.dataset.v);
    mutate(() => {
      const j = ensureJournal(key);
      if (j.levels[k] === v) delete j.levels[k];
      else j.levels[k] = v;
    });
    const cur = ensureJournal(key).levels[k] || 0;
    el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) <= cur));
  },
  deep: async () => {
    ai = { busy: true, res: null, error: '' };
    nav.rerender();
    try {
      ai.res = await deepPatterns(diarySummary(30) || 'No data yet.');
    } catch (err) {
      ai.error = err.message || String(err);
    }
    ai.busy = false;
    nav.rerender();
  },
  trange: (el) => { trange = Number(el.dataset.n) || 30; listMax = 14; nav.rerender(); },
  more: () => { listMax += 30; nav.rerender(); },
  day: (el) => daySheet(el.dataset.k),
  csv: () => download(`vektplan-days-${dayKey()}.csv`, historyCSV(), 'text/csv'),
  addW: () => weightSheet(),
  editW: (el) => weightSheet(el.dataset.date, undefined, true),
  height: (el) => {
    const v = Math.round(Number(el.value));
    mutate((s) => { s.profile.heightCm = v > 80 && v < 260 ? v : null; });
    nav.rerender();
  },
  bmiW: (el) => {
    const kg = parseFloat(String(el.value).replace(',', '.'));
    const bmi = bmiOf(kg, S().profile.heightCm);
    const v = document.getElementById('bmi-v');
    const m = document.getElementById('bmi-m');
    if (v) v.textContent = bmi ? n1(bmi) : '–';
    if (m) {
      m.style.display = bmi ? '' : 'none';
      if (bmi) m.style.left = `${Math.max(0, Math.min(100, ((bmi - 15) / 20) * 100))}%`;
    }
  },
};
