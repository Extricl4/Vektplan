// Food for training: what to eat before and after, and honest notes on supplements.
// Written for a sensitive, low-FODMAP stomach and for gaining weight. General info, not medical advice.
import { hasSupp, isTicked, toggleSupp, suppCheer, suppList } from '../supps.js';
import { S } from '../store.js';
import { tr, L, n0, n1 } from '../i18n.js';
import { icon, openSheet, closeSheet, plate, fodmapBadge } from '../ui.js';
import { recipeById } from '../data/recipes.js';
import { logRecipeSheet } from '../meals.js';
import { myMeals, sortedMeals, logMyMeal, kcalLine } from '../mymeals.js';
import { exName, kgFmt } from '../training.js';
import { esc, dayKey } from '../util.js';
import { nav } from '../nav.js';
import { cheer } from '../meals.js';
import { toast } from '../ui.js';

const BEFORE = ['pb-toast', 'ricecakes-pb', 'overnight-oats', 'yogurt-bowl'];
const AFTER = ['smoothie', 'eggs-toast', 'tuna-ricecakes', 'yogurt-bowl', 'chicken-pasta', 'salmon-bowl'];

function recipeRow(id, act = 'logR') {
  const r = recipeById(id);
  if (!r) return '';
  const calm = S().prefs.calm;
  return `<button class="item" data-act="${act}" data-id="${r.id}">${plate(r, 44)}<span class="grow"><span class="t" style="display:block;font-weight:500">${esc(L(r.name))}</span>
    <span class="s">${r.min} min${calm ? '' : ` · ${n0(r.kcal)} kcal`}</span></span>${icon('plus', 18, 'style="color:var(--accent)"')}</button>`;
}

function snackMine() {
  return sortedMeals(myMeals().filter((m) => !m.when?.length || m.when.includes('snack'))).slice(0, 2);
}

// Shown after a workout: a calm summary and a few easy things to eat.
export function refuelSheet(summary) {
  if (!summary) return;
  const mine = snackMine();
  const ideas = ['smoothie', 'yogurt-bowl', 'pb-toast', 'eggs-toast'].filter((id) => recipeById(id)).slice(0, 3 - Math.min(1, mine.length));
  const name = S().profile.name ? `, ${esc(S().profile.name)}` : '';
  openSheet({
    title: tr(`Well done${name}`, `Bra jobba${name}`),
    html: `${summary.cheer ? `<p class="h3" style="line-height:1.4">${esc(summary.cheer)}</p>` : ''}
      <div class="wstats"><div class="wstat"><span class="tiny muted">${tr('Time', 'Tid')}</span><span class="v num">${summary.minutes} min</span></div>
        <div class="wstat"><span class="tiny muted">${tr('Sets', 'Sett')}</span><span class="v num">${summary.sets}</span></div>
        <div class="wstat"><span class="tiny muted">${tr('Exercises', 'Øvelser')}</span><span class="v num">${summary.exercises}</span></div></div>
      ${summary.bests?.length ? `<div class="note">${icon('flame', 18)}<div class="grow col" style="gap:4px"><b>${tr('New best', 'Ny rekord')}</b>${summary.bests.map((b) => `<span class="small">${esc(exName(b.exId))}: ${kgFmt(b.kg)} (${tr('was', 'var')} ${kgFmt(b.prev)})</span>`).join('')}</div></div>` : ''}
      <p class="soft small" style="line-height:1.5">${tr('Your muscles grow from what you eat in the next few hours. Something small with protein is perfect, whenever you feel ready.', 'Musklene vokser av det du spiser de neste timene. Noe lite med protein er perfekt, når du føler deg klar.')}</p>
      <div class="list">${hasSupp('protein') && !isTicked('protein') ? `<button class="item" data-act="shake"><span class="plate-mini" aria-hidden="true">${icon('pill', 18)}</span>
        <span class="grow"><span class="t" style="display:block;font-weight:600">${tr('Protein shake', 'Proteinshake')}</span><span class="s">${tr('Tick it off and log it in one tap', 'Kryss av og logg med ett trykk')}</span></span>${icon('plus', 18, 'style="color:var(--accent)"')}</button>` : ''}${mine.map((m) => `<button class="item" data-act="logM" data-id="${m.id}"><span class="plate-mini" aria-hidden="true">${icon('heart', 18)}</span>
        <span class="grow"><span class="t" style="display:block;font-weight:500">${esc(m.name)}</span>${kcalLine(m) ? `<span class="s">${kcalLine(m)}</span>` : ''}</span>${icon('plus', 18, 'style="color:var(--accent)"')}</button>`).join('')}
        ${ideas.map((id) => recipeRow(id)).join('')}</div>
      <div class="btns"><button class="btn secondary" data-act="fuel">${icon('book', 18)} ${tr('Food for training', 'Mat og trening')}</button><button class="btn primary" data-act="close">${tr('Close', 'Lukk')}</button></div>`,
    actions: {
      shake: () => { const r = toggleSupp(suppList().find((x) => x.kind === 'protein')?.id || 'protein'); closeSheet(); toast(suppCheer(r)); },
      logR: (el) => { closeSheet(true); logRecipeSheet(dayKey(), recipeById(el.dataset.id), null); },
      logM: (el) => {
        const m = myMeals().find((x) => x.id === el.dataset.id);
        if (m) logMyMeal(dayKey(), m, null, 1);
        closeSheet();
        toast(cheer());
        nav.rerender();
      },
      close: () => closeSheet(),
      fuel: () => { closeSheet(true); nav.go('fuel'); },
    },
  });
}

// ---------- The guide ----------
const tip = (ic, title, body) => `<div class="tip"><span class="plate-mini" aria-hidden="true">${icon(ic, 18)}</span><div class="grow"><p style="font-weight:600">${title}</p><p class="small soft" style="line-height:1.5;margin-top:2px">${body}</p></div></div>`;

const verdict = (kind) => {
  const map = {
    yes: [tr('Can help', 'Kan hjelpe'), 'var(--accent-soft)', 'var(--accent)'],
    maybe: [tr('Optional, ask your doctor', 'Valgfritt, spør legen'), 'var(--surface2)', 'var(--soft)'],
    no: [tr('Skip it for now', 'Dropp det foreløpig'), 'var(--amber-bg)', 'var(--amber)'],
    diy: [tr('Make your own instead', 'Lag din egen i stedet'), 'var(--surface2)', 'var(--soft)'],
  };
  const [t, bg, fg] = map[kind];
  return `<span class="badge" style="background:${bg};color:${fg};font-weight:600">${t}</span>`;
};

const supp = (title, kind, body) => `<section class="card tight"><div class="row between top" style="gap:10px"><h3 class="h3">${title}</h3>${verdict(kind)}</div><p class="small soft" style="line-height:1.55">${body}</p></section>`;

export function render() {
  return `<div class="screen no-tabs">
    <header class="head"><button class="icon-btn surface" data-act="back" aria-label="${tr('Back', 'Tilbake')}">${icon('chevL', 20)}</button>
      <div class="titles grow"><p class="eyebrow">${tr('Gain muscle, gently', 'Bygg muskler, skånsomt')}</p><h1 class="h1">${tr('Food for training', 'Mat og trening')}</h1></div></header>

    <section class="card soft">
      <p style="line-height:1.55">${tr('Training is only the signal. Muscle is built from <b>food and rest</b>. While you are eating little, short and gentle sessions plus a bit of food around them do more for you than training hard.', 'Treningen er bare signalet. Muskler bygges av <b>mat og hvile</b>. Mens du spiser lite, gjør korte og rolige økter pluss litt mat rundt dem mer for deg enn å trene hardt.')}</p>
    </section>

    <div class="section-title"><h2 class="h2">${tr('Before', 'Før')}</h2></div>
    <section class="card">
      ${tip('clock', tr('1–2 hours before: a small, easy meal', '1–2 timer før: et lite, lett måltid'), tr('Something with carbs and a little protein. Not too fatty, so it sits well.', 'Noe med karbohydrater og litt protein. Ikke for fett, så ligger det godt.'))}
      ${tip('leaf', tr('Less than an hour before: just a bite', 'Under en time før: bare en bit'), tr('A firm banana, a couple of rice cakes or a few crackers. Training on a completely empty stomach can leave you shaky and queasy.', 'En fast banan, et par riskaker eller noen kjeks. Å trene helt tom for mat kan gjøre deg skjelven og kvalm.'))}
      ${tip('info', tr('Nervous stomach?', 'Urolig mage?'), tr('Small sips of water, eat earlier, and choose foods you know sit well. Your own safe foods count.', 'Små slurker vann, spis tidligere, og velg mat du vet går fint. Din egen trygge mat teller.'))}
      <p class="label">${tr('Ideas', 'Forslag')}</p>
      <div class="list">${BEFORE.map((id) => recipeRow(id)).join('')}</div>
    </section>

    <div class="section-title"><h2 class="h2">${tr('After', 'Etter')}</h2></div>
    <section class="card">
      ${tip('heart', tr('Within a couple of hours: protein + carbs', 'Innen et par timer: protein + karbohydrater'), tr('A normal meal or a snack. No need to rush. The next few hours are what counts.', 'Et vanlig måltid eller et mellommåltid. Ingen hast. Det er de neste timene som teller.'))}
      ${tip('sparkle', tr('Drinking is easier than chewing', 'Drikke er lettere enn å tygge'), tr('When food feels hard after training, a smoothie or a glass of lactose-free milk does the job.', 'Når mat føles tungt etter trening, gjør en smoothie eller et glass laktosefri melk jobben.'))}
      ${tip('flame', tr('Training day = one extra snack', 'Treningsdag = ett ekstra mellommåltid'), tr('Training uses energy your body needs for gaining. Add one small snack on training days.', 'Trening bruker energi kroppen trenger for å gå opp. Legg til ett lite mellommåltid på treningsdager.'))}
      <p class="label">${tr('Ideas', 'Forslag')}</p>
      <div class="list">${AFTER.map((id) => recipeRow(id)).join('')}</div>
    </section>

    <div class="section-title"><h2 class="h2">${tr('Supplements', 'Kosttilskudd')}</h2></div>
    ${supp(tr('Protein powder', 'Proteinpulver'), 'yes', tr(
      'Handy when eating enough protein is hard: blend it into a smoothie. Pick <b>whey protein isolate</b> (most of the lactose is filtered out), rice protein or egg white protein. Pea protein differs a lot between brands. Avoid whey <i>concentrate</i>, inulin or chicory root fibre, and sweeteners ending in -ol (sorbitol, xylitol, maltitol). Monash or FODMAP Friendly certified is the safest bet.',
      'Lurt når det er vanskelig å få i seg nok protein: mos det i en smoothie. Velg <b>myseprotein-isolat</b> (whey isolate, mesteparten av laktosen er filtrert bort), risprotein eller eggehvite-protein. Erteprotein varierer mye mellom merker. Unngå myse<i>konsentrat</i>, inulin eller sikorirot-fiber, og søtstoffer som slutter på -ol (sorbitol, xylitol, maltitol). Monash- eller FODMAP Friendly-sertifisert er tryggest.'))}
    ${supp(tr('Creatine', 'Kreatin'), 'maybe', tr(
      'The best-researched supplement for strength and muscle, and considered safe for healthy adults. Plain <b>creatine monohydrate</b>, a small daily dose (3–5 g) with a meal. Skip the "loading phase": large single doses are what upset stomachs. It pulls a little water into your muscles, so the scale goes up a bit, which is normal. <b>Gummies:</b> lab tests have found many hold much less creatine than the label says, so pick a brand that is third-party tested, and check for sorbitol, maltitol or xylitol (FODMAP sweeteners). Since your stomach has been sick for years, check with your doctor first.',
      'Det best undersøkte tilskuddet for styrke og muskler, og regnet som trygt for friske voksne. Vanlig <b>kreatin monohydrat</b>, en liten daglig dose (3–5 g) sammen med et måltid. Dropp «ladefasen»: store enkeltdoser er det som gir vondt i magen. Det trekker litt vann inn i musklene, så vekta går litt opp, og det er normalt. <b>Gummies:</b> labtester har funnet at mange har mye mindre kreatin enn det står på pakken, så velg et merke som er testet av en tredjepart, og sjekk for sorbitol, maltitol eller xylitol (FODMAP-søtstoffer). Siden magen har vært syk i flere år, sjekk med legen først.'))}
    ${supp(tr('Pre-workout', 'Pre-workout'), 'no', tr(
      'Most are built on a lot of caffeine (often more than a couple of cups of coffee per scoop), and common side effects are nausea, stomach trouble, jitters and a racing heart. Not what your stomach needs. <b>A small snack is your pre-workout.</b>',
      'De fleste er bygget på mye koffein (ofte mer enn et par kopper kaffe per skje), og vanlige bivirkninger er kvalme, mageplager, skjelving og hjertebank. Ikke det magen din trenger. <b>Et lite mellommåltid er din pre-workout.</b>'))}
    ${supp(tr('Mass gainers', 'Mass gainers'), 'diy', tr(
      'Often made with whey concentrate (lactose), fibres or sweeteners that are hard on a sensitive gut. A homemade smoothie with lactose-free milk, oats, peanut butter, a firm banana and whey isolate does the same job.',
      'Ofte laget med mysekonsentrat (laktose), fiber eller søtstoffer som er tøffe for en sensitiv mage. En hjemmelaget smoothie med laktosefri melk, havre, peanøttsmør, en fast banan og whey isolate gjør samme jobben.'))}
    ${supp('BCAA / EAA', 'no', tr(
      'Not needed when you get protein from food or a shake.',
      'Ikke nødvendig når du får protein fra mat eller en shake.'))}

    <p class="tiny muted" style="margin:0 6px;line-height:1.5">${tr('General information, not medical advice. A doctor or a dietitian who knows your stomach can tailor this to you.', 'Generell informasjon, ikke medisinske råd. En lege eller ernæringsfysiolog som kjenner magen din kan tilpasse dette til deg.')}</p>
  </div>`;
}

export const actions = {
  back: () => nav.back('train'),
  logR: (el) => logRecipeSheet(dayKey(), recipeById(el.dataset.id), null),
};
