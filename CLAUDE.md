# Vektplan — notes for Claude

Personal iPhone web app for Emil (Norway). Plain HTML/CSS/ES modules, no build step, hosted on
GitHub Pages from `main` (https://extricl4.github.io/Vektplan/). Installed via Safari "Add to Home Screen".

## Who it's for
- Sensitive stomach and nausea for years, follows low-FODMAP, gets full fast, has food anxiety, wants to gain weight gently and get stronger.
- Tone everywhere: calm, warm, no guilt. Never suggest restriction, skipping meals, weight loss or "burning off" food.
- Don't invent calorie targets. The daily goal is optional and set by the user (ideally with a doctor/dietitian). Calm mode hides numbers.
- Recipes/foods must stay low FODMAP per Monash guidance; flag anything uncertain as "check".

## Design
"Daylight": light stone-grey background `#E6E9E7`, off-white cards `#F4F5F3`, calm sky-blue accent, Figtree font,
rounded organic shapes. A dark "Midnight" theme exists. Tokens are CSS variables in `css/app.css`.
UI text is bilingual: `tr('English', 'Norsk')` and `L({ en, nb })`.

## Releasing an update (always do this when changing the app)
1. Make the change.
2. `python3 tools/bump.py X.Y.Z "English notes" "Norske notater"` — bumps `js/version.js`, `version.json`, and `sw.js` (version + offline file list).
3. Commit and push to `main`. The app shows "Update ready"; Settings → Update now installs it.

If you add a new file under `css/`, `js/`, `fonts/` or `icons/`, the bump script picks it up automatically.

## Layout
The page never scrolls: `#app` is a full-height flex column, each `.screen` scrolls inside it and the
`.tabbar` is a normal row at the bottom. Don't go back to `position: fixed` bars or `window.scrollTo`
(iOS 26 home-screen apps misplace fixed bars after the keyboard). Use `nav.scrollTo(y)` / `nav.scroller()`.
Every tab screen must end with `${tabbar('<tab>')}` after its `.screen`.

## Food and training
- Own food lives in `myMeals` (`js/mymeals.js`). `prefs.planSource` picks where meal ideas come from: auto/mix/mine/recipes/free.
  Plan items are `{ rid }` (recipe), `{ my }` (own food), `{ food }` or `{ free: true }`. Today shows ideas, never orders.
- Training plans are in `training` (`js/training.js`): sessions with `{ id, sets, reps }`, `schedule[weekday] = sessionId`,
  `extras[weekday] = 'walk'|'stretch'`. Empty `training.sessions` = the built-in Strength A/B rhythm.
  `workoutDef(id)` gives one shape for own sessions, built-in ones and walks. Workouts save `log[exId] = [{ r, kg }]`.
- Default level is "gentle" (he eats very little): 2 sets, max 5 exercises, 90 s rest, no heavy barbell lifts auto-picked,
  nothing that presses on the stomach (crunches, leg raises) auto-picked.

## Apple Watch
Web apps can't read HealthKit. A Shortcut (guide in `js/views/health.js`) copies Health samples as
`Type;Start;End;Value;Unit` lines; `js/health.js` parses them (English/Norwegian names, ISO or default
dates) into `health.days[YYYY-MM-DD]`. Sleep counts for the day you wake up.
"Get data from the Watch" opens `shortcuts://run-shortcut?name=…`; coming back offers "Bring it in" (clipboard needs a tap).

## Data
All user data is in `localStorage['vektplan.v1']` (see `js/store.js`). Keep changes backward compatible:
add fields with defaults in `defaults()`; never rename existing ones without a migration in `migrate()`.
