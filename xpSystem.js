import { getState, setState } from './state.js';
import { pushToast } from './uiRenderer.js';

export function getPhase(level) {
  if (level <= 10) return 'Construção';
  if (level <= 20) return 'Disciplina';
  if (level <= 30) return 'Elite';
  return 'Ascensão';
}

export function xpNeededForLevel(level, xpPerLevel) {
  return Math.max(1, level * xpPerLevel);
}

export function getSleepModifierFromClassification(classification) {
  if (classification === 'Ruim') return 0.9;
  if (classification === 'Insuficiente') return 1.0;
  if (classification === 'Ideal') return 1.1;
  if (classification === 'Recuperação Total') return 1.2;
  return 1.0;
}

export function computeFinalXp({ baseXp, sleepModifier, eventModifier }) {
  return Math.max(0, Math.round(baseXp * sleepModifier * eventModifier));
}

export function awardXp({ baseXp, reason, eventModifier = null }) {
  const s = getState();
  const effectiveEventMod = eventModifier ?? s.settings.eventModifier ?? 1.0;
  const sleepMod = s.settings.xpModifierFromSleep ? (s.sleep.activeXpModifier ?? 1.0) : 1.0;
  const final = computeFinalXp({ baseXp, sleepModifier: sleepMod, eventModifier: effectiveEventMod });

  setState((draft) => {
    draft.character.xp += final;
    draft.character.totalXp += final;

    if (!Array.isArray(draft.stats.xpTimeline)) draft.stats.xpTimeline = [];
    draft.stats.xpTimeline.push({
      ts: Date.now(),
      xpDelta: final,
      reason: reason ?? 'XP',
      level: draft.character.level,
      totalXp: draft.character.totalXp,
    });

    while (draft.character.xp >= xpNeededForLevel(draft.character.level, draft.character.xpPerLevel)) {
      const need = xpNeededForLevel(draft.character.level, draft.character.xpPerLevel);
      draft.character.xp -= need;
      draft.character.level += 1;
      draft.character.phase = getPhase(draft.character.level);
    }
  });

  if (final > 0) {
    pushToast({
      title: `+${final} XP`,
      description: reason ? `${reason} • mod sono ${sleepMod.toFixed(2)} • mod evento ${effectiveEventMod.toFixed(2)}` : undefined,
      variant: 'good',
    });
  }

  const next = getState();
  if (next.character.phase !== s.character.phase || next.character.level !== s.character.level) {
    pushToast({
      title: `Level Up! Nv ${next.character.level}`,
      description: `Fase: ${next.character.phase}`,
      variant: 'good',
    });
  }
}
