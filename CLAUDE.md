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

## Data
All user data is in `localStorage['vektplan.v1']` (see `js/store.js`). Keep changes backward compatible:
add fields with defaults in `defaults()`; never rename existing ones without a migration in `migrate()`.
