// Choose and tune a ready-made muscle program: which days, where you train, what equipment you have,
// which muscles to focus on, how hard and how many reps. The preview updates as you choose.
import { tr, L, dayShort } from '../i18n.js';
import { icon, toast, confirmSheet, openSheet, closeSheet } from '../ui.js';
import { esc, dayKey, addDays, startOfWeek, parseKey } from '../util.js';
import { nav } from '../nav.js';
import { PLACES, PLACE_ORDER, EQUIP, EQUIP_ORDER } from '../data/exercises.js';
import { PROGRAMS, PROGRAM_ORDER, FOCUS, FOCUS_ORDER, REPS, normFocus } from '../data/programs.js';
import { howToSheet, needsLine } from './howto.js';
import { training, programReady, LEVELS, buildProgram, applyProgram, allowedEquip, setEquip, exName, getEx } from '../training.js';

const WD = () => Array.from({ length: 7 }, (_, i) => dayShort(parseKey(addDays(startOfWeek(dayKey()), i))));
let cfg = null;

function fresh(id) {
  const t = training();
  const cur = t.program;
  if (cur && cur.id === id) return { ...cur, days: [...cur.days], focus: normFocus(cur.focus) };
  return {
    id,
    days: [...PROGRAMS[id].days],
    place: cur?.place || (PLACES[t.place] && !PLACES[t.place].hidden ? t.place : 'home'),
    focus: PROGRAMS[id].focusDay && !normFocus(cur?.focus).length ? [...PROGRAMS[id].defaultFocus] : normFocus(cur?.focus),
    level: cur?.level || t.level || 'gentle',
    reps: cur?.reps || 'grow',
    rest: cur?.rest || 'mix',
  };
}

export function enter(ctx) {
  const id = PROGRAMS[ctx.params[0]] ? ctx.params[0] : training().program?.id || 'start2';
  cfg = fresh(id);
}

const choice = (act, v, on, title, sub, extra = '') => `<button class="choice" aria-pressed="${on}" data-act="${act}" data-v="${v}" style="flex-direction:column;align-items:flex-start;gap:0">
  <span style="display:block;font-weight:700">${title}${extra}</span>${sub ? `<span class="small soft" style="display:block;margin-top:3px;line-height:1.4;font-weight:400">${sub}</span>` : ''}</button>`;

export function equipChips(place) {
  const have = allowedEquip(place);
  return `<div class="chips">${EQUIP_ORDER.map((e) => `<button class="chip solid" aria-pressed="${have.includes(e)}" data-act="gear" data-p="${place}" data-e="${e}">${have.includes(e) ? icon('check', 14) : ''} ${esc(L(EQUIP[e]))}</button>`).join('')}</div>`;
}
export function toggleGear(place, e) {
  const have = allowedEquip(place).filter((x) => x !== 'none');
  setEquip(place, have.includes(e) ? have.filter((x) => x !== e) : [...have, e]);
}

// The equipment sheet (also opened from Train and the plan wizard).
export function equipSheet(onDone) {
  const draw = () => `<p class="small soft" style="line-height:1.45">${tr('Tick what you have. Every plan picks exercises that fit, and body-weight moves are always there.', 'Kryss av det du har. Alle planer velger øvelser som passer, og kroppsvektøvelser er alltid med.')}</p>
    ${PLACE_ORDER.map((p) => `<p class="label">${esc(L(PLACES[p].name))}</p>${equipChips(p)}`).join('')}
    <button class="btn primary" data-act="done">${tr('Done', 'Ferdig')}</button>`;
  openSheet({
    title: tr('Your equipment', 'Utstyret ditt'),
    html: draw(),
    actions: {
      gear: (el, e, sheet) => { toggleGear(el.dataset.p, el.dataset.e); sheet.querySelector('.col').innerHTML = draw(); },
      done: () => closeSheet(),
    },
    onClose: () => { onDone?.(); nav.rerender(); },
  });
}

function preview() {
  const plan = buildProgram(cfg);
  const wd = WD();
  const daysOf = (sid) => Object.entries(plan.schedule).filter(([, v]) => v === sid).map(([d]) => wd[d]).join(', ');
  return `<div class="col" style="gap:10px">${plan.sessions.map((s) => `<section class="card tight">
      <div class="row between"><h3 class="h3">${esc(s.name)}</h3><span class="small muted">${esc(daysOf(s.id))}</span></div>
      <div class="list">${s.ex.map((e) => {
        const x = getEx(e.id);
        const goal = x?.mode === 'time' ? `${e.sets} × ${e.reps} s` : `${e.sets} × ${e.lo && e.hi ? `${e.lo}–${e.hi}` : e.reps}`;
        return `<button class="item" data-act="how" data-id="${esc(e.id)}" style="gap:10px;padding:10px 0">${e.focus ? `<span class="dot" style="background:var(--accent-line)" title="${tr('Focus', 'Fokus')}"></span>` : '<span class="dot" style="background:var(--surface2)"></span>'}
          <span class="grow" style="min-width:0">${esc(exName(e.id))}</span><span class="small muted num" style="white-space:nowrap">${goal}</span><span class="q" style="flex:none;width:20px;height:20px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:700;display:grid;place-items:center" aria-hidden="true">?</span></button>`;
      }).join('')}</div>
      <p class="tiny soft">${icon('dumbbell', 13, 'style="vertical-align:-2px"')} ${tr('You need', 'Du trenger')}: ${esc(needsLine(s.ex.map((e) => e.id)))}</p></section>`).join('')}
    ${cfg.focus.length ? `<p class="tiny muted">${tr('Blue dot = focus muscle: an extra exercise and one more set.', 'Blå prikk = fokusmuskel: en ekstra øvelse og ett sett til.')}</p>` : ''}</div>`;
}

export function render() {
  if (!cfg) cfg = fresh('start2');
  const prog = PROGRAMS[cfg.id];
  const wd = WD();
  const recommended = prog.days.length;
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <div class="titles grow"><p class="eyebrow">${tr('Training plan', 'Treningsplan')}</p><h1 class="h1" style="font-size:26px">${esc(L(prog.name))}</h1></div></header>

    <div class="chips">${PROGRAM_ORDER.map((id) => `<button class="chip solid" aria-pressed="${cfg.id === id}" data-act="prog" data-v="${id}">${esc(L(PROGRAMS[id].name))}</button>`).join('')}</div>
    <p class="soft" style="line-height:1.5;margin:0 4px">${esc(L(prog.sub))}</p>

    <section class="card">
      <h2 class="h3">${tr('Which days?', 'Hvilke dager?')}</h2>
      <div class="daypick">${wd.map((d, i) => `<button class="dp" aria-pressed="${cfg.days.includes(i)}" data-act="day" data-v="${i}"><span>${esc(d)}</span></button>`).join('')}</div>
      <p class="tiny muted">${cfg.days.length} ${cfg.days.length === 1 ? tr('day a week', 'dag i uka') : tr('days a week', 'dager i uka')} · ${tr(`this plan is made for ${recommended}. Leave a day of rest between if you can.`, `denne planen er laget for ${recommended}. La det gå en hviledag imellom hvis du kan.`)}</p>
    </section>

    <section class="card">
      <h2 class="h3">${tr('Where do you usually train?', 'Hvor trener du som regel?')}</h2>
      <div class="seg">${PLACE_ORDER.map((p) => `<button aria-pressed="${cfg.place === p}" data-act="place" data-v="${p}">${esc(L(PLACES[p].name))}</button>`).join('')}</div>
      <p class="tiny muted" style="line-height:1.5">${tr('Not sure, or a mix? Pick one. On a training day you can switch with one tap and the exercises change to fit.', 'Usikker, eller litt av begge? Velg én. På en treningsdag kan du bytte med ett trykk, og øvelsene endres så de passer.')}</p>
      <p class="label">${tr('What you have', 'Det du har')} · ${esc(L(PLACES[cfg.place].name)).toLowerCase()}</p>
      ${equipChips(cfg.place)}
      <button class="link-btn small" data-act="allGear" style="align-self:flex-start">${tr('Equipment for every place', 'Utstyr for alle steder')}</button>
    </section>

    <section class="card">
      <h2 class="h3">${prog.focusDay ? tr('Muscles for the focus day', 'Muskler for fokusdagen') : tr('Extra focus (optional)', 'Ekstra fokus (valgfritt)')}</h2>
      <p class="small soft" style="line-height:1.45">${prog.focusDay ? tr('The day in between trains only these, and the full-body days include one exercise for each. 1–2 works best.', 'Dagen imellom trener bare disse, og helkroppsdagene har én øvelse for hver. 1–2 fungerer best.') : tr('Want some muscles to grow faster? They get an extra exercise and one more set. 1–2 works best.', 'Vil du at noen muskler skal vokse fortere? De får en ekstra øvelse og ett sett til. 1–2 fungerer best.')}</p>
      <div class="chips">${FOCUS_ORDER.map((f) => `<button class="chip solid" aria-pressed="${cfg.focus.includes(f)}" data-act="focus" data-v="${f}">${esc(L(FOCUS[f].name))}</button>`).join('')}</div>
      ${cfg.focus.length > 2 ? `<p class="tiny" style="color:var(--amber)">${tr('Many focus muscles make sessions longer, and the extras get shared out. Fewer often grows more.', 'Mange fokusmuskler gir lengre økter, og ekstraøvelsene må deles. Færre gir ofte mer vekst.')}</p>` : ''}
    </section>

    <section class="card">
      <h2 class="h3">${tr('How hard?', 'Hvor hardt?')}</h2>
      <div class="col">${Object.entries(LEVELS).map(([k, v]) => choice('level', k, cfg.level === k, esc(L(v.name)), esc(L(v.sub)), k === 'gentle' ? ` <span class="badge accent" style="margin-left:6px">${tr('While eating little', 'Mens du spiser lite')}</span>` : '')).join('')}</div>
      <h2 class="h3" style="margin-top:6px">${tr('Reps', 'Repetisjoner')}</h2>
      <div class="col">${Object.entries(REPS).map(([k, v]) => choice('reps', k, cfg.reps === k, esc(L(v.name)), esc(L(v.sub)))).join('')}</div>
      <h2 class="h3" style="margin-top:6px">${tr('Rest days', 'Hviledager')}</h2>
      <div class="seg"><button aria-pressed="${cfg.rest !== 'none'}" data-act="rest" data-v="mix">${tr('A walk or a stretch', 'En gåtur eller tøying')}</button><button aria-pressed="${cfg.rest === 'none'}" data-act="rest" data-v="none">${tr('Just rest', 'Bare hvile')}</button></div>
    </section>

    <div class="section-title"><h2 class="h2">${tr('Your sessions', 'Øktene dine')}</h2></div>
    ${preview()}
    <button class="btn primary" data-act="use" style="min-height:56px">${icon('check', 18)} ${tr('Use this plan', 'Bruk denne planen')}</button>
    <p class="tiny muted center" style="line-height:1.5">${tr('You can change any exercise, set or day afterwards.', 'Du kan endre hver øvelse, sett og dag etterpå.')}</p>
    <a class="link-btn" style="align-self:center" href="#/plan/new">${tr('Or build one from scratch (advanced)', 'Eller lag en helt selv (avansert)')}</a>
  </div>`;
}

export const actions = {
  how: (el) => howToSheet(el.dataset.id),
  back: () => { cfg = null; nav.back('train'); },
  prog: (el) => {
    const id = el.dataset.v;
    if (!PROGRAMS[id] || id === cfg.id) return;
    cfg = { ...cfg, id, days: [...PROGRAMS[id].days], focus: PROGRAMS[id].focusDay && !cfg.focus.length ? [...PROGRAMS[id].defaultFocus] : cfg.focus };
    nav.rerender();
  },
  day: (el) => {
    const d = Number(el.dataset.v);
    if (cfg.days.includes(d)) {
      if (cfg.days.length <= 1) { toast(tr('Keep at least one day.', 'Behold minst én dag.')); return; }
      cfg.days = cfg.days.filter((x) => x !== d);
    } else {
      if (cfg.days.length >= 6) { toast(tr('Keep at least one day off.', 'Behold minst én fridag.')); return; }
      cfg.days = [...cfg.days, d].sort((a, b) => a - b);
    }
    nav.rerender();
  },
  place: (el) => { cfg.place = el.dataset.v; nav.rerender(); },
  gear: (el) => { toggleGear(el.dataset.p, el.dataset.e); nav.rerender(); },
  allGear: () => equipSheet(),
  focus: (el) => {
    const f = el.dataset.v;
    cfg.focus = cfg.focus.includes(f) ? cfg.focus.filter((x) => x !== f) : [...cfg.focus, f];
    nav.rerender();
  },
  level: (el) => { cfg.level = el.dataset.v; nav.rerender(); },
  reps: (el) => { cfg.reps = el.dataset.v; nav.rerender(); },
  rest: (el) => { cfg.rest = el.dataset.v; nav.rerender(); },
  use: async () => {
    if (programReady()) {
      const ok = await confirmSheet({
        title: tr('Use this plan?', 'Bruke denne planen?'),
        text: tr('It replaces your current sessions and week. Your workout history and best lifts are kept.', 'Den erstatter øktene og uka du har nå. Treningshistorikken og rekordene dine beholdes.'),
        yes: tr('Use it', 'Bruk den'),
      });
      if (!ok) return;
    }
    const plan = applyProgram(cfg);
    const first = plan.days.find((d) => d >= (new Date().getDay() + 6) % 7) ?? plan.days[0];
    cfg = null;
    toast(tr(`Your plan is ready. First session: ${WD()[first]}.`, `Planen din er klar. Første økt: ${WD()[first]}.`), 3000);
    nav.go('train');
  },
};

