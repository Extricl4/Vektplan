import { S, mutate, exportJSON, replaceAll, resetAll, activeSlots, DEFAULT_SLOTS } from '../store.js';
import { MODELS, hasAI, testKey } from '../ai.js';
import { tr, setLang, kindName, longDate } from '../i18n.js';
import { icon, toast, confirmSheet, openSheet, closeSheet } from '../ui.js';
import { APP_VERSION } from '../version.js';
import { update, checkForUpdate, applyUpdate, forceRefresh, onUpdate } from '../updates.js';
import { esc, dayKey, addDays, download, openCalendarFile, isStandalone, isIOS, pad } from '../util.js';
import { applyTheme } from '../theme.js';
import { nav } from '../nav.js';
import { hasHealth, lastSync, shortcutURL, markPending } from '../health.js';
import { syncHealth } from './health.js';

let showKey = false;
let testing = false;

function row(label, sub, control, attrs = '') {
  return `<div class="set-row" ${attrs}><div class="grow"><div>${label}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>${control}</div>`;
}

function toggle(id, on, act) {
  return `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} data-change="${act}"><span></span></label>`;
}

function updateRow() {
  const s = update.status;
  const notes = S().prefs.lang === 'nb' ? update.notesNb : update.notes;
  const text = {
    idle: tr('Tap to check for a new version.', 'Trykk for å se etter en ny versjon.'),
    checking: tr('Checking…', 'Sjekker…'),
    none: tr("You're on the newest version.", 'Du har den nyeste versjonen.'),
    available: tr(`Version ${update.remote} is out. Downloading…`, `Versjon ${update.remote} er ute. Laster ned…`),
    installing: tr('Installing… the app will restart.', 'Installerer… appen starter på nytt.'),
    ready: tr(`Version ${update.remote} is ready to install.`, `Versjon ${update.remote} er klar til å installeres.`),
    offline: tr('You are offline. Try again when you have internet.', 'Du er frakoblet. Prøv igjen når du har nett.'),
    error: tr('Could not check right now. Try again later.', 'Klarte ikke å sjekke nå. Prøv igjen senere.'),
  }[s] || '';
  const canUpdate = s === 'ready' || s === 'available';
  return `<div class="set-row" style="flex-direction:column;align-items:stretch;gap:10px">
      <div class="row between"><div><div>${tr('Version', 'Versjon')} ${APP_VERSION}</div><div class="s" id="upd-text">${text}</div></div>
      <span class="icon-btn" style="background:var(--accent-soft);color:var(--accent)">${icon('refresh', 20)}</span></div>
      ${canUpdate && notes ? `<p class="small soft" style="background:var(--accent-soft);border-radius:12px;padding:10px 12px">${esc(notes)}</p>` : ''}
      <button class="btn ${canUpdate ? 'primary' : 'secondary'}" data-act="${canUpdate ? 'doUpdate' : 'check'}" ${s === 'checking' || s === 'installing' ? 'disabled' : ''}>
        ${canUpdate ? `${icon('download', 18)} ${tr('Update now', 'Oppdater nå')}` : `${icon('refresh', 18)} ${tr('Check for updates', 'Se etter oppdateringer')}`}</button>
    </div>`;
}

export function render() {
  const st = S();
  const p = st.profile;
  const slots = st.slots.slice().sort((a, b) => a.time.localeCompare(b.time));
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <h1 class="h1 grow">${tr('Settings', 'Innstillinger')}</h1></header>

    <p class="set-label">${tr('App', 'App')}</p>
    <div class="set-group">${updateRow()}
      ${!isStandalone() ? row(tr('Put it on your Home Screen', 'Legg den på Hjem-skjermen'), isIOS() ? tr('In Safari: tap Share, then "Add to Home Screen".', 'I Safari: trykk Del, og så «Legg til på Hjem-skjerm».') : tr('Open this page in Safari on your iPhone, tap Share, then "Add to Home Screen".', 'Åpne siden i Safari på iPhonen, trykk Del, og så «Legg til på Hjem-skjerm».'), icon('phone', 22)) : ''}
    </div>

    <p class="set-label">${tr('You', 'Deg')}</p>
    <div class="set-group">
      ${row(`<label for="s-name">${tr('Name', 'Navn')}</label>`, '', `<input id="s-name" class="input" style="width:150px;min-height:40px;padding:8px 12px;text-align:right" value="${esc(p.name)}" data-change="name" autocomplete="given-name">`)}
      ${row(`<label for="s-height">${tr('Height', 'Høyde')}</label>`, '', `<div class="row" style="gap:6px"><input id="s-height" class="input" style="width:90px;min-height:40px;padding:8px 12px;text-align:right" type="number" inputmode="numeric" value="${p.heightCm ?? ''}" data-change="height"><span class="muted small">cm</span></div>`)}
      ${row(`<label for="s-goal">${tr('Daily calorie goal', 'Daglig kalorimål')}</label>`, tr('Optional. Leave empty to track meals instead. Best set together with your doctor or a dietitian.', 'Valgfritt. La det stå tomt for å følge måltider i stedet. Best å sette sammen med legen eller en ernæringsfysiolog.'), `<div class="row" style="gap:6px"><input id="s-goal" class="input" style="width:96px;min-height:40px;padding:8px 12px;text-align:right" type="number" inputmode="numeric" placeholder="–" value="${p.goalKcal ?? ''}" data-change="goal"><span class="muted small">kcal</span></div>`)}
      ${row(tr('Calm mode', 'Rolig modus'), tr('Hides calorie numbers. Shows meals done instead.', 'Skjuler kalorier. Viser måltider i stedet.'), toggle('s-calm', st.prefs.calm, 'calm'))}
    </div>

    <p class="set-label">Apple Watch</p>
    <div class="set-group">
      <a class="set-row" href="#/health">${icon('watch', 20)}<div class="grow"><div>${hasHealth() ? tr('Watch data', 'Watch-data') : tr('Connect Apple Watch', 'Koble til Apple Watch')}</div>
        <div class="s">${hasHealth() ? tr(`Sleep, pulse and movement · last synced ${new Date(lastSync()).toLocaleString(S().prefs.lang === 'nb' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, `Søvn, puls og bevegelse · sist hentet ${new Date(lastSync()).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`) : tr('Sleep, resting pulse, active calories, steps and exercise, through a Shortcut', 'Søvn, hvilepuls, aktive kalorier, skritt og trening, via en snarvei')}</div></div>${icon('chevR', 18)}</a>
      ${hasHealth() ? `<button class="set-row" data-act="runShortcut" style="color:var(--accent)">${icon('refresh', 18)} <span class="grow">${tr('Get data from the Watch', 'Hent data fra klokka')}</span></button>` : ''}
    </div>

    <p class="set-label">${tr('Meal times', 'Måltider')}</p>
    <div class="set-group">
      ${slots.map((s) => row(`<span>${kindName(s.kind)}</span>`, '', `<div class="row" style="gap:10px"><input class="input" style="width:118px;min-height:40px;padding:6px 10px" type="time" value="${s.time}" data-change="slotTime" data-id="${s.id}" aria-label="${kindName(s.kind)}" ${s.on ? '' : 'disabled'}>${toggle('slot-' + s.id, s.on, 'slotOn').replace('data-change="slotOn"', `data-change="slotOn" data-id="${s.id}"`)}</div>`)).join('')}
      <button class="set-row" data-act="resetSlots" style="color:var(--accent)">${icon('refresh', 18)} ${tr('Reset to default times', 'Tilbakestill tidene')}</button>
      <button class="set-row" data-act="ics" style="color:var(--accent)">${icon('bell', 18)} <span class="grow">${tr('Add meal reminders to Calendar', 'Legg måltidspåminnelser i Kalender')}</span></button>
    </div>
    <p class="tiny muted" style="margin:0 6px">${tr('Reminders go into your iPhone Calendar as daily events with an alert. Update them here if you change your times.', 'Påminnelsene legges i Kalender på iPhonen som daglige hendelser med varsel. Oppdater dem her hvis du endrer tidene.')}</p>

    <p class="set-label">${tr('Look and feel', 'Utseende')}</p>
    <div class="set-group">
      ${row(tr('Theme', 'Tema'), '', `<div class="seg" style="width:190px">${[['light', icon('sun', 17)], ['dark', icon('moon', 17)], ['auto', 'Auto']].map(([id, l]) => `<button aria-pressed="${st.prefs.theme === id}" data-act="theme" data-v="${id}" aria-label="${id}" style="min-height:36px">${l}</button>`).join('')}</div>`)}
      ${row(tr('Language', 'Språk'), '', `<div class="seg" style="width:190px">${[['en', 'English'], ['nb', 'Norsk']].map(([id, l]) => `<button aria-pressed="${st.prefs.lang === id}" data-act="lang" data-v="${id}" style="min-height:36px">${l}</button>`).join('')}</div>`)}
      ${row(tr('Rest between sets', 'Pause mellom sett'), '', `<div class="seg" style="width:190px">${[30, 60, 90].map((v) => `<button aria-pressed="${st.prefs.restSec === v}" data-act="rest" data-v="${v}" style="min-height:36px">${v}s</button>`).join('')}</div>`)}
    </div>

    <p class="set-label" id="ai">${tr('AI (optional)', 'AI (valgfritt)')}</p>
    <div class="set-group">
      <div class="set-row" style="flex-direction:column;align-items:stretch;gap:10px">
        <p class="small soft" style="line-height:1.5">${tr('Photo estimates, free chat with the coach and deeper pattern finding use Claude. Paste your own API key from console.anthropic.com. It is stored only on this phone and sent only to Anthropic. You pay Anthropic per use, usually a few øre per meal.', 'Bildeestimat, fri chat med coachen og grundigere mønstersøk bruker Claude. Lim inn din egen API-nøkkel fra console.anthropic.com. Den lagres bare på denne telefonen og sendes bare til Anthropic. Du betaler Anthropic per bruk, som regel noen få øre per måltid.')}</p>
        <div class="field"><label for="s-key">${tr('API key', 'API-nøkkel')}</label>
          <div class="input-row"><input id="s-key" class="input" type="${showKey ? 'text' : 'password'}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(st.ai.key)}" data-change="key">
          <button class="icon-btn" data-act="showKey" aria-label="${showKey ? tr('Hide key', 'Skjul nøkkel') : tr('Show key', 'Vis nøkkel')}">${icon('eye', 20)}</button></div></div>
        <div class="field"><label for="s-model">${tr('Model', 'Modell')}</label>
          <select id="s-model" class="select" data-change="model">${MODELS.map((m) => `<option value="${m.id}" ${st.ai.model === m.id ? 'selected' : ''}>${m.name} · ${m.note()}</option>`).join('')}</select></div>
        <div class="btns"><button class="btn secondary" data-act="test" ${!hasAI() || testing ? 'disabled' : ''}>${testing ? tr('Testing…', 'Tester…') : tr('Test the key', 'Test nøkkelen')}</button>
          <a class="btn outline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">${tr('Get a key', 'Hent nøkkel')}</a></div>
        ${hasAI() ? `<button class="link-btn" style="color:var(--red);align-self:flex-start" data-act="removeKey">${tr('Remove key', 'Fjern nøkkelen')}</button>` : ''}
      </div>
    </div>

    <p class="set-label">${tr('Your data', 'Dataene dine')}</p>
    <div class="set-group">
      <button class="set-row" data-act="export">${icon('download', 20)}<div class="grow"><div>${tr('Back up my data', 'Ta sikkerhetskopi')}</div><div class="s">${tr('Saves a file you can keep in Files or iCloud', 'Lagrer en fil du kan ha i Filer eller iCloud')}</div></div></button>
      <label class="set-row" for="s-import" style="cursor:pointer">${icon('upload', 20)}<div class="grow"><div>${tr('Restore from backup', 'Gjenopprett fra sikkerhetskopi')}</div><div class="s">${tr('Replaces what is on this phone', 'Erstatter det som er på denne telefonen')}</div></div></label>
      <input id="s-import" class="sr-only" type="file" accept="application/json,.json" data-change="import">
      <button class="set-row" data-act="reset" style="color:var(--red)">${icon('trash', 20)}<span class="grow">${tr('Delete all data', 'Slett alle data')}</span></button>
    </div>
    <p class="tiny muted" style="margin:0 6px;line-height:1.5">${tr('Everything you log stays on this phone. Back up now and then, especially before changing phones.', 'Alt du logger blir på denne telefonen. Ta sikkerhetskopi innimellom, særlig før du bytter telefon.')}</p>

    <p class="set-label">${tr('Good to know', 'Greit å vite')}</p>
    <div class="set-group"><div class="set-row" style="flex-direction:column;align-items:stretch;gap:8px">
      <p class="small soft" style="line-height:1.55">${tr('Recipes and FODMAP ratings follow Monash University guidance, but products differ: check labels for onion, garlic, honey, inulin and lactose. The Monash FODMAP app is the most complete source.', 'Oppskrifter og FODMAP-vurderinger følger rådene fra Monash University, men produkter varierer: sjekk etiketter for løk, hvitløk, honning, inulin og laktose. Monash FODMAP-appen er den mest komplette kilden.')}</p>
      <p class="small soft" style="line-height:1.55">${tr('Vektplan is a personal helper, not medical advice. If your stomach gets worse, you lose weight without trying, or food feels scary most days, talk to your doctor (fastlege). Low-FODMAP works best with a dietitian.', 'Vektplan er en personlig hjelper, ikke medisinske råd. Hvis magen blir verre, du går ned i vekt uten å prøve, eller mat føles skummelt de fleste dager, snakk med fastlegen. Lav-FODMAP fungerer best sammen med en ernæringsfysiolog.')}</p>
      <button class="link-btn" style="align-self:flex-start;color:var(--muted)" data-act="force">${tr('Trouble? Reload the app from scratch', 'Problemer? Last appen på nytt fra bunnen')}</button>
    </div></div>
    <p class="tiny muted center" style="margin-top:6px">Vektplan ${APP_VERSION} · ${tr('made for Emil', 'laget for Emil')}</p>
  </div>`;
}

let off = null;
export function enter(ctx) {
  off?.();
  off = onUpdate(() => nav.rerender());
  if (ctx.params[0] === 'ai') setTimeout(() => document.getElementById('ai')?.scrollIntoView({ block: 'start' }), 60);
}
export function unmount() {
  off?.();
  off = null;
}

function icsFile() {
  const st = S();
  const start = addDays(dayKey(), 1).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vektplan//Meal reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:Vektplan`];
  for (const s of activeSlots()) {
    const [h, m] = s.time.split(':');
    const title = `Vektplan · ${kindName(s.kind)}`;
    const desc = tr('Meal time is around now. Something small counts, and Vektplan has ideas if you want them.', 'Det er måltidstid omtrent nå. Noe lite teller, og Vektplan har forslag hvis du vil.');
    lines.push('BEGIN:VEVENT', `UID:vektplan-${s.id}@vektplan`, `DTSTAMP:${stamp}`, `DTSTART:${start}T${pad(+h)}${pad(+m)}00`, 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
      `SUMMARY:${title}`, `DESCRIPTION:${desc}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export const actions = {
  syncHealth: () => syncHealth(),
  runShortcut: () => { markPending(); location.href = shortcutURL(); },
  back: () => nav.back('today'),
  check: () => checkForUpdate(false),
  doUpdate: () => applyUpdate(),
  force: async () => {
    const ok = await confirmSheet({ title: tr('Reload the app?', 'Laste appen på nytt?'), text: tr('This downloads the app again. Your data is kept.', 'Dette laster ned appen på nytt. Dataene dine beholdes.'), yes: tr('Reload', 'Last på nytt') });
    if (ok) forceRefresh();
  },
  name: (el) => { mutate((s) => { s.profile.name = el.value.trim().slice(0, 40); }); toast(tr('Saved.', 'Lagret.'), 1200); },
  height: (el) => { const v = Math.round(Number(el.value)); mutate((s) => { s.profile.heightCm = v > 80 && v < 260 ? v : null; }); toast(tr('Saved.', 'Lagret.'), 1200); },
  goal: (el) => {
    const v = Math.round(Number(el.value));
    mutate((s) => { s.profile.goalKcal = v >= 800 && v <= 8000 ? v : null; });
    if (el.value && !(v >= 800 && v <= 8000)) toast(tr('Use a number between 800 and 8000, or leave it empty.', 'Bruk et tall mellom 800 og 8000, eller la det stå tomt.'));
    else toast(tr('Saved.', 'Lagret.'), 1200);
  },
  calm: (el) => { mutate((s) => { s.prefs.calm = el.checked; }); toast(el.checked ? tr('Calm mode on.', 'Rolig modus på.') : tr('Calm mode off.', 'Rolig modus av.'), 1400); },
  slotOn: (el) => {
    const id = el.dataset.id;
    mutate((s) => { const x = s.slots.find((y) => y.id === id); if (x) x.on = el.checked; });
    if (!S().slots.some((s) => s.on)) { mutate((s) => { s.slots.find((y) => y.id === id).on = true; }); toast(tr('Keep at least one meal.', 'Behold minst ett måltid.')); }
    nav.rerender();
  },
  slotTime: (el) => {
    const id = el.dataset.id;
    if (!/^\d{2}:\d{2}$/.test(el.value)) return;
    mutate((s) => { const x = s.slots.find((y) => y.id === id); if (x) x.time = el.value; });
    toast(tr('Saved.', 'Lagret.'), 1200);
  },
  resetSlots: () => { mutate((s) => { s.slots = DEFAULT_SLOTS.map((x) => ({ ...x })); }); toast(tr('Meal times reset.', 'Måltidene er tilbakestilt.')); nav.rerender(); },
  ics: () => openCalendarFile(icsFile()),
  theme: (el) => { mutate((s) => { s.prefs.theme = el.dataset.v; }); applyTheme(); nav.rerender(); },
  lang: (el) => { mutate((s) => { s.prefs.lang = el.dataset.v; }); setLang(el.dataset.v); nav.rerender(); },
  rest: (el) => { mutate((s) => { s.prefs.restSec = Number(el.dataset.v); }); nav.rerender(); },
  key: (el) => { mutate((s) => { s.ai.key = el.value.trim(); }); toast(el.value.trim() ? tr('Key saved on this phone.', 'Nøkkelen er lagret på telefonen.') : tr('Key removed.', 'Nøkkelen er fjernet.'), 1600); nav.rerender(); },
  removeKey: () => { mutate((s) => { s.ai.key = ''; }); nav.rerender(); },
  showKey: () => { showKey = !showKey; nav.rerender(); },
  model: (el) => { mutate((s) => { s.ai.model = el.value; }); toast(tr('Saved.', 'Lagret.'), 1200); },
  test: async () => {
    testing = true;
    nav.rerender();
    try {
      await testKey();
      toast(tr('It works! AI features are on.', 'Det virker! AI-funksjonene er på.'), 2600);
    } catch (e) {
      toast(e.message || String(e), 4000);
    }
    testing = false;
    nav.rerender();
  },
  export: () => download(`vektplan-backup-${dayKey()}.json`, exportJSON(), 'application/json'),
  import: async (el) => {
    const file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !data.profile || !data.days) throw new Error('bad');
      const ok = await confirmSheet({ title: tr('Restore this backup?', 'Gjenopprette denne kopien?'), text: tr('Everything on this phone is replaced with the backup.', 'Alt på telefonen erstattes med sikkerhetskopien.'), yes: tr('Restore', 'Gjenopprett') });
      if (!ok) return;
      replaceAll(data);
      setLang(S().prefs.lang);
      applyTheme();
      toast(tr('Backup restored.', 'Sikkerhetskopien er gjenopprettet.'));
      nav.go('today');
    } catch (e) {
      toast(tr('That file is not a Vektplan backup.', 'Den filen er ikke en Vektplan-kopi.'), 3000);
    }
  },
  reset: async () => {
    const ok = await confirmSheet({ title: tr('Delete everything?', 'Slette alt?'), text: tr('All meals, notes, weights and workouts on this phone are deleted. This cannot be undone. Make a backup first if you might want them back.', 'Alle måltider, notater, veiinger og økter på telefonen slettes. Dette kan ikke angres. Ta sikkerhetskopi først hvis du kan komme til å ville ha dem tilbake.'), yes: tr('Delete all', 'Slett alt'), danger: true });
    if (!ok) return;
    resetAll();
    toast(tr('All data deleted.', 'Alle data er slettet.'));
    nav.go('setup');
  },
};
