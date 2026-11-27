// Exercise library, tagged by muscle group and equipment, for building your own plan.
// The first group is the main one. `pri` = how central it is (0 = main lift, higher = accessory).
// Ids used by the old built-in sessions (squat, pushup, row, ...) are kept so history still reads.
const N = (en, nb) => ({ en, nb });

export const GROUPS = {
  chest: N('Chest', 'Bryst'),
  back: N('Back', 'Rygg'),
  shoulders: N('Shoulders', 'Skuldre'),
  biceps: N('Biceps', 'Biceps'),
  triceps: N('Triceps', 'Triceps'),
  legs: N('Legs', 'Bein'),
  glutes: N('Glutes', 'Sete'),
  core: N('Core', 'Kjerne'),
  mobility: N('Mobility', 'Bevegelighet'),
};
export const GROUP_ORDER = ['legs', 'chest', 'back', 'shoulders', 'glutes', 'biceps', 'triceps', 'core', 'mobility'];

export const EQUIP = {
  none: N('No equipment', 'Uten utstyr'),
  dumbbell: N('Dumbbells', 'Manualer'),
  barbell: N('Barbell', 'Vektstang'),
  machine: N('Machine', 'Maskin'),
  cable: N('Cable', 'Kabel'),
  bar: N('Pull-up bar', 'Pull-up-stang'),
  kettlebell: N('Kettlebell', 'Kettlebell'),
  band: N('Resistance bands', 'Treningsstrikk'),
};
// The order equipment is listed in when you choose what you have.
export const EQUIP_ORDER = ['dumbbell', 'kettlebell', 'band', 'bar', 'barbell', 'machine', 'cable'];

// Where you train decides which equipment the plan uses.
export const PLACES = {
  home: { name: N('Home', 'Hjemme'), sub: N('Body weight, a chair and the floor, plus any equipment you have', 'Kroppsvekt, en stol og gulvet, pluss utstyret du har'), equip: ['none'] },
  gym: { name: N('Gym', 'Treningssenter'), sub: N('Machines, cables, bars and weights', 'Maskiner, kabler, stenger og vekter'), equip: ['none', 'dumbbell', 'barbell', 'machine', 'cable', 'bar', 'kettlebell', 'band'] },
  // Older versions had a separate "home with dumbbells" place; it now means home with dumbbells ticked.
  dumbbells: { name: N('Home with dumbbells', 'Hjemme med manualer'), sub: N('A pair of dumbbells, maybe a bench', 'Et par manualer, kanskje en benk'), equip: ['none', 'dumbbell'], hidden: true },
};
export const PLACE_ORDER = ['home', 'gym'];

const X = (groups, equip, mode, def, pri, name, cue) => ({ groups, equip, mode, def, pri, name, cue });

export const LIB = {
  // ---------- Legs ----------
  bwsquat: X(['legs', 'glutes'], ['none'], 'reps', 12, 1, N('Bodyweight squat', 'Knebøy uten vekt'),
    N('Feet shoulder-width apart. Sit back and down like onto a chair, chest up, then stand tall.', 'Føttene i skulderbredde. Sett deg bakover og ned som mot en stol, brystet opp, og reis deg.')),
  chairsquat: X(['legs', 'glutes'], ['none'], 'reps', 10, 2, N('Chair squat', 'Knebøy til stol'),
    N('Stand in front of a chair. Sit down slowly until you just touch it, then stand up tall. The easiest way to start squatting.', 'Stå foran en stol. Sett deg rolig ned til du så vidt kjenner den, og reis deg helt opp. Den enkleste måten å begynne med knebøy.')),
  squat: X(['legs', 'glutes'], ['dumbbell', 'kettlebell'], 'reps', 10, 1, N('Goblet squat', 'Knebøy med manual'),
    N('Hold a dumbbell at your chest. Sit back like you are lowering into a chair, then stand up tall.', 'Hold en manual foran brystet. Sett deg bakover som mot en stol, og reis deg opp igjen.')),
  bbsquat: X(['legs', 'glutes'], ['barbell'], 'reps', 8, 0, N('Barbell squat', 'Knebøy med stang'),
    N('Bar on your upper back, brace your belly, sit down between your heels and drive up. Start light.', 'Stanga på øvre del av ryggen, stram magen, sett deg ned mellom hælene og press opp. Start lett.')),
  legpress: X(['legs', 'glutes'], ['machine'], 'reps', 10, 1, N('Leg press', 'Beinpress'),
    N('Feet hip-width on the plate. Lower until your knees are near your chest, then push away without locking your knees.', 'Føttene i hoftebredde på platen. Senk til knærne er nær brystet, og press ut uten å låse knærne.')),
  lunge: X(['legs', 'glutes'], ['none', 'dumbbell', 'kettlebell'], 'reps', 8, 2, N('Reverse lunge', 'Utfall bakover'),
    N('Step one foot back and lower your back knee toward the floor. Push back up. Alternate legs.', 'Ta et steg bakover og senk det bakre kneet mot gulvet. Press deg opp igjen. Bytt bein.')),
  splitsquat: X(['legs', 'glutes'], ['none', 'dumbbell', 'kettlebell'], 'reps', 8, 2, N('Bulgarian split squat', 'Bulgarsk utfall'),
    N('Back foot on a chair or sofa. Lower straight down on the front leg, then push up. Both sides.', 'Bakre fot på en stol eller sofa. Senk deg rett ned på fremre bein, og press opp. Begge sider.')),
  stepup: X(['legs', 'glutes'], ['none', 'dumbbell', 'kettlebell'], 'reps', 10, 3, N('Step-up', 'Step-up'),
    N('Step up onto a sturdy chair or the stairs with one foot, stand tall, step down slowly. Switch legs.', 'Gå opp på en stødig stol eller trapp med én fot, rett deg opp, og gå rolig ned. Bytt bein.')),
  legext: X(['legs'], ['machine'], 'reps', 12, 3, N('Leg extension', 'Beinspark i maskin'),
    N('Sit tall, kick your legs straight, squeeze the front of your thighs, lower slowly.', 'Sitt rett, spark beina ut, klem forsiden av lårene, og senk rolig.')),
  legcurl: X(['legs'], ['machine'], 'reps', 12, 3, N('Leg curl', 'Lårcurl i maskin'),
    N('Curl your heels toward your seat, pause, then let them back slowly.', 'Bøy hælene mot setet, hold et øyeblikk, og slipp rolig tilbake.')),
  rdl: X(['legs', 'glutes', 'back'], ['dumbbell', 'barbell', 'kettlebell'], 'reps', 10, 2, N('Romanian deadlift', 'Rumensk markløft'),
    N('Weights in front of your thighs. Push your hips back with soft knees, slide the weights down your legs, then stand tall.', 'Vektene foran lårene. Skyv hoftene bakover med myke knær, la vektene gli nedover beina, og reis deg opp.')),
  deadlift: X(['legs', 'back', 'glutes'], ['barbell'], 'reps', 6, 1, N('Deadlift', 'Markløft'),
    N('Bar over the middle of your feet. Flat back, brace, push the floor away and stand up. Start light and learn the move.', 'Stanga over midten av føttene. Rett rygg, stram magen, press gulvet vekk og reis deg. Start lett og lær bevegelsen.')),
  wallsit: X(['legs'], ['none'], 'time', 30, 4, N('Wall sit', 'Veggsitt'),
    N('Back against a wall, slide down until your knees are bent. Hold and breathe.', 'Ryggen mot veggen, skli ned til knærne er bøyd. Hold og pust.')),
  calfraise: X(['legs'], ['none', 'dumbbell', 'machine'], 'reps', 15, 5, N('Calf raise', 'Tåhev'),
    N('Rise up onto your toes, pause at the top, lower slowly. Hold a wall for balance.', 'Gå opp på tærne, hold litt på toppen, og senk rolig. Hold i en vegg for balanse.')),

  // ---------- Chest ----------
  pushup: X(['chest', 'triceps', 'shoulders'], ['none'], 'reps', 8, 1, N('Push-ups (knees are fine)', 'Armhevinger (gjerne på knærne)'),
    N('Hands under your shoulders, body in a straight line. Lower your chest toward the floor, then push back up.', 'Hendene under skuldrene, kroppen rett. Senk brystet mot gulvet og press deg opp igjen.')),
  incline: X(['chest', 'triceps'], ['none'], 'reps', 10, 2, N('Incline push-up', 'Armhevinger mot benk'),
    N('Hands on a bench, table or kitchen counter. Lower your chest toward it, then push away.', 'Hendene på en benk, et bord eller kjøkkenbenken. Senk brystet mot kanten og press deg ut igjen.')),
  dbpress: X(['chest', 'triceps', 'shoulders'], ['dumbbell'], 'reps', 10, 1, N('Dumbbell bench press', 'Benkpress med manualer'),
    N('Lie on a bench (or the floor) with dumbbells over your chest. Lower to the sides of your chest, then press up.', 'Ligg på en benk (eller gulvet) med manualene over brystet. Senk til siden av brystet, og press opp.')),
  inclinedb: X(['chest', 'shoulders'], ['dumbbell'], 'reps', 10, 2, N('Incline dumbbell press', 'Skråbenk med manualer'),
    N('Bench tilted up a little. Press the dumbbells up over your upper chest, lower with control.', 'Benken litt på skrå. Press manualene opp over øvre del av brystet, og senk kontrollert.')),
  benchpress: X(['chest', 'triceps', 'shoulders'], ['barbell'], 'reps', 8, 0, N('Bench press', 'Benkpress'),
    N('Eyes under the bar, feet planted. Lower the bar to mid-chest, press up. Use a spotter or safety bars.', 'Øynene under stanga, føttene i gulvet. Senk stanga til midten av brystet og press opp. Bruk sikring.')),
  chestpress: X(['chest', 'triceps'], ['machine'], 'reps', 10, 1, N('Chest press machine', 'Brystpress i maskin'),
    N('Handles at chest height. Press forward, pause, and come back slowly.', 'Håndtakene i brysthøyde. Press fram, hold litt, og kom rolig tilbake.')),
  dbfly: X(['chest'], ['dumbbell'], 'reps', 12, 3, N('Dumbbell fly', 'Flyes med manualer'),
    N('Lying down, arms slightly bent. Open your arms wide like a hug, then bring them back over your chest.', 'Liggende, armene litt bøyd. Åpne armene bredt som en klem, og før dem tilbake over brystet.')),
  cablefly: X(['chest'], ['cable'], 'reps', 12, 3, N('Cable fly', 'Flyes i kabel'),
    N('Step forward between the cables and bring your hands together in front of your chest.', 'Gå et steg fram mellom kablene og før hendene sammen foran brystet.')),

  // ---------- Back ----------
  row: X(['back', 'biceps'], ['dumbbell', 'kettlebell'], 'reps', 10, 1, N('One-arm dumbbell row', 'Roing med manual'),
    N('One hand and knee on a bench or chair. Pull the weight up toward your hip, lower slowly. Both sides.', 'Én hånd og ett kne på en benk eller stol. Trekk vekten opp mot hoften og senk rolig. Begge sider.')),
  doorrow: X(['back', 'biceps'], ['none'], 'reps', 10, 1, N('Doorframe row', 'Roing i dørkarm'),
    N('Hold a sturdy doorframe, lean back with straight arms, then pull your chest toward the frame.', 'Hold i en stødig dørkarm, len deg bakover med strake armer, og trekk brystet mot karmen.')),
  superman: X(['back', 'glutes'], ['none'], 'reps', 10, 2, N('Superman', 'Superman'),
    N('Lie on your stomach. Lift arms and legs a little off the floor, hold for a breath, lower.', 'Ligg på magen. Løft armer og bein litt fra gulvet, hold et pust, og senk.')),
  snowangel: X(['back', 'shoulders'], ['none'], 'reps', 10, 3, N('Reverse snow angel', 'Omvendt snøengel'),
    N('Lie face down, arms by your sides. Lift them slightly and sweep them overhead and back.', 'Ligg på magen med armene langs siden. Løft dem litt og før dem i en bue over hodet og tilbake.')),
  latpull: X(['back', 'biceps'], ['cable', 'machine'], 'reps', 10, 0, N('Lat pulldown', 'Nedtrekk'),
    N('Wide grip. Pull the bar to your upper chest, elbows down, then let it up slowly.', 'Bredt grep. Trekk stanga ned til øvre del av brystet med albuene ned, og slipp rolig opp.')),
  seatedrow: X(['back', 'biceps'], ['cable', 'machine'], 'reps', 10, 1, N('Seated row', 'Sittende roing'),
    N('Sit tall, pull the handle to your belly, squeeze your shoulder blades, return slowly.', 'Sitt rett, trekk håndtaket inn mot magen, klem skulderbladene, og slipp rolig.')),
  pullup: X(['back', 'biceps'], ['bar'], 'reps', 5, 1, N('Pull-up (assisted is fine)', 'Pull-ups (gjerne med hjelp)'),
    N('Hang from the bar and pull your chest up toward it. A band or the assist machine makes it easier.', 'Heng i stanga og trekk brystet opp mot den. Strikk eller assistert maskin gjør det lettere.')),
  bbrow: X(['back', 'biceps'], ['barbell'], 'reps', 8, 1, N('Barbell row', 'Roing med stang'),
    N('Lean forward with a flat back. Pull the bar to your lower ribs, lower with control.', 'Len deg fram med rett rygg. Trekk stanga opp mot de nederste ribbeina, og senk kontrollert.')),

  // ---------- Shoulders ----------
  press: X(['shoulders', 'triceps'], ['dumbbell', 'kettlebell'], 'reps', 10, 1, N('Dumbbell shoulder press', 'Skulderpress med manualer'),
    N('Weights at shoulder height. Press them overhead, then lower slowly. Sitting is fine.', 'Vektene i skulderhøyde. Press dem over hodet og senk rolig. Gjerne sittende.')),
  pikepush: X(['shoulders', 'triceps'], ['none'], 'reps', 6, 1, N('Pike push-up', 'Pike-armhevinger'),
    N('Hips high like an upside-down V. Bend your elbows to lower your head toward the floor, push back up.', 'Hoftene høyt som en opp-ned V. Bøy albuene og senk hodet mot gulvet, og press opp.')),
  yraise: X(['shoulders', 'back'], ['none'], 'reps', 10, 2, N('Lying Y-raise', 'Y-løft på magen'),
    N('Lie face down, arms in a Y over your head, thumbs up. Lift your arms a little, hold, lower.', 'Ligg på magen med armene i en Y over hodet, tomlene opp. Løft armene litt, hold, og senk.')),
  lateral: X(['shoulders'], ['dumbbell', 'cable'], 'reps', 12, 2, N('Lateral raise', 'Sidehev'),
    N('Light weights by your sides. Raise your arms out to shoulder height, lower slowly.', 'Lette vekter langs siden. Løft armene ut til skulderhøyde, og senk rolig.')),
  rearfly: X(['shoulders', 'back'], ['dumbbell', 'cable', 'machine'], 'reps', 12, 3, N('Rear delt fly', 'Omvendt flyes'),
    N('Lean forward, arms hanging. Open your arms out to the sides, squeeze your upper back.', 'Len deg fram med armene hengende. Åpne armene ut til siden og klem øvre del av ryggen.')),
  machpress: X(['shoulders', 'triceps'], ['machine'], 'reps', 10, 1, N('Shoulder press machine', 'Skulderpress i maskin'),
    N('Sit tall, press the handles overhead, lower with control.', 'Sitt rett, press håndtakene opp, og senk kontrollert.')),
  facepull: X(['shoulders', 'back'], ['cable'], 'reps', 12, 2, N('Face pull', 'Face pull'),
    N('Rope at face height. Pull it toward your eyes with elbows high, pause, return.', 'Tauet i ansiktshøyde. Trekk det mot øynene med høye albuer, hold litt, og slipp.')),

  // ---------- Biceps ----------
  bagcurl: X(['biceps'], ['none'], 'reps', 12, 1, N('Backpack curl', 'Curl med sekk'),
    N('Fill a backpack with books, hold it by the top handle and curl it up toward your shoulder. Both arms.', 'Fyll en sekk med bøker, hold i stroppen og bøy den opp mot skulderen. Begge armer.')),
  curl: X(['biceps'], ['dumbbell'], 'reps', 10, 1, N('Dumbbell curl', 'Bicepscurl'),
    N('Elbows by your sides. Curl the weights up, squeeze, lower slowly.', 'Albuene inntil kroppen. Bøy vektene opp, klem, og senk rolig.')),
  hammer: X(['biceps'], ['dumbbell'], 'reps', 10, 2, N('Hammer curl', 'Hammercurl'),
    N('Palms facing each other. Curl up without swinging, lower slowly.', 'Håndflatene mot hverandre. Bøy opp uten å svinge, og senk rolig.')),
  bbcurl: X(['biceps'], ['barbell'], 'reps', 10, 1, N('Barbell curl', 'Curl med stang'),
    N('Shoulder-width grip. Curl the bar up, keep your elbows still, lower slowly.', 'Grep i skulderbredde. Bøy stanga opp med albuene i ro, og senk rolig.')),
  cablecurl: X(['biceps'], ['cable'], 'reps', 12, 2, N('Cable curl', 'Curl i kabel'),
    N('Stand close to the cable, elbows by your sides, curl up and lower slowly.', 'Stå nær kabelen med albuene inntil kroppen, bøy opp og senk rolig.')),
  chinup: X(['biceps', 'back'], ['bar'], 'reps', 5, 1, N('Chin-up (assisted is fine)', 'Chin-ups (gjerne med hjelp)'),
    N('Palms facing you. Pull your chin over the bar, lower slowly. A band helps.', 'Håndflatene mot deg. Trekk haken over stanga, og senk rolig. En strikk hjelper.')),

  // ---------- Triceps ----------
  benchdip: X(['triceps', 'chest'], ['none'], 'reps', 10, 1, N('Chair dips', 'Dips på stol'),
    N('Hands on the edge of a sturdy chair behind you. Bend your elbows to lower, push back up.', 'Hendene på kanten av en stødig stol bak deg. Bøy albuene og senk deg, og press opp igjen.')),
  diamond: X(['triceps', 'chest'], ['none'], 'reps', 8, 2, N('Close push-ups', 'Smale armhevinger'),
    N('Push-ups with your hands close together. Knees on the floor is fine.', 'Armhevinger med hendene tett sammen. Gjerne på knærne.')),
  ohext: X(['triceps'], ['dumbbell', 'kettlebell'], 'reps', 10, 1, N('Overhead triceps extension', 'Triceps over hodet'),
    N('Hold one dumbbell overhead with both hands. Lower it behind your head, then straighten your arms.', 'Hold én manual over hodet med begge hender. Senk den bak hodet, og strekk armene.')),
  skull: X(['triceps'], ['dumbbell', 'barbell'], 'reps', 10, 2, N('Lying triceps extension', 'Liggende triceps'),
    N('Lying down, weights over your chest. Bend only at the elbows toward your forehead, then straighten.', 'Liggende med vektene over brystet. Bøy bare i albuene ned mot pannen, og strekk.')),
  pushdown: X(['triceps'], ['cable'], 'reps', 12, 1, N('Triceps pushdown', 'Triceps i kabel'),
    N('Elbows by your sides. Push the bar or rope down until your arms are straight, return slowly.', 'Albuene inntil kroppen. Press stanga eller tauet ned til armene er strake, og slipp rolig.')),

  // ---------- Glutes ----------
  bridge: X(['glutes', 'legs'], ['none'], 'reps', 12, 1, N('Glute bridge', 'Seteløft'),
    N('Lie on your back with knees bent. Push through your heels, lift your hips, squeeze, then lower.', 'Ligg på ryggen med bøyde knær. Press gjennom hælene, løft hoftene, klem og senk.')),
  singlebridge: X(['glutes'], ['none'], 'reps', 8, 2, N('Single-leg glute bridge', 'Seteløft på ett bein'),
    N('Like a glute bridge, with one foot lifted. Both sides.', 'Som seteløft, men med én fot løftet. Begge sider.')),
  hipthrust: X(['glutes', 'legs'], ['dumbbell', 'barbell', 'machine'], 'reps', 10, 0, N('Hip thrust', 'Hip thrust'),
    N('Upper back on a bench or sofa, weight on your hips. Drive your hips up, squeeze, lower.', 'Øvre del av ryggen mot en benk eller sofa, vekten på hoftene. Press hoftene opp, klem, og senk.')),
  donkey: X(['glutes'], ['none'], 'reps', 12, 3, N('Donkey kick', 'Eselspark'),
    N('On hands and knees, kick one foot up toward the ceiling with the knee bent. Both sides.', 'Stå på alle fire og spark én fot opp mot taket med bøyd kne. Begge sider.')),
  clamshell: X(['glutes'], ['none'], 'reps', 15, 3, N('Clamshell', 'Musling'),
    N('Lie on your side, knees bent. Open your top knee like a clamshell, keep your feet together.', 'Ligg på siden med bøyde knær. Åpne det øverste kneet som et skjell, med føttene sammen.')),
  kickback: X(['glutes'], ['cable'], 'reps', 12, 2, N('Cable kickback', 'Kickback i kabel'),
    N('Strap on your ankle. Kick the leg straight back, squeeze, return slowly. Both sides.', 'Strikk eller stropp på ankelen. Spark beinet rett bakover, klem, og før det rolig tilbake. Begge sider.')),

  // ---------- Core ----------
  plank: X(['core'], ['none'], 'time', 25, 1, N('Plank', 'Planken'),
    N('Forearms on the floor, body straight from head to heels. Breathe calmly.', 'Underarmene i gulvet, kroppen rett fra hode til hæl. Pust rolig.')),
  deadbug: X(['core'], ['none'], 'reps', 10, 1, N('Dead bug', 'Dead bug'),
    N('Lie on your back, arms up, knees bent at 90°. Slowly lower the opposite arm and leg, then switch.', 'Ligg på ryggen med armene opp og knærne i 90°. Senk motsatt arm og bein rolig, og bytt.')),
  sideplank: X(['core'], ['none'], 'time', 20, 2, N('Side plank', 'Sideplanke'),
    N('On one forearm, body in a straight line, hips up. Both sides.', 'På én underarm, kroppen rett og hoftene oppe. Begge sider.')),
  birddog: X(['core', 'back'], ['none'], 'reps', 10, 2, N('Bird dog', 'Fuglehund'),
    N('On hands and knees, reach one arm forward and the opposite leg back. Hold, then switch.', 'Stå på alle fire, strekk én arm fram og motsatt bein bak. Hold, og bytt.')),
  crunch: X(['core'], ['none'], 'reps', 12, 3, N('Crunch', 'Crunch'),
    N('Lie on your back, knees bent. Curl your shoulders off the floor, lower slowly. Skip it if your stomach complains.', 'Ligg på ryggen med bøyde knær. Rull skuldrene opp fra gulvet, og senk rolig. Dropp den hvis magen protesterer.')),
  legraise: X(['core'], ['none'], 'reps', 10, 3, N('Lying leg raise', 'Beinløft liggende'),
    N('Lie flat, hands under your hips. Raise straight legs up, lower slowly without touching the floor.', 'Ligg flatt med hendene under hoftene. Løft strake bein opp, og senk rolig uten å treffe gulvet.')),
  hangraise: X(['core'], ['bar'], 'reps', 8, 2, N('Hanging knee raise', 'Hengende kneløft'),
    N('Hang from a bar and pull your knees up toward your chest, lower with control.', 'Heng i en stang og trekk knærne opp mot brystet, og senk kontrollert.')),
  cablecrunch: X(['core'], ['cable'], 'reps', 12, 3, N('Cable crunch', 'Crunch i kabel'),
    N('Kneel facing the cable, rope by your head. Curl down toward your knees, return slowly.', 'Stå på knærne mot kabelen med tauet ved hodet. Rull ned mot knærne, og tilbake rolig.')),

  // ---------- Mobility (gentle stretch session) ----------
  catcow: X(['mobility'], ['none'], 'time', 45, 9, N('Cat–cow', 'Katt og ku'),
    N('On hands and knees, slowly round and arch your back in time with your breath.', 'Stå på alle fire og skyt rygg og svai rolig i takt med pusten.')),
  child: X(['mobility'], ['none'], 'time', 45, 9, N("Child's pose", 'Barnets stilling'),
    N('Sit back on your heels, arms forward and forehead down. Breathe slowly into your belly.', 'Sett deg bakover på hælene, armene fram og pannen ned. Pust rolig ned i magen.')),
  hipflexor: X(['mobility'], ['none'], 'time', 40, 9, N('Hip flexor stretch', 'Tøy hoftebøyeren'),
    N('Kneel on one knee and gently push your hips forward. Switch sides halfway.', 'Stå på ett kne og skyv hoftene rolig fram. Bytt side halvveis.')),
  hamstring: X(['mobility'], ['none'], 'time', 40, 9, N('Hamstring stretch', 'Tøy baksiden av lårene'),
    N('Sit with one leg straight and reach gently toward your toes. Switch sides halfway.', 'Sitt med ett bein strakt og strekk deg rolig mot tærne. Bytt side halvveis.')),
  chest: X(['mobility'], ['none'], 'time', 30, 9, N('Chest opener', 'Bryståpner'),
    N('Clasp your hands behind your back and gently open your chest. Keep your shoulders soft.', 'Fold hendene bak ryggen og åpne brystet rolig. Hold skuldrene avslappet.')),
  breathing: X(['mobility'], ['none'], 'time', 60, 9, N('Belly breathing', 'Magepust'),
    N('Lie down with a hand on your belly. Breathe in through your nose for 4, out for 6. It can help calm the stomach.', 'Ligg med en hånd på magen. Pust inn gjennom nesen på 4, ut på 6. Det kan roe magen.')),
  // ---------- Resistance bands and a pull-up bar ----------
  bandrow: X(['back', 'biceps'], ['band'], 'reps', 12, 2, N('Band row', 'Roing med strikk'),
    N('Loop the band round your feet or a door handle. Pull your elbows back past your ribs, squeeze, and let it back slowly.', 'Fest strikken rundt føttene eller et dørhåndtak. Trekk albuene bakover forbi ribbeina, klem, og slipp sakte tilbake.')),
  bandpulldown: X(['back', 'biceps'], ['band'], 'reps', 12, 2, N('Band pulldown', 'Nedtrekk med strikk'),
    N('Anchor the band high (top of a door). Pull your elbows down to your sides like a pull-up, then let it up slowly.', 'Fest strikken høyt (toppen av en dør). Trekk albuene ned til siden som en pull-up, og slipp sakte opp.')),
  bandpull: X(['shoulders', 'back'], ['band'], 'reps', 15, 3, N('Band pull-apart', 'Strikk fra hverandre'),
    N('Hold the band in front at shoulder height. Pull it apart until it touches your chest, squeeze the shoulder blades.', 'Hold strikken foran deg i skulderhøyde. Dra den fra hverandre til den treffer brystet, klem skulderbladene.')),
  bandpress: X(['chest', 'triceps'], ['band'], 'reps', 12, 2, N('Band chest press', 'Brystpress med strikk'),
    N('Band behind your back, a handle in each hand. Press forward like a push-up in the air, then back slowly.', 'Strikken bak ryggen, et håndtak i hver hånd. Press fremover som en armhevning i lufta, og sakte tilbake.')),
  bandlateral: X(['shoulders'], ['band'], 'reps', 15, 2, N('Band lateral raise', 'Sidehev med strikk'),
    N('Stand on the band. Lift your arms out to the sides to shoulder height, slow on the way down.', 'Stå på strikken. Løft armene ut til siden til skulderhøyde, sakte ned.')),
  bandcurl: X(['biceps'], ['band'], 'reps', 15, 2, N('Band curl', 'Bicepscurl med strikk'),
    N('Stand on the band, elbows by your sides. Curl up, squeeze, lower slowly.', 'Stå på strikken, albuene inntil kroppen. Bøy opp, klem, senk sakte.')),
  bandpushdown: X(['triceps'], ['band'], 'reps', 15, 2, N('Band pushdown', 'Tricepspress med strikk'),
    N('Anchor the band high. Elbows tight to your sides, push down until your arms are straight.', 'Fest strikken høyt. Albuene inntil kroppen, press ned til armene er strake.')),
  bandwalk: X(['glutes'], ['band'], 'reps', 12, 3, N('Band side steps', 'Sidesteg med strikk'),
    N('Small band round your legs above the knees. Bend a little and step sideways, 12 each way.', 'Liten strikk rundt beina over knærne. Bøy litt og ta steg til siden, 12 hver vei.')),
  negpull: X(['back', 'biceps'], ['bar'], 'reps', 4, 1, N('Slow pull-up lowering', 'Sakte nedfiring fra stang'),
    N('Jump or step up so your chin is over the bar, then lower yourself as slowly as you can (3–5 seconds). Builds strength for real pull-ups.', 'Hopp eller gå opp så haka er over stanga, og senk deg så sakte du klarer (3–5 sekunder). Bygger styrke til ekte pull-ups.')),
};

// Exercises that use added weight get a kg field in the workout.
export const weighted = (ex) => !!ex && ex.mode === 'reps' && ex.equip.some((e) => e !== 'none' && e !== 'bar' && e !== 'band');
// Barbells and machines go up in bigger jumps than dumbbells.
export const kgStep = (ex) => (ex && ex.equip.some((e) => e === 'barbell' || e === 'machine' || e === 'cable') && !ex.equip.includes('dumbbell') ? 2.5 : 1);
