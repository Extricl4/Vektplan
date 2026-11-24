import { S, peekDay, day, mutate, hasJournal, addWeight, latestWeight } from '../store.js';
import { analyze, patternText, symptomLabel, diarySummary } from '../patterns.js';
import { hasAI, deepPatterns } from '../ai.js';
import { tr, n1, longDate, shortDate, dayShort } from '../i18n.js';
import { icon, tabbar, weightChart, openSheet, closeSheet, toast, sparkline } from '../ui.js';
import { esc, dayKey, addDays, parseKey, debounce, clock } from '../util.js';
import { nav } from '../nav.js';
import { hasHealth, healthDay, fmtSleep } from '../health.js';

const SYMPTOMS = ['nausea', 'bloating', 'pain', 'gas', 'diarrhea', 'constipation', 'reflux', 'low_energy', 'anxiety', 'good'];
const LEVELS = [
  ['nausea', () => tr('Nausea', 'Kvalme'), false],
  ['bloating', () => tr('Bloating', 'Oppblåsthet'), false],
  ['pain', () => tr('Pain', 'Smerter'), false],
  ['energy', () => tr('Energy', 'Energi'), true],
];

let range = '3m';
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

function bmiOf(kg, cm) {
  if (!kg || !cm) return null;
  return kg / ((cm / 100) ** 2);
}

function bodyTab() {
  const st = S();
  const w = latestWeight();
  const all = st.weights;
  const cutoff = range === '1m' ? addDays(dayKey(), -31) : range === '3m' ? addDays(dayKey(), -92) : '0000';
  const pts = all.filter((p) => p.date >= cutoff);
  const first = all[0];
  const change = w && first && all.length > 1 ? w.kg - first.kg : null;
  const height = st.profile.heightCm;
  const bmi = bmiOf(w?.kg, height);
  const pos = bmi ? Math.max(0, Math.min(100, ((bmi - 15) / 20) * 100)) : null;
  return `<section class="card">
      <div class="row between top"><div><span class="small muted">${tr('Weight', 'Vekt')}</span>
        <p class="num" style="font-size:34px;font-weight:700;letter-spacing:-0.02em;line-height:1.1">${w ? `${n1(w.kg)} kg` : '–'}</p>
        ${change != null ? `<span class="small" style="font-weight:600;color:var(--accent)">${change >= 0 ? '+' : ''}${n1(change)} kg ${tr('since', 'siden')} ${shortDate(parseKey(first.date))}</span>` : `<span class="small muted">${tr('Weigh in once a week, same time of day', 'Vei deg en gang i uka, til samme tid')}</span>`}</div>
        <button class="btn small primary" data-act="addW">${icon('plus', 16)} ${tr('Log weight', 'Logg vekt')}</button></div>
      ${all.length ? `<div class="seg" style="grid-auto-columns:minmax(0,1fr)">${[['1m', tr('1 month', '1 mnd')], ['3m', tr('3 months', '3 mnd')], ['all', tr('All', 'Alt')]].map(([id, l]) => `<button aria-pressed="${range === id}" data-act="range" data-r="${id}">${l}</button>`).join('')}</div>
        ${pts.length ? weightChart(pts, { label: tr('Weight over time', 'Vekt over tid') }) : `<p class="small muted">${tr('No weigh-ins in this period.', 'Ingen veiinger i denne perioden.')}</p>`}` : ''}
    </section>
    ${watchBody()}
    <section class="card" aria-label="${tr('BMI calculator', 'BMI-kalkulator')}">
      <h2 class="h2">${tr('BMI calculator', 'BMI-kalkulator')}</h2>
      <div class="grid2"><div class="field"><label for="b-h">${tr('Height (cm)', 'Høyde (cm)')}</label><input id="b-h" class="input filled" type="number" inputmode="numeric" value="${height ?? ''}" data-change="height"></div>
        <div class="field"><label for="b-w">${tr('Weight (kg)', 'Vekt (kg)')}</label><input id="b-w" class="input filled" type="number" inputmode="decimal" step="0.1" value="${w?.kg ?? ''}" data-input="bmiW"></div></div>
      <div class="row" style="gap:8px;align-items:baseline"><span class="small muted">${tr('BMI', 'BMI')}</span><span id="bmi-v" class="num" style="font-size:30px;font-weight:700">${bmi ? n1(bmi) : '–'}</span></div>
      <div class="bmi-scale" aria-hidden="true"><div class="bars"><span class="under" style="width:17.5%"></span><span class="ok" style="width:32.5%"></span><span style="width:25%"></span><span style="width:25%"></span></div>
        <span id="bmi-m" class="marker" style="left:${pos ?? 0}%;${pos == null ? 'display:none' : ''}"></span>
        <div class="labels"><span style="width:17.5%">15</span><span style="width:32.5%">18.5</span><span style="width:25%">25</span><span style="width:25%">30</span></div></div>
      <p class="small soft" style="line-height:1.5">${tr('For adults, 18.5 to 24.9 is the usual healthy range. BMI is only a rough guide: your trend, strength and how you feel matter more.', 'For voksne er 18,5 til 24,9 det vanlige normalområdet. BMI er bare en grov pekepinn: utviklingen, styrken og hvordan du har det betyr mer.')}</p>
    </section>
    ${all.length ? `<section class="card" style="padding:4px 16px"><div class="list">${all.slice(-8).reverse().map((p) => `<button class="item" data-act="editW" data-date="${p.date}"><span class="grow">${shortDate(parseKey(p.date))}</span><span class="num" style="font-weight:600">${n1(p.kg)} kg</span>${icon('chevR', 16)}</button>`).join('')}</div></section>` : ''}`;
}

export function render(ctx) {
  const [tab, arg] = ctx.params;
  const which = tab === 'body' ? 'body' : tab === 'patterns' ? 'patterns' : 'journal';
  const key = which === 'journal' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '') && arg <= dayKey() ? arg : dayKey();
  return `<div class="screen">
    <div class="blob b1"></div>
    <header class="head"><h1 class="h1">${tr('Progress', 'Fremgang')}</h1></header>
    <div class="seg" role="tablist">
      <a role="tab" href="#/progress" aria-selected="${which === 'journal'}">${tr('Journal', 'Dagbok')}</a>
      <a role="tab" href="#/progress/patterns" aria-selected="${which === 'patterns'}">${tr('Patterns', 'Mønstre')}</a>
      <a role="tab" href="#/progress/body" aria-selected="${which === 'body'}">${tr('Body', 'Kropp')}</a></div>
    ${which === 'journal' ? journalTab(key) : which === 'patterns' ? patternsTab() : bodyTab()}
  </div>${tabbar('progress')}`;
}

function keyFrom(ctx) {
  const [tab, arg] = ctx.params;
  return tab === 'journal' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : dayKey();
}

function weightSheet(date = dayKey(), kg = latestWeight()?.kg) {
  const existing = S().weights.find((w) => w.date === date);
  openSheet({
    title: existing ? tr('Edit weigh-in', 'Endre veiing') : tr('Log weight', 'Logg vekt'),
    html: `<div class="field"><label for="w-kg">${tr('Weight (kg)', 'Vekt (kg)')}</label>
      <input id="w-kg" class="input" type="number" inputmode="decimal" step="0.1" min="30" max="250" value="${existing?.kg ?? kg ?? ''}"></div>
      <div class="field"><label for="w-date">${tr('Date', 'Dato')}</label><input id="w-date" class="input" type="date" value="${date}" max="${dayKey()}"></div>
      <p class="tiny muted">${tr('Tip: weigh yourself in the morning, before breakfast. Day-to-day changes are mostly water, so look at the trend.', 'Tips: vei deg om morgenen før frokost. Endringer fra dag til dag er mest vann, så se på utviklingen.')}</p>
      <button class="btn primary" data-act="save">${tr('Save', 'Lagre')}</button>
      ${existing ? `<button class="btn danger" data-act="del">${icon('trash', 18)} ${tr('Delete', 'Slett')}</button>` : ''}`,
    actions: {
      save: (el, e, sheet) => {
        const v = parseFloat(String(sheet.querySelector('#w-kg').value).replace(',', '.'));
        const dt = sheet.querySelector('#w-date').value || dayKey();
        if (!(v > 25 && v < 300)) { toast(tr('That weight looks off. Try again.', 'Den vekten ser feil ut. Prøv igjen.')); return; }
        if (dt !== date) mutate((s) => { s.weights = s.weights.filter((w) => w.date !== date); });
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
  range: (el) => { range = el.dataset.r; nav.rerender(); },
  addW: () => weightSheet(),
  editW: (el) => weightSheet(el.dataset.date),
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
