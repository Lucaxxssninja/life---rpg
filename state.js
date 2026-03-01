import { loadState, persistState } from './storage.js';
import { getPhase } from './xpSystem.js';

const DEFAULT_XP_PER_LEVEL = 120;

let state = null;
const subscribers = new Set();

function todayISO(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function clampNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultState() {
  return {
    character: {
      name: 'Você',
      level: 1,
      xp: 0,
      totalXp: 0,
      xpPerLevel: DEFAULT_XP_PER_LEVEL,
      phase: getPhase(1),
    },
    attributes: {
      intelligence: 1,
      strength: 1,
      discipline: 1,
      energy: 1,
      consistency: 1,
      mentalResistance: 1,
    },
    habits: [],
    tasks: [],
    addictions: [],
    sleep: {
      targetBedtime: '23:00',
      lastSleepEntry: null,
      streak: 0,
      history: [],
      riskZone: false,
      riskZoneStartedAt: null,
      riskZoneDelayReasons: [],
      activeXpModifier: 1.0,
      modifierValidUntil: null,
    },
    studies: {
      timerMinutes: 25,
      timerSeconds: 0,
      isRunning: false,
      isPaused: false,
      notes: '',
      flashcards: {
        cards: [],
        ui: {
          reviewing: false,
          currentId: null,
          revealed: false,
        },
      },
    },
    stats: {
      activeDays: 0,
      bestStreak: 0,
      totalHabitsCompleted: 0,
      dailyStreak: 0,
      lastActiveDate: null,
      xpTimeline: [],
      perfectDays: [],
    },
    settings: {
      theme: 'rpg',
      darkMode: true,
      primaryColor: '#c9b037',
      xpBarColor: '#ff6b35',
      penaltiesEnabled: true,
      relapsePenalty: 0,
      eventModifier: 1,
      xpModifierFromSleep: true,
    },
    __meta: {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      lastSavedAt: null,
      lastTickDate: todayISO(),
      onboarded: false,
    },
  };
}

function ensureStateShape(next) {
  const base = defaultState();

  const merged = {
    ...base,
    ...next,
    character: { ...base.character, ...(next?.character || {}) },
    attributes: { ...base.attributes, ...(next?.attributes || {}) },
    sleep: { ...base.sleep, ...(next?.sleep || {}) },
    stats: { ...base.stats, ...(next?.stats || {}) },
    settings: { ...base.settings, ...(next?.settings || {}) },
    __meta: { ...base.__meta, ...(next?.__meta || {}) },
  };

  merged.habits = Array.isArray(next?.habits) ? next.habits : base.habits;
  merged.tasks = Array.isArray(next?.tasks) ? next.tasks : base.tasks;
  merged.addictions = Array.isArray(next?.addictions) ? next.addictions : base.addictions;
  merged.sleep.history = Array.isArray(merged.sleep.history) ? merged.sleep.history : [];
  merged.sleep.riskZoneDelayReasons = Array.isArray(merged.sleep.riskZoneDelayReasons) ? merged.sleep.riskZoneDelayReasons : [];
  merged.stats.xpTimeline = Array.isArray(merged.stats.xpTimeline) ? merged.stats.xpTimeline : [];
  merged.stats.perfectDays = Array.isArray(merged.stats.perfectDays) ? merged.stats.perfectDays : [];
  merged.studies = { ...base.studies, ...(next?.studies || {}) };

  if (!merged.studies.flashcards) merged.studies.flashcards = { ...base.studies.flashcards };
  merged.studies.flashcards.cards = Array.isArray(merged.studies.flashcards.cards) ? merged.studies.flashcards.cards : [];
  merged.studies.flashcards.ui = { ...base.studies.flashcards.ui, ...(merged.studies.flashcards.ui || {}) };
  merged.studies.flashcards.ui.reviewing = Boolean(merged.studies.flashcards.ui.reviewing);
  merged.studies.flashcards.ui.revealed = Boolean(merged.studies.flashcards.ui.revealed);
  merged.studies.flashcards.ui.currentId = merged.studies.flashcards.ui.currentId || null;

  merged.character.level = clampNumber(merged.character.level, 1);
  merged.character.xpPerLevel = clampNumber(merged.character.xpPerLevel, DEFAULT_XP_PER_LEVEL);
  merged.character.xp = clampNumber(merged.character.xp, 0);
  merged.character.totalXp = clampNumber(merged.character.totalXp, 0);
  merged.character.phase = getPhase(merged.character.level);

  merged.settings.darkMode = Boolean(merged.settings.darkMode);
  merged.sleep.activeXpModifier = clampNumber(merged.sleep.activeXpModifier, 1.0);
  merged.__meta.onboarded = Boolean(merged.__meta.onboarded);

  return merged;
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() {
  subscribers.forEach((fn) => fn(state));
}

export function setState(mutator) {
  if (!state) throw new Error('State not initialized');
  mutator(state);
  state.__meta.lastSavedAt = new Date().toISOString();
  persistState(state);
  notify();
}

export function initAppState() {
  const loaded = loadState();
  state = ensureStateShape(loaded ?? defaultState());

  persistState(state);
  notify();
}

export function resetState() {
  state = defaultState();
  persistState(state);
  notify();
}

export function replaceState(nextState) {
  state = ensureStateShape(nextState);
  persistState(state);
  notify();
}

export function getTodayISO() {
  return todayISO();
}
