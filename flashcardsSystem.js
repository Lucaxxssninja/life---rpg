import { getState, setState } from './state.js';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalizeText(v) {
  return String(v ?? '').replaceAll('\r\n', '\n').trim();
}

function nowISO() {
  return new Date().toISOString();
}

function msFromDays(days) {
  return Math.round(days * 86400000);
}

function clampEase(e) {
  return Math.max(1.3, Number.isFinite(e) ? e : 2.5);
}

function computeNext({ prevIntervalDays, prevEase, prevReps, grade }) {
  const q = Math.max(0, Math.min(5, Number(grade)));
  const easeBefore = clampEase(prevEase);

  if (q < 3) {
    return {
      intervalDays: 1,
      ease: clampEase(easeBefore - 0.2),
      reps: 0,
      lapsesInc: 1,
    };
  }

  const reps = (Number(prevReps) || 0) + 1;
  let intervalDays;

  if (reps === 1) intervalDays = 1;
  else if (reps === 2) intervalDays = 6;
  else intervalDays = Math.max(1, Math.round((Number(prevIntervalDays) || 1) * easeBefore));

  const ease = clampEase(easeBefore + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  return { intervalDays, ease, reps, lapsesInc: 0 };
}

export function addFlashcard({ front, back, tags = [] }) {
  const f = normalizeText(front);
  const b = normalizeText(back);
  if (!f || !b) return;

  setState((draft) => {
    if (!draft.studies.flashcards) draft.studies.flashcards = { cards: [], ui: { reviewing: false, currentId: null, revealed: false } };
    if (!Array.isArray(draft.studies.flashcards.cards)) draft.studies.flashcards.cards = [];

    const createdAt = nowISO();
    draft.studies.flashcards.cards.push({
      id: uid(),
      front: f,
      back: b,
      tags: Array.isArray(tags) ? tags : [],
      createdAt,
      updatedAt: createdAt,
      dueAt: createdAt,
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      lastReviewedAt: null,
    });
  });
}

export function removeFlashcard(id) {
  setState((draft) => {
    const fc = draft.studies.flashcards;
    if (!fc || !Array.isArray(fc.cards)) return;
    fc.cards = fc.cards.filter((c) => c.id !== id);
    if (fc.ui?.currentId === id) {
      fc.ui.currentId = null;
      fc.ui.revealed = false;
    }
  });
}

export function importFlashcardsFromText(raw) {
  const text = normalizeText(raw);
  if (!text) return { added: 0, skipped: 0 };

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let added = 0;
  let skipped = 0;

  lines.forEach((line) => {
    const parts = line.includes('::') ? line.split('::') : line.split('|');
    if (parts.length < 2) {
      skipped += 1;
      return;
    }
    const front = normalizeText(parts[0]);
    const back = normalizeText(parts.slice(1).join('::'));
    if (!front || !back) {
      skipped += 1;
      return;
    }
    addFlashcard({ front, back });
    added += 1;
  });

  return { added, skipped };
}

export function getFlashcardsStats() {
  const s = getState();
  const cards = s.studies?.flashcards?.cards || [];
  const now = Date.now();
  const due = cards.filter((c) => new Date(c.dueAt).getTime() <= now);
  return { total: cards.length, due: due.length };
}

export function getNextDueFlashcardId() {
  const s = getState();
  const cards = s.studies?.flashcards?.cards || [];
  const now = Date.now();

  const dueCards = cards
    .filter((c) => new Date(c.dueAt).getTime() <= now)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  return dueCards[0]?.id || null;
}

export function startFlashcardsReview() {
  const nextId = getNextDueFlashcardId();
  setState((draft) => {
    if (!draft.studies.flashcards) draft.studies.flashcards = { cards: [], ui: { reviewing: false, currentId: null, revealed: false } };
    draft.studies.flashcards.ui = draft.studies.flashcards.ui || { reviewing: false, currentId: null, revealed: false };
    draft.studies.flashcards.ui.reviewing = true;
    draft.studies.flashcards.ui.currentId = nextId;
    draft.studies.flashcards.ui.revealed = false;
  });
}

export function stopFlashcardsReview() {
  setState((draft) => {
    if (!draft.studies.flashcards?.ui) return;
    draft.studies.flashcards.ui.reviewing = false;
    draft.studies.flashcards.ui.currentId = null;
    draft.studies.flashcards.ui.revealed = false;
  });
}

export function revealFlashcardAnswer() {
  setState((draft) => {
    if (!draft.studies.flashcards?.ui) return;
    if (!draft.studies.flashcards.ui.currentId) return;
    draft.studies.flashcards.ui.revealed = true;
  });
}

export function gradeFlashcard(id, grade) {
  const g = Math.max(0, Math.min(5, Number(grade)));
  const now = Date.now();

  setState((draft) => {
    const fc = draft.studies.flashcards;
    if (!fc || !Array.isArray(fc.cards)) return;

    const card = fc.cards.find((c) => c.id === id);
    if (!card) return;

    const next = computeNext({
      prevIntervalDays: card.intervalDays,
      prevEase: card.ease,
      prevReps: card.reps,
      grade: g,
    });

    card.intervalDays = next.intervalDays;
    card.ease = next.ease;
    card.reps = next.reps;
    card.lapses = (card.lapses || 0) + next.lapsesInc;
    card.lastReviewedAt = new Date(now).toISOString();
    card.dueAt = new Date(now + msFromDays(next.intervalDays)).toISOString();
    card.updatedAt = nowISO();

    const nextId = getNextDueFlashcardId();
    fc.ui.reviewing = true;
    fc.ui.currentId = nextId;
    fc.ui.revealed = false;
  });
}
