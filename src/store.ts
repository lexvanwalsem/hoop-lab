import type { Kind, Metric } from './analysis';

export interface Session {
  id: string;
  date: string; // local day, yyyy-mm-dd
  kind: Kind;
  headline: number;
  metrics: Metric[];
  tips: string[];
  demo?: boolean; // sample data, never mixed up with a real result
}

export interface Exercise {
  id: string;
  date: string;
  name: string;
  sets: number;
  reps: number;
  notes: string;
  demo?: boolean;
}

export interface Data {
  heightCm: number;
  weightKg: number;
  goalCm: number; // jump height goal, 0 = not set
  sessions: Session[];
  exercises: Exercise[];
}

const KEY = 'hooplab.v1';
const KINDS: Kind[] = ['standing', 'dunk', 'shot'];

export const emptyData = (): Data => ({ heightCm: 0, weightKg: 0, goalCm: 0, sessions: [], exercises: [] }); // 0 = not entered yet, the user must fill it in

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/**
 * Checks the shape of stored or imported data and drops what does not fit,
 * so one broken entry can never take the whole dashboard down.
 */
export function sanitize(raw: unknown): Data {
  const out = emptyData();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (isNum(r.heightCm)) out.heightCm = r.heightCm;
  if (isNum(r.weightKg)) out.weightKg = r.weightKg;
  if (isNum(r.goalCm)) out.goalCm = r.goalCm;
  if (Array.isArray(r.sessions)) {
    for (const s of r.sessions as Record<string, unknown>[]) {
      if (s && isStr(s.id) && isStr(s.date) && KINDS.includes(s.kind as Kind) && isNum(s.headline) && Array.isArray(s.metrics)) {
        const metrics = (s.metrics as Record<string, unknown>[]).filter((m) => m && isStr(m.label) && isStr(m.value) && isStr(m.status)) as unknown as Metric[];
        out.sessions.push({ id: s.id, date: s.date, kind: s.kind as Kind, headline: s.headline, metrics, tips: Array.isArray(s.tips) ? (s.tips as unknown[]).filter(isStr) : [], ...(s.demo ? { demo: true } : {}) });
      }
    }
  }
  if (Array.isArray(r.exercises)) {
    for (const e of r.exercises as Record<string, unknown>[]) {
      if (e && isStr(e.id) && isStr(e.date) && isStr(e.name) && isNum(e.sets) && isNum(e.reps)) {
        out.exercises.push({ id: e.id, date: e.date, name: e.name, sets: e.sets, reps: e.reps, notes: isStr(e.notes) ? e.notes : '', ...(e.demo ? { demo: true } : {}) });
      }
    }
  }
  sortByDate(out);
  return out;
}

/** Oldest first, so "latest" and "previous" always mean what they say. The sort is stable. */
export function sortByDate(d: Data): void {
  d.sessions.sort((a, b) => a.date.localeCompare(b.date));
  d.exercises.sort((a, b) => a.date.localeCompare(b.date));
}

export function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    // corrupt or unavailable storage: start empty
  }
  return emptyData();
}

/** Returns false when the browser refused to store it (storage full or blocked). */
export function save(data: Data): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** A backup is the data itself plus a small header, as formatted JSON. */
export function exportBackup(data: Data): string {
  return JSON.stringify({ app: 'hoop-lab', version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2);
}

/** Reads a backup and merges it into `data` by id. Returns how many sessions and exercises were added, or an error text. */
export function importBackup(text: string, data: Data): { sessions: number; exercises: number } | string {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return 'This file is not valid JSON.';
  }
  if (!raw || typeof raw !== 'object' || (raw as Record<string, unknown>).app !== 'hoop-lab') return 'This is not a Hoop Lab backup.';
  const incoming = sanitize(raw);
  const haveS = new Set(data.sessions.map((s) => s.id));
  const haveE = new Set(data.exercises.map((e) => e.id));
  const newS = incoming.sessions.filter((s) => !haveS.has(s.id));
  const newE = incoming.exercises.filter((e) => !haveE.has(e.id));
  data.sessions.push(...newS);
  data.exercises.push(...newE);
  if (!data.heightCm) data.heightCm = incoming.heightCm;
  if (!data.weightKg) data.weightKg = incoming.weightKg;
  if (!data.goalCm) data.goalCm = incoming.goalCm;
  sortByDate(data);
  return { sessions: newS.length, exercises: newE.length };
}

export const newId = (): string => Math.random().toString(36).slice(2, 10);
export const today = (): string => new Date().toLocaleDateString('sv-SE'); // local day, yyyy-mm-dd
