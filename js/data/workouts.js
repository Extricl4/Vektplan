// Beginner-friendly sessions. Work at an easy pace; stop if your stomach says no.
const N = (en, nb) => ({ en, nb });

export const EXERCISES = {
  squat: {
    name: N('Goblet squat', 'Knebøy med vekt'), mode: 'reps', def: 10, area: N('legs', 'bein'),
    cue: N('Hold a weight or a full water bottle at your chest. Sit back like you are lowering into a chair, then stand up tall.', 'Hold en vekt eller en full vannflaske foran brystet. Sett deg bakover som mot en stol, og reis deg opp igjen.'),
  },
  pushup: {
    name: N('Push-ups (knees are fine)', 'Armhevinger (gjerne på knærne)'), mode: 'reps', def: 8, area: N('chest', 'bryst'),
    cue: N('Hands under your shoulders, body in a straight line. Lower your chest toward the floor, then push back up.', 'Hendene under skuldrene, kroppen rett. Senk brystet mot gulvet og press deg opp igjen.'),
  },
  row: {
    name: N('One-arm row', 'Roing med én arm'), mode: 'reps', def: 10, area: N('back', 'rygg'),
    cue: N('One hand and knee on a chair or bench. Pull the weight up toward your hip, then lower it slowly. Do both sides.', 'Én hånd og ett kne på en stol eller benk. Trekk vekten opp mot hoften og senk rolig. Ta begge sider.'),
  },
  bridge: {
    name: N('Glute bridge', 'Seteløft'), mode: 'reps', def: 12, area: N('hips', 'hofter'),
    cue: N('Lie on your back with knees bent. Push through your heels, lift your hips, squeeze, then lower.', 'Ligg på ryggen med bøyde knær. Press gjennom hælene, løft hoftene, klem og senk.'),
  },
  plank: {
    name: N('Plank', 'Planken'), mode: 'time', def: 25, area: N('core', 'mage'),
    cue: N('Forearms on the floor, body straight from head to heels. Breathe calmly.', 'Underarmene i gulvet, kroppen rett fra hode til hæl. Pust rolig.'),
  },
  lunge: {
    name: N('Reverse lunge', 'Utfall bakover'), mode: 'reps', def: 8, area: N('legs', 'bein'),
    cue: N('Step one foot back and lower your back knee toward the floor. Push back up. Alternate legs.', 'Ta et steg bakover og senk det bakre kneet mot gulvet. Press deg opp igjen. Bytt bein.'),
  },
  press: {
    name: N('Shoulder press', 'Skulderpress'), mode: 'reps', def: 10, area: N('shoulders', 'skuldre'),
    cue: N('Hold weights at shoulder height and press them overhead, then lower slowly. Sitting is fine.', 'Hold vektene i skulderhøyde, press dem over hodet og senk rolig. Gjerne sittende.'),
  },
  rdl: {
    name: N('Romanian deadlift', 'Rumensk markløft'), mode: 'reps', def: 10, area: N('back of legs', 'baksiden av beina'),
    cue: N('Hold weights in front of your thighs. Push your hips back with soft knees, slide the weights down your legs, then stand tall.', 'Hold vektene foran lårene. Skyv hoftene bakover med myke knær, la vektene gli nedover beina, og reis deg opp.'),
  },
  incline: {
    name: N('Incline push-up', 'Armhevinger mot benk'), mode: 'reps', def: 10, area: N('chest', 'bryst'),
    cue: N('Hands on a bench, table or kitchen counter. Lower your chest toward it, then push away.', 'Hendene på en benk, et bord eller kjøkkenbenken. Senk brystet mot kanten og press deg ut igjen.'),
  },
  deadbug: {
    name: N('Dead bug', 'Dead bug'), mode: 'reps', def: 10, area: N('core', 'mage'),
    cue: N('Lie on your back, arms up, knees bent at 90°. Slowly lower the opposite arm and leg, then switch.', 'Ligg på ryggen med armene opp og knærne i 90°. Senk motsatt arm og bein rolig, og bytt.'),
  },
  catcow: {
    name: N('Cat–cow', 'Katt og ku'), mode: 'time', def: 45, area: N('back', 'rygg'),
    cue: N('On hands and knees, slowly round and arch your back in time with your breath.', 'Stå på alle fire og skyt rygg og svai rolig i takt med pusten.'),
  },
  child: {
    name: N("Child's pose", 'Barnets stilling'), mode: 'time', def: 45, area: N('back', 'rygg'),
    cue: N('Sit back on your heels, arms forward and forehead down. Breathe slowly into your belly.', 'Sett deg bakover på hælene, armene fram og pannen ned. Pust rolig ned i magen.'),
  },
  hipflexor: {
    name: N('Hip flexor stretch', 'Tøy hoftebøyeren'), mode: 'time', def: 40, area: N('hips', 'hofter'),
    cue: N('Kneel on one knee and gently push your hips forward. Switch sides halfway.', 'Stå på ett kne og skyv hoftene rolig fram. Bytt side halvveis.'),
  },
  hamstring: {
    name: N('Hamstring stretch', 'Tøy baksiden av lårene'), mode: 'time', def: 40, area: N('legs', 'bein'),
    cue: N('Sit with one leg straight and reach gently toward your toes. Switch sides halfway.', 'Sitt med ett bein strakt og strekk deg rolig mot tærne. Bytt side halvveis.'),
  },
  chest: {
    name: N('Chest opener', 'Bryståpner'), mode: 'time', def: 30, area: N('chest', 'bryst'),
    cue: N('Clasp your hands behind your back and gently open your chest. Keep your shoulders soft.', 'Fold hendene bak ryggen og åpne brystet rolig. Hold skuldrene avslappet.'),
  },
  breathing: {
    name: N('Belly breathing', 'Magepust'), mode: 'time', def: 60, area: N('calm', 'ro'),
    cue: N('Lie down with a hand on your belly. Breathe in through your nose for 4, out for 6. It can help calm the stomach.', 'Ligg med en hånd på magen. Pust inn gjennom nesen på 4, ut på 6. Det kan roe magen.'),
  },
};

export const WORKOUTS = {
  strengthA: { name: N('Strength A', 'Styrke A'), sub: N('Full body', 'Hele kroppen'), minutes: 30, kind: 'strength', ex: ['squat', 'pushup', 'row', 'bridge', 'plank'] },
  strengthB: { name: N('Strength B', 'Styrke B'), sub: N('Full body', 'Hele kroppen'), minutes: 30, kind: 'strength', ex: ['lunge', 'press', 'rdl', 'incline', 'deadbug'] },
  stretch: { name: N('Gentle stretch', 'Rolig tøying'), sub: N('Calm body, calm stomach', 'Rolig kropp, rolig mage'), minutes: 12, kind: 'mobility', ex: ['catcow', 'child', 'hipflexor', 'hamstring', 'chest', 'breathing'] },
  walk: { name: N('Walk', 'Gåtur'), sub: N('Easy on the stomach', 'Skånsomt for magen'), minutes: 20, kind: 'walk', ex: [] },
};

// Weekly rhythm, Monday first. Strength days alternate A and B week to week.
export const WEEK_PLAN = ['strength', 'walk', 'strength', 'stretch', 'strength', 'walk', 'rest'];

export const OTHER_ACTIVITIES = [
  { id: 'walk', name: N('Walk', 'Gåtur') },
  { id: 'cycling', name: N('Cycling', 'Sykling') },
  { id: 'gym', name: N('Gym', 'Treningssenter') },
  { id: 'football', name: N('Football', 'Fotball') },
  { id: 'swim', name: N('Swimming', 'Svømming') },
  { id: 'other', name: N('Something else', 'Noe annet') },
];
