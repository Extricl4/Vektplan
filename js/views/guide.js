// Exercise guide: every exercise by muscle, what you need for it, and how to do it.
import { tr, L } from '../i18n.js';
import { icon } from '../ui.js';
import { esc } from '../util.js';
import { nav } from '../nav.js';
import { GROUP_ORDER, PLACES, PLACE_ORDER } from '../data/exercises.js';
import { pickList, getEx, groupName, currentPlace } from '../training.js';
import { HOWTO } from '../data/howto.js';
import { howToSheet, needsFor } from './howto.js';

let f = { group: 'biceps', place: null, q: '' };

export function enter() {
  f.place = f.place || currentPlace();
}

function rows() {
  const ids = pickList({ group: f.group, place: f.place, onlyMine: true, q: f.q })
    .filter((id) => !getEx(id)?.custom)
    .sort((a, b) => (HOWTO[b] ? 1 : 0) - (HOWTO[a] ? 1 : 0));
  if (!ids.length) return `<p class="small muted">${tr('Nothing for this muscle with your equipment here.', 'Ingenting for denne muskelen med utstyret ditt her.')}</p>`;
  return `<div class="list">${ids.map((id) => {
    const ex = getEx(id);
    return `<button class="item" data-act="how" data-id="${id}"><span class="grow" style="min-width:0"><span class="t" style="display:block;font-weight:500">${esc(L(ex.name))}</span>
      <span class="s">${esc(needsFor(id).map((g) => L(g)).join(', '))}</span></span>${icon('chevR', 16)}</button>`;
  }).join('')}</div>`;
}

export function render() {
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <div class="titles grow"><p class="eyebrow">${tr('Training', 'Trening')}</p><h1 class="h1" style="font-size:26px">${tr('Exercise guide', 'Øvelsesguide')}</h1></div></header>
    <div class="seg">${PLACE_ORDER.map((p) => `<button aria-pressed="${f.place === p}" data-act="place" data-v="${p}">${esc(L(PLACES[p].name))}</button>`).join('')}</div>
    <div class="chips scroll">${GROUP_ORDER.filter((g) => g !== 'mobility').map((g) => `<button class="chip solid" aria-pressed="${f.group === g}" data-act="g" data-g="${g}">${esc(groupName(g))}</button>`).join('')}</div>
    <div class="search">${icon('search', 18)}<label class="sr-only" for="gd-q">${tr('Search', 'Søk')}</label>
      <input id="gd-q" class="input" type="search" autocomplete="off" placeholder="${tr('Search exercises', 'Søk i øvelser')}" value="${esc(f.q)}" data-input="q"></div>
    <p class="tiny muted" style="margin:0 4px">${tr('Showing what fits your equipment. Tap one to see the steps, what you need and a video.', 'Viser det som passer utstyret ditt. Trykk på en for å se stegene, hva du trenger og en video.')}</p>
    <section class="card" style="padding:4px 16px" id="gd-list">${rows()}</section>
  </div>`;
}

export const actions = {
  back: () => nav.back('train'),
  how: (el) => howToSheet(el.dataset.id),
  place: (el) => { f.place = el.dataset.v; nav.rerender(); },
  g: (el) => { f.group = el.dataset.g; nav.rerender(); },
  q: (el) => { f.q = el.value; const box = document.getElementById('gd-list'); if (box) box.innerHTML = rows(); },
};
