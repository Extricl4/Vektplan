// Kind, specific words about how today is going. Never guilt, never "you should have".
import { S, latestWeight } from './store.js';
import { workoutsOn } from './planner.js';
import { dayTotals, proteinGoal } from './nutrition.js';
import { suppList, allDone } from './supps.js';
import { tr, n1 } from './i18n.js';
import { dayKey, addDays, nowMinutes, dayNum } from './util.js';

const pick = (arr, key) => arr[(dayNum(key) + arr.length) % arr.length];

// Weight change over about the last three weeks, if there are two weigh-ins far enough apart.
export function recentGain(days = 21) {
  const ws = S().weights;
  const last = latestWeight();
  if (!last || ws.length < 2) return null;
  const from = addDays(last.date, -days);
  const base = ws.filter((w) => w.date <= addDays(last.date, -7) && w.date >= addDays(from, -7)).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return base ? last.kg - base.kg : null;
}

export function todayLine(key = dayKey()) {
  const tt = dayTotals(key);
  const t = { logs: tt.n };
  const goal = proteinGoal();
  const trained = workoutsOn(key).length > 0;
  const supps = suppList().length > 0 && allDone(key);
  const now = nowMinutes();
  const gain = recentGain();
  const tail = supps ? ` ${tr('Supplements done too.', 'Tilskudd er gjort også.')}` : '';

  if (goal && tt.p >= goal) return tr('Protein goal reached today. Your muscles have what they need.', 'Proteinmålet er nådd i dag. Musklene har det de trenger.') + tail;
  if (t.logs >= 5) return tr(`You have eaten ${t.logs} times today. Small and often is exactly how gaining works.`, `Du har spist ${t.logs} ganger i dag. Lite og ofte er akkurat sånn man går opp.`) + tail;
  if (trained && t.logs) return tr('You trained and you are eating. That is exactly how muscle grows.', 'Du har trent og du spiser. Det er akkurat sånn muskler vokser.') + tail;
  if (trained) return tr('Nice workout. Something to eat in the next hour or two helps your muscles grow.', 'Fin økt. Litt mat i løpet av en time eller to hjelper musklene å vokse.') + tail;
  if (t.logs) {
    const lines = [
      tr(`${t.logs} logged so far. Every bite builds you up.`, `${t.logs} logget så langt. Hver bit bygger deg opp.`),
      tr('Good going. Small and often works.', 'Bra jobba. Lite og ofte fungerer.'),
      tr('You are on it today. Keep it gentle.', 'Du er i gang i dag. Ta det rolig.'),
    ];
    return pick(lines, key) + tail;
  }
  if (gain != null && gain >= 0.3) return tr(`Up ${n1(gain)} kg over the last weeks. Your body is responding.`, `Opp ${n1(gain)} kg de siste ukene. Kroppen svarer.`) + tail;
  if (now < 11 * 60) return pick([tr('New day. Something small to start is plenty.', 'Ny dag. Noe lite til å begynne med er nok.'), tr('Morning. A few bites and a drink is a great start.', 'God morgen. Noen biter og noe å drikke er en fin start.')], key) + tail;
  return tr('No rush. A small snack is a great start.', 'Ingen stress. Et lite mellommåltid er en fin start.') + tail;
}

// After a finished workout.
export function workoutCheer(sets = 0, bests = 0) {
  if (bests) return tr(`New best${bests > 1 ? 's' : ''}! You are getting stronger.`, `Ny${bests > 1 ? 'e' : ''} rekord${bests > 1 ? 'er' : ''}! Du blir sterkere.`);
  const lines = [
    tr('Workout saved. Showing up is the hard part, and you did it.', 'Økta er lagret. Å møte opp er det vanskeligste, og det gjorde du.'),
    tr('Done. Muscles grow while you rest and eat, so take it easy now.', 'Ferdig. Musklene vokser mens du hviler og spiser, så ta det rolig nå.'),
    tr(`Saved${sets ? `: ${sets} sets` : ''}. That is real work.`, `Lagret${sets ? `: ${sets} sett` : ''}. Det er ekte innsats.`),
  ];
  return lines[(S().workouts.length + sets) % lines.length];
}
