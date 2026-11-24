// Tiny navigation hub so views can ask the app to re-render without importing app.js.
export const nav = {
  stack: [], // in-app screen history, so "back" never leaves the app
  rerender: () => {},
  go(path) {
    const target = '#/' + path.replace(/^#?\/?/, '');
    if (location.hash === target) nav.rerender();
    else location.hash = target;
  },
  // The page never scrolls; the current screen does.
  scroller: () => document.querySelector('#app > .screen'),
  scrollTo(y) {
    const el = nav.scroller();
    if (el) el.scrollTop = y === 'end' ? el.scrollHeight : y;
  },
  back(fallback = 'today') {
    if (nav.stack.length > 1) history.back();
    else nav.go(fallback);
  },
};
