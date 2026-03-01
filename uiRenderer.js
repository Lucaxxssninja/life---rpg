import { getState, setState, subscribe, replaceState, resetState } from './state.js';
import { addHabit, removeHabit, toggleHabitCompletion, toggleHabitActive } from './habits.js';
import { addTask, removeTask, toggleTaskCompletion } from './tasks.js';
import { getDailyTasks, getTaskProgress, toggleTaskCompletion as toggleDailyTask } from './dailyTasks.js';
import { addAddiction, removeAddiction, analyzeRelapsePatterns, openRelapseModal } from './addictionSystem.js';
import { logSleepByTimes, logSleepByHours, getRiskCountdown, promptDelayReasonIfLate, setTargetBedtime, getWeeklySleepAnalysis } from './sleepSystem.js';
import { setTheme, getThemePresets, updateSetting } from './settings.js';
import { renderAnalytics } from './analytics.js';
import { importStateJSON, clearStorage } from './storage.js';
import {
  addFlashcard,
  removeFlashcard,
  importFlashcardsFromText,
  getFlashcardsStats,
  startFlashcardsReview,
  stopFlashcardsReview,
  revealFlashcardAnswer,
  gradeFlashcard,
} from './flashcardsSystem.js';

let mounted = false;
let currentRoute = 'dashboard';

function esc(str) {
  return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function renderThemeDropdown(currentTheme, presets) {
  const items = Object.entries(presets)
    .map(([key, preset]) => `<div class="theme-dropdown__item ${key === currentTheme ? 'is-active' : ''}" data-theme="${esc(key)}">${esc(preset.label)}</div>`)
    .join('');

  const currentLabel = presets[currentTheme]?.label || 'RPG Medieval';

  return `
    <div class="theme-dropdown" id="themeDropdown">
      <button type="button" class="theme-dropdown__trigger" id="themeDropdownTrigger">
        <span>${esc(currentLabel)}</span>
      </button>
      <div class="theme-dropdown__menu">
        ${items}
      </div>
    </div>
  `;
}

function attrLabel(key) {
  const map = {
    intelligence: 'Inteligência',
    strength: 'Força',
    discipline: 'Disciplina',
    energy: 'Energia',
    consistency: 'Consistência',
    mentalResistance: 'Resistência',
  };
  return map[key] || key;
}

function getWeeklyHabitCompletionRate(s) {
  if (!s.habits || s.habits.length === 0) return 0;
  const completed = s.habits.filter(h => h.completedToday).length;
  return completed / s.habits.length;
}

function pillVariantForClassification(c) {
  if (c === 'Ruim') return 'pill pill--danger';
  if (c === 'Insuficiente') return 'pill pill--warn';
  return 'pill pill--good';
}

function xpSummaryCard(s) {
  const need = Math.max(1, s.character.level * s.character.xpPerLevel);
  const pct = Math.max(0, Math.min(100, Math.round((s.character.xp / need) * 100)));

  return `
    <section class="card card--6">
      <div class="card__header">
        <div>
          <div class="card__title">Status do Herói</div>
          <div class="card__subtitle">Evolua com disciplina, sono e autocontrole</div>
        </div>
        <span class="pill">${esc(s.character.phase)}</span>
      </div>
      <div class="card__body stack">
        <div class="row">
          <div class="kpi">
            <div class="kpi__value">Nv ${s.character.level}</div>
            <div class="kpi__label">${esc(s.character.name)}</div>
          </div>
          <div class="kpi" style="text-align:right">
            <div class="kpi__value">${s.character.totalXp}</div>
            <div class="kpi__label">XP total</div>
          </div>
        </div>

        <div class="stack" style="gap:6px">
          <div class="row">
            <div class="muted">XP atual</div>
            <div class="muted">${s.character.xp} / ${need}</div>
          </div>
          <div class="progress" aria-label="Progresso de XP">
            <div class="progress__bar" style="width:${pct}%"></div>
          </div>
        </div>

        <div class="row">
          <span class="pill">Mod Sono: ${Number(s.sleep.activeXpModifier || 1).toFixed(2)}</span>
          <span class="pill">Streak diário: ${s.stats.dailyStreak || 0}</span>
        </div>
      </div>
    </section>
  `;
}

function attributesCard(s) {
  const keys = Object.keys(s.attributes);
  return `
    <section class="card card--6">
      <div class="card__header">
        <div>
          <div class="card__title">Atributos do Herói</div>
          <div class="card__subtitle">Cada missão fortalece um pilar do seu poder</div>
        </div>
      </div>
      <div class="card__body">
        <table class="table">
          <thead><tr><th>Atributo</th><th>Valor</th></tr></thead>
          <tbody>
            ${keys
              .map((k) => `<tr><td>${esc(attrLabel(k))}</td><td>${Number(s.attributes[k] || 0)}</td></tr>`)
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function riskZoneCard(s) {
  const countdown = getRiskCountdown();
  const bonus = Math.round(10 * (s.sleep.activeXpModifier || 1));
  const isRisk = Boolean(s.sleep.riskZone);

  return `
    <section class="card card--6">
      <div class="card__header">
        <div>
          <div class="card__title">Zona de Risco Noturna</div>
          <div class="card__subtitle">Janela crítica antes do descanso sagrado</div>
        </div>
        <span class="${isRisk ? 'pill pill--warn' : 'pill'}">${isRisk ? 'ATIVA' : 'Inativa'}</span>
      </div>
      <div class="card__body stack">
        <div class="row">
          <div class="kpi">
            <div class="kpi__value">${countdown || '--:--'}</div>
            <div class="kpi__label">Até ${esc(s.sleep.targetBedtime)}</div>
          </div>
          <div class="kpi" style="text-align:right">
            <div class="kpi__value">+${bonus}</div>
            <div class="kpi__label">bônus potencial</div>
          </div>
        </div>
        <div class="muted">Estratégia: desligue gatilhos, prepare o ambiente e escolha uma rotina curta e repetível.</div>
        <div class="row">
          <button class="btn btn--ghost" type="button" data-action="promptDelay">Registrar atraso</button>
          <button class="btn btn--primary" type="button" data-action="goSleep">Iniciar rotina</button>
        </div>
      </div>
    </section>
  `;
}

function dashboardView(s) {
  return `
    <div class="grid tasks-grid">
      <section class="card tasks-list-card">
        <div class="card__header">
          <div>
            <div class="card__title">Olá, seja bem vindo${s.character.name ? `, ${esc(s.character.name)}` : ''}</div>
            <div class="card__subtitle">Vamos evoluir com consistência, sono e autocontrole.</div>
          </div>
        </div>
      </section>

      ${xpSummaryCard(s)}
      ${attributesCard(s)}
      ${riskZoneCard(s)}

      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Resumo da Jornada</div>
            <div class="card__subtitle">Seu progresso até aqui</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="row"><span class="muted">Dias ativos</span><span>${s.stats.activeDays || 0}</span></div>
          <div class="row"><span class="muted">Melhor streak</span><span>${s.stats.bestStreak || 0}</span></div>
          <div class="row"><span class="muted">Hábitos completos (total)</span><span>${s.stats.totalHabitsCompleted || 0}</span></div>
          <div class="row"><span class="muted">Meta de sono</span><span>${esc(s.sleep.targetBedtime)}</span></div>
        </div>
      </section>

      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Missões de Hoje</div>
            <div class="card__subtitle">Checklist rápido</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="row"><span class="muted">Hábitos feitos</span><span>${s.habits.filter((h) => h.completedToday).length} / ${s.habits.length}</span></div>
          <div class="row"><span class="muted">Sono registrado</span><span>${s.sleep.lastSleepEntry?.date === new Date().toISOString().slice(0, 10) ? 'Sim' : 'Não'}</span></div>
          <div class="row"><span class="muted">Vícios monitorados</span><span>${s.addictions.length}</span></div>
        </div>
      </section>
    </div>
  `;
}

function tasksView(s) {
  try {
    const dailyTasks = getDailyTasks();
    const progress = getTaskProgress();
    
    const renderTaskItem = (task) => {
      const isCompleted = task.completedToday;
      const isHabit = task.taskType === 'habit';
      const sourceLabel = isHabit ? '🔄 Hábito' : '📝 Tarefa Manual';
      
      return `
        <div class="task-item ${isCompleted ? 'task-item--completed' : ''}" data-id="${esc(task.id)}">
          <div class="task-checkbox">
            <input 
              type="checkbox" 
              id="task-${esc(task.id)}" 
              ${isCompleted ? 'checked' : ''} 
              data-action="toggleDailyTask" 
              data-id="${esc(task.id)}"
            />
            <label for="task-${esc(task.id)}" class="task-checkbox-label">
              <svg class="task-checkmark" viewBox="0 0 20 20" fill="currentColor">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
              </svg>
            </label>
          </div>
          
          <div class="task-content">
            <div class="task-title">${esc(task.name)}</div>
            <div class="task-meta">
              <span class="task-source">${sourceLabel}</span>
              <span class="task-xp">+${task.xpReward} XP</span>
              ${task.attributeAffected ? `<span class="task-attribute">${esc(attrLabel(task.attributeAffected))}</span>` : ''}
              <span class="task-streak">🔥 ${task.streak || 0}</span>
            </div>
          </div>
          
          <div class="task-actions">
            ${isCompleted ? '<div class="task-completed-indicator">✨</div>' : ''}
          </div>
        </div>
      `;
    };

    const taskItems = dailyTasks.map(renderTaskItem).join('');

    return `
      <div class="tasks-daily-container">
        <section class="card tasks-progress-card">
          <div class="card__header">
            <div>
              <div class="card__title">📋 PROGRESSO DIÁRIO</div>
              <div class="card__subtitle">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
            <div class="progress-stats">
              <div class="progress-text">${progress.completed}/${progress.total}</div>
              <div class="progress-percentage">${progress.percentage}%</div>
            </div>
          </div>
          <div class="card__body">
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${progress.percentage}%"></div>
            </div>
            <div class="progress-insights">
              ${progress.percentage === 100 ? 
                '<div class="progress-message progress-message--perfect">🎉 Dia perfeito! Todos os hábitos concluídos!</div>' :
                progress.percentage >= 75 ? 
                '<div class="progress-message progress-message--good">💪 Ótimo progresso! Continue assim!</div>' :
                progress.percentage >= 50 ? 
                '<div class="progress-message progress-message--normal">👍 Bom progresso. Você consegue!</div>' :
                '<div class="progress-message progress-message--low">🚀 Vamos começar! Cada pequeno passo conta.</div>'
              }
            </div>
          </div>
        </section>

        <section class="card tasks-checklist-card">
          <div class="card__header">
            <div>
              <div class="card__title">✅ CHECKLIST DE EXECUÇÃO</div>
              <div class="card__subtitle">Marque suas tarefas como concluídas</div>
            </div>
            <div class="pill">${progress.total} tarefas</div>
          </div>
          <div class="card__body">
            <div class="tasks-list">
              ${taskItems || '<div class="tasks-empty">Nenhuma tarefa para hoje. <a href="#/habits">Cadastrar hábitos</a> para começar.</div>'}
            </div>
          </div>
        </section>

        <section class="card tasks-manual-card">
          <div class="card__header">
            <div>
              <div class="card__title">➕ ADICIONAR TAREFA EXTRA</div>
              <div class="card__subtitle">Adicione tarefas manuais para hoje</div>
            </div>
          </div>
          <div class="card__body stack">
            <div class="field">
              <div class="label">Nome da tarefa</div>
              <input id="taskName" class="input" placeholder="Ex: Estudar JavaScript" />
            </div>
            <div class="field">
              <div class="label">Recompensa XP</div>
              <input id="taskXp" class="input" type="number" min="1" max="100" placeholder="15" />
            </div>
            <button class="btn btn--primary" type="button" data-action="addTask">Adicionar Tarefa Manual</button>
          </div>
        </section>
      </div>
    `;
  } catch (error) {
    console.error('Error in tasksView:', error);
    return '<div style="padding:2rem">Erro ao carregar tarefas.</div>';
  }
}

function habitsView(s) {
  // Geração hardcoded das opções de atributos para garantir que funcionem
  const options = `
    <option value="intelligence" style="color: #000;">Inteligência</option>
    <option value="strength" style="color: #000;">Força</option>
    <option value="discipline" style="color: #000;">Disciplina</option>
    <option value="energy" style="color: #000;">Energia</option>
    <option value="consistency" style="color: #000;">Consistência</option>
    <option value="mentalResistance" style="color: #000;">Resistência</option>
  `;

  const rows = s.habits
    .map((h) => {
      const activeStatus = h.active ? 'pill pill--good' : 'pill';
      const frequencyLabel = h.frequency === 'weekly' ? '📅 Semanal' : '📆 Diário';
      return `
        <tr class="${h.active ? '' : 'habit-inactive'}">
          <td>
            <div style="font-weight:750">${esc(h.name)}</div>
            <div class="muted" style="font-size:12px">
              ${esc(attrLabel(h.attributeAffected))} • ${h.xpReward} XP • ${frequencyLabel}
            </div>
          </td>
          <td><span class="pill">${h.streak || 0}</span></td>
          <td><span class="${activeStatus}">${h.active ? '✅ Ativo' : '⏸️ Inativo'}</span></td>
          <td style="width:280px">
            <div class="row" style="justify-content:flex-end;gap:8px">
              <button class="btn btn--ghost btn--small" type="button" data-action="toggleHabitActive" data-id="${esc(h.id)}">
                ${h.active ? 'Desativar' : 'Ativar'}
              </button>
              <button class="btn btn--danger btn--small" type="button" data-action="removeHabit" data-id="${esc(h.id)}">Remover</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="grid habits-grid">
      <section class="card habits-form-card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">📝 CADASTRO DE HÁBITOS</div>
            <div class="card__subtitle">Crie hábitos recorrentes para suas tarefas diárias</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="field">
            <div class="label">Nome do Hábito</div>
            <input id="habitName" class="input" placeholder="Ex: Meditar, Ler, Exercitar..." />
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
            <div class="field">
              <div class="label">Recompensa XP</div>
              <input id="habitXp" class="input" type="number" min="1" max="100" placeholder="10" />
            </div>
            <div class="field">
              <div class="label">Atributo Afetado</div>
              <select id="habitAttr" class="select">${options}</select>
            </div>
            <div class="field">
              <div class="label">Frequência</div>
              <select id="habitFrequency" class="select">
                <option value="daily">📆 Diário</option>
                <option value="weekly">📅 Semanal</option>
              </select>
            </div>
          </div>
          <button class="btn btn--primary" type="button" data-action="addHabit">📋 Cadastrar Hábito</button>
        </div>
      </section>

      <section class="card habits-list-card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">🗂️ BANCO DE HÁBITOS</div>
            <div class="card__subtitle">Gerencie seus hábitos cadastrados</div>
          </div>
          <div class="pill">${s.habits.length} hábitos</div>
        </div>
        <div class="card__body">
          <table class="table">
            <thead>
              <tr>
                <th>Hábito</th>
                <th>Streak</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="4" class="muted">Nenhum hábito cadastrado ainda.</td></tr>`}</tbody>
          </table>
        </div>
      </section>

      <section class="card habits-stats-card card--12">
        <div class="card__header">
          <div>
            <div class="card__title">📊 ESTATÍSTICAS DOS HÁBITOS</div>
            <div class="card__subtitle">Visão geral do desempenho</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">${s.habits.length}</div>
              <div class="stat-label">Total cadastrados</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${s.habits.filter((h) => h.active).length}</div>
              <div class="stat-label">Ativos hoje</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${Math.round(getWeeklyHabitCompletionRate(s) * 100)}%</div>
              <div class="stat-label">Taxa (7 dias)</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${Math.max(...s.habits.map((h) => h.streak || 0), 0)}</div>
              <div class="stat-label">Maior streak</div>
            </div>
          </div>
          <canvas id="habitHeatmap" class="canvas" width="1000" height="200"></canvas>
        </div>
      </section>
    </div>
  `;
}

function addictionsView(s) {
  const rows = s.addictions
    .map((a) => {
      const analysis = analyzeRelapsePatterns(a.id);
      return `
        <tr>
          <td>
            <div style="font-weight:750">${esc(a.name)}</div>
            <div class="muted" style="font-size:12px">Streak limpo: ${a.streak || 0} • Máx: ${a.maxStreak || 0}</div>
          </td>
          <td><span class="pill">${a.relapseHistory?.length || 0}</span></td>
          <td class="muted">${esc(analysis.insight || '')}</td>
          <td style="width:260px">
            <div class="row" style="justify-content:flex-end">
              <button class="btn btn--danger" type="button" data-action="relapse" data-id="${esc(a.id)}">Recaída</button>
              <button class="btn" type="button" data-action="removeAddiction" data-id="${esc(a.id)}">Remover</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="grid addictions-grid">
      <section class="card addictions-form-card card--4">
        <div class="card__header">
          <div>
            <div class="card__title">Novo Inimigo</div>
            <div class="card__subtitle">Monitore seus adversários para vencer</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="field">
            <div class="label">Nome</div>
            <input id="addictionName" class="input" placeholder="Ex: pornografia, açúcar, redes sociais" />
          </div>
          <button class="btn btn--primary" type="button" data-action="addAddiction">Adicionar</button>
          <div class="muted">Cada recaída registra horário e trigger para análise.</div>
        </div>
      </section>

      <section class="card addictions-list-card card--8">
        <div class="card__header">
          <div>
            <div class="card__title">Salão dos Inimigos</div>
            <div class="card__subtitle">Insights estratégicos a partir das batalhas</div>
          </div>
        </div>
        <div class="card__body">
          <table class="table">
            <thead><tr><th>Inimigo</th><th>Recaídas</th><th>Insight</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4" class="muted">Adicione um inimigo para monitorar.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function sleepView(s) {
  const last = s.sleep.lastSleepEntry;
  const weekly = getWeeklySleepAnalysis();

  const lastHTML = last
    ? `<div class="row"><span class="muted">Último descanso</span><span class="${pillVariantForClassification(last.classification)}">${esc(last.classification)} • ${last.hours}h</span></div>`
    : `<div class="muted">Sem registros ainda.</div>`;

  return `
    <div class="grid">
      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Descanso Sagrado</div>
            <div class="card__subtitle">Dois modos: horários ou horas manuais</div>
          </div>
          <span class="pill">Streak: ${s.sleep.streak || 0}</span>
        </div>
        <div class="card__body stack">
          ${lastHTML}

          <div class="grid" style="grid-template-columns:repeat(12,1fr)">
            <div class="field" style="grid-column:span 6">
              <div class="label">Dormiu</div>
              <input id="sleepTime" class="input" type="time" value="23:30" />
            </div>
            <div class="field" style="grid-column:span 6">
              <div class="label">Acordou</div>
              <input id="wakeTime" class="input" type="time" value="07:00" />
            </div>
          </div>
          <button class="btn btn--primary" type="button" data-action="logSleepTimes">Registrar por horário</button>

          <div class="field">
            <div class="label">Horas (manual)</div>
            <input id="sleepHours" class="input" type="number" step="0.1" min="0" placeholder="Ex: 7.5" />
          </div>
          <button class="btn" type="button" data-action="logSleepHours">Registrar horas</button>
        </div>
      </section>

      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Ritual do Sono</div>
            <div class="card__subtitle">Proteja seu próximo ciclo de energia e XP</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="field">
            <div class="label">Horário-alvo</div>
            <input id="targetBedtime" class="input" type="time" value="${esc(s.sleep.targetBedtime)}" />
          </div>
          <button class="btn btn--primary" type="button" data-action="saveBedtime">Salvar meta</button>
          <div class="row"><span class="muted">Zona de risco</span><span class="${s.sleep.riskZone ? 'pill pill--warn' : 'pill'}">${s.sleep.riskZone ? 'Ativa' : 'Inativa'}</span></div>
          <div class="row"><span class="muted">Contagem</span><span class="pill">${getRiskCountdown() || '--:--'}</span></div>
          <button class="btn btn--ghost" type="button" data-action="promptDelay">Registrar motivo de atraso</button>
        </div>
      </section>

      <section class="card">
        <div class="card__header">
          <div>
            <div class="card__title">Crônica do Sono</div>
            <div class="card__subtitle">Consistência e média (últimos 7 dias)</div>
          </div>
          <span class="pill">Média: ${weekly.avgHours}h${weekly.avgBedtime ? ` • Dormir: ${esc(weekly.avgBedtime)}` : ''}</span>
        </div>
        <div class="card__body stack">
          <div class="row"><span class="muted">Consistência</span><span>${Math.round(weekly.consistency * 100)}%</span></div>
          <canvas id="sleepConsistency" class="canvas" width="1000" height="280"></canvas>
        </div>
      </section>
    </div>
  `;
}

function studiesView(s) {
  const { timerMinutes, timerSeconds, isRunning, isPaused, notes } = s.studies || {};
  const displayMinutes = String(timerMinutes || 25).padStart(2, '0');
  const displaySeconds = String(timerSeconds || 0).padStart(2, '0');

  const fc = s.studies?.flashcards || {};
  const cards = Array.isArray(fc.cards) ? fc.cards : [];
  const ui = fc.ui || { reviewing: false, currentId: null, revealed: false };
  const stats = getFlashcardsStats();
  const current = ui.currentId ? cards.find((c) => c.id === ui.currentId) : null;

  return `
    <div class="grid studies-grid">
      <section class="card studies-timer-card">
        <div class="card__header">
          <div>
            <div class="card__title">Foco Arcano</div>
            <div class="card__subtitle">Timer personalizável para sessões de estudo</div>
          </div>
        </div>
        <div class="card__body">
          <div class="timer-container">
            <div class="timer-display ${isRunning && !isPaused ? 'timer-display--active' : ''}">
              <span class="timer-minutes">${displayMinutes}</span>
              <span class="timer-separator">:</span>
              <span class="timer-seconds">${displaySeconds}</span>
            </div>
            <div class="timer-status">
              ${isRunning ? (isPaused ? 'Pausado' : 'Foco ativo') : 'Pronto para iniciar'}
            </div>
          </div>
          
          <div class="timer-controls">
            <div class="field">
              <div class="label">Duração (minutos)</div>
              <input id="studyTimerMinutes" class="input" type="number" min="1" max="180" value="${timerMinutes || 25}" />
            </div>
            
            <div class="timer-buttons">
              <button class="btn btn--primary timer-btn timer-btn--start" type="button" data-action="startTimer" ${isRunning ? 'disabled' : ''}>
                ${isPaused ? 'Retomar' : 'Iniciar'}
              </button>
              <button class="btn timer-btn timer-btn--pause" type="button" data-action="pauseTimer" ${!isRunning || isPaused ? 'disabled' : ''}>
                Pausar
              </button>
              <button class="btn timer-btn timer-btn--reset" type="button" data-action="resetTimer">
                Resetar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="card studies-notes-card">
        <div class="card__header">
          <div>
            <div class="card__title">Grimório de Notas</div>
            <div class="card__subtitle">Anotações da sessão (salvas automaticamente)</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="field">
            <div class="label">Anotações</div>
            <textarea id="studyNotes" class="input notes-textarea" rows="12" placeholder="Escreva suas anotações, resumos, ideias...">${esc(notes || '')}</textarea>
          </div>
          <div class="row notes-actions" style="justify-content:flex-end">
            <button class="btn btn--ghost notes-btn" type="button" data-action="clearNotes">Limpar</button>
            <button class="btn notes-btn notes-btn--primary" type="button" data-action="saveNotes">Salvar</button>
          </div>
        </div>
      </section>

      <section class="card studies-flashcards-card">
        <div class="card__header">
          <div>
            <div class="card__title">Flashcards</div>
            <div class="card__subtitle">Revisão espaçada (para hoje: ${stats.due}/${stats.total})</div>
          </div>
          <div class="row" style="justify-content:flex-end;gap:8px">
            <button class="btn btn--ghost" type="button" data-action="fcStart" ${stats.due ? '' : 'disabled'}>Revisar</button>
            <button class="btn btn--ghost" type="button" data-action="fcStop" ${ui.reviewing ? '' : 'disabled'}>Parar</button>
          </div>
        </div>
        <div class="card__body stack">
          <div class="flashcards-review ${ui.reviewing ? 'is-reviewing' : ''}">
            ${ui.reviewing
              ? current
                ? `
              <div class="flashcard">
                <div class="flashcard__label">Pergunta</div>
                <div class="flashcard__front">${esc(current.front)}</div>
                ${ui.revealed
                  ? `
                  <div class="flashcard__divider"></div>
                  <div class="flashcard__label">Resposta</div>
                  <div class="flashcard__back">${esc(current.back)}</div>
                  `
                  : ''}
              </div>
              <div class="flashcard__actions">
                ${ui.revealed
                  ? `
                    <button class="btn btn--ghost" type="button" data-action="fcGrade" data-grade="0" data-id="${esc(current.id)}">Errei</button>
                    <button class="btn btn--ghost" type="button" data-action="fcGrade" data-grade="3" data-id="${esc(current.id)}">Difícil</button>
                    <button class="btn" type="button" data-action="fcGrade" data-grade="4" data-id="${esc(current.id)}">Bom</button>
                    <button class="btn" type="button" data-action="fcGrade" data-grade="5" data-id="${esc(current.id)}">Fácil</button>
                  `
                  : `
                    <button class="btn btn--primary" type="button" data-action="fcReveal">Mostrar resposta</button>
                `}
              </div>
                `
                : `<div class="muted">Nada para revisar agora. Volte mais tarde.</div>`
              : `<div class="muted">Inicie uma sessão de revisão para começar.</div>`}
          </div>

          ${!ui.reviewing ? `
            <div class="flashcards-editor">
              <div class="field">
                <div class="label">Frente (pergunta)</div>
                <input id="fcFront" class="input" type="text" placeholder="Digite a pergunta..." />
              </div>
              <div class="field">
                <div class="label">Verso (resposta)</div>
                <textarea id="fcBack" class="input" rows="3" placeholder="Digite a resposta..."></textarea>
              </div>
              <div class="row" style="justify-content:flex-end;gap:8px">
                <button class="btn btn--ghost" type="button" data-action="fcImport">Importar</button>
                <button class="btn btn--primary" type="button" data-action="fcAdd">Adicionar</button>
              </div>
            </div>

            <div class="flashcards-list">
              <div class="card__title" style="margin-bottom:8px">Todos os flashcards (${cards.length})</div>
              ${cards.length > 0 ? `
                <div class="flashcards-grid">
                  ${cards.map(card => `
                    <div class="flashcard-item" data-id="${esc(card.id)}">
                      <div class="flashcard-item__front">${esc(card.front)}</div>
                      <div class="flashcard-item__back">${esc(card.back)}</div>
                      <div class="flashcard-item__meta">
                        Próxima revisão: ${card.nextReview ? new Date(card.nextReview).toLocaleDateString('pt-BR') : 'Aguardando'}
                      </div>
                      <button class="btn btn--ghost btn--small" type="button" data-action="fcDelete" data-id="${esc(card.id)}">Remover</button>
                    </div>
                  `).join('')}
                </div>
              ` : '<div class="muted">Nenhum flashcard criado ainda.</div>'}
            </div>
          ` : ''}
        </div>
      </section>
    </div>
  `;
}

function analyticsView() {
  return `
    <div class="grid">
      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Crônica de XP</div>
            <div class="card__subtitle">Ganho acumulado e picos ao longo do tempo</div>
          </div>
        </div>
        <div class="card__body">
          <canvas id="xpChart" class="canvas" width="1000" height="280"></canvas>
        </div>
      </section>

      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Sono Semanal</div>
            <div class="card__subtitle">Horas por dia</div>
          </div>
        </div>
        <div class="card__body">
          <canvas id="sleepChart" class="canvas" width="1000" height="280"></canvas>
        </div>
      </section>

      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Batalhas por Hora</div>
            <div class="card__subtitle">Distribuição de recaídas por hora (0–23)</div>
          </div>
        </div>
        <div class="card__body">
          <canvas id="relapseChart" class="canvas" width="1000" height="280"></canvas>
        </div>
      </section>

      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Dias Lendários</div>
            <div class="card__subtitle">% de dias com missões completas + descanso sagrado</div>
          </div>
        </div>
        <div class="card__body stack">
          <div id="perfectRate" class="kpi"></div>
          <canvas id="perfectChart" class="canvas" width="1000" height="280"></canvas>
        </div>
      </section>
    </div>
  `;
}

function settingsView(s) {
  const presets = getThemePresets();

  return `
    <div class="grid">
      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Temas Épicos</div>
            <div class="card__subtitle">Variáveis CSS + persistência</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="field">
            <div class="label">Preset</div>
            ${renderThemeDropdown(s.settings.theme || 'rpg', presets)}
          </div>
          <div class="grid" style="grid-template-columns:repeat(12,1fr)">
            <div class="field" style="grid-column:span 6">
              <div class="label">Cor primária</div>
              <input id="primaryColor" class="input" type="color" value="${esc(s.settings.primaryColor)}" />
            </div>
            <div class="field" style="grid-column:span 6">
              <div class="label">Cor XP</div>
              <input id="xpBarColor" class="input" type="color" value="${esc(s.settings.xpBarColor)}" />
            </div>
          </div>
          <div class="row">
            <span class="muted">Dark mode</span>
            <button class="btn" type="button" data-action="toggleDark">${s.settings.darkMode ? 'Ativo' : 'Inativo'}</button>
          </div>
          <button class="btn btn--primary" type="button" data-action="saveTheme">Aplicar</button>
        </div>
      </section>

      <section class="card card--6">
        <div class="card__header">
          <div>
            <div class="card__title">Arcanos do Sistema</div>
            <div class="card__subtitle">XP por nível, penalidades e multiplicadores</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="field">
            <div class="label">XP por nível (xpPerLevel)</div>
            <input id="xpPerLevel" class="input" type="number" min="20" value="${Number(s.character.xpPerLevel || 120)}" />
          </div>
          <div class="field">
            <div class="label">Penalidade de recaída (XP)</div>
            <input id="relapsePenalty" class="input" type="number" min="0" value="${Number(s.settings.relapsePenalty || 0)}" />
          </div>
          <div class="row">
            <span class="muted">Penalidades</span>
            <button class="btn" type="button" data-action="togglePenalties">${s.settings.penaltiesEnabled ? 'Ativas' : 'Desativadas'}</button>
          </div>
          <div class="field">
            <div class="label">Event modifier (multiplicador global)</div>
            <input id="eventModifier" class="input" type="number" step="0.05" min="0" value="${Number(s.settings.eventModifier || 1)}" />
          </div>
          <div class="row">
            <span class="muted">XP mod do sono</span>
            <button class="btn" type="button" data-action="toggleSleepMod">${s.settings.xpModifierFromSleep ? 'Ativo' : 'Inativo'}</button>
          </div>
          <button class="btn btn--primary" type="button" data-action="saveAdvanced">Salvar</button>
        </div>
      </section>

      <section class="card">
        <div class="card__header">
          <div>
            <div class="card__title">Tomo do Destino</div>
            <div class="card__subtitle">Importe, exporte ou resete seu reinado</div>
          </div>
        </div>
        <div class="card__body stack">
          <div class="field">
            <div class="label">JSON</div>
            <textarea id="stateJson" class="input" rows="10" placeholder="Cole aqui para importar ou clique em exportar..."></textarea>
          </div>
          <div class="row" style="flex-wrap:wrap;justify-content:flex-end">
            <button class="btn" type="button" data-action="exportJson">Exportar</button>
            <button class="btn" type="button" data-action="importJson">Importar</button>
            <button class="btn btn--danger" type="button" data-action="resetAll">Reset total</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function mountOnce() {
  if (mounted) return;
  mounted = true;

  // Subscribe apenas para atualizar elementos que não são a view principal
  subscribe(() => {
    const s = getState();
    // Apenas atualiza o phase badge, não re-renderiza a view inteira
    const phaseBadge = document.getElementById('phaseBadge');
    if (phaseBadge) {
      phaseBadge.textContent = `${s.character.phase} • Nv ${s.character.level}`;
    }
  });

  document.addEventListener('click', (e) => {
    // Handle theme dropdown trigger first
    const themeDropdownTrigger = document.getElementById('themeDropdownTrigger');
    const themeDropdown = document.getElementById('themeDropdown');
    if (themeDropdownTrigger && themeDropdown) {
      if (e.target === themeDropdownTrigger || themeDropdownTrigger.contains(e.target)) {
        e.stopPropagation();
        themeDropdown.classList.toggle('is-open');
        return;
      }

      // Handle theme dropdown item selection
      const item = e.target.closest('.theme-dropdown__item');
      if (item && themeDropdown.contains(item)) {
        const selectedTheme = item.dataset.theme;
        if (selectedTheme) {
          setTheme(selectedTheme);
          // Re-render settings to update the dropdown
          const s = getState();
          const viewEl = document.getElementById('view');
          if (viewEl && currentRoute === 'settings') {
            viewEl.innerHTML = settingsView(s);
          }
        }
        return;
      }

      // Close dropdown when clicking outside
      if (!themeDropdown.contains(e.target)) {
        themeDropdown.classList.remove('is-open');
      }
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'addHabit') {
      const name = document.getElementById('habitName')?.value;
      const xp = document.getElementById('habitXp')?.value;
      const attr = document.getElementById('habitAttr')?.value;
      const frequency = document.getElementById('habitFrequency')?.value;
      addHabit({ name, xpReward: xp, attributeAffected: attr, frequency });
      
      // Clear form
      document.getElementById('habitName').value = '';
      document.getElementById('habitXp').value = '';
      document.getElementById('habitFrequency').value = 'daily';
      
      pushToast({ title: 'Hábito criado', description: 'Hábito cadastrado com sucesso!', variant: 'good' });
    }

    if (action === 'toggleHabitActive') {
      toggleHabitActive(btn.dataset.id);
      const s = getState();
      const habit = s.habits.find(h => h.id === btn.dataset.id);
      pushToast({ 
        title: 'Status atualizado', 
        description: `Hábito ${habit?.active ? 'ativado' : 'desativado'}.`, 
        variant: 'good' 
      });
    }

    if (action === 'addTask') {
      const name = document.getElementById('taskName')?.value;
      const xp = document.getElementById('taskXp')?.value;
      addTask({ name, xpReward: xp, type: 'daily' });
      
      // Clear form
      document.getElementById('taskName').value = '';
      document.getElementById('taskXp').value = '';
      
      pushToast({ title: 'Tarefa adicionada', description: 'Tarefa manual criada para hoje!', variant: 'good' });
    }

    if (action === 'toggleDailyTask') {
      toggleDailyTask(btn.dataset.id);
    }

    if (action === 'toggleTask') toggleTaskCompletion(btn.dataset.id);
    if (action === 'removeTask') removeTask(btn.dataset.id);

    if (action === 'toggleHabit') toggleHabitCompletion(btn.dataset.id);
    if (action === 'removeHabit') removeHabit(btn.dataset.id);

    if (action === 'addAddiction') {
      const name = document.getElementById('addictionName')?.value;
      addAddiction({ name });
    }

    if (action === 'removeAddiction') removeAddiction(btn.dataset.id);
    if (action === 'relapse') openRelapseModal(btn.dataset.id);

    if (action === 'goSleep') {
      const now = new Date();
      logSleepByTimes({ sleepTime: '23:00', wakeTime: '07:00', date: now });
    }

    if (action === 'logSleepTimes') {
      const sleepTime = document.getElementById('sleepTime')?.value;
      const wakeTime = document.getElementById('wakeTime')?.value;
      if (sleepTime && wakeTime) logSleepByTimes({ sleepTime, wakeTime });
    }

    if (action === 'logSleepHours') {
      const hours = parseFloat(document.getElementById('sleepHours')?.value);
      if (hours && hours > 0) logSleepByHours({ hours });
    }

    if (action === 'saveBedtime') {
      const target = document.getElementById('targetBedtime')?.value;
      if (target) setTargetBedtime(target);
    }

    if (action === 'promptDelay') {
      promptDelayReasonIfLate();
    }

    if (action === 'saveTheme') {
      const primary = document.getElementById('primaryColor')?.value;
      const xpBar = document.getElementById('xpBarColor')?.value;
      updateSetting('primaryColor', primary);
      updateSetting('xpBarColor', xpBar);
      pushToast({ title: 'Tema salvo', description: 'Cores atualizadas.', variant: 'good' });
    }

    if (action === 'toggleDark') {
      const s = getState();
      updateSetting('darkMode', !s.settings.darkMode);
    }

    if (action === 'saveAdvanced') {
      const xpPerLevel = Number(document.getElementById('xpPerLevel')?.value);
      const relapsePenalty = Number(document.getElementById('relapsePenalty')?.value);
      const eventModifier = Number(document.getElementById('eventModifier')?.value);
      if (xpPerLevel > 0) setState((draft) => (draft.character.xpPerLevel = xpPerLevel));
      if (relapsePenalty >= 0) updateSetting('relapsePenalty', relapsePenalty);
      if (eventModifier >= 0) updateSetting('eventModifier', eventModifier);
      pushToast({ title: 'Config salva', description: 'Preferências avançadas atualizadas.', variant: 'good' });
    }

    if (action === 'togglePenalties') {
      const s = getState();
      updateSetting('penaltiesEnabled', !s.settings.penaltiesEnabled);
    }

    if (action === 'toggleSleepMod') {
      const s = getState();
      updateSetting('xpModifierFromSleep', !s.settings.xpModifierFromSleep);
    }

    if (action === 'exportJson') {
      const s = getState();
      const json = JSON.stringify(s, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habit-quest-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    if (action === 'importJson') {
      const txt = document.getElementById('stateJson')?.value;
      if (!txt) return;
      try {
        const parsed = JSON.parse(txt);
        replaceState(parsed);
        pushToast({ title: 'Importado com sucesso', description: 'Estado aplicado.', variant: 'good' });
      } catch {
        pushToast({ title: 'JSON inválido', description: 'Verifique a estrutura.', variant: 'danger' });
      }
    }

    if (action === 'resetAll') {
      openModal({
        title: 'Reset total',
        contentHTML: '<div class="muted">Tem certeza? Isso apagará tudo.</div>',
        actions: [
          { label: 'Cancelar', kind: 'ghost', onClick: () => {} },
          {
            label: 'Resetar',
            kind: 'danger',
            onClick: () => {
              resetState();
              window.location.reload();
            },
          },
        ],
      });
    }

    // Studies timer actions
    if (action === 'startTimer') {
      const minutes = parseInt(document.getElementById('studyTimerMinutes')?.value || 25);
      setState((draft) => {
        draft.studies.timerMinutes = minutes;
        draft.studies.timerSeconds = 0;
        draft.studies.isRunning = true;
        draft.studies.isPaused = false;
      });
    }

    if (action === 'pauseTimer') {
      setState((draft) => {
        draft.studies.isPaused = true;
      });
    }

    if (action === 'resetTimer') {
      setState((draft) => {
        draft.studies.isRunning = false;
        draft.studies.isPaused = false;
        draft.studies.timerSeconds = 0;
      });
    }

    if (action === 'saveNotes') {
      const notes = document.getElementById('studyNotes')?.value || '';
      setState((draft) => {
        draft.studies.notes = notes;
      });

      const textarea = document.getElementById('studyNotes');
      if (textarea) {
        textarea.classList.remove('is-saved');
        requestAnimationFrame(() => {
          textarea.classList.add('is-saved');
          setTimeout(() => textarea.classList.remove('is-saved'), 420);
        });
      }

      pushToast({ title: 'Notas salvas', description: 'Anotações da sessão salvas.', variant: 'good' });
    }

    if (action === 'clearNotes') {
      if (confirm('Limpar todas as anotações?')) {
        setState((draft) => {
          draft.studies.notes = '';
        });
        const textarea = document.getElementById('studyNotes');
        if (textarea) textarea.value = '';
        pushToast({ title: 'Notas limpas', description: 'Anotações foram removidas.', variant: 'good' });
      }
    }

    if (action === 'fcAdd') {
      const front = document.getElementById('fcFront')?.value;
      const back = document.getElementById('fcBack')?.value;
      addFlashcard({ front, back });
      const f = document.getElementById('fcFront');
      const b = document.getElementById('fcBack');
      if (f) f.value = '';
      if (b) b.value = '';
      pushToast({ title: 'Flashcard criado', description: 'Adicionado à sua coleção.', variant: 'good' });
    }

    if (action === 'fcImport') {
      const raw = prompt('Cole os flashcards no formato: frente :: verso (um por linha)');
      if (raw) {
        const res = importFlashcardsFromText(raw);
        pushToast({ title: 'Importação concluída', description: `Adicionados: ${res.added} • Ignorados: ${res.skipped}`, variant: 'good' });
      }
    }

    if (action === 'fcDelete') {
      removeFlashcard(btn.dataset.id);
      pushToast({ title: 'Removido', description: 'Flashcard removido.', variant: 'good' });
    }

    if (action === 'fcStart') {
      startFlashcardsReview();
    }

    if (action === 'fcStop') {
      stopFlashcardsReview();
    }

    if (action === 'fcReveal') {
      revealFlashcardAnswer();
    }

    if (action === 'fcGrade') {
      const id = btn.dataset.id;
      const grade = Number(btn.dataset.grade);
      if (id) gradeFlashcard(id, grade);
    }
  });

  // Studies timer interval with enhanced animations
  setInterval(() => {
    const s = getState();
    if (s.studies?.isRunning && !s.studies?.isPaused) {
      let { timerMinutes, timerSeconds } = s.studies;
      
      // Animate seconds change
      const secondsEl = document.querySelector('.timer-seconds');
      const minutesEl = document.querySelector('.timer-minutes');
      
      if (timerSeconds > 0) {
        timerSeconds--;
        if (secondsEl) {
          secondsEl.style.transform = 'scale(1.1)';
          setTimeout(() => {
            secondsEl.style.transform = 'scale(1)';
          }, 200);
        }
      } else if (timerMinutes > 0) {
        timerMinutes--;
        timerSeconds = 59;
        // Animate minutes change
        if (minutesEl) {
          minutesEl.style.transform = 'scale(1.1)';
          setTimeout(() => {
            minutesEl.style.transform = 'scale(1)';
          }, 200);
        }
      } else {
        // Timer finished
        setState((draft) => {
          draft.studies.isRunning = false;
          draft.studies.isPaused = false;
        });
        
        // Completion animation
        const timerDisplay = document.querySelector('.timer-display');
        if (timerDisplay) {
          timerDisplay.style.animation = 'timerComplete 0.6s ease-out';
          setTimeout(() => {
            timerDisplay.style.animation = '';
          }, 600);
        }
        
        pushToast({ title: 'Tempo esgotado!', description: 'Sessão de estudo concluída.', variant: 'good' });
        return;
      }
      
      setState((draft) => {
        draft.studies.timerMinutes = timerMinutes;
        draft.studies.timerSeconds = timerSeconds;
      });
    }
  }, 1000);
}

function renderRoute(route, s) {
  let result;
  // Identificação da rota para debug
  const routeComment = `<!-- Route: ${route} -->`;
  if (route === 'dashboard') result = routeComment + dashboardView(s);
  else if (route === 'tasks') result = routeComment + tasksView(s);
  else if (route === 'habits') result = routeComment + habitsView(s);
  else if (route === 'addictions') result = routeComment + addictionsView(s);
  else if (route === 'sleep') result = routeComment + sleepView(s);
  else if (route === 'analytics') result = routeComment + analyticsView();
  else if (route === 'studies') result = routeComment + studiesView(s);
  else if (route === 'settings') result = routeComment + settingsView(s);
  else result = routeComment + '<div style="padding:2rem">Página não encontrada.</div>';
  return result;
}

export function renderAppShell(route) {
  mountOnce();
  
  // Sempre atualiza a rota atual global
  currentRoute = route;

  const s = getState();
  const view = document.getElementById('view');
  if (!view) {
    return;
  }

  // Renderização imediata sem delay
  const content = renderRoute(route, s);
  view.innerHTML = content;

  if (route === 'analytics') {
    renderAnalytics();
  }

  if (route === 'sleep') {
    renderAnalytics({ mode: 'sleepOnly' });
  }
}

export function pushToast({ title, description, variant }) {
  const host = document.getElementById('toastHost');
  if (!host) return;

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <div class="toast__title">${esc(title)}</div>
    ${description ? `<div class="toast__desc">${esc(description)}</div>` : ''}
  `;

  if (variant === 'danger') el.style.borderColor = 'rgba(255, 77, 109, 0.55)';
  if (variant === 'warn') el.style.borderColor = 'rgba(255, 183, 3, 0.55)';
  if (variant === 'good') el.style.borderColor = 'rgba(61, 220, 151, 0.55)';

  host.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

let modalListener = null;

export function openModal({ title, contentHTML, actions }) {
  const host = document.getElementById('modalHost');
  if (!host) return;

  if (modalListener) {
    host.removeEventListener('click', modalListener);
    modalListener = null;
  }

  host.classList.add('is-open');

  host.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header">
        <div class="modal__title">${esc(title)}</div>
      </div>
      <div class="modal__body">${contentHTML}</div>
      <div class="modal__footer">
        ${(actions || [])
          .map((a, i) => {
            const kind = a.kind === 'danger' ? 'btn btn--danger' : a.kind === 'primary' ? 'btn btn--primary' : 'btn btn--ghost';
            return `<button class="${kind}" type="button" data-modal-action="${i}">${esc(a.label)}</button>`;
          })
          .join('')}
      </div>
    </div>
  `;

  const close = () => {
    host.classList.remove('is-open');
    host.innerHTML = '';
    if (modalListener) {
      host.removeEventListener('click', modalListener);
      modalListener = null;
    }
  };

  modalListener = (e) => {
    const btn = e.target.closest('[data-modal-action]');
    if (btn) {
      const idx = Number(btn.dataset.modalAction);
      const act = actions?.[idx];
      if (act?.onClick) act.onClick();
      close();
      return;
    }

    if (e.target === host) close();
  };

  host.addEventListener('click', modalListener);
}

export function ensureOnboarding() {
  const s = getState();
  if (s.__meta?.onboarded) return;

  openModal({
    title: 'Qual o seu nome?',
    contentHTML: `
      <div class="stack">
        <div class="field">
          <div class="label">Nome</div>
          <input id="onboardName" class="input" placeholder="Digite seu nome" value="${esc(s.character?.name || '')}" />
        </div>
        <div class="muted">Você pode mudar depois (export/import ou ajustando o estado).</div>
      </div>
    `,
    actions: [
      {
        label: 'Continuar',
        kind: 'primary',
        onClick: () => {
          const v = document.getElementById('onboardName')?.value;
          const name = String(v ?? '').trim();
          setState((draft) => {
            draft.character.name = name || 'Você';
            draft.__meta.onboarded = true;
          });
          pushToast({ title: 'Pronto!', description: `Bem vindo, ${name || 'Você'}.`, variant: 'good' });
        },
      },
    ],
  });
}
