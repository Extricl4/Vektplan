// Beginner-friendly sessions. Work at an easy pace; stop if your stomach says no.
const N = (en, nb) => ({ en, nb });

// The exercises now live in exercises.js (tagged by muscle group and equipment).
export { LIB as EXERCISES } from './exercises.js';

// The original built-in sessions. Still used before you build your own plan, and for history.
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
