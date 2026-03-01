import { getState, setState, getTodayISO } from './state.js';
import { resetHabitsForNewDay } from './habits.js';
import { resetDailyTasksForNewDay } from './dailyTasks.js';
import { resetTasksForNewDay } from './tasks.js';
import { updateCleanDaysDaily } from './addictionSystem.js';
import { recomputePerfectDay } from './analytics.js';

function isDifferentDay(aISO, bISO) {
  return aISO && bISO && aISO !== bISO;
}

export function runDailyRollover() {
  const s = getState();
  const today = getTodayISO();
  const lastTick = s.__meta.lastTickDate || today;

  if (!isDifferentDay(lastTick, today)) return;

  setState((draft) => {
    draft.__meta.lastTickDate = today;

    if (!draft.stats.lastActiveDate) {
      draft.stats.activeDays = 1;
      draft.stats.dailyStreak = 1;
    } else {
      const diffDays = Math.floor((new Date(today) - new Date(draft.stats.lastActiveDate)) / 86400000);
      draft.stats.activeDays = (draft.stats.activeDays || 0) + 1;
      if (diffDays === 1) draft.stats.dailyStreak = (draft.stats.dailyStreak || 0) + 1;
      else draft.stats.dailyStreak = 1;
    }

    draft.stats.lastActiveDate = today;
    if ((draft.stats.bestStreak || 0) < (draft.stats.dailyStreak || 0)) draft.stats.bestStreak = draft.stats.dailyStreak;
  });

  resetHabitsForNewDay();
  resetDailyTasksForNewDay();
  updateCleanDaysDaily();
  recomputePerfectDay();
}
