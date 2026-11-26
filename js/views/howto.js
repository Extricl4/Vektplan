// "How to do it": steps, what you need, muscles, a tip and a video link for any exercise.
import { tr, L } from '../i18n.js';
import { icon, openSheet } from '../ui.js';
import { esc } from '../util.js';
import { getEx, groupName, easierOf, harderOf, exName } from '../training.js';
import { HOWTO, GEAR, cueSteps } from '../data/howto.js';

const EQUIP_GEAR = { dumbbell: 'db', kettlebell: 'db', band: 'band', bar: 'bar', cable: 'cable' };
const N = (en, nb) => ({ en, nb });

export function needsFor(exId) {
  const h = HOWTO[exId];
  if (h) return h.need.map((k) => GEAR[k]).filter(Boolean);
  const ex = getEx(exId);
  if (!ex) return [];
  if (ex.equip.includes('none')) return [GEAR.floor];
  const e = ex.equip[0];
  if (EQUIP_GEAR[e]) return [GEAR[EQUIP_GEAR[e]]];
  if (e === 'barbell') return [N('A barbell', 'En vektstang')];
  return [N('The machine at the gym', 'Maskinen på senteret')];
}

// Everything a session needs, listed once (floor space only if nothing else).
export function sessionNeeds(exIds) {
  const seen = new Map();
  for (const id of exIds) for (const g of needsFor(id)) seen.set(g.en, g);
  const list = [...seen.values()];
  const rest = list.filter((g) => g !== GEAR.floor);
  return rest.length ? rest : list;
}

export const needsLine = (exIds) => sessionNeeds(exIds).map((g) => L(g)).join(' · ');

export const videoURL = (exId) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${getEx(exId)?.name?.en || exId} exercise proper form`)}`;

export function howToSheet(exId) {
  const ex = getEx(exId);
  if (!ex) return;
  const h = HOWTO[exId];
  const steps = h ? L(h.steps).split('|') : cueSteps(L(ex.cue));
  const easier = easierOf(exId);
  const harder = harderOf(exId);
  openSheet({
    title: esc(L(ex.name)),
    html: `<div class="chips">${(ex.groups || []).slice(0, 3).map((g) => `<span class="chip" style="pointer-events:none">${esc(groupName(g))}</span>`).join('')}
        <span class="chip" style="pointer-events:none">${ex.mode === 'time' ? tr('Hold for time', 'Hold på tid') : tr('Reps', 'Repetisjoner')}</span></div>
      <div class="note">${icon('dumbbell', 18)}<div class="grow"><b>${tr('You need', 'Du trenger')}</b><br>${needsFor(exId).map((g) => esc(L(g))).join('<br>')}</div></div>
      <ol class="steps">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      ${h?.tip ? `<div class="note amber">${icon('info', 18)}<span>${esc(L(h.tip))}</span></div>` : ''}
      ${easier || harder ? `<p class="small soft" style="line-height:1.5">${easier ? `${tr('Too hard?', 'For tungt?')} <b>${esc(exName(easier))}</b>. ` : ''}${harder ? `${tr('Too easy?', 'For lett?')} <b>${esc(exName(harder))}</b>.` : ''}</p>` : ''}
      <a class="btn secondary" href="${esc(videoURL(exId))}" target="_blank" rel="noopener">${icon('play', 18)} ${tr('Watch a video of it', 'Se en video av den')}</a>
      <p class="tiny muted center">${tr('Opens YouTube search. Pick a short video from a trainer or physio.', 'Åpner YouTube-søk. Velg en kort video fra en trener eller fysioterapeut.')}</p>`,
  });
}
