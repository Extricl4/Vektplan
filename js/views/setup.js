import { S, mutate, DEFAULT_SLOTS } from '../store.js';
import { tr, setLang, kindName } from '../i18n.js';
import { icon, toast } from '../ui.js';
import { esc, isStandalone, isIOS } from '../util.js';
import { nav } from '../nav.js';
import { update, applyUpdate } from '../updates.js';

let step = 0;
let draft = null;
const STEPS = 3; // welcome + language, meal times, done. Name and height are already known (it's Emil's app).

export function enter() {
  step = 0;
  const st = S();
  draft = {
    slots: (st.slots?.length ? st.slots : DEFAULT_SLOTS).map((s) => ({ ...s })),
  };
}

function dots() {
  return `<div class="steps-dots" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('')}</div>`;
}

function nextBtns(nextLabel = tr('Continue', 'Fortsett'), canBack = true) {
  return `<div class="btns" style="margin-top:6px">${canBack ? `<button class="btn secondary" data-act="prev">${tr('Back', 'Tilbake')}</button>` : '<span></span>'}
    <button class="btn primary" data-act="next">${nextLabel}</button></div>`;
}

function body() {
  const lang = S().prefs.lang;
  const name = S().profile.name;
  switch (step) {
    case 0:
      return `<img class="hero-icon" src="./icons/icon-192.png" alt="">
        <div class="col" style="gap:8px"><h1 class="h1" style="font-size:32px">${name ? tr(`Hi ${esc(name)}, welcome to Vektplan`, `Hei ${esc(name)}, velkommen til Vektplan`) : tr('Welcome to Vektplan', 'Velkommen til Vektplan')}</h1>
        <p class="soft" style="font-size:17px;line-height:1.5">${tr('Your calm helper for eating a little more, a little more often. Your own food or gentle low-FODMAP ideas, training that fits your energy, and a journal that helps you understand your stomach.', 'Din rolige hjelper for å spise litt mer, litt oftere. Din egen mat eller milde lav-FODMAP-forslag, trening som passer energien din, og en dagbok som hjelper deg å forstå magen din.')}</p></div>
        <p class="label">${tr('Language', 'Språk')}</p>
        <div class="col"><button class="choice" aria-pressed="${lang === 'en'}" data-act="lang" data-v="en">English</button>
        <button class="choice" aria-pressed="${lang === 'nb'}" data-act="lang" data-v="nb">Norsk</button></div>
        ${nextBtns(tr("Let's start", 'Kom i gang'), false)}`;
    case 1:
      return `<h1 class="h1">${tr('Your meal times', 'Måltidene dine')}</h1>
        <p class="soft">${tr('Small and often is the trick when you get full fast. Six small meals is the start, change anything you like.', 'Lite og ofte er trikset når du blir fort mett. Seks små måltider er utgangspunktet, endre det du vil.')}</p>
        <div class="set-group">${draft.slots.map((s, i) => `<div class="set-row"><span class="grow">${kindName(s.kind)}</span>
          <input class="input" style="width:118px;min-height:40px;padding:6px 10px" type="time" value="${s.time}" data-change="slotTime" data-i="${i}" aria-label="${kindName(s.kind)}">
          <label class="switch"><input type="checkbox" ${s.on ? 'checked' : ''} data-change="slotOn" data-i="${i}" aria-label="${kindName(s.kind)}"><span></span></label></div>`).join('')}</div>
        ${nextBtns()}`;
    default: {
      const home = !isStandalone();
      return `<h1 class="h1" style="font-size:30px">${tr("You're all set", 'Alt er klart')}${name ? `, ${esc(name)}` : ''}.</h1>
        <p class="soft" style="font-size:17px;line-height:1.5">${tr(`Tap "I've eaten" when you have had something, your own food or an idea from the app, and write a line in the journal in the evening. That is all it takes.`, 'Trykk «Jeg har spist» når du har fått i deg noe, din egen mat eller et forslag fra appen, og skriv en linje i dagboka om kvelden. Det er alt som skal til.')}</p>
        <p class="small soft" style="line-height:1.5">${tr('Weight, calorie goal, calm mode and Apple Watch are in Settings whenever you want them.', 'Vekt, kalorimål, rolig modus og Apple Watch finner du i Innstillinger når du vil.')}</p>
        ${home ? `<div class="note">${icon('phone', 20)}<span>${isIOS() ? tr('Tip: tap the Share button in Safari and choose "Add to Home Screen" so Vektplan opens like a real app.', 'Tips: trykk Del-knappen i Safari og velg «Legg til på Hjem-skjerm», så åpner Vektplan seg som en ekte app.') : tr('Tip: open this page in Safari on your iPhone and choose Share, then "Add to Home Screen".', 'Tips: åpne siden i Safari på iPhonen og velg Del, og så «Legg til på Hjem-skjerm».')}</span></div>` : ''}
        ${nextBtns(tr('Open Vektplan', 'Åpne Vektplan'))}`;
    }
  }
}

export function render() {
  if (!draft) enter();
  const upd = update.status === 'ready' || update.status === 'available'
    ? `<button class="banner" data-act="update">${icon('refresh', 20)}<span class="grow">${tr('A new version of Vektplan is ready. Tap to update.', 'En ny versjon av Vektplan er klar. Trykk for å oppdatere.')}</span></button>` : '';
  return `<div class="screen no-tabs setup"><div class="blob b1"></div><div class="blob b2"></div>${upd}${dots()}${body()}</div>`;
}

function finish() {
  const d = draft;
  mutate((s) => {
    s.slots = d.slots.some((x) => x.on) ? d.slots : DEFAULT_SLOTS.map((x) => ({ ...x }));
    s.profile.onboarded = true;
  });
  draft = null;
  toast(tr('Welcome. Take it one meal at a time.', 'Velkommen. Ta ett måltid om gangen.'), 2600);
  nav.go('today');
}

export const actions = {
  update: () => applyUpdate(),
  lang: (el) => { mutate((s) => { s.prefs.lang = el.dataset.v; }); setLang(el.dataset.v); nav.rerender(); },
  next: () => {
    if (step >= STEPS - 1) { finish(); return; }
    step++;
    nav.rerender();
    nav.scrollTo(0);
  },
  prev: () => { step = Math.max(0, step - 1); nav.rerender(); },
  slotTime: (el) => { if (/^\d{2}:\d{2}$/.test(el.value)) draft.slots[Number(el.dataset.i)].time = el.value; },
  slotOn: (el) => { draft.slots[Number(el.dataset.i)].on = el.checked; },
};
