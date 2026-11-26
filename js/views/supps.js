// The supplements card on Today and the sheet to choose which ones you take, and how many a day.
import { S } from '../store.js';
import { tr } from '../i18n.js';
import { icon, openSheet, closeSheet, toast } from '../ui.js';
import { esc, dayKey } from '../util.js';
import { nav } from '../nav.js';
import {
  PRESETS, PRESET_ORDER, PER_DAY, SUPP_UNITS, suppList, suppName, suppDose, countOf, doneCount, allDone, suppStreak, toggleSupp, decSupp,
  suppCheer, suppWarnings, setSupps, addCustomSupp, proteinNote, perDay, suppUnit, suppEach, unitWord, listOn,
} from '../supps.js';

export function suppsCard(key = dayKey()) {
  const list = key === dayKey() ? suppList() : listOn(key);
  const sp = S().supps || {};
  if (!list.length) {
    if (sp.setup) return '';
    return `<div class="note">${icon('pill', 18)}<div class="grow col" style="gap:8px">
      <span>${tr('Taking creatine, protein powder or vitamins? Tick them off here each day.', 'Tar du kreatin, proteinpulver eller vitaminer? Kryss dem av her hver dag.')}</span>
      <div class="row" style="gap:8px"><button class="btn small primary" data-act="suppEdit">${tr('Choose', 'Velg')}</button></div></div></div>`;
  }
  const done = doneCount(key);
  const streak = suppStreak();
  return `<section class="card tight" aria-label="${tr('Supplements', 'Kosttilskudd')}">
    <div class="row between"><h2 class="h3 row" style="gap:8px">${icon('pill', 19)} ${tr('Supplements', 'Kosttilskudd')}</h2>
      <span class="row" style="gap:10px"><span class="small muted num">${done}/${list.length}</span><button class="link-btn small" data-act="suppEdit">${tr('Edit', 'Endre')}</button></span></div>
    <div class="supps">${list.map((x) => {
      const n = perDay(x);
      const c = countOf(x.id, key);
      const full = c >= n;
      const u = suppUnit(x);
      return `<div class="supp-wrap${c > 0 && !full ? ' has-minus' : ''}"><button class="supp ${full ? 'on' : c ? 'part' : ''}" aria-pressed="${full}" data-act="supp" data-id="${esc(x.id)}"
          aria-label="${esc(`${suppName(x)}: ${c} ${tr('of', 'av')} ${n} ${unitWord(u, n)}`)}">
        <span class="box" aria-hidden="true">${full ? icon('check', 15) : c ? `<b>${c}</b>` : ''}</span>
        <span class="grow" style="min-width:0"><span class="t">${esc(suppName(x))}</span>
          <span class="d">${n > 1 ? `${c}/${n} ${esc(unitWord(u, n))}` : esc(suppDose(x))}${PRESETS[x.kind]?.food && !S().prefs.calm ? ` · ${proteinNote(x)}` : ''}</span>
          ${n > 1 && n <= 8 ? `<span class="pips" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i < c ? 'on' : ''}"></i>`).join('')}</span>` : ''}</span></button>
        ${c > 0 && !full ? `<button class="supp-minus" data-act="suppMinus" data-id="${esc(x.id)}" aria-label="${tr('One less', 'Én mindre')}">−</button>` : ''}</div>`;
    }).join('')}</div>
    <p class="tiny muted">${tr('Tap each time you take one.', 'Trykk hver gang du tar én.')}</p>
    ${allDone(key) ? `<p class="tiny" style="color:var(--sage);font-weight:600">${icon('check', 13, 'style="vertical-align:-2px"')} ${streak >= 2 ? tr(`All done · ${streak} days in a row`, `Alt gjort · ${streak} dager på rad`) : tr('All done today', 'Alt gjort i dag')}</p>` : ''}
  </section>`;
}

export function tickSupp(el, key = dayKey()) {
  const res = toggleSupp(el.dataset.id, key);
  toast(suppCheer(res), res.all ? 2600 : 1400);
  nav.rerender();
}
export function minusSupp(el, key = dayKey()) {
  const res = decSupp(el.dataset.id, key);
  toast(suppCheer(res), 1200);
  nav.rerender();
}

const unitSelect = (x) => `<select class="ing-unit" data-change="unit" data-id="${esc(x.id)}" aria-label="${tr('What you take', 'Hva du tar')}">
  ${Object.keys(SUPP_UNITS).map((u) => `<option value="${u}" ${suppUnit(x) === u ? 'selected' : ''}>${esc(unitWord(u, 2))}</option>`).join('')}</select>`;

function perDayRow(x) {
  const n = perDay(x);
  return `<div class="row wrap" style="gap:8px;width:100%;margin-top:8px">
      <span class="small muted" style="width:100%">${tr('How many a day', 'Hvor mange om dagen')}</span>
      <button class="ing-step" data-act="n" data-d="-1" data-id="${esc(x.id)}" aria-label="${tr('Fewer', 'Færre')}">−</button>
      <span class="num" style="font-weight:700;font-size:18px;min-width:26px;text-align:center">${n}</span>
      <button class="ing-step" data-act="n" data-d="1" data-id="${esc(x.id)}" aria-label="${tr('More', 'Flere')}">+</button>
      ${unitSelect(x)}
      <input class="input" style="min-height:42px;flex:1 1 100%" type="text" maxlength="30" value="${esc(suppEach(x))}" data-change="each" data-id="${esc(x.id)}" placeholder="${tr('How much is in each (optional), e.g. 1 g', 'Hvor mye er i hver (valgfritt), f.eks. 1 g')}" aria-label="${tr('Amount in each', 'Mengde i hver')}"></div>`;
}

export function suppsSheet() {
  const draw = () => {
    const list = suppList();
    const on = (k) => list.find((x) => x.kind === k);
    const warn = suppWarnings(list);
    return `<p class="small soft" style="line-height:1.45">${tr('Switch on what you take and how many a day. On Today you tap once for each one you take.', 'Slå på det du tar og hvor mange om dagen. På I dag trykker du én gang for hver du tar.')}</p>
      ${warn.map((w) => `<div class="note amber">${icon('info', 18)}<span>${esc(w)}</span></div>`).join('')}
      <div class="list">${PRESET_ORDER.map((k) => {
        const x = on(k);
        const p = PRESETS[k];
        return `<div class="item" style="flex-wrap:wrap;align-items:center">
          <label class="row grow" style="gap:12px;cursor:pointer;min-width:0"><span class="switch"><input type="checkbox" ${x ? 'checked' : ''} data-change="toggle" data-k="${k}"><span></span></span>
            <span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(p.name())}</span><span class="s">${esc(x ? suppDose(x) : `${PER_DAY[k].n} ${unitWord(PER_DAY[k].unit, PER_DAY[k].n)}`)}</span></span></label>
          <button class="icon-btn" data-act="about" data-k="${k}" aria-label="${tr('About', 'Om')} ${esc(p.name())}">${icon('info', 18)}</button>
          ${x ? perDayRow(x) : ''}
          ${k === 'protein' && x ? `<div class="seg" style="width:100%;margin-top:8px;grid-auto-columns:minmax(0,1fr)">
            <button aria-pressed="${x.mix !== 'milk'}" data-act="mix" data-v="water">${tr('With water', 'Med vann')}</button>
            <button aria-pressed="${x.mix === 'milk'}" data-act="mix" data-v="milk">${tr('With lactose-free milk', 'Med laktosefri melk')}</button></div>` : ''}
          <div class="about tiny soft" data-about="${k}" hidden style="width:100%;line-height:1.5;margin-top:6px">${esc(p.about())}</div></div>`;
      }).join('')}
      ${list.filter((x) => x.kind === 'custom').map((x) => `<div class="item" style="flex-wrap:wrap"><span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(x.name)}</span><span class="s">${esc(suppDose(x))}</span></span>
        <button class="icon-btn" data-act="rm" data-id="${esc(x.id)}" aria-label="${tr('Remove', 'Fjern')} ${esc(x.name)}">${icon('trash', 18)}</button>${perDayRow(x)}</div>`).join('')}</div>
      <p class="label">${tr('Something else', 'Noe annet')}</p>
      <input id="c-name" class="input" type="text" maxlength="40" placeholder="${tr('Name, e.g. Magnesium', 'Navn, f.eks. Magnesium')}" autocomplete="off">
      <button class="btn secondary" data-act="add">${icon('plus', 18)} ${tr('Add', 'Legg til')}</button>
      <p class="tiny muted" style="line-height:1.5">${tr('Not sure what you need? A pharmacy or your doctor can help. Never take more than the label says.', 'Usikker på hva du trenger? Apoteket eller legen kan hjelpe. Ta aldri mer enn det står på pakken.')}</p>
      <button class="btn primary" data-act="done">${tr('Done', 'Ferdig')}</button>`;
  };
  const redraw = (sheet) => { sheet.querySelector('.col').innerHTML = draw(); };
  const edit = (id, fn) => setSupps((sp) => { const x = sp.list.find((s) => s.id === id); if (x) fn(x); });
  openSheet({
    title: tr('Your supplements', 'Dine kosttilskudd'),
    html: draw(),
    actions: {
      toggle: (el, e, sheet) => {
        const k = el.dataset.k;
        setSupps((sp) => {
          if (el.checked) { if (!sp.list.some((x) => x.kind === k)) sp.list.push({ id: k, kind: k, ...PER_DAY[k], since: dayKey(), ...(k === 'protein' ? { mix: 'water' } : {}) }); }
          else sp.list = sp.list.filter((x) => x.kind !== k);
        });
        redraw(sheet);
      },
      n: (el, e, sheet) => { edit(el.dataset.id, (x) => { x.n = Math.max(1, Math.min(20, perDay(x) + Number(el.dataset.d))); }); redraw(sheet); },
      unit: (el, e, sheet) => { edit(el.dataset.id, (x) => { x.unit = el.value; }); redraw(sheet); },
      each: (el) => edit(el.dataset.id, (x) => { x.each = el.value.trim().slice(0, 30); }),
      mix: (el, e, sheet) => { setSupps((sp) => { const x = sp.list.find((s) => s.kind === 'protein'); if (x) x.mix = el.dataset.v; }); redraw(sheet); },
      about: (el, e, sheet) => { const a = sheet.querySelector(`[data-about="${el.dataset.k}"]`); if (a) a.hidden = !a.hidden; },
      rm: (el, e, sheet) => { setSupps((sp) => { sp.list = sp.list.filter((x) => x.id !== el.dataset.id); }); redraw(sheet); },
      add: (el, e, sheet) => {
        const name = sheet.querySelector('#c-name').value.trim();
        if (!name) { toast(tr('Write a name first.', 'Skriv et navn først.')); return; }
        addCustomSupp(name, 1, 'pill', '');
        redraw(sheet);
      },
      done: () => { setSupps(() => {}); closeSheet(); nav.rerender(); },
    },
    onClose: () => nav.rerender(),
  });
}
