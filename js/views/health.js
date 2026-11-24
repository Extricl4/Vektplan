// Apple Watch screen: sync status, the last days of Watch data, and a step-by-step guide to the
// Shortcut that reads Apple Health (web apps can't read HealthKit themselves).
import { S } from '../store.js';
import { tr, n0, shortDate, dayShort } from '../i18n.js';
import { icon, toast, openSheet, closeSheet, confirmSheet } from '../ui.js';
import { esc, dayKey, addDays, parseKey, clock } from '../util.js';
import { nav } from '../nav.js';
import {
  importHealth, readClipboard, looksLikeHealth, hasHealth, healthDay, lastSync, fmtSleep, fmtSleepShort, sleepWindow, clearHealth,
} from '../health.js';

// ---------- Sync (shared with Today, Train and Settings) ----------
function resultToast(res) {
  const night = healthDay(dayKey());
  const parts = [];
  if (night?.sleepMin != null) parts.push(tr(`last night ${fmtSleep(night.sleepMin)}`, `i natt ${fmtSleep(night.sleepMin)}`));
  if (res.newWeights) parts.push(tr(`${res.newWeights} weigh-in${res.newWeights > 1 ? 's' : ''}`, `${res.newWeights} veiing${res.newWeights > 1 ? 'er' : ''}`));
  const days = tr(`${res.dayCount} day${res.dayCount === 1 ? '' : 's'} updated`, `${res.dayCount} dag${res.dayCount === 1 ? '' : 'er'} oppdatert`);
  toast(`${tr('Synced from Apple Health', 'Hentet fra Apple Helse')}: ${[days, ...parts].join(', ')}.`, 3600);
}

function failMessage() {
  return tr(
    "Couldn't find Watch data on the clipboard. Run the Vektplan Health shortcut first, then tap Sync.",
    'Fant ikke Watch-data på utklippstavlen. Kjør snarveien Vektplan Health først, og trykk så Hent.'
  );
}

export function pasteSheet(after) {
  openSheet({
    title: tr('Paste Watch data', 'Lim inn Watch-data'),
    html: `<p class="small soft" style="line-height:1.5">${tr('Run the Vektplan Health shortcut, then press and hold in the box below and choose Paste.', 'Kjør snarveien Vektplan Health, og hold så fingeren i boksen under og velg Lim inn.')}</p>
      <textarea id="h-paste" class="textarea filled" rows="6" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="${tr('Paste here', 'Lim inn her')}"></textarea>
      <p id="h-err" class="small" style="color:var(--red);display:none"></p>
      <button class="btn primary" data-act="go">${icon('download', 18)} ${tr('Bring it in', 'Hent inn')}</button>`,
    actions: {
      go: (el, e, sheet) => {
        const text = sheet.querySelector('#h-paste').value;
        try {
          const res = importHealth(text);
          closeSheet();
          resultToast(res);
          after?.();
        } catch (err) {
          const p = sheet.querySelector('#h-err');
          p.textContent = text.trim() ? tr('That text has no Health data Vektplan can read. Check the Text step in the guide (semicolons between the parts).', 'Den teksten har ingen helsedata Vektplan kan lese. Sjekk Tekst-steget i guiden (semikolon mellom delene).') : tr('The box is empty.', 'Boksen er tom.');
          p.style.display = 'block';
        }
      },
    },
  });
}

export async function syncHealth(after = () => nav.rerender()) {
  let text = '';
  try {
    text = await readClipboard();
  } catch (e) {
    // No clipboard access (or the paste bubble was dismissed): let him paste by hand.
    pasteSheet(after);
    return;
  }
  if (!looksLikeHealth(text)) {
    toast(failMessage(), 4200);
    return;
  }
  try {
    const res = importHealth(text);
    resultToast(res);
    after?.();
  } catch (e) {
    toast(failMessage(), 4200);
  }
}

// ---------- Small pieces ----------
function syncedText() {
  const t = lastSync();
  if (!t) return tr('Not synced yet', 'Ikke hentet ennå');
  const d = new Date(t);
  const k = dayKey(d);
  const when = k === dayKey() ? tr('today', 'i dag') : k === addDays(dayKey(), -1) ? tr('yesterday', 'i går') : shortDate(d);
  return tr(`Last synced ${when} at ${clock(t)}`, `Sist hentet ${when} kl. ${clock(t)}`);
}

function dayLabel(k) {
  const today = dayKey();
  if (k === today) return tr('Today', 'I dag');
  if (k === addDays(today, -1)) return tr('Yesterday', 'I går');
  return `${dayShort(parseKey(k))} ${parseKey(k).getDate()}.`;
}

function lastDays() {
  const calm = S().prefs.calm;
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const k = addDays(dayKey(), -i);
    const d = healthDay(k);
    if (!d) continue;
    const moved = calm ? (d.exerciseMin != null ? `${d.exerciseMin} min` : '–') : d.activeKcal != null ? `${n0(d.activeKcal)} kcal` : '–';
    rows.push(`<div class="hrow"><span class="d">${esc(dayLabel(k))}</span>
      <span class="num">${d.sleepMin != null ? fmtSleepShort(d.sleepMin) : '–'}</span>
      <span class="num">${d.restingHR ?? '–'}</span>
      <span class="num">${moved}</span>
      <span class="num">${d.steps != null ? n0(d.steps) : '–'}</span></div>`);
  }
  if (!rows.length) return `<p class="small muted">${tr('Nothing from the last 7 days yet.', 'Ingenting fra de siste 7 dagene ennå.')}</p>`;
  return `<div class="htable" role="table">
    <div class="hrow head"><span class="d"></span><span>${tr('Sleep', 'Søvn')}</span><span>${tr('Pulse', 'Puls')}</span><span>${calm ? tr('Active', 'Aktiv') : tr('Moved', 'Bevegelse')}</span><span>${tr('Steps', 'Skritt')}</span></div>
    ${rows.join('')}</div>
    <p class="tiny muted">${tr('Sleep is the night before each day. Pulse is resting pulse.', 'Søvn er natten før hver dag. Puls er hvilepuls.')}</p>`;
}

const step = (n, html) => `<li><span class="n">${n}</span><div class="grow">${html}</div></li>`;
const b = (s) => `<b>${s}</b>`;

function guide() {
  const types = [
    [tr('Steps', 'Steps (Skritt)'), tr('last 7 days, group by Day', 'siste 7 dager, grupper etter dag')],
    [tr('Exercise Minutes', 'Exercise Minutes (Treningsminutter)'), tr('last 7 days, group by Day', 'siste 7 dager, grupper etter dag')],
    [tr('Resting Heart Rate', 'Resting Heart Rate (Hvilepuls)'), tr('last 7 days, no grouping', 'siste 7 dager, ingen gruppering')],
    [tr('Heart Rate Variability', 'Heart Rate Variability (Pulsvariasjon)'), tr('last 7 days, group by Day', 'siste 7 dager, grupper etter dag')],
    [tr('Sleep Analysis', 'Sleep Analysis (Søvn)'), tr('last 3 days, no grouping', 'siste 3 dager, ingen gruppering')],
    [tr('Weight', 'Weight (Vekt)'), tr('last 30 days, no grouping', 'siste 30 dager, ingen gruppering')],
  ];
  return `<ol class="howto">
    ${step(1, tr(`Open the ${b('Shortcuts')} app, tap ${b('+')} and name the new shortcut ${b('Vektplan Health')}.`, `Åpne ${b('Snarveier')}-appen, trykk ${b('+')} og kall den nye snarveien ${b('Vektplan Health')}.`))}
    ${step(2, tr(`Add the action ${b('Find Health Samples')}. Tap the type and pick ${b('Active Energy')}. Tap ${b('Add Filter')}, choose ${b('Start Date')} → ${b('is in the last')} → ${b('7 days')}. Set ${b('Group By')} to ${b('Day')}.`, `Legg til handlingen for å finne helsedata (${b('Find Health Samples')}). Trykk på typen og velg ${b('Aktiv energi')}. Legg til et filter: ${b('Startdato')} → ${b('er i løpet av de siste')} → ${b('7 dager')}. Sett ${b('Grupper etter')} til ${b('Dag')}.`))}
    ${step(3, tr(`Add the action ${b('Add to Variable')} and call the variable ${b('Health')}.`, `Legg til handlingen ${b('Legg til i variabel')} og kall variabelen ${b('Health')}.`))}
    ${step(4, `${tr('Do steps 2 and 3 again for each of these. Quickest: press and hold an action, choose Duplicate, and change the type.', 'Gjør steg 2 og 3 igjen for hver av disse. Raskest: hold fingeren på en handling, velg Dupliser, og bytt type.')}
      <ul class="types">${types.map(([t, how]) => `<li>${b(t)} <span class="muted">· ${how}</span></li>`).join('')}</ul>`)}
    ${step(5, tr(`Add ${b('Repeat with Each')} and choose the variable ${b('Health')} as what it repeats over.`, `Legg til ${b('Gjenta med hvert objekt')} og velg variabelen ${b('Health')} som det skal gjentas over.`))}
    ${step(6, `${tr(`Inside the repeat, add a ${b('Text')} action and build this one line, with semicolons between the parts:`, `Inni gjentakelsen legger du til en ${b('Tekst')}-handling og bygger denne ene linjen, med semikolon mellom delene:`)}
      <code class="codeline">${tr('Type;Start Date;End Date;Value;Unit', 'Type;Startdato;Sluttdato;Verdi;Enhet')}</code>
      ${tr(`Each word is a detail of ${b('Repeat Item')}: insert Repeat Item from the bar above the keyboard, tap it and pick the detail. For both dates, tap the date and set ${b('Date Format')} to ${b('ISO 8601')} with ${b('Include ISO 8601 Time')} switched on. If there is no Unit, just leave it out.`, `Hvert ord er en detalj fra ${b('Gjentatt objekt')}: sett det inn fra linjen over tastaturet, trykk på det og velg detaljen. For begge datoene trykker du på datoen og setter ${b('Datoformat')} til ${b('ISO 8601')} med ${b('ISO 8601-tid')} slått på. Finnes ikke Enhet, dropper du den.`)}`)}
    ${step(7, tr(`Below ${b('End Repeat')}, add ${b('Combine Text')}: combine ${b('Repeat Results')} with ${b('New Lines')}.`, `Under ${b('Slutt å gjenta')} legger du til ${b('Kombiner tekst')}: kombiner ${b('Gjentatte resultater')} med ${b('Linjeskift')}.`))}
    ${step(8, tr(`Add ${b('Copy to Clipboard')}. Optional: add ${b('Show Notification')} saying "Open Vektplan and tap Sync".`, `Legg til ${b('Kopier til utklipp')}. Valgfritt: legg til ${b('Vis varsel')} med «Åpne Vektplan og trykk Hent».`))}
    ${step(9, tr(`Tap ▶ to run it. The first time, iPhone asks to let Shortcuts read your Health data: tap ${b('Turn On All')}, then ${b('Allow')}. Then come back here and tap ${b('Sync now')}.`, `Trykk ▶ for å kjøre den. Første gang spør iPhonen om Snarveier får lese helsedataene dine: trykk ${b('Slå på alle')} og så ${b('Tillat')}. Kom så tilbake hit og trykk ${b('Hent nå')}.`))}
  </ol>
  <p class="tiny muted" style="line-height:1.5">${tr('Is your iPhone in Norwegian? The actions and types have Norwegian names. Search for "helse" and pick the ones that match.', 'Står iPhonen på norsk, kan navnene avvike litt fra det som står her. Søk etter «helse» og velg det som ligner.')}</p>`;
}

function automation() {
  return `<ol class="howto">
    ${step(1, tr(`In Shortcuts, open ${b('Automation')} and tap ${b('+')}, then ${b('Time of Day')}.`, `I Snarveier åpner du ${b('Automatisering')} og trykker ${b('+')}, så ${b('Klokkeslett')}.`))}
    ${step(2, tr(`Pick a time after you usually wake up, ${b('Daily')}, and ${b('Run Immediately')}.`, `Velg et tidspunkt etter at du pleier å våkne, ${b('Daglig')}, og ${b('Kjør umiddelbart')}.`))}
    ${step(3, tr(`Choose the ${b('Vektplan Health')} shortcut. Done.`, `Velg snarveien ${b('Vektplan Health')}. Ferdig.`))}
  </ol>
  <p class="small soft" style="line-height:1.5">${tr('Every morning your Watch data then waits on the clipboard. Open Vektplan and tap Sync on Today. You can also run the shortcut any time from the Shortcuts widget, or say "Hey Siri, Vektplan Health".', 'Hver morgen ligger da Watch-dataene klare på utklippstavlen. Åpne Vektplan og trykk Hent på I dag. Du kan også kjøre snarveien når som helst fra Snarveier-widgeten, eller si «Hei Siri, Vektplan Health».')}</p>`;
}

function trouble() {
  const item = (q, a) => `<div class="col" style="gap:4px"><p style="font-weight:600">${q}</p><p class="small soft" style="line-height:1.5">${a}</p></div>`;
  return [
    item(tr('Sync says it found nothing', 'Hent sier at den ikke fant noe'), tr('Run the shortcut right before you tap Sync, since copying something else replaces it. You can also tap Paste by hand below and paste it in.', 'Kjør snarveien rett før du trykker Hent, siden det du kopierer etterpå erstatter den. Du kan også trykke Lim inn selv nedenfor.')),
    item(tr('Some numbers are missing', 'Noen tall mangler'), tr('Check that Shortcuts may read that data: in the Health app, tap your picture, then Apps, then Shortcuts, and turn everything on. Also check that the Watch actually recorded it (open the Health app).', 'Sjekk at Snarveier får lese dataene: i Helse-appen trykker du på bildet ditt, så Apper, så Snarveier, og slår på alt. Sjekk også at klokka faktisk har registrert det (åpne Helse-appen).')),
    item(tr('Wrong days or times', 'Feil dager eller klokkeslett'), tr('Set both dates in the Text action to ISO 8601 with time turned on.', 'Sett begge datoene i Tekst-handlingen til ISO 8601 med tid slått på.')),
  ].join('');
}

// ---------- Screen ----------
export function render() {
  const has = hasHealth();
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <h1 class="h1 grow">Apple Watch</h1></header>

    <section class="card">
      <div class="row" style="gap:12px"><span class="icon-btn" style="background:var(--accent-soft);color:var(--accent)">${icon('watch', 22)}</span>
        <div class="grow"><p class="h3">${has ? tr('Connected through Shortcuts', 'Koblet til via Snarveier') : tr('Sleep, pulse and movement from your Watch', 'Søvn, puls og bevegelse fra klokka')}</p>
        <p class="small muted">${syncedText()}</p></div></div>
      ${has ? '' : `<p class="small soft" style="line-height:1.55">${tr('Vektplan can show your sleep, resting pulse, active calories, steps and exercise minutes, and look for links between sleep and your stomach. Apple only lets App Store apps read Health directly, so a small Shortcut does the reading and hands it over. Set it up once (about 5 minutes); after that it can run by itself every morning.', 'Vektplan kan vise søvn, hvilepuls, aktive kalorier, skritt og treningsminutter, og se etter sammenhenger mellom søvn og magen. Apple lar bare App Store-apper lese Helse direkte, så en liten snarvei gjør jobben og gir dataene videre. Sett den opp én gang (cirka 5 minutter), så kan den kjøre av seg selv hver morgen.')}</p>`}
      <div class="btns"><button class="btn primary" data-act="sync">${icon('refresh', 18)} ${tr('Sync now', 'Hent nå')}</button>
        <button class="btn secondary" data-act="paste">${tr('Paste by hand', 'Lim inn selv')}</button></div>
    </section>

    ${has ? `<section class="card"><h2 class="h3">${tr('The last 7 days', 'De siste 7 dagene')}</h2>${lastDays()}</section>` : ''}

    <section class="card">
      <h2 class="h2">${tr('Set it up once', 'Sett det opp én gang')}</h2>
      ${guide()}
    </section>

    <section class="card">
      <h2 class="h2">${tr('Make it run every morning', 'La den kjøre hver morgen')}</h2>
      ${automation()}
    </section>

    <section class="card">
      <h2 class="h2">${tr('If something is off', 'Hvis noe ikke stemmer')}</h2>
      ${trouble()}
    </section>

    <p class="tiny muted" style="margin:0 6px;line-height:1.5">${tr('Your Health data goes from the Shortcut straight into Vektplan on this phone. Nothing is uploaded. If you use the AI coach, it sees a short summary (like last night\'s sleep), just like your meals.', 'Helsedataene går fra snarveien rett inn i Vektplan på denne telefonen. Ingenting lastes opp. Bruker du AI-coachen, ser den et kort sammendrag (som nattens søvn), akkurat som måltidene.')}</p>
    ${has ? `<button class="link-btn" style="color:var(--red);align-self:flex-start;margin:0 6px" data-act="clear">${tr('Remove Watch data from Vektplan', 'Fjern Watch-data fra Vektplan')}</button>` : ''}
  </div>`;
}

export const actions = {
  back: () => nav.back('settings'),
  sync: () => syncHealth(),
  paste: () => pasteSheet(() => nav.rerender()),
  clear: async () => {
    const ok = await confirmSheet({
      title: tr('Remove Watch data?', 'Fjerne Watch-data?'),
      text: tr('This removes the sleep, pulse and movement numbers from Vektplan. Apple Health keeps everything, and you can sync again any time. Weigh-ins stay.', 'Dette fjerner søvn, puls og bevegelse fra Vektplan. Apple Helse beholder alt, og du kan hente på nytt når som helst. Veiinger blir værende.'),
      yes: tr('Remove', 'Fjern'),
      danger: true,
    });
    if (!ok) return;
    clearHealth();
    toast(tr('Watch data removed.', 'Watch-data fjernet.'));
    nav.rerender();
  },
};
