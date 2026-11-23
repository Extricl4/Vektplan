import { S } from './store.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme() {
  const pref = S().prefs.theme || 'light';
  const dark = pref === 'dark' || (pref === 'auto' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0B1220' : '#E6E9E7');
}

media.addEventListener?.('change', () => {
  if ((S().prefs.theme || 'light') === 'auto') applyTheme();
});
