// Vektplan — app entry: routing, events, startup.
import { load, S } from './store.js';
import { setLang, tr } from './i18n.js';
import { applyTheme } from './theme.js';
import { nav } from './nav.js';
import { initUpdates, onUpdate, forceRefresh } from './updates.js';
import { closeSheet, sheetOpen, toast } from './ui.js';
import { esc } from './util.js';
import * as today from './views/today.js';
import * as food from './views/food.js';
import * as recipe from './views/recipe.js';
import * as log from './views/log.js';
import * as train from './views/train.js';
import * as workout from './views/workout.js';
import * as progress from './views/progress.js';
import * as coach from './views/coach.js';
import * as settings from './views/settings.js';
import * as setup from './views/setup.js';
import * as health from './views/health.js';
import { checkReturn } from './views/health.js';
import * as plan from './views/plan.js';
import * as session from './views/session.js';
import * as fuel from './views/fuel.js';
import * as program from './views/program.js';
import * as guide from './views/guide.js';

const VIEWS = { today, food, recipe, log, train, workout, progress, coach, settings, setup, health, plan, session, fuel, program, guide };
const app = document.getElementById('app');

let current = null;
let currentName = '';
let currentCtx = { name: 'today', params: [] };
let currentHash = null;

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  return { name: parts[0] || 'today', params: parts.slice(1) };
}

function isTyping() {
  const a = document.activeElement;
  return !!a && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
}

function render() {
  const st = S();
  let { name, params } = parse();
  if (!st.profile.onboarded && name !== 'setup') {
    location.replace('#/setup');
    return;
  }
  if (st.profile.onboarded && name === 'setup') {
    location.replace('#/today');
    return;
  }
  if (!VIEWS[name]) name = 'today';
  const view = VIEWS[name];
  const ctx = { name, params };
  const changed = location.hash !== currentHash;
  try {
    if (changed) {
      current?.unmount?.();
      closeSheet(true);
      view.enter?.(ctx);
    }
    const y = changed ? 0 : nav.scroller()?.scrollTop || 0;
    app.innerHTML = view.render(ctx);
    current = view;
    currentName = name;
    currentCtx = ctx;
    currentHash = location.hash;
    const sc = nav.scroller();
    if (sc) {
      if (!changed) sc.style.animation = 'none'; // only animate when you actually go to a new screen
      sc.scrollTop = y;
    }
    view.mount?.(app, ctx);
  } catch (err) {
    console.error(err);
    showError(err);
  }
}

function showError(err) {
  app.innerHTML = `<div class="screen no-tabs" style="justify-content:center">
    <h1 class="h1">${tr('Something went wrong', 'Noe gikk galt')}</h1>
    <p class="soft">${tr('Your data is safe. Try going back to Today, or reload the app.', 'Dataene dine er trygge. Prøv å gå tilbake til I dag, eller last appen på nytt.')}</p>
    <pre class="tiny muted" style="white-space:pre-wrap;background:var(--surface);padding:12px;border-radius:12px">${esc(String(err && (err.stack || err.message) || err)).slice(0, 600)}</pre>
    <a class="btn primary" href="#/today">${tr('Go to Today', 'Gå til I dag')}</a>
    <button class="btn secondary" id="err-reload">${tr('Reload the app', 'Last appen på nytt')}</button></div>`;
  document.getElementById('err-reload')?.addEventListener('click', () => forceRefresh());
}

nav.rerender = () => render();

function delegate(type, attr) {
  return (e) => {
    const el = e.target.closest(`[data-${attr}]`);
    if (!el || !app.contains(el)) return;
    const fn = current?.actions?.[el.dataset[attr]];
    if (!fn) return;
    if (type === 'click') e.preventDefault();
    try {
      const out = fn(el, e, currentCtx);
      if (out && typeof out.catch === 'function') out.catch((err) => { console.error(err); toast(tr('Something went wrong.', 'Noe gikk galt.')); });
    } catch (err) {
      console.error(err);
      toast(tr('Something went wrong.', 'Noe gikk galt.'));
    }
  };
}

app.addEventListener('click', delegate('click', 'act'));
app.addEventListener('input', delegate('input', 'input'));
app.addEventListener('change', delegate('change', 'change'));

window.addEventListener('hashchange', () => {
  const h = location.hash;
  const st = nav.stack;
  if (st.length > 1 && st[st.length - 2] === h) st.pop();
  else st.push(h);
  if (st.length > 50) st.splice(0, st.length - 50);
  render();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!sheetOpen() && !isTyping() && currentName !== 'log' && currentName !== 'coach') render();
  checkReturn(); // back from the Apple Health shortcut?
});
window.addEventListener('pageshow', () => checkReturn());

onUpdate((u) => {
  if ((u.status === 'ready' || u.status === 'available') && (currentName === 'today' || currentName === 'setup') && !sheetOpen() && !isTyping()) render();
});

// iOS 26 home-screen apps can leave the view shifted after the keyboard closes, which pushes
// the bottom bar off screen. The page itself never scrolls, so snapping it back to 0 is safe.
function resetViewport() {
  if (isTyping()) return;
  if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
document.addEventListener('focusout', () => setTimeout(resetViewport, 60));
window.visualViewport?.addEventListener('resize', () => setTimeout(resetViewport, 60));
window.addEventListener('orientationchange', () => setTimeout(resetViewport, 300));

window.addEventListener('unhandledrejection', (e) => console.warn('Unhandled', e.reason));

// ---- Start ----
load();
setLang(S().prefs.lang);
applyTheme();
if (!location.hash) history.replaceState(null, '', '#/today');
nav.stack = [location.hash];
render();
initUpdates();
