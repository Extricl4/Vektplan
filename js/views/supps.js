// The supplements card on Today and the sheet to choose which ones you take.
import { S } from '../store.js';
import { tr } from '../i18n.js';
import { icon, openSheet, closeSheet, toast } from '../ui.js';
import { esc, dayKey } from '../util.js';
import { nav } from '../nav.js';
import {
  PRESETS, PRESET_ORDER, suppList, suppName, suppDose, ticks, doneCount, allDone, suppStreak, toggleSupp, suppCheer,
  suppWarnings, setSupps, addCustomSupp, proteinNote,
} from '../supps.js';

export function suppsCard(key = dayKey()) {
  const list = suppList();
  const sp = S().supps || {};
  if (!list.length) {
    if (sp.setup) return '';
    return `<div class="note">${icon('pill', 18)}<div class="grow col" style="gap:8px">
      <span>${tr('Taking creatine, protein powder or vitamins? Tick them off here each day.', 'Tar du kreatin, proteinpulver eller vitaminer? Kryss dem av her hver dag.')}</span>
      <div class="row" style="gap:8px"><button class="btn small primary" data-act="suppEdit">${tr('Choose', 'Velg')}</button></div></div></div>`;
  }
  const t = ticks(key);
  const done = doneCount(key);
  const streak = suppStreak();
  return `<section class="card tight" aria-label="${tr('Supplements', 'Kosttilskudd')}">
    <div class="row between"><h2 class="h3 row" style="gap:8px">${icon('pill', 19)} ${tr('Supplements', 'Kosttilskudd')}</h2>
      <span class="row" style="gap:10px"><span class="small muted num">${done}/${list.length}</span><button class="link-btn small" data-act="suppEdit">${tr('Edit', 'Endre')}</button></span></div>
    <div class="supps">${list.map((x) => `<button class="supp ${t[x.id] ? 'on' : ''}" aria-pressed="${!!t[x.id]}" data-act="supp" data-id="${esc(x.id)}">
      <span class="box" aria-hidden="true">${icon('check', 15)}</span>
      <span class="grow" style="min-width:0"><span class="t">${esc(suppName(x))}</span><span class="d">${esc(suppDose(x))}${PRESETS[x.kind]?.food && !S().prefs.calm ? ` · ${proteinNote(x)}` : ''}</span></span></button>`).join('')}</div>
    ${allDone(key) ? `<p class="tiny" style="color:var(--sage);font-weight:600">${icon('check', 13, 'style="vertical-align:-2px"')} ${streak >= 2 ? tr(`All done · ${streak} days in a row`, `Alt gjort · ${streak} dager på rad`) : tr('All done today', 'Alt gjort i dag')}</p>` : ''}
  </section>`;
}

export function tickSupp(el, key = dayKey()) {
  const res = toggleSupp(el.dataset.id, key);
  toast(suppCheer(res), res.all ? 2600 : 1400);
  nav.rerender();
}

export function suppsSheet() {
  const draw = () => {
    const list = suppList();
    const on = (k) => list.find((x) => x.kind === k);
    const warn = suppWarnings(list);
    return `<p class="small soft" style="line-height:1.45">${tr('Switch on what you take. Each day you just tick them off on Today.', 'Slå på det du tar. Hver dag krysser du dem bare av på I dag.')}</p>
      ${warn.map((w) => `<div class="note amber">${icon('info', 18)}<span>${esc(w)}</span></div>`).join('')}
      <div class="list">${PRESET_ORDER.map((k) => {
        const x = on(k);
        const p = PRESETS[k];
        return `<div class="item" style="flex-wrap:wrap;align-items:center">
          <label class="row grow" style="gap:12px;cursor:pointer;min-width:0"><span class="switch"><input type="checkbox" ${x ? 'checked' : ''} data-change="toggle" data-k="${k}"><span></span></span>
            <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(p.name())}</span><span class="s">${esc(p.dose())}</span></span></label>
          <button class="icon-btn" data-act="about" data-k="${k}" aria-label="${tr('About', 'Om')} ${esc(p.name())}">${icon('info', 18)}</button>
          ${k === 'protein' && x ? `<div class="seg" style="width:100%;margin-top:8px;grid-auto-columns:minmax(0,1fr)">
            <button aria-pressed="${x.mix !== 'milk'}" data-act="mix" data-v="water">${tr('With water', 'Med vann')}</button>
            <button aria-pressed="${x.mix === 'milk'}" data-act="mix" data-v="milk">${tr('With lactose-free milk', 'Med laktosefri melk')}</button></div>` : ''}
          ${k === 'creatine-gummy' && x ? `<div class="row" style="width:100%;gap:8px;margin-top:8px"><label class="small muted" for="g-dose" style="white-space:nowrap">${tr('Your dose', 'Din dose')}</label>
            <input id="g-dose" class="input" style="min-height:40px" type="text" maxlength="30" value="${esc(x.dose ?? '3 g')}" data-change="dose" data-k="${k}"></div>` : ''}
          <div class="about tiny soft" data-about="${k}" hidden style="width:100%;line-height:1.5;margin-top:6px">${esc(p.about())}</div></div>`;
      }).join('')}
      ${list.filter((x) => x.kind === 'custom').map((x) => `<div class="item"><span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(x.name)}</span><span class="s">${esc(x.dose || '')}</span></span>
        <button class="icon-btn" data-act="rm" data-id="${esc(x.id)}" aria-label="${tr('Remove', 'Fjern')} ${esc(x.name)}">${icon('trash', 18)}</button></div>`).join('')}</div>
      <p class="label">${tr('Something else', 'Noe annet')}</p>
      <div class="grid2"><input id="c-name" class="input" type="text" maxlength="40" placeholder="${tr('Name, e.g. Magnesium', 'Navn, f.eks. Magnesium')}" autocomplete="off">
        <input id="c-dose" class="input" type="text" maxlength="30" placeholder="${tr('Dose (optional)', 'Dose (valgfritt)')}" autocomplete="off"></div>
      <button class="btn secondary" data-act="add">${icon('plus', 18)} ${tr('Add', 'Legg til')}</button>
      <p class="tiny muted" style="line-height:1.5">${tr('Not sure what you need? A pharmacy or your doctor can help. Never take more than the label says.', 'Usikker på hva du trenger? Apoteket eller legen kan hjelpe. Ta aldri mer enn det står på pakken.')}</p>
      <button class="btn primary" data-act="done">${tr('Done', 'Ferdig')}</button>`;
  };
  const redraw = (sheet) => { sheet.querySelector('.col').innerHTML = draw(); };
  openSheet({
    title: tr('Your supplements', 'Dine kosttilskudd'),
    html: draw(),
    actions: {
      toggle: (el, e, sheet) => {
        const k = el.dataset.k;
        setSupps((sp) => {
          if (el.checked) { if (!sp.list.some((x) => x.kind === k)) sp.list.push({ id: k, kind: k, ...(k === 'protein' ? { mix: 'water' } : {}) }); }
          else sp.list = sp.list.filter((x) => x.kind !== k);
        });
        redraw(sheet);
      },
      mix: (el, e, sheet) => { setSupps((sp) => { const x = sp.list.find((s) => s.kind === 'protein'); if (x) x.mix = el.dataset.v; }); redraw(sheet); },
      dose: (el) => setSupps((sp) => { const x = sp.list.find((s) => s.kind === el.dataset.k); if (x) x.dose = el.value.trim().slice(0, 30); }),
      about: (el, e, sheet) => { const a = sheet.querySelector(`[data-about="${el.dataset.k}"]`); if (a) a.hidden = !a.hidden; },
      rm: (el, e, sheet) => { setSupps((sp) => { sp.list = sp.list.filter((x) => x.id !== el.dataset.id); }); redraw(sheet); },
      add: (el, e, sheet) => {
        const name = sheet.querySelector('#c-name').value.trim();
        if (!name) { toast(tr('Write a name first.', 'Skriv et navn først.')); return; }
        addCustomSupp(name, sheet.querySelector('#c-dose').value);
        redraw(sheet);
      },
      done: () => { setSupps(() => {}); closeSheet(); nav.rerender(); },
    },
    onClose: () => nav.rerender(),
  });
}
