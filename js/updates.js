// App updates: the service worker keeps an offline copy of the app.
// When a new version is pushed to GitHub, this finds it and installs it when you tap "Update".
import { APP_VERSION } from './version.js';

let reg = null;
let waiting = null;
const listeners = new Set();

export const update = {
  status: 'idle', // idle | checking | none | available | ready | installing | offline | error
  remote: null,
  notes: null,
  notesNb: null,
  checkedAt: null,
};

function set(status) {
  update.status = status;
  [...listeners].forEach((fn) => {
    try {
      fn(update);
    } catch (e) {
      console.warn(e);
    }
  });
}

export function onUpdate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setWaiting(worker) {
  waiting = worker;
  set('ready');
  maybeAutoApply();
}

// Hassle-free: when you've just opened the app on a main tab (not in a workout, a sheet or a text field),
// a ready update installs by itself. Otherwise it waits for the next time you open the app.
let openedAt = Date.now();
const TABS = ['#/today', '#/food', '#/train', '#/progress', '#/food/diary', '#/food/recipes', ''];
function autoOk() {
  if (document.visibilityState !== 'visible' || Date.now() - openedAt > 20_000) return false;
  if (!TABS.includes(location.hash.split('?')[0])) return false;
  if (document.querySelector('#layer .sheet')) return false;
  const el = document.activeElement;
  if (el && el.matches?.('input, textarea, select')) return false;
  try {
    if (JSON.parse(localStorage.getItem('vektplan.v1') || '{}').activeWorkout) return false;
  } catch (e) { /* ignore */ }
  return true;
}
function maybeAutoApply() {
  if (waiting && autoOk()) applyUpdate();
}

export async function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  try {
    reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (e) {
    console.warn('Service worker failed', e);
    return;
  }
  if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    if (update.status === 'available') set('installing');
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
    });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return; // first install: no reload needed
    reloading = true;
    location.reload();
  });
  setTimeout(() => checkForUpdate(true), 2500);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      openedAt = Date.now();
      if (waiting) maybeAutoApply();
      else checkForUpdate(true);
    }
  });
}

export async function checkForUpdate(quiet = false) {
  if (update.status === 'checking' || update.status === 'installing') return update;
  if (quiet && update.checkedAt && Date.now() - update.checkedAt < 60_000) return update;
  if (!navigator.onLine) {
    if (!quiet) set('offline');
    return update;
  }
  if (!quiet) set('checking');
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    const info = await res.json();
    update.checkedAt = Date.now();
    update.remote = info.version || null;
    update.notes = info.notes || null;
    update.notesNb = info.notes_nb || info.notes || null;
    if (info.version && info.version !== APP_VERSION) {
      if (waiting) set('ready');
      else {
        set('available');
        if (reg) {
          await reg.update().catch(() => {});
          if (reg.waiting) setWaiting(reg.waiting);
        }
      }
    } else if (update.status !== 'ready') {
      if (quiet) update.status = 'none';
      else set('none');
    }
  } catch (e) {
    if (!quiet) set('error');
  }
  return update;
}

// Install the new version and reload.
export async function applyUpdate() {
  try { localStorage.setItem('vektplan.updatedTo', update.remote || ''); } catch (e) { /* ignore */ }
  if (waiting) {
    set('installing');
    waiting.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(() => location.reload(), 4000); // safety net
    return;
  }
  set('installing');
  if (reg) {
    await reg.update().catch(() => {});
    const start = Date.now();
    while (Date.now() - start < 8000) {
      if (reg.waiting) {
        waiting = reg.waiting;
        waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => location.reload(), 4000);
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  forceRefresh();
}

// Last resort: throw away the offline copy and load everything fresh. Your data is not touched.
export async function forceRefresh() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('vektplan-')).map((k) => caches.delete(k)));
    // Only Vektplan's own worker: other apps on the same site (like Mage) are left alone.
    const scope = new URL('./', location.href).href;
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.filter((r) => r.scope === scope).map((r) => r.unregister()));
  } catch (e) {
    console.warn(e);
  }
  location.replace(location.pathname + '?r=' + Date.now() + location.hash);
}
