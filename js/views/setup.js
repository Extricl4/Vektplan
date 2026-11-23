import { S, mutate, addWeight, DEFAULT_SLOTS } from '../store.js';
import { tr, setLang, kindName } from '../i18n.js';
import { icon, toast } from '../ui.js';
import { esc, isStandalone, isIOS } from '../util.js';
import { nav } from '../nav.js';

let step = 0;
let draft = null;
const STEPS = 6;

export function enter() {
  step = 0;
  const st = S();
  draft = {
    name: st.profile.name || '',
    height: st.profile.heightCm || '',
    weight: st.weights.length ? st.weights[st.weights.length - 1].kg : '',
    goal: st.profile.goalKcal || '',
    calm: st.prefs.calm,
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
  switch (step) {
    case 0:
      return `<img class="hero-icon" src="./icons/icon-192.png" alt="">
        <div class="col" style="gap:8px"><h1 class="h1" style="font-size:32px">${tr('Welcome to Vektplan', 'Velkommen til Vektplan')}</h1>
        <p class="soft" style="font-size:17px;line-height:1.5">${tr('Your calm helper for eating a little more, a little more often. Gentle low-FODMAP food, a coach that tells you what to eat now, and a journal that helps you understand your stomach.', 'Din rolige hjelper for å spise litt mer, litt oftere. Skånsom lav-FODMAP-mat, en coach som sier hva du skal spise nå, og en dagbok som hjelper deg å forstå magen din.')}</p></div>
        <p class="label">${tr('Language', 'Språk')}</p>
        <div class="col"><button class="choice" aria-pressed="${lang === 'en'}" data-act="lang" data-v="en">English</button>
        <button class="choice" aria-pressed="${lang === 'nb'}" data-act="lang" data-v="nb">Norsk</button></div>
        ${nextBtns(tr("Let's start", 'Kom i gang'), false)}`;
    case 1:
      return `<h1 class="h1">${tr('What should I call you?', 'Hva skal jeg kalle deg?')}</h1>
        <div class="field"><label for="su-name">${tr('Your name', 'Navnet ditt')}</label>
        <input id="su-name" class="input" value="${esc(draft.name)}" autocomplete="given-name" data-input="name" enterkeyhint="next"></div>
        ${nextBtns()}`;
    case 2:
      return `<h1 class="h1">${tr('A little about you', 'Litt om deg')}</h1>
        <p class="soft">${tr('Used for your weight chart and BMI. You can skip this.', 'Brukes til vektgrafen og BMI. Du kan hoppe over.')}</p>
        <div class="grid2"><div class="field"><label for="su-h">${tr('Height (cm)', 'Høyde (cm)')}</label><input id="su-h" class="input" type="number" inputmode="numeric" value="${draft.height}" data-input="height"></div>
        <div class="field"><label for="su-w">${tr('Weight today (kg)', 'Vekt i dag (kg)')}</label><input id="su-w" class="input" type="number" inputmode="decimal" step="0.1" value="${draft.weight}" data-input="weight"></div></div>
        ${nextBtns()}`;
    case 3:
      return `<h1 class="h1">${tr('How do you want to track?', 'Hvordan vil du følge med?')}</h1>
        <div class="field"><label for="su-goal">${tr('Daily calorie goal (optional)', 'Daglig kalorimål (valgfritt)')}</label>
        <input id="su-goal" class="input" type="number" inputmode="numeric" placeholder="${tr('Leave empty to track meals', 'La stå tomt for å følge måltider')}" value="${draft.goal}" data-input="goal"></div>
        <p class="small soft" style="line-height:1.5">${tr('If you have a number from your doctor or a dietitian, put it here and Today shows how far you are, like 700 / 3,200. No number? Vektplan counts meals instead, which works great too.', 'Har du et tall fra legen eller en ernæringsfysiolog, skriv det her, så viser I dag hvor langt du er kommet, f.eks. 700 / 3 200. Ikke noe tall? Da teller Vektplan måltider i stedet, og det fungerer også fint.')}</p>
        <div class="set-group"><div class="set-row"><div class="grow"><div>${tr('Calm mode', 'Rolig modus')}</div><div class="s">${tr('Hide calorie numbers if they stress you', 'Skjul kalorier hvis de stresser deg')}</div></div>
        <label class="switch"><input type="checkbox" ${draft.calm ? 'checked' : ''} data-change="calm"><span></span></label></div></div>
        ${nextBtns()}`;
    case 4:
      return `<h1 class="h1">${tr('Your meal times', 'Måltidene dine')}</h1>
        <p class="soft">${tr('Small and often is the trick when you get full fast. Six small meals is the start, change anything you like.', 'Lite og ofte er trikset når du blir fort mett. Seks små måltider er utgangspunktet, endre det du vil.')}</p>
        <div class="set-group">${draft.slots.map((s, i) => `<div class="set-row"><span class="grow">${kindName(s.kind)}</span>
          <input class="input" style="width:118px;min-height:40px;padding:6px 10px" type="time" value="${s.time}" data-change="slotTime" data-i="${i}" aria-label="${kindName(s.kind)}">
          <label class="switch"><input type="checkbox" ${s.on ? 'checked' : ''} data-change="slotOn" data-i="${i}" aria-label="${kindName(s.kind)}"><span></span></label></div>`).join('')}</div>
        ${nextBtns()}`;
    default: {
      const home = !isStandalone();
      return `<h1 class="h1" style="font-size:30px">${tr("You're all set", 'Alt er klart')}${draft.name ? `, ${esc(draft.name)}` : ''}.</h1>
        <p class="soft" style="font-size:17px;line-height:1.5">${tr('Open Vektplan when it is time to eat, tap "I ate it", and write a line in the journal in the evening. That is all it takes.', 'Åpne Vektplan når det er tid for mat, trykk «Jeg spiste det», og skriv en linje i dagboka om kvelden. Det er alt som skal til.')}</p>
        ${home ? `<div class="note">${icon('phone', 20)}<span>${isIOS() ? tr('Tip: tap the Share button in Safari and choose "Add to Home Screen" so Vektplan opens like a real app.', 'Tips: trykk Del-knappen i Safari og velg «Legg til på Hjem-skjerm», så åpner Vektplan seg som en ekte app.') : tr('Tip: open this page in Safari on your iPhone and choose Share, then "Add to Home Screen".', 'Tips: åpne siden i Safari på iPhonen og velg Del, og så «Legg til på Hjem-skjerm».')}</span></div>` : ''}
        ${nextBtns(tr('Open Vektplan', 'Åpne Vektplan'))}`;
    }
  }
}

export function render() {
  if (!draft) enter();
  return `<div class="screen no-tabs setup"><div class="blob b1"></div><div class="blob b2"></div>${dots()}${body()}</div>`;
}

export function mount() {
  const input = document.querySelector('.setup input:not([type=checkbox]):not([type=time])');
  if (input && step > 0 && step < 4) setTimeout(() => input.focus(), 300);
}

function finish() {
  const d = draft;
  mutate((s) => {
    s.profile.name = String(d.name).trim().slice(0, 40);
    const h = Math.round(Number(d.height));
    s.profile.heightCm = h > 80 && h < 260 ? h : null;
    const g = Math.round(Number(d.goal));
    s.profile.goalKcal = g >= 800 && g <= 8000 ? g : null;
    s.prefs.calm = !!d.calm;
    s.slots = d.slots.some((x) => x.on) ? d.slots : DEFAULT_SLOTS.map((x) => ({ ...x }));
    s.profile.onboarded = true;
  });
  const w = parseFloat(String(d.weight).replace(',', '.'));
  if (w > 25 && w < 300) addWeight(w);
  draft = null;
  toast(tr("Welcome! Let's eat something small.", 'Velkommen! La oss spise noe lite.'), 2600);
  nav.go('today');
}

export const actions = {
  lang: (el) => { mutate((s) => { s.prefs.lang = el.dataset.v; }); setLang(el.dataset.v); nav.rerender(); },
  next: () => {
    if (step >= STEPS - 1) { finish(); return; }
    step++;
    nav.rerender();
    window.scrollTo(0, 0);
  },
  prev: () => { step = Math.max(0, step - 1); nav.rerender(); },
  name: (el) => { draft.name = el.value; },
  height: (el) => { draft.height = el.value; },
  weight: (el) => { draft.weight = el.value; },
  goal: (el) => { draft.goal = el.value; },
  calm: (el) => { draft.calm = el.checked; },
  slotTime: (el) => { if (/^\d{2}:\d{2}$/.test(el.value)) draft.slots[Number(el.dataset.i)].time = el.value; },
  slotOn: (el) => { draft.slots[Number(el.dataset.i)].on = el.checked; },
};
