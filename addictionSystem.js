import { getState, setState, getTodayISO } from './state.js';
import { pushToast, openModal } from './uiRenderer.js';
import { awardXp } from './xpSystem.js';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function addAddiction({ name }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return;

  setState((draft) => {
    draft.addictions.push({
      id: uid(),
      name: trimmed,
      cleanDays: 0,
      maxStreak: 0,
      relapseHistory: [],
      lastRelapseDate: null,
      streak: 0,
    });
  });
}

export function removeAddiction(id) {
  setState((draft) => {
    draft.addictions = draft.addictions.filter((a) => a.id !== id);
  });
}

export function recordRelapse({ addictionId, trigger }) {
  const now = new Date();
  const date = getTodayISO(now);
  const time = now.toTimeString().slice(0, 5);
  const trig = String(trigger ?? '').trim() || 'Não informado';

  const penalty = getState().settings.penaltiesEnabled ? Number(getState().settings.relapsePenalty || 0) : 0;

  setState((draft) => {
    const a = draft.addictions.find((x) => x.id === addictionId);
    if (!a) return;

    a.relapseHistory.unshift({ date, time, trigger: trig });
    a.lastRelapseDate = date;
    a.streak = 0;
    a.cleanDays = 0;
  });

  if (penalty > 0) {
    setState((draft) => {
      draft.character.xp = Math.max(0, (draft.character.xp || 0) - penalty);
    });

    pushToast({
      title: `Penalidade: -${penalty} XP`,
      description: `Recaída registrada` ,
      variant: 'danger',
    });
  } else {
    pushToast({ title: 'Recaída registrada', description: 'Use o insight para ajustar estratégia.', variant: 'warn' });
  }
}

export function analyzeRelapsePatterns(addictionId) {
  const a = getState().addictions.find((x) => x.id === addictionId);
  if (!a || !Array.isArray(a.relapseHistory) || a.relapseHistory.length === 0) {
    return { insight: 'Ainda não há recaídas registradas.' };
  }

  const hourCounts = new Map();
  const triggerCounts = new Map();

  a.relapseHistory.forEach((r) => {
    const hour = String(r.time || '00:00').slice(0, 2);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    const trig = String(r.trigger || 'Não informado');
    triggerCounts.set(trig, (triggerCounts.get(trig) || 0) + 1);
  });

  const topHour = [...hourCounts.entries()].sort((a1, a2) => a2[1] - a1[1])[0][0];
  const topTrigger = [...triggerCounts.entries()].sort((a1, a2) => a2[1] - a1[1])[0][0];

  const insight = `Maioria das recaídas ocorre por volta de ${topHour}h. Trigger mais frequente: ${topTrigger}.`;
  return { insight, topHour, topTrigger };
}

export function openRelapseModal(addictionId) {
  openModal({
    title: 'Registrar recaída',
    contentHTML: `
      <div class="stack">
        <div class="field">
          <div class="label">Trigger / contexto</div>
          <input id="relapseTrigger" class="input" placeholder="Ex: solidão, tédio, ansiedade" />
        </div>
        <div class="muted">A penalidade depende das configurações.</div>
      </div>
    `,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Registrar',
        kind: 'danger',
        onClick: () => {
          const input = document.getElementById('relapseTrigger');
          recordRelapse({ addictionId, trigger: input?.value });
        },
      },
    ],
  });
}

export function updateCleanDaysDaily() {
  const today = getTodayISO();

  setState((draft) => {
    draft.addictions.forEach((a) => {
      const last = a.lastRelapseDate;
      if (!last) {
        a.cleanDays = (a.cleanDays || 0) + 1;
        a.streak = (a.streak || 0) + 1;
      } else {
        const diffDays = Math.floor((new Date(today) - new Date(last)) / 86400000);
        a.cleanDays = Math.max(0, diffDays);
        a.streak = a.cleanDays;
      }
      if ((a.maxStreak || 0) < (a.streak || 0)) a.maxStreak = a.streak || 0;

      if (a.cleanDays > 0 && a.cleanDays % 7 === 0) {
        awardXp({ baseXp: 25, reason: `Anti-vício: ${a.name} • ${a.cleanDays} dias` });
      }
    });
  });
}
