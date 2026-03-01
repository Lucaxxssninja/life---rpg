import { getState, setState, getTodayISO } from './state.js';

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function clearCanvas(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawGrid(ctx) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;

  const stepX = w / 10;
  const stepY = h / 6;

  for (let i = 1; i < 10; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * stepX, 0);
    ctx.lineTo(i * stepX, h);
    ctx.stroke();
  }

  for (let i = 1; i < 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, i * stepY);
    ctx.lineTo(w, i * stepY);
    ctx.stroke();
  }
}

function drawLineChart(ctx, points, { stroke, fill } = {}) {
  if (!points.length) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const pad = 24;

  const sx = (x) => {
    if (maxX === minX) return pad;
    return pad + ((x - minX) / (maxX - minX)) * (w - pad * 2);
  };
  const sy = (y) => {
    if (maxY === minY) return h - pad;
    return h - pad - ((y - minY) / (maxY - minY)) * (h - pad * 2);
  };

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = sx(p.x);
    const y = sy(p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle = stroke || getCssVar('--primary-color') || '#6d5efc';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (fill) {
    ctx.lineTo(sx(points[points.length - 1].x), h - pad);
    ctx.lineTo(sx(points[0].x), h - pad);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function drawBars(ctx, values, { barColor } = {}) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const pad = 24;

  const max = Math.max(1, ...values);
  const barW = (w - pad * 2) / values.length;

  values.forEach((v, i) => {
    const x = pad + i * barW;
    const barH = ((v || 0) / max) * (h - pad * 2);
    const y = h - pad - barH;

    ctx.fillStyle = barColor || getCssVar('--xp-bar-color') || '#3ddc97';
    ctx.fillRect(x + 2, y, Math.max(1, barW - 4), barH);
  });
}

function get7DayWindowDates() {
  const now = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function recomputePerfectDay() {
  const s = getState();
  const today = getTodayISO();

  const allHabitsDone = s.habits.length > 0 && s.habits.every((h) => h.completedToday);
  const sleepLoggedToday = s.sleep.lastSleepEntry?.date === today;

  const isPerfect = Boolean(allHabitsDone && sleepLoggedToday);

  setState((draft) => {
    if (!Array.isArray(draft.stats.perfectDays)) draft.stats.perfectDays = [];

    const idx = draft.stats.perfectDays.findIndex((d) => d.date === today);
    if (idx >= 0) {
      draft.stats.perfectDays[idx].perfect = isPerfect;
    } else {
      draft.stats.perfectDays.push({ date: today, perfect: isPerfect });
    }

    draft.stats.perfectDays = draft.stats.perfectDays.slice(-120);
  });
}

function renderPerfectRate() {
  const s = getState();
  const list = s.stats.perfectDays || [];
  const windowDates = get7DayWindowDates();

  const items = windowDates.map((d) => list.find((x) => x.date === d)?.perfect === true);
  const perfectCount = items.filter(Boolean).length;
  const rate = Math.round((perfectCount / 7) * 100);

  const el = document.getElementById('perfectRate');
  if (!el) return;

  el.innerHTML = `
    <div class="kpi__value">${rate}%</div>
    <div class="kpi__label">dias perfeitos (7 dias)</div>
  `;

  const canvas = document.getElementById('perfectChart');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  clearCanvas(ctx);
  drawGrid(ctx);

  const values = items.map((v) => (v ? 1 : 0));
  drawBars(ctx, values, { barColor: getCssVar('--primary-color') });
}

function renderXpChart() {
  const s = getState();
  const canvas = document.getElementById('xpChart');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  clearCanvas(ctx);
  drawGrid(ctx);

  const timeline = (s.stats.xpTimeline || []).slice(-60);
  if (!timeline.length) return;

  let cumulative = 0;
  const points = timeline.map((e) => {
    cumulative += Number(e.xpDelta || 0);
    return { x: Number(e.ts || 0), y: cumulative };
  });

  drawLineChart(ctx, points, {
    stroke: getCssVar('--primary-color'),
    fill: 'rgba(109, 94, 252, 0.12)',
  });
}

function renderSleepChart() {
  const s = getState();
  const canvas = document.getElementById('sleepChart');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  clearCanvas(ctx);
  drawGrid(ctx);

  const windowDates = get7DayWindowDates();
  const byDate = new Map((s.sleep.history || []).map((e) => [e.date, e]));
  const values = windowDates.map((d) => Number(byDate.get(d)?.hours || 0));
  drawBars(ctx, values, { barColor: getCssVar('--xp-bar-color') });
}

function renderRelapseDistribution() {
  const s = getState();
  const canvas = document.getElementById('relapseChart');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  clearCanvas(ctx);
  drawGrid(ctx);

  const counts = new Array(24).fill(0);
  (s.addictions || []).forEach((a) => {
    (a.relapseHistory || []).forEach((r) => {
      const hour = Number(String(r.time || '00:00').slice(0, 2));
      if (Number.isFinite(hour) && hour >= 0 && hour < 24) counts[hour] += 1;
    });
  });

  drawBars(ctx, counts, { barColor: 'rgba(255, 77, 109, 0.7)' });
}

function renderSleepConsistencyCanvas() {
  const canvas = document.getElementById('sleepConsistency');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const ctx = canvas.getContext('2d');
  clearCanvas(ctx);
  drawGrid(ctx);

  const s = getState();
  const windowDates = get7DayWindowDates();
  const byDate = new Map((s.sleep.history || []).map((e) => [e.date, e]));

  const points = windowDates.map((d, idx) => ({ x: idx, y: Number(byDate.get(d)?.hours || 0) }));
  drawLineChart(ctx, points, {
    stroke: getCssVar('--xp-bar-color'),
    fill: 'rgba(61, 220, 151, 0.10)',
  });
}

export function renderAnalytics(opts = {}) {
  const mode = opts.mode || 'full';

  if (mode === 'full') {
    renderXpChart();
    renderSleepChart();
    renderRelapseDistribution();
    renderPerfectRate();
    return;
  }

  if (mode === 'sleepOnly') {
    renderSleepConsistencyCanvas();
  }
}
