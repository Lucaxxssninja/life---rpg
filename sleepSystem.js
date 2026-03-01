import { getState, setState, getTodayISO } from './state.js';
import { getSleepModifierFromClassification } from './xpSystem.js';
import { openModal, pushToast } from './uiRenderer.js';

function parseTimeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function averageMinutes(values) {
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(sum / values.length);
}

export function classifySleep(hours) {
  if (hours < 5) return 'Ruim';
  if (hours < 6.5) return 'Insuficiente';
  if (hours < 8) return 'Ideal';
  return 'Recuperação Total';
}

export function computeHoursFromTimes({ sleepTime, wakeTime }) {
  const s = parseTimeToMinutes(sleepTime);
  const w = parseTimeToMinutes(wakeTime);
  if (s == null || w == null) return null;

  let delta = w - s;
  if (delta < 0) delta += 24 * 60;
  return Math.max(0, delta / 60);
}

export function logSleepByTimes({ sleepTime, wakeTime }) {
  const hours = computeHoursFromTimes({ sleepTime, wakeTime });
  if (hours == null) return;
  logSleepEntry({ hours, sleepTime, wakeTime, mode: 'times' });
}

export function logSleepByHours({ hours }) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return;
  logSleepEntry({ hours: h, mode: 'manual' });
}

function logSleepEntry({ hours, sleepTime = null, wakeTime = null, mode }) {
  const date = getTodayISO();
  const classification = classifySleep(hours);
  const modifier = getSleepModifierFromClassification(classification);
  const validUntil = Date.now() + 24 * 60 * 60 * 1000;

  setState((draft) => {
    draft.sleep.lastSleepEntry = {
      date,
      hours: Number(hours.toFixed(2)),
      classification,
      sleepTime,
      wakeTime,
      mode,
    };

    draft.sleep.history.unshift({
      date,
      hours: Number(hours.toFixed(2)),
      classification,
      sleepTime,
      wakeTime,
      mode,
    });
    draft.sleep.history = draft.sleep.history.slice(0, 30);

    draft.sleep.activeXpModifier = modifier;
    draft.sleep.modifierValidUntil = validUntil;

    const energyBoost = classification === 'Ruim' ? 0 : classification === 'Insuficiente' ? 1 : classification === 'Ideal' ? 2 : 3;
    draft.attributes.energy = (draft.attributes.energy || 1) + energyBoost;

    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yISO = yesterday.toISOString().slice(0, 10);

    const last = draft.sleep.lastEntryDateForStreak || null;
    if (!last) {
      draft.sleep.streak = 1;
    } else if (last === yISO) {
      draft.sleep.streak = (draft.sleep.streak || 0) + 1;
    } else if (last === date) {
      draft.sleep.streak = draft.sleep.streak || 1;
    } else {
      draft.sleep.streak = 1;
    }
    draft.sleep.lastEntryDateForStreak = date;
  });

  pushToast({
    title: `Sono registrado: ${hours.toFixed(1)}h`,
    description: `${classification} • mod XP ${modifier.toFixed(2)} por 24h`,
    variant: classification === 'Ruim' ? 'danger' : classification === 'Insuficiente' ? 'warn' : 'good',
  });
}

export function tickRiskZone() {
  const s = getState();
  const target = s.sleep.targetBedtime;
  const targetMin = parseTimeToMinutes(target);
  if (targetMin == null) return;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const start = (targetMin - 60 + 24 * 60) % (24 * 60);
  const inWindow = start <= targetMin ? nowMin >= start && nowMin <= targetMin : nowMin >= start || nowMin <= targetMin;

  const shouldBeRisk = inWindow;
  const wasRisk = Boolean(s.sleep.riskZone);

  if (shouldBeRisk !== wasRisk) {
    setState((draft) => {
      draft.sleep.riskZone = shouldBeRisk;
      draft.sleep.riskZoneStartedAt = shouldBeRisk ? Date.now() : null;
    });

    if (shouldBeRisk) {
      pushToast({
        title: 'Zona de Risco Noturna',
        description: 'Você está a menos de 1h do horário-alvo. Proteja sua energia e seu XP futuro.',
        variant: 'warn',
      });
    }
  }

  if (s.sleep.modifierValidUntil && Date.now() > s.sleep.modifierValidUntil) {
    setState((draft) => {
      draft.sleep.activeXpModifier = 1.0;
      draft.sleep.modifierValidUntil = null;
    });
  }
}

export function getRiskCountdown() {
  const s = getState();
  const targetMin = parseTimeToMinutes(s.sleep.targetBedtime);
  if (targetMin == null) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let delta = targetMin - nowMin;
  if (delta < 0) delta += 24 * 60;
  const hh = String(Math.floor(delta / 60)).padStart(2, '0');
  const mm = String(delta % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function promptDelayReasonIfLate() {
  const s = getState();
  const targetMin = parseTimeToMinutes(s.sleep.targetBedtime);
  if (targetMin == null) return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (nowMin <= targetMin) return;

  openModal({
    title: 'Atraso detectado',
    contentHTML: `
      <div class="stack">
        <div class="muted">Você passou do horário-alvo. Registrar o motivo melhora sua análise comportamental.</div>
        <div class="field">
          <div class="label">Motivo do atraso</div>
          <input id="delayReason" class="input" placeholder="Ex: redes sociais, trabalho, ansiedade" />
        </div>
      </div>
    `,
    actions: [
      { label: 'Agora não', kind: 'ghost' },
      {
        label: 'Registrar',
        kind: 'primary',
        onClick: () => {
          const val = document.getElementById('delayReason')?.value;
          const reason = String(val ?? '').trim();
          if (!reason) return;
          setState((draft) => {
            draft.sleep.riskZoneDelayReasons.unshift({ ts: Date.now(), reason });
            draft.sleep.riskZoneDelayReasons = draft.sleep.riskZoneDelayReasons.slice(0, 50);
          });
        },
      },
    ],
  });
}

export function getWeeklySleepAnalysis() {
  const s = getState();
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const startISO = start.toISOString().slice(0, 10);

  const entries = (s.sleep.history || []).filter((e) => e.date >= startISO).slice().reverse();

  const avgHours = entries.length ? entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0) / entries.length : 0;

  const bedtimeMinutes = entries
    .map((e) => (e.sleepTime ? parseTimeToMinutes(e.sleepTime) : null))
    .filter((v) => v != null);
  const avgBedtimeMin = averageMinutes(bedtimeMinutes);

  return {
    entries,
    avgHours: Number(avgHours.toFixed(2)),
    avgBedtime: avgBedtimeMin == null ? null : minutesToHHMM(avgBedtimeMin),
    consistency: entries.length / 7,
  };
}

export function setTargetBedtime(hhmm) {
  const normalized = String(hhmm || '').trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) return;
  setState((draft) => {
    draft.sleep.targetBedtime = normalized;
  });
}

export function suggestBedtimeFromAverage(hoursTarget = 7.5) {
  const now = new Date();
  const wake = now.getHours() * 60 + now.getMinutes();
  const bedtime = (wake - Math.round(hoursTarget * 60) + 24 * 60) % (24 * 60);
  return minutesToHHMM(bedtime);
}
