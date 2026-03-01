const STORAGE_KEY = 'habitQuest.v1.state';

let persistTimer = null;

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function persistState(state) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      
    }
  }, 80);
}

export function exportStateJSON(state) {
  return JSON.stringify(state, null, 2);
}

export function importStateJSON(json) {
  const parsed = JSON.parse(json);
  return parsed;
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}
