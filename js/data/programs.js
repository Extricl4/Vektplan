// Ready-made beginner programs for muscle growth. Each session is a list of movement "slots"
// (squat, push, row…) that turn into the right exercise for where you train today:
// at home, with dumbbells or at the gym. Focus muscles get an extra exercise and an extra set.
const N = (en, nb) => ({ en, nb });

// Candidates, best first: "exercise:equipment". The first one whose equipment you have where you
// train (and that isn't already in the session) is used, so plans follow your own equipment.
export const SLOTS = {
  squat: { g: ['legs', 'glutes'], c: ['legpress:machine', 'squat:dumbbell', 'squat:kettlebell', 'bwsquat:none'] },
  hinge: { g: ['glutes', 'legs'], c: ['rdl:dumbbell', 'rdl:kettlebell', 'rdl:barbell', 'hipthrust:machine', 'bridge:none'] },
  lunge: { g: ['legs', 'glutes'], c: ['splitsquat:dumbbell', 'splitsquat:kettlebell', 'lunge:none', 'stepup:none'] },
  legcurl: { g: ['legs'], c: ['legcurl:machine', 'legext:machine', 'singlebridge:none'] },
  glute: { g: ['glutes'], c: ['hipthrust:machine', 'hipthrust:dumbbell', 'bandwalk:band', 'singlebridge:none', 'donkey:none'] },
  calves: { g: ['legs'], c: ['calfraise:none'] },
  push: { g: ['chest', 'triceps'], c: ['chestpress:machine', 'dbpress:dumbbell', 'bandpress:band', 'incline:none', 'pushup:none'] },
  push2: { g: ['chest', 'shoulders'], c: ['inclinedb:dumbbell', 'chestpress:machine', 'pushup:none', 'incline:none'] },
  fly: { g: ['chest'], c: ['cablefly:cable', 'dbfly:dumbbell', 'bandpress:band', 'diamond:none', 'pushup:none'] },
  row: { g: ['back', 'biceps'], c: ['seatedrow:cable', 'seatedrow:machine', 'row:dumbbell', 'row:kettlebell', 'bandrow:band', 'doorrow:none'] },
  pulldown: { g: ['back', 'biceps'], c: ['latpull:cable', 'latpull:machine', 'bandpulldown:band', 'negpull:bar', 'rearfly:dumbbell', 'superman:none', 'snowangel:none'] },
  rear: { g: ['shoulders', 'back'], c: ['facepull:cable', 'rearfly:dumbbell', 'bandpull:band', 'snowangel:none', 'yraise:none'] },
  press: { g: ['shoulders', 'triceps'], c: ['machpress:machine', 'press:dumbbell', 'press:kettlebell', 'pikepush:none'] },
  side: { g: ['shoulders'], c: ['lateral:dumbbell', 'lateral:cable', 'bandlateral:band', 'yraise:none'] },
  biceps: { g: ['biceps'], c: ['cablecurl:cable', 'curl:dumbbell', 'bandcurl:band', 'bagcurl:none'] },
  biceps2: { g: ['biceps'], c: ['hammer:dumbbell', 'curl:dumbbell', 'bandcurl:band', 'bagcurl:none'] },
  triceps: { g: ['triceps'], c: ['pushdown:cable', 'ohext:dumbbell', 'ohext:kettlebell', 'bandpushdown:band', 'benchdip:none'] },
  triceps2: { g: ['triceps'], c: ['ohext:dumbbell', 'skull:dumbbell', 'bandpushdown:band', 'diamond:none', 'benchdip:none'] },
  core: { g: ['core'], c: ['deadbug:none'] },
  core2: { g: ['core'], c: ['plank:none', 'birddog:none'] },
};
const cand = (slot) => (SLOTS[slot]?.c || []).map((x) => x.split(':'));

// The exercise this slot becomes with this equipment (skipping ones already used).
export function slotPick(slot, equip, used = new Set()) {
  const ok = cand(slot).filter(([, e]) => equip.includes(e)).map(([id]) => id);
  return ok.find((id) => !used.has(id)) || ok[0] || null;
}

// Every exercise a slot can become (so we can tell if you changed it yourself).
export const slotIds = (slot) => [...new Set(cand(slot).map(([id]) => id))];

// Muscles you can put extra focus on, and the slots that train them (best first).
export const FOCUS = {
  chest: { name: N('Chest', 'Bryst'), slots: ['push', 'push2', 'fly'], kinds: ['full', 'upper'] },
  back: { name: N('Back', 'Rygg'), slots: ['row', 'pulldown', 'rear'], kinds: ['full', 'upper'] },
  shoulders: { name: N('Shoulders', 'Skuldre'), slots: ['side', 'press', 'rear'], kinds: ['full', 'upper'] },
  arms: { name: N('Arms', 'Armer'), slots: ['biceps', 'triceps', 'biceps2', 'triceps2'], kinds: ['full', 'upper'], min: 2, each: [['biceps', 'biceps2'], ['triceps', 'triceps2']] },
  legs: { name: N('Legs', 'Bein'), slots: ['squat', 'lunge', 'legcurl'], kinds: ['full', 'lower'] },
  glutes: { name: N('Glutes', 'Sete'), slots: ['hinge', 'glute', 'lunge'], kinds: ['full', 'lower'] },
  core: { name: N('Core', 'Kjerne'), slots: ['core', 'core2'], kinds: ['full', 'lower', 'upper'], min: 1 },
};
export const FOCUS_ORDER = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'];

export const REPS = {
  grow: { lo: 8, hi: 12, name: N('8–12 reps', '8–12 reps'), sub: N('The classic range for muscle growth. Recommended.', 'Det klassiske området for muskelvekst. Anbefalt.') },
  light: { lo: 12, hi: 15, name: N('12–15 reps', '12–15 reps'), sub: N('Lighter weights, easier on joints and nerves.', 'Lettere vekter, snillere mot ledd og nerver.') },
  heavy: { lo: 6, hi: 10, name: N('6–10 reps', '6–10 reps'), sub: N('Heavier, for when you feel at home with the exercises.', 'Tyngre, for når du er trygg på øvelsene.') },
};

export const PROGRAMS = {
  start2: {
    name: N('Start here', 'Start her'),
    tag: N('Recommended', 'Anbefalt'),
    sub: N('2 short full-body sessions a week. Enough to grow while you eat little, and easy to keep up.', '2 korte helkroppsøkter i uka. Nok til å vokse mens du spiser lite, og lett å holde på med.'),
    days: [0, 3],
    sessions: [
      { key: 'A', kind: 'full', name: N('Full body A', 'Hele kroppen A'), slots: ['squat', 'push', 'row', 'side', 'biceps', 'core', 'calves'] },
      { key: 'B', kind: 'full', name: N('Full body B', 'Hele kroppen B'), slots: ['hinge', 'push2', 'pulldown', 'lunge', 'triceps', 'rear', 'core2'] },
    ],
  },
  full3: {
    name: N('Full body ×3', 'Hele kroppen ×3'),
    tag: N('When 2 feels easy', 'Når 2 føles lett'),
    sub: N('3 full-body sessions a week. Each muscle gets trained often, which is great for growth.', '3 helkroppsøkter i uka. Hver muskel trenes ofte, og det er bra for vekst.'),
    days: [0, 2, 4],
    sessions: [
      { key: 'A', kind: 'full', name: N('Full body A', 'Hele kroppen A'), slots: ['squat', 'push', 'row', 'side', 'biceps', 'core', 'calves'] },
      { key: 'B', kind: 'full', name: N('Full body B', 'Hele kroppen B'), slots: ['hinge', 'push2', 'pulldown', 'lunge', 'triceps', 'rear', 'core2'] },
      { key: 'C', kind: 'full', name: N('Full body C', 'Hele kroppen C'), slots: ['lunge', 'press', 'row', 'fly', 'legcurl', 'biceps2', 'core'] },
    ],
  },
  ul4: {
    name: N('Upper / lower', 'Over / under'),
    tag: N('4 days', '4 dager'),
    sub: N('Upper body one day, legs the next. More exercises per muscle, for when eating and energy are steady.', 'Overkropp én dag, bein neste. Flere øvelser per muskel, for når maten og energien er stabil.'),
    days: [0, 1, 3, 4],
    sessions: [
      { key: 'UA', kind: 'upper', name: N('Upper A', 'Overkropp A'), slots: ['push', 'row', 'press', 'side', 'biceps', 'triceps', 'rear'] },
      { key: 'LA', kind: 'lower', name: N('Lower A', 'Underkropp A'), slots: ['squat', 'hinge', 'lunge', 'calves', 'core', 'legcurl'] },
      { key: 'UB', kind: 'upper', name: N('Upper B', 'Overkropp B'), slots: ['push2', 'pulldown', 'side', 'fly', 'triceps2', 'biceps2', 'rear'] },
      { key: 'LB', kind: 'lower', name: N('Lower B', 'Underkropp B'), slots: ['hinge', 'lunge', 'squat', 'glute', 'calves', 'core2'] },
    ],
  },
};
export const PROGRAM_ORDER = ['start2', 'full3', 'ul4'];

// An easier and a harder version of the same movement (for "too hard today" / "too easy").
export const EASIER = {
  pushup: 'incline', bwsquat: 'chairsquat', lunge: 'stepup', splitsquat: 'lunge', singlebridge: 'bridge', pikepush: 'yraise',
  diamond: 'incline', plank: 'deadbug', benchdip: 'incline', squat: 'bwsquat', dbpress: 'pushup', rdl: 'bridge',
};
export const HARDER = {
  incline: 'pushup', chairsquat: 'bwsquat', bwsquat: 'splitsquat', stepup: 'lunge', lunge: 'splitsquat', bridge: 'singlebridge',
  yraise: 'pikepush', deadbug: 'plank', pushup: 'diamond',
};
