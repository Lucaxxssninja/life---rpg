import { getState, setState, getTodayISO } from './state.js';
import { awardXp } from './xpSystem.js';
import { recomputePerfectDay } from './analytics.js';
import { getDailyTasksFromHabits } from './habits.js';

export function getDailyTasks() {
  const habitTasks = getDailyTasksFromHabits();
  const manualTasks = (getState().tasks || []).filter((t) => t.type === 'daily');
  
  return [...habitTasks, ...manualTasks];
}

export function getTaskProgress() {
  const dailyTasks = getDailyTasks();
  const completed = dailyTasks.filter((t) => t.completedToday).length;
  const total = dailyTasks.length;
  
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function toggleTaskCompletion(id) {
  const today = getTodayISO();
  const before = getState();
  
  // Verificar se é uma tarefa de hábito
  const habitTask = before.habits.find((h) => h.id === id);
  const manualTask = (before.tasks || []).find((t) => t.id === id);
  
  const task = habitTask || manualTask;
  if (!task) return;

  setState((draft) => {
    let targetTask = null;
    
    if (habitTask) {
      targetTask = draft.habits.find((h) => h.id === id);
    } else {
      targetTask = (draft.tasks || []).find((t) => t.id === id);
    }
    
    if (!targetTask) return;

    const willComplete = !targetTask.completedToday;
    targetTask.completedToday = willComplete;

    if (willComplete) {
      // Atualizar streak
      const last = targetTask.lastCompletedDate;
      if (last) {
        const lastDate = new Date(last);
        const diffDays = Math.floor((new Date(today) - lastDate) / 86400000);
        if (diffDays === 1) targetTask.streak = (targetTask.streak || 0) + 1;
        else if (diffDays === 0) targetTask.streak = targetTask.streak || 1;
        else targetTask.streak = 1;
      } else {
        targetTask.streak = 1;
      }

      targetTask.lastCompletedDate = today;

      // Aplicar modificadores
      let finalXp = targetTask.xpReward;
      
      // Modificador de sono
      if (draft.settings.xpModifierFromSleep && draft.sleep.streak > 0) {
        const sleepBonus = Math.round(finalXp * 0.1 * draft.sleep.streak);
        finalXp += sleepBonus;
      }
      
      // Modificador de penalidades
      if (draft.settings.penaltiesEnabled) {
        const todayRelapses = (draft.addictions || [])
          .filter((a) => a.lastRelapseDate === today).length;
        if (todayRelapses > 0) {
          finalXp = Math.max(1, Math.round(finalXp * (1 - draft.settings.relapsePenalty * todayRelapses)));
        }
      }

      // Aplicar XP e atributos
      if (targetTask.attributeAffected && draft.attributes[targetTask.attributeAffected] != null) {
        draft.attributes[targetTask.attributeAffected] += 1;
      }

      draft.stats.totalHabitsCompleted = (draft.stats.totalHabitsCompleted || 0) + 1;
      if ((draft.stats.bestStreak || 0) < targetTask.streak) {
        draft.stats.bestStreak = targetTask.streak;
      }

      const taskType = habitTask ? 'Hábito' : 'Tarefa';
      awardXp({ baseXp: finalXp, reason: `${taskType}: ${targetTask.name}` });
    }
  });

  recomputePerfectDay();
}

export function resetDailyTasksForNewDay() {
  setState((draft) => {
    // Resetar hábitos
    draft.habits.forEach((h) => {
      h.completedToday = false;
    });
    
    // Resetar tarefas manuais
    (draft.tasks || []).forEach((t) => {
      if (t.type === 'daily') {
        t.completedToday = false;
      }
    });
  });
}
