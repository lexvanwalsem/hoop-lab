import { angle } from './analysis.ts';
import type { Metric, Result, Status } from './analysis';
import type { Pose } from './pose';

/**
 * Key moments of a jump or shot, kept as a small drawing instead of a video: the body points of that frame and the
 * joint angles with their verdict. About 2 KB per session, no faces, and it can be redrawn at any size.
 */

/** The pose landmarks a snapshot keeps: nose, shoulders, elbows, wrists, hips, knees, ankles, feet. */
export const KEEP = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32] as const;
const slot = (landmark: number): number => KEEP.indexOf(landmark as (typeof KEEP)[number]);

export interface AngleMark {
  a: number; // slots into pts: the angle sits at b, between the lines to a and to c
  b: number;
  c: number;
  deg: number;
  label: string;
  status: Status;
  target?: string;
}

export interface Snap {
  name: string;
  ar: number; // frame width over height, so the drawing keeps its proportions
  pts: [number, number][]; // x, y in 0..1 for each of KEEP
  angles: AngleMark[];
}

const MAX_SNAPS = 6;
const round = (n: number, d = 3): number => Math.round(n * 10 ** d) / 10 ** d;

/** The joint angle at one frame, in 3D when the world landmarks exist (so a turned camera does not matter). */
function angleAt(pose: Pose, frame: number, a: number, b: number, c: number): number {
  const w = pose.world?.[frame];
  if (w) return angle([w[a].x, w[a].y, w[a].z], [w[b].x, w[b].y, w[b].z], [w[c].x, w[c].y, w[c].z]);
  const lm = pose.frames[frame]!;
  const px = (k: number): number[] => [lm[k].x * pose.width, lm[k].y * pose.height];
  return angle(px(a), px(b), px(c));
}

const metricOf = (r: Result, label: string): Metric | undefined => r.metrics.find((m) => m.label === label);

/** A mark from a landmark triple. When a metric measures this same angle its value, verdict and target are used. */
function mark(pose: Pose, frame: number, tri: [number, number, number], label: string, metric?: Metric): AngleMark {
  const deg = metric ? parseFloat(metric.value) : angleAt(pose, frame, ...tri);
  return {
    a: slot(tri[0]),
    b: slot(tri[1]),
    c: slot(tri[2]),
    deg: Math.round(deg),
    label,
    status: metric?.status ?? 'info',
    ...(metric?.target ? { target: metric.target } : {}),
  };
}

/** The side of the body that bends most (jumps) or shoots (shots). */
const LEFT = { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27 };
const RIGHT = { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28 };
type Side = typeof LEFT;

function shootingSide(pose: Pose): Side {
  const top = (k: number): number => Math.min(...pose.frames.map((lm) => (lm ? lm[k].y : Infinity)));
  return top(16) < top(15) ? RIGHT : LEFT;
}

function bendingSide(pose: Pose, frame: number): Side {
  return angleAt(pose, frame, LEFT.hip, LEFT.kn, LEFT.an) <= angleAt(pose, frame, RIGHT.hip, RIGHT.kn, RIGHT.an) ? LEFT : RIGHT;
}

/** The frame inside the first 0.15 s after landing where the knees are bent most, the same window the landing metric uses. */
function deepestLanding(pose: Pose, landing: number): number {
  const end = Math.min(pose.frames.length - 1, landing + Math.round(0.15 * pose.fps));
  let best = landing;
  let low = Infinity;
  for (let i = landing; i <= end; i++) {
    if (!pose.frames[i]) continue;
    const v = (angleAt(pose, i, LEFT.hip, LEFT.kn, LEFT.an) + angleAt(pose, i, RIGHT.hip, RIGHT.kn, RIGHT.an)) / 2;
    if (v < low) {
      low = v;
      best = i;
    }
  }
  return best;
}

/** The key moments of one result, each with the joint angles that matter at that moment. */
export function buildSnapshots(pose: Pose, result: Result): Snap[] {
  const shot = result.kind === 'shot';
  const shooter = shot ? shootingSide(pose) : null;
  const snaps: Snap[] = [];
  const seen = new Set<string>();
  for (const m of result.marks) {
    if (seen.has(m.name) || snaps.length >= MAX_SNAPS) continue;
    seen.add(m.name);
    let frame = m.frame;
    const angles: AngleMark[] = [];
    if (shot) {
      const s = shooter!;
      if (m.name === 'Set point') {
        angles.push(mark(pose, frame, [s.sh, s.el, s.wr], 'Elbow', metricOf(result, 'Elbow at set point')));
        angles.push(mark(pose, frame, [s.hip, s.kn, s.an], 'Knee'));
      } else if (m.name === 'Release') {
        angles.push(mark(pose, frame, [s.sh, s.el, s.wr], 'Elbow', metricOf(result, 'Elbow at release')));
      } else if (m.name === 'Landing') {
        frame = deepestLanding(pose, frame);
        if (pose.frames[frame]) angles.push(mark(pose, frame, [s.hip, s.kn, s.an], 'Knee'));
      } else continue; // takeoff and apex of a shot add little
    } else if (m.name === 'Dip bottom' && pose.frames[frame]) {
      const s = bendingSide(pose, frame);
      angles.push(mark(pose, frame, [s.hip, s.kn, s.an], 'Knee'), mark(pose, frame, [s.sh, s.hip, s.kn], 'Hip'));
    } else if (m.name === 'Takeoff' && pose.frames[frame]) {
      const s = bendingSide(pose, frame);
      angles.push(mark(pose, frame, [s.hip, s.kn, s.an], 'Knee'));
    } else if (m.name === 'Landing') {
      frame = deepestLanding(pose, frame);
      if (pose.frames[frame]) {
        const s = bendingSide(pose, frame);
        angles.push(mark(pose, frame, [s.hip, s.kn, s.an], 'Knee', metricOf(result, 'Landing knee angle')));
      }
    }
    const lm = pose.frames[frame];
    if (!lm) continue;
    snaps.push({
      name: m.name,
      ar: round(pose.width / pose.height, 3),
      pts: KEEP.map((k) => [round(lm[k].x), round(lm[k].y)] as [number, number]),
      angles,
    });
  }
  return snaps;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const STATUSES: Status[] = ['good', 'warn', 'bad', 'info'];

/** Keeps only well-formed snapshots from stored or imported data. */
export function sanitizeSnaps(raw: unknown): Snap[] {
  if (!Array.isArray(raw)) return [];
  const out: Snap[] = [];
  for (const s of raw.slice(0, MAX_SNAPS) as Record<string, unknown>[]) {
    if (!s || typeof s.name !== 'string' || !isNum(s.ar) || !Array.isArray(s.pts) || s.pts.length !== KEEP.length) continue;
    const pts = s.pts as unknown[];
    if (!pts.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]))) continue;
    const angles = (Array.isArray(s.angles) ? (s.angles as Record<string, unknown>[]) : [])
      .filter((a) => a && [a.a, a.b, a.c].every((i) => isNum(i) && i >= 0 && i < KEEP.length) && isNum(a.deg) && typeof a.label === 'string' && STATUSES.includes(a.status as Status))
      .map((a) => ({ a: a.a as number, b: a.b as number, c: a.c as number, deg: a.deg as number, label: a.label as string, status: a.status as Status, ...(typeof a.target === 'string' ? { target: a.target } : {}) }));
    out.push({ name: s.name, ar: s.ar, pts: pts as [number, number][], angles });
  }
  return out;
}

/** Slot of a landmark, for drawing. */
export const slotOf = slot;
