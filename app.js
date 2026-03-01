import { initAppState, subscribe, getState, setState } from './modules/state.js';
import { applySettingsToDocument, getThemePresets, toggleDarkMode } from './modules/settings.js';
import { renderAppShell, ensureOnboarding } from './modules/uiRenderer.js';
import { tickRiskZone } from './modules/sleepSystem.js';
import { runDailyRollover } from './modules/streakSystem.js';

const ROUTES = ['dashboard', 'tasks', 'habits', 'addictions', 'sleep', 'analytics', 'studies', 'settings'];

function getRoute() {
  const hash = window.location.hash || '#/dashboard';
  const route = hash.replace('#/', '').split('?')[0];
  return ROUTES.includes(route) ? route : 'dashboard';
}

function setActiveNav(route) {
  document.querySelectorAll('.nav__item').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.route === route);
  });
}

function wireTopbar() {
  const btn = document.getElementById('themeToggle');
  if (!btn) {
    return;
  }
  btn.addEventListener('click', () => {
    toggleDarkMode();
  });
}

function setupRouting() {
  const rerender = () => {
    const route = getRoute();
    setActiveNav(route);
    renderAppShell(route);
  };

  window.addEventListener('hashchange', rerender);
  rerender();
  
  // Chamar wireTopbar depois do render inicial para garantir que o botão exista no DOM
  setTimeout(() => {
    wireTopbar();
  }, 100);
}

function startIntervals() {
  setInterval(() => {
    runDailyRollover();
    tickRiskZone();
  }, 1000);
}

function bootstrap() {
  initAppState();

  const state = getState();
  applySettingsToDocument(state.settings, getThemePresets());

  subscribe((next) => {
    applySettingsToDocument(next.settings, getThemePresets());
    const phaseBadge = document.getElementById('phaseBadge');
    phaseBadge.textContent = `${next.character.phase} • Nv ${next.character.level}`;
  });

  setupRouting();
  startIntervals();

  setTimeout(ensureOnboarding, 200);

  setState((draft) => {
    draft.__booted = true;
  });
}

bootstrap();
