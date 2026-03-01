import { getState, setState, getTodayISO } from './state.js';
import { awardXp } from './xpSystem.js';
import { pushToast } from './uiRenderer.js';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function addTask({ name, xpReward, type = 'daily', bonusStreak = false }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return;

  setState((draft) => {
    if (!Array.isArray(draft.tasks)) draft.tasks = [];
    draft.tasks.push({
      id: uid(),
      name: trimmed,
      xpReward: Math.max(1, Number(xpReward) || 10),
      type,
      completedToday: false,
      streak: 0,
      lastCompletedDate: null,
      bonusStreak: Boolean(bonusStreak),
    });
  });
}

export function removeTask(id) {
  setState((draft) => {
    draft.tasks = (draft.tasks || []).filter((t) => t.id !== id);
  });
}

export function toggleTaskCompletion(id) {
  const today = getTodayISO();
  const before = getState();
  const taskBefore = (before.tasks || []).find((t) => t.id === id);
  if (!taskBefore) return;

  setState((draft) => {
    const t = (draft.tasks || []).find((x) => x.id === id);
    if (!t) return;

    const willComplete = !t.completedToday;
    t.completedToday = willComplete;

    if (willComplete) {
      const last = t.lastCompletedDate;
      if (last) {
        const lastDate = new Date(last);
        const diffDays = Math.floor((new Date(today) - lastDate) / 86400000);
        if (diffDays === 1) t.streak = (t.streak || 0) + 1;
        else if (diffDays === 0) t.streak = t.streak || 1;
        else t.streak = 1;
      } else {
        t.streak = 1;
      }

      t.lastCompletedDate = today;

      if (t.bonusStreak && t.streak > 1 && t.streak % 3 === 0) {
        const bonus = Math.round(t.xpReward * 0.5);
        awardXp({ baseXp: bonus, reason: `Bônus de streak: ${t.name}` });
      }

      awardXp({ baseXp: t.xpReward, reason: `Tarefa: ${t.name}` });
    }
  });
}

export function resetTasksForNewDay() {
  setState((draft) => {
    (draft.tasks || []).forEach((t) => {
      t.completedToday = false;
    });
  });
}

export function getDailyTasks() {
  return (getState().tasks || []).filter((t) => t.type === 'daily');
}

export function getWeeklyTasks() {
  return (getState().tasks || []).filter((t) => t.type === 'weekly');
}

export function getCompletedTodayCount() {
  return (getState().tasks || []).filter((t) => t.completedToday).length;
}

export function getStreakBonusCount() {
  return (getState().tasks || []).filter((t) => t.bonusStreak && t.streak > 1 && t.streak % 3 === 0).length;
}
