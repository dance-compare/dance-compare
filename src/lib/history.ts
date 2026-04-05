import type { ComparisonResult } from '../types/pose';

export interface HistoryEntry {
  id: string;
  date: string;           // ISO string
  overallScore: number;
  bodyPartScores: { name: string; nameJa: string; score: number }[];
  adviceCount: number;
  frameDiffCount: number;
  /** Optional memo from user */
  memo: string;
}

const STORAGE_KEY = 'dance-score-history';
const MAX_ENTRIES = 100;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function addHistoryEntry(result: ComparisonResult, memo = ''): HistoryEntry {
  const entries = loadHistory();
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: new Date().toISOString(),
    overallScore: result.overallScore,
    bodyPartScores: result.bodyPartScores.map((bp) => ({
      name: bp.name,
      nameJa: bp.nameJa,
      score: bp.score,
    })),
    adviceCount: result.advices.length,
    frameDiffCount: result.frameDiffs.length,
    memo,
  };
  entries.unshift(entry);
  saveHistory(entries);
  return entry;
}

export function deleteHistoryEntry(id: string): void {
  const entries = loadHistory().filter((e) => e.id !== id);
  saveHistory(entries);
}

export function updateMemo(id: string, memo: string): void {
  const entries = loadHistory();
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    entry.memo = memo;
    saveHistory(entries);
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
