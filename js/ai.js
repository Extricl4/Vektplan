// Optional AI features, using the user's own Claude API key (stored only on this phone).
// Calls go straight from the phone to api.anthropic.com.
import { S, peekDay } from './store.js';
import { healthContext } from './health.js';
import { dayStatus, totals, plannedActivity, workoutsOn } from './planner.js';
import { getLang, tr } from './i18n.js';
import { dayKey, addDays, clock } from './util.js';

export const MODELS = [
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: () => tr('Fastest and cheapest', 'Raskest og billigst') },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: () => tr('Best balance (recommended)', 'Best balanse (anbefalt)') },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: () => tr('Smartest, costs the most', 'Smartest, dyrest') },
];

export const hasAI = () => !!S().ai.key?.trim();

const LANG_NAME = () => (getLang() === 'nb' ? 'Norwegian (bokmål)' : 'English');

export class AIError extends Error {}

async function call({ system, messages, maxTokens = 900 }) {
  const { key, model } = S().ai;
  if (!key) throw new AIError(tr('Add your API key in Settings first.', 'Legg inn API-nøkkelen din i Innstillinger først.'));
  if (!navigator.onLine) throw new AIError(tr('You are offline.', 'Du er frakoblet.'));
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: model || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages }),
    });
  } catch (e) {
    throw new AIError(tr('Could not reach the AI. Check your connection.', 'Fikk ikke kontakt med AI-en. Sjekk nettet.'));
  }
  if (!res.ok) {
    let msg = '';
    try {
      msg = (await res.json())?.error?.message || '';
    } catch (e) { /* ignore */ }
    if (res.status === 401) throw new AIError(tr('The API key was not accepted. Check it in Settings.', 'API-nøkkelen ble ikke godtatt. Sjekk den i Innstillinger.'));
    if (res.status === 429) throw new AIError(tr('Too many requests right now. Try again in a minute.', 'For mange forespørsler akkurat nå. Prøv igjen om et minutt.'));
    if (res.status === 400 && /credit|balance|billing/i.test(msg)) throw new AIError(tr('Your API account is out of credit.', 'API-kontoen din er tom for kreditt.'));
    throw new AIError(msg || `${tr('AI error', 'AI-feil')} (${res.status})`);
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

function parseJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new AIError(tr('The AI answer could not be read. Try again.', 'Klarte ikke lese AI-svaret. Prøv igjen.'));
  return JSON.parse(text.slice(start, end + 1));
}

export async function testKey() {
  const out = await call({ system: 'Reply with the single word OK.', messages: [{ role: 'user', content: 'Ping' }], maxTokens: 5 });
  return out;
}

const TAGS = ['wheat', 'lactose', 'garlic_onion', 'fructose', 'polyol', 'gos', 'fatty', 'spicy', 'caffeine', 'fizzy'];

// Estimate a meal from a photo and/or a description.
export async function estimateMeal({ text = '', image = null }) {
  const system = `You estimate meals for a personal food log app. The user follows a low-FODMAP diet (Monash University guidance), has a sensitive stomach, and is trying to gain weight gently.
Identify each food or drink, estimate a realistic portion and its energy in kcal. When unsure, give your best typical estimate rather than refusing.
Rate each item's FODMAP level at that portion: "low", "moderate", "high", or "check" (depends on the product/recipe, e.g. sauces, processed meat).
Return ONLY valid JSON, no markdown:
{"title": "short meal name", "items": [{"name": "...", "portion": "e.g. 1 cup / 130 g", "kcal": 0, "fodmap": "low", "reason": "short reason if not low, else empty", "tags": []}], "question": "one short question if something important for FODMAP or calories is unclear, else empty"}
Allowed tags: ${TAGS.join(', ')}. Use tags for what the item contains (e.g. wheat bread -> wheat; regular milk -> lactose; garlic, onion -> garlic_onion; fried food -> fatty).
Write title, names, portions, reasons and the question in ${LANG_NAME()}.`;
  const content = [];
  if (image) {
    const [meta, data] = image.split(',');
    const media = /image\/(png|jpeg|webp|gif)/.exec(meta)?.[0] || 'image/jpeg';
    content.push({ type: 'image', source: { type: 'base64', media_type: media, data } });
  }
  content.push({ type: 'text', text: text ? `Meal description: ${text}` : 'Estimate this meal.' });
  const out = await call({ system, messages: [{ role: 'user', content }], maxTokens: 1200 });
  const json = parseJSON(out);
  const items = (json.items || []).map((it) => ({
    name: String(it.name || '').slice(0, 80),
    portion: String(it.portion || '').slice(0, 60),
    kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
    fodmap: ['low', 'moderate', 'high', 'check'].includes(it.fodmap) ? it.fodmap : 'check',
    reason: String(it.reason || '').slice(0, 160),
    tags: (it.tags || []).filter((t) => TAGS.includes(t)),
  }));
  return { title: String(json.title || '').slice(0, 80), items, question: String(json.question || '').slice(0, 200) };
}

export function contextText() {
  const st = S();
  const key = dayKey();
  const d = peekDay(key);
  const { list } = dayStatus(key);
  const t = totals(key);
  const lines = [];
  lines.push(`Now: ${new Date().toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`);
  if (st.profile.name) lines.push(`Name: ${st.profile.name}.`);
  if (st.profile.heightCm) lines.push(`Height: ${st.profile.heightCm} cm.`);
  const w = st.weights;
  if (w.length) lines.push(`Weight: latest ${w[w.length - 1].kg} kg (${w[w.length - 1].date})${w.length > 1 ? `, first logged ${w[0].kg} kg (${w[0].date})` : ''}.`);
  if (st.prefs.calm) lines.push('Calm mode is ON: never mention calorie numbers.');
  else lines.push(`Energy eaten today: ${t.kcal} kcal${st.profile.goalKcal ? `, the user's own daily goal is ${st.profile.goalKcal} kcal` : ' (no calorie goal set)'}.`);
  lines.push(`Meals today (${t.done} of ${t.total} done):`);
  for (const x of list) {
    lines.push(`- ${x.time} ${x.slot.kind}: planned "${x.info.title}" [${x.state}]${x.logs.length ? `; ate ${x.logs.map((l) => `${l.title}${l.portion && l.portion < 1 ? ` (${Math.round(l.portion * 100)}%)` : ''}`).join(', ')}` : ''}`);
  }
  const extra = d.logs.filter((l) => !l.slot);
  if (extra.length) lines.push(`Other food today: ${extra.map((l) => `${clock(l.ts)} ${l.title}`).join('; ')}`);
  if (d.stomach?.length) lines.push(`Stomach check-ins today: ${d.stomach.map((s) => `${clock(s.ts)} ${s.level}`).join(', ')}`);
  const j = d.journal;
  if (j) {
    const lv = Object.entries(j.levels || {}).map(([k, v]) => `${k} ${v}/5`).join(', ');
    lines.push(`Journal today: ${j.note ? `"${j.note.slice(0, 400)}"` : '(no note)'}${j.symptoms?.length ? `; symptoms: ${j.symptoms.join(', ')}` : ''}${lv ? `; levels: ${lv}` : ''}`);
  }
  for (let i = 1; i <= 3; i++) {
    const k = addDays(key, -i);
    const pd = peekDay(k);
    if (!pd.logs.length && !pd.journal) continue;
    const syms = pd.journal?.symptoms?.join(', ') || 'none noted';
    lines.push(`${k}: ${pd.logs.length} things logged; symptoms: ${syms}${pd.journal?.note ? `; note: "${pd.journal.note.slice(0, 160)}"` : ''}`);
  }
  const act = plannedActivity(key);
  lines.push(`Training today: planned ${act}; ${workoutsOn(key).length ? 'done' : 'not done yet'}.`);
  const watch = healthContext(key);
  if (watch) lines.push(st.prefs.calm ? watch.replace(/, active energy \d+ kcal/g, '') : watch);
  return lines.join('\n');
}

export async function coachReply(history) {
  const name = S().profile.name || 'the user';
  const system = `You are the coach inside Vektplan, a personal app for ${name}. He has had a sensitive stomach, nausea and food anxiety for years, follows a low-FODMAP diet, gets full quickly from small portions, and wants to gain weight gently, get stronger and feel better.
How you talk: warm, calm, brief (2–4 short sentences, it is a phone), practical, never preachy. Make the next step tiny ("a few sips", "half a portion", "three bites"). Validate feelings. Suggest small, frequent, energy-dense, low-FODMAP options he can actually eat now.
Never: shame or guilt him, suggest skipping meals, restricting, losing weight or "burning off" food, or invent calorie targets (only refer to his own goal if one is set). Do not diagnose.
If he describes severe or worsening symptoms (vomiting blood, black stools, severe pain, fainting, cannot keep fluids down, losing weight without trying), calmly tell him to contact a doctor or legevakt (116 117 in Norway, 113 for emergencies).
If he mentions thoughts of hurting himself, respond with care and give Mental Helse's helpline 116 123 (24/7) and 113 if in danger.
Always reply in ${LANG_NAME()}.
Current data from the app:
${contextText()}`;
  const messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.text }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  return call({ system, messages, maxTokens: 500 });
}

export async function deepPatterns(summary) {
  const system = `You look for possible links between food and symptoms in a personal low-FODMAP food and symptom diary.
Be careful and humble: these are patterns, not diagnoses. Only mention patterns with at least 3 supporting days. Consider same-day and next-day effects. Mention helpful habits too.
Return ONLY JSON: {"patterns": [{"kind": "trigger" | "helps", "text": "one or two short sentences"}], "tip": "one practical, gentle suggestion"}
Max 5 patterns. Write in ${LANG_NAME()}. If there is not enough data, return an empty list and say so in the tip.`;
  const out = await call({ system, messages: [{ role: 'user', content: summary }], maxTokens: 900 });
  const json = parseJSON(out);
  return {
    patterns: (json.patterns || []).slice(0, 5).map((p) => ({ kind: p.kind === 'helps' ? 'helps' : 'trigger', text: String(p.text || '') })),
    tip: String(json.tip || ''),
  };
}
