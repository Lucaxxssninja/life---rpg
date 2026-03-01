import { getState, setState, getTodayISO } from './state.js';
import { awardXp } from './xpSystem.js';
import { recomputePerfectDay } from './analytics.js';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function addHabit({ name, xpReward, attributeAffected, frequency = 'daily' }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return;

  setState((draft) => {
    draft.habits.push({
      id: uid(),
      name: trimmed,
      xpReward: Math.max(1, Number(xpReward) || 10),
      attributeAffected: attributeAffected || 'discipline',
      frequency: frequency, // 'daily' ou 'weekly'
      active: true, // para ativar/desativar
      completedToday: false,
      streak: 0,
      lastCompletedDate: null,
    });
  });
}

export function removeHabit(id) {
  setState((draft) => {
    draft.habits = draft.habits.filter((h) => h.id !== id);
  });
}

export function toggleHabitActive(id) {
  setState((draft) => {
    const habit = draft.habits.find((h) => h.id === id);
    if (habit) {
      habit.active = !habit.active;
    }
  });
}

export function getActiveHabits() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = domingo, 1 = segunda, etc.
  
  return getState().habits.filter((h) => {
    if (!h.active) return false;
    
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'weekly') {
      // Hábitos semanais são todos os dias (podemos personalizar depois)
      return true;
    }
    return false;
  });
}

export function getDailyTasksFromHabits() {
  return getActiveHabits().map((habit) => ({
    ...habit,
    taskType: 'habit', // para diferenciar de tarefas manuais
  }));
}

export function toggleHabitCompletion(id) {
  const today = getTodayISO();
  const before = getState();
  const habitBefore = before.habits.find((h) => h.id === id);
  if (!habitBefore) return;

  setState((draft) => {
    const h = draft.habits.find((x) => x.id === id);
    if (!h) return;

    const willComplete = !h.completedToday;
    h.completedToday = willComplete;

    if (willComplete) {
      const last = h.lastCompletedDate;
      if (last) {
        const lastDate = new Date(last);
        const diffDays = Math.floor((new Date(today) - lastDate) / 86400000);
        if (diffDays === 1) h.streak = (h.streak || 0) + 1;
        else if (diffDays === 0) h.streak = h.streak || 1;
        else h.streak = 1;
      } else {
        h.streak = 1;
      }

      h.lastCompletedDate = today;

      draft.stats.totalHabitsCompleted = (draft.stats.totalHabitsCompleted || 0) + 1;
      if ((draft.stats.bestStreak || 0) < h.streak) draft.stats.bestStreak = h.streak;

      const attr = h.attributeAffected;
      if (draft.attributes[attr] != null) draft.attributes[attr] += 1;

      awardXp({ baseXp: h.xpReward, reason: `Hábito: ${h.name}` });
    }
  });

  recomputePerfectDay();
}

export function resetHabitsForNewDay() {
  setState((draft) => {
    draft.habits.forEach((h) => {
      h.completedToday = false;
    });
  });
}
