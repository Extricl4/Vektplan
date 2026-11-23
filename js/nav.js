// Tiny navigation hub so views can ask the app to re-render without importing app.js.
export const nav = {
  stack: [], // in-app screen history, so "back" never leaves the app
  rerender: () => {},
  go(path) {
    const target = '#/' + path.replace(/^#?\/?/, '');
    if (location.hash === target) nav.rerender();
    else location.hash = target;
  },
  back(fallback = 'today') {
    if (nav.stack.length > 1) history.back();
    else nav.go(fallback);
  },
};
