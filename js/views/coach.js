import { S, mutate, peekDay } from '../store.js';
import { dayStatus, totals, streak, makeRestGentle, nudgeNext, weekSummary } from '../planner.js';
import { hasAI, coachReply } from '../ai.js';
import { GENTLE, POOLS, recipeById } from '../data/recipes.js';
import { tr, L, n0, n1, kindName } from '../i18n.js';
import { icon, confirmSheet, toast } from '../ui.js';
import { esc, dayKey, hash } from '../util.js';
import { nav } from '../nav.js';

let busy = false;

const CHIPS = () => [
  ['nausea', tr('I feel nauseous', 'Jeg er kvalm')],
  ['appetite', tr("I don't feel like eating", 'Jeg har ikke lyst på mat')],
  ['snack', tr('Suggest a snack', 'Foreslå et mellommåltid')],
  ['status', tr('How am I doing?', 'Hvordan går det?')],
  ['move', tr('Move my next meal', 'Flytt neste måltid')],
  ['anxiety', tr('I feel anxious about food', 'Jeg er engstelig for mat')],
];

function pickSnack() {
  const d = peekDay();
  const rough = (d.stomach || []).slice(-1)[0];
  const base = rough && (rough.level === 'queasy' || rough.level === 'rough') ? GENTLE : [...POOLS.snack, ...GENTLE];
  const pool = [...new Set(base)].map(recipeById).filter((r) => r && r.min <= 15);
  return pool[hash(String(Math.floor(Date.now() / 600000))) % pool.length];
}

function detect(text) {
  const t = text.toLowerCase();
  if (/(kill myself|suicid|selvmord|ta livet|want to die|vil dø|hurt myself|skade meg selv)/.test(t)) return 'crisis';
  if (/(blood|blod|black stool|svart avføring|severe pain|sterke smerter|faint|besvim|can't keep|klarer ikke holde)/.test(t)) return 'redflag';
  if (/(nause|queasy|kvalm|uvel|sick to my|throw up|kaste opp)/.test(t)) return 'nausea';
  if (/(anx|scared|afraid|angst|redd|nervøs|worried|bekymr)/.test(t)) return 'anxiety';
  if (/(appetite|not hungry|don.t feel like eat|matlyst|ikke sulten|orker ikke|ikke lyst)/.test(t)) return 'appetite';
  if (/(how am i|how.s it going|status|hvordan går|fremgang|progress)/.test(t)) return 'status';
  if (/(what should i eat|what (do|can) i eat|what to eat|hva skal jeg spise|hva bør jeg spise|hva kan jeg spise|eat now|spise nå|next meal|neste måltid)/.test(t)) return 'next';
  if (/(move|later|delay|flytt|senere|utsett)/.test(t)) return 'move';
  if (/(snack|mellommåltid|suggest|forslag|hungry|sulten|idea)/.test(t)) return 'snack';
  if (/(thank|takk)/.test(t)) return 'thanks';
  return 'other';
}

function localReply(intent) {
  const st = S();
  const calm = st.prefs.calm;
  const { current } = dayStatus();
  switch (intent) {
    case 'crisis':
      return { text: tr("I'm really glad you told me. You deserve support right now from a real person. In Norway you can call Mental Helse on 116 123 any time, day or night, or 113 if you are in danger. Could you also reach out to someone close to you today?", 'Jeg er glad for at du sa det. Du fortjener støtte fra et ekte menneske nå. Du kan ringe Mental Helse på 116 123 når som helst, døgnet rundt, eller 113 hvis du er i fare. Kan du også ta kontakt med noen som står deg nær i dag?') };
    case 'redflag':
      return { text: tr('That sounds like something a doctor should look at soon. Please call legevakt on 116 117, or 113 if it feels serious or is getting worse fast.', 'Det høres ut som noe en lege bør se på snart. Ring legevakten på 116 117, eller 113 hvis det føles alvorlig eller blir raskt verre.') };
    case 'nausea':
      return {
        text: tr("That's rough, I'm sorry. Try something cold and plain in tiny amounts: a few sips of smoothie or a couple of rice crackers. Sit upright, breathe out slowly, and give it 15 minutes. Want me to make the rest of today extra gentle?", 'Så kjipt, det er leit. Prøv noe kaldt og enkelt i små mengder: noen slurker smoothie eller et par riskjeks. Sitt oppreist, pust rolig ut, og gi det 15 minutter. Skal jeg gjøre resten av dagen ekstra mild?'),
        action: 'gentle',
      };
    case 'appetite':
      return {
        text: current
          ? tr(`Totally normal with a sensitive stomach. Let's make it tiny: three bites or five sips, then stop. Small and often adds up. Next on the plan is ${current.info.title}. Even half counts.`, `Helt vanlig med en sensitiv mage. Vi gjør det bitte lite: tre biter eller fem slurker, og så stopper du. Lite og ofte blir mye til slutt. Neste i planen er ${current.info.title}. Selv halvparten teller.`)
          : tr("Totally normal. You've done today's meals, so listen to your body. If you get a little hungry later, a small snack is a bonus.", 'Helt vanlig. Du har gjort dagens måltider, så lytt til kroppen. Blir du litt sulten senere, er et lite mellommåltid en bonus.'),
        action: current ? 'today' : null,
      };
    case 'next': {
      if (current && current.state === 'next') {
        const r = pickSnack();
        return {
          text: tr(`Your next meal is ${kindName(current.slot.kind).toLowerCase()} at ${current.time}. Hungry before that? Have a small snack now: ${L(r.name).toLowerCase()}. ${r.min ? `${r.min} minutes.` : 'No cooking.'}`, `Neste måltid er ${kindName(current.slot.kind).toLowerCase()} kl. ${current.time}. Sulten før det? Ta et lite mellommåltid nå: ${L(r.name).toLowerCase()}. ${r.min ? `${r.min} minutter.` : 'Ingen matlaging.'}`),
          action: `recipe:${r.id}`,
        };
      }
      if (current) {
        const alt = pickSnack();
        const when = current.state === 'now' ? tr('Right now', 'Akkurat nå') : tr(`At ${current.time}`, `Kl. ${current.time}`);
        return {
          text: tr(`${when}: ${current.info.title}. If that feels like too much, half a portion is great, or try ${L(alt.name).toLowerCase()} instead. Start with a few bites and see how it feels.`, `${when}: ${current.info.title}. Føles det som mye, er en halv porsjon kjempebra, eller prøv ${L(alt.name).toLowerCase()} i stedet. Start med noen biter og kjenn etter.`),
          action: 'today',
        };
      }
      return localReply('snack');
    }
    case 'snack': {
      const r = pickSnack();
      return {
        text: tr(`How about ${L(r.name)}? ${r.min ? `${r.min} minutes` : 'No cooking'}, low FODMAP${calm ? '' : `, about ${n0(r.kcal)} kcal`}. ${L(r.note)}`, `Hva med ${L(r.name)}? ${r.min ? `${r.min} minutter` : 'Ingen matlaging'}, lav-FODMAP${calm ? '' : `, ca. ${n0(r.kcal)} kcal`}. ${L(r.note)}`),
        action: `recipe:${r.id}`,
      };
    }
    case 'status': {
      const t = totals();
      const s = streak();
      const w = st.weights;
      const change = w.length > 1 ? w[w.length - 1].kg - w[0].kg : null;
      const wk = weekSummary();
      const parts = [];
      parts.push(tr(`You've done ${t.done} of ${t.total} meals today${calm ? '' : ` (${n0(t.kcal)} kcal${st.profile.goalKcal ? ` of ${n0(st.profile.goalKcal)}` : ''})`}.`, `Du har gjort ${t.done} av ${t.total} måltider i dag${calm ? '' : ` (${n0(t.kcal)} kcal${st.profile.goalKcal ? ` av ${n0(st.profile.goalKcal)}` : ''})`}.`));
      if (s >= 2) parts.push(tr(`${s} days in a row of logging.`, `${s} dager på rad med logging.`));
      if (change != null) parts.push(change >= 0 ? tr(`Weight is up ${n1(change)} kg since you started.`, `Vekten har gått opp ${n1(change)} kg siden du startet.`) : tr(`Weight is ${n1(Math.abs(change))} kg below where you started. Let's add one extra snack a day this week.`, `Vekten er ${n1(Math.abs(change))} kg under der du startet. La oss legge til ett ekstra mellommåltid om dagen denne uka.`));
      parts.push(wk.sessions ? tr(`${wk.sessions} training ${wk.sessions === 1 ? 'session' : 'sessions'} this week.`, `${wk.sessions} treningsøkt${wk.sessions === 1 ? '' : 'er'} denne uka.`) : tr('No training yet this week. A short walk is a great start.', 'Ingen trening ennå denne uka. En kort gåtur er en fin start.'));
      parts.push(tr("You're doing better than you think.", 'Du gjør det bedre enn du tror.'));
      return { text: parts.join(' ') };
    }
    case 'move': {
      const moved = nudgeNext(30);
      if (!moved) return { text: tr('There are no more meals left today to move.', 'Det er ingen flere måltider igjen i dag å flytte.') };
      const { list } = dayStatus();
      const x = list.find((e) => e.slot.id === moved.slot.id);
      return { text: tr(`Done. ${kindName(moved.slot.kind)} is moved to ${x?.time}. No stress.`, `Ferdig. ${kindName(moved.slot.kind)} er flyttet til ${x?.time}. Ingen stress.`) };
    }
    case 'anxiety':
      return { text: tr("Food anxiety is real, and it's not your fault. Try this: pick the safest food you know, take one bite, and breathe out slowly. You set the pace. If it keeps being hard, telling your doctor about it can really help. It's very treatable.", 'Matangst er ekte, og det er ikke din feil. Prøv dette: velg den tryggeste maten du vet om, ta én bit, og pust rolig ut. Du bestemmer tempoet. Hvis det fortsetter å være vanskelig, kan det hjelpe mye å fortelle legen om det. Det går an å få god hjelp.') };
    case 'thanks':
      return { text: tr("Anytime. I'm here.", 'Bare hyggelig. Jeg er her.') };
    default:
      return {
        text: tr('I can help with the buttons below right away. To chat freely about anything, add your Claude API key in Settings.', 'Jeg kan hjelpe med knappene under med en gang. For å prate fritt om alt mulig, legg inn Claude API-nøkkelen din i Innstillinger.'),
        action: 'settings',
      };
  }
}

function actionButton(action) {
  if (!action) return '';
  if (action === 'gentle') return `<button class="btn small primary" style="align-self:flex-start" data-act="gentle">${icon('leaf', 16)} ${tr('Make today gentle', 'Gjør dagen mild')}</button>`;
  if (action === 'today') return `<a class="btn small secondary" style="align-self:flex-start" href="#/today">${tr('See my next meal', 'Se neste måltid')}</a>`;
  if (action === 'settings') return `<a class="btn small secondary" style="align-self:flex-start" href="#/settings/ai">${tr('Set up AI', 'Sett opp AI')}</a>`;
  if (action.startsWith('recipe:')) return `<a class="btn small secondary" style="align-self:flex-start" href="#/recipe/${esc(action.slice(7))}">${tr('Open recipe', 'Åpne oppskrift')}</a>`;
  return '';
}

function greeting() {
  const name = S().profile.name;
  return tr(`Hi${name ? ` ${name}` : ''}! I'm your coach. I can see your meal plan, what you've logged and how your stomach has been. Ask me anything, or tap a button below.`, `Hei${name ? ` ${name}` : ''}! Jeg er coachen din. Jeg ser måltidsplanen, det du har logget og hvordan magen har vært. Spør meg om hva som helst, eller trykk en knapp under.`);
}

export function render() {
  const chat = S().chat;
  const ai = hasAI();
  return `<div class="screen no-tabs" style="padding-top:0;padding-bottom:0;gap:10px">
    <header class="head" style="position:sticky;top:0;z-index:5;background:var(--bg);margin:0 -18px;padding:calc(env(safe-area-inset-top) + 14px) 18px 12px;border-bottom:1px solid var(--line)">
      <button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <span class="icon-btn" style="background:var(--accent-soft);color:var(--accent-line)">${icon('sparkle', 20)}</span>
      <div class="grow"><h1 class="h2">${tr('Coach', 'Coach')}</h1><p class="tiny muted">${ai ? tr('AI coach · knows your plan and journal', 'AI-coach · kjenner planen og dagboka') : tr('Quick help · add an AI key for free chat', 'Rask hjelp · legg inn AI-nøkkel for fri chat')}</p></div>
      ${chat.length ? `<button class="icon-btn" style="background:transparent;color:var(--muted)" data-act="clear" aria-label="${tr('Clear chat', 'Tøm chatten')}">${icon('trash', 19)}</button>` : ''}
    </header>
    <div class="chat" id="chat">
      <div class="bubble coach">${esc(greeting())}</div>
      ${chat.map((m) => `<div class="bubble ${m.role === 'user' ? 'me' : 'coach'}">${esc(m.text)}</div>${m.role === 'assistant' ? actionButton(m.action) : ''}`).join('')}
      ${busy ? '<div class="bubble coach typing" aria-label="…"><i></i><i></i><i></i></div>' : ''}
    </div>
    <div class="chips scroll" style="padding-top:4px">${CHIPS().map(([id, label]) => `<button class="chip" data-act="chip" data-intent="${id}">${label}</button>`).join('')}</div>
    <div class="composer">
      <label class="sr-only" for="chat-in">${tr('Message the coach', 'Skriv til coachen')}</label>
      <textarea id="chat-in" class="textarea" rows="1" placeholder="${tr('Message the coach', 'Skriv til coachen')}" data-input="grow"></textarea>
      <button class="icon-btn" style="width:48px;height:48px;background:var(--accent-fill);color:var(--accent-ink)" data-act="send" aria-label="${tr('Send', 'Send')}">${icon('send', 20)}</button>
    </div>
  </div>`;
}

export function mount() {
  requestAnimationFrame(() => nav.scrollTo('end'));
  const input = document.getElementById('chat-in');
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      actions.send();
    }
  });
}

async function send(text, intent = null) {
  if (!text.trim() || busy) return;
  mutate((s) => { s.chat.push({ role: 'user', text: text.trim(), ts: Date.now() }); s.chat = s.chat.slice(-80); });
  const kind = intent || detect(text);
  const forceLocal = ['crisis', 'redflag', 'move'].includes(kind) || (intent && intent !== 'other' && !hasAI());
  busy = true;
  nav.rerender();
  let reply;
  if (hasAI() && !forceLocal) {
    try {
      const text2 = await coachReply(S().chat);
      reply = { text: text2, action: kind === 'nausea' ? 'gentle' : null };
    } catch (e) {
      const local = localReply(kind);
      reply = { text: `${local.text}\n\n(${tr('AI unavailable', 'AI utilgjengelig')}: ${e.message})`, action: local.action };
    }
  } else {
    await new Promise((r) => setTimeout(r, 450));
    reply = localReply(kind);
  }
  busy = false;
  mutate((s) => { s.chat.push({ role: 'assistant', text: reply.text, action: reply.action || null, ts: Date.now() }); s.chat = s.chat.slice(-80); });
  nav.rerender();
}

export const actions = {
  back: () => nav.back('today'),
  send: () => {
    const el = document.getElementById('chat-in');
    const text = el?.value || '';
    if (el) el.value = '';
    send(text);
  },
  chip: (el) => send(el.textContent, el.dataset.intent),
  grow: (el) => {
    el.style.height = 'auto';
    el.style.height = Math.min(140, el.scrollHeight) + 'px';
  },
  gentle: () => {
    const n = makeRestGentle();
    toast(n ? tr('Done. The rest of today is extra gentle.', 'Ferdig. Resten av dagen er ekstra mild.') : tr('Nothing left to change today.', 'Ingenting igjen å endre i dag.'));
  },
  clear: async () => {
    const ok = await confirmSheet({ title: tr('Clear the chat?', 'Tømme chatten?'), text: tr('This deletes the conversation on this phone.', 'Dette sletter samtalen på denne telefonen.'), yes: tr('Clear', 'Tøm'), danger: true });
    if (ok) { mutate((s) => { s.chat = []; }); nav.rerender(); }
  },
};
