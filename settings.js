import { getState, setState } from './state.js';

export function getThemePresets() {
  return {
    rpg: {
      label: 'RPG Medieval',
      primaryColor: '#c9b037',
      xpBarColor: '#ff6b35',
      background: '#0d0f1b',
      text: '#f4e4c1',
      surface: 'rgba(201, 176, 55, 0.08)',
      surfaceStrong: 'rgba(201, 176, 55, 0.14)',
      border: 'rgba(201, 176, 55, 0.2)',
      font: "'Cinzel Decorative', 'Cinzel', 'IM Fell English', serif",
    },
    cosmos: {
      label: 'Roxo do Universo',
      primaryColor: '#a855f7',
      xpBarColor: '#22d3ee',
      background: '#070615',
      text: '#f5f3ff',
      surface: 'rgba(168, 85, 247, 0.08)',
      surfaceStrong: 'rgba(168, 85, 247, 0.14)',
      border: 'rgba(168, 85, 247, 0.22)',
      font: "'Cinzel Decorative', 'Cinzel', 'IM Fell English', serif",
      darkMode: true,
    },
    rose: {
      label: 'Rosa Astral',
      primaryColor: '#fb7185',
      xpBarColor: '#f472b6',
      background: '#12060b',
      text: '#fff1f2',
      surface: 'rgba(251, 113, 133, 0.08)',
      surfaceStrong: 'rgba(251, 113, 133, 0.14)',
      border: 'rgba(251, 113, 133, 0.22)',
      font: "'Cinzel Decorative', 'Cinzel', 'IM Fell English', serif",
      darkMode: true,
    },
    vino: {
      label: 'Vinho Arcano',
      primaryColor: '#7f1d1d',
      xpBarColor: '#fda4af',
      background: '#0f0607',
      text: '#fff1f2',
      surface: 'rgba(127, 29, 29, 0.10)',
      surfaceStrong: 'rgba(127, 29, 29, 0.16)',
      border: 'rgba(253, 164, 175, 0.18)',
      font: "'Cinzel Decorative', 'Cinzel', 'IM Fell English', serif",
      darkMode: true,
    },
    cyberpunk: {
      label: 'Cyberpunk',
      primaryColor: '#00ff88',
      xpBarColor: '#ff00ff',
      background: '#0a0a0a',
      text: '#e0e0e0',
      surface: 'rgba(0, 255, 136, 0.06)',
      surfaceStrong: 'rgba(0, 255, 136, 0.12)',
      border: 'rgba(0, 255, 136, 0.2)',
      font: "'Orbitron', 'Exo 2', sans-serif",
    },
    dracula: {
      label: 'Dracula',
      primaryColor: '#bd93f9',
      xpBarColor: '#ff79c6',
      background: '#1e1f29',
      text: '#f8f8f2',
      surface: 'rgba(189, 147, 249, 0.08)',
      surfaceStrong: 'rgba(189, 147, 249, 0.14)',
      border: 'rgba(189, 147, 249, 0.2)',
      font: "'Fira Code', 'Source Code Pro', monospace",
    },
    forest: {
      label: 'Floresta',
      primaryColor: '#4ade80',
      xpBarColor: '#fbbf24',
      background: '#0f1f0f',
      text: '#ecfccb',
      surface: 'rgba(74, 222, 128, 0.08)',
      surfaceStrong: 'rgba(74, 222, 128, 0.14)',
      border: 'rgba(74, 222, 128, 0.2)',
      font: "'Merriweather', 'Lora', serif",
    },
    ocean: {
      label: 'Oceano',
      primaryColor: '#38bdf8',
      xpBarColor: '#f97316',
      background: '#0c1929',
      text: '#e0f2fe',
      surface: 'rgba(56, 189, 248, 0.08)',
      surfaceStrong: 'rgba(56, 189, 248, 0.14)',
      border: 'rgba(56, 189, 248, 0.2)',
      font: "'Playfair Display', 'Cormorant Garamond', serif",
    },
    sunset: {
      label: 'Pôr do Sol',
      primaryColor: '#fb923c',
      xpBarColor: '#f43f5e',
      background: '#1a0f0f',
      text: '#fef3c7',
      surface: 'rgba(251, 146, 60, 0.08)',
      surfaceStrong: 'rgba(251, 146, 60, 0.14)',
      border: 'rgba(251, 146, 60, 0.2)',
      font: "'Bebas Neue', 'Oswald', sans-serif",
    },
  };
}

export function applySettingsToDocument(settings, presets) {
  const root = document.documentElement;
  const themeName = settings.theme || 'rpg';
  const preset = presets[themeName];

  const primary = settings.primaryColor || preset?.primaryColor || '#c9b037';
  const xpBar = settings.xpBarColor || preset?.xpBarColor || '#ff6b35';

  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--xp-bar-color', xpBar);

  if (preset?.background) root.style.setProperty('--background-color', preset.background);
  if (preset?.text) root.style.setProperty('--text-color', preset.text);
  if (preset?.surface) root.style.setProperty('--surface-color', preset.surface);
  if (preset?.surfaceStrong) root.style.setProperty('--surface-strong', preset.surfaceStrong);
  if (preset?.border) root.style.setProperty('--border-color', preset.border);
  if (preset?.font) root.style.setProperty('--font', preset.font);

  // Ensure muted and shadow adapt to theme
  if (preset?.text) {
    // Create a semi-transparent version of text color for muted
    const hex = preset.text.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    root.style.setProperty('--muted', `rgba(${r}, ${g}, ${b}, 0.7)`);
  }

  const darkMode = Boolean(settings.darkMode);
  root.setAttribute('data-theme', darkMode ? 'dark' : 'light');
}

export function setTheme(themeName) {
  const presets = getThemePresets();
  const preset = presets[themeName];
  if (!preset) return;

  setState((draft) => {
    draft.settings.theme = themeName;
    draft.settings.primaryColor = preset.primaryColor;
    draft.settings.xpBarColor = preset.xpBarColor;
    draft.settings.darkMode = preset.darkMode;
  });
}

export function toggleDarkMode() {
  const s = getState();
  setState((draft) => {
    draft.settings.darkMode = !Boolean(s.settings.darkMode);
  });
}

export function updateSetting(path, value) {
  setState((draft) => {
    const keys = path.split('.');
    let cur = draft;
    for (let i = 0; i < keys.length - 1; i += 1) {
      cur = cur[keys[i]];
      if (!cur) return;
    }
    cur[keys[keys.length - 1]] = value;
  });
}
