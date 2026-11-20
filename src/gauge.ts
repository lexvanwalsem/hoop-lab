import type { Status } from './analysis';

/** Turns a target like "25-50 cm", "150+ deg", "under 140 deg" or "-80 to 40 ms" into a numeric range. */
export function parseTarget(t: string): [number, number] | null {
  const s = t.toLowerCase();
  let m = s.match(/^under\s+(-?[\d.]+)/);
  if (m) return [-Infinity, parseFloat(m[1])];
  m = s.match(/^(-?[\d.]+)\+/);
  if (m) return [parseFloat(m[1]), Infinity];
  m = s.match(/^(-?[\d.]+)\s*(?:-|to)\s*(-?[\d.]+)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  return null;
}

/**
 * A small range bar: the target band is a coloured zone, the dot is where you are.
 * Positions are written as data-pos so the dot can slide in from the left after the tile appears.
 */
export function gauge(valueText: string, target: string | undefined, status: Status): string {
  const v = parseFloat(valueText);
  const range = target ? parseTarget(target) : null;
  if (!range || Number.isNaN(v)) return '';
  const [lo, hi] = range;
  let min: number;
  let max: number;
  if (Number.isFinite(lo) && Number.isFinite(hi)) {
    const span = hi - lo || 1;
    min = lo - span * 0.7;
    max = hi + span * 0.7;
  } else if (Number.isFinite(lo)) {
    const span = Math.max(Math.abs(lo) * 0.4, 1);
    min = lo - span * 1.3;
    max = lo + span * 1.7;
  } else {
    const span = Math.max(Math.abs(hi) * 0.4, 1);
    min = hi - span * 1.7;
    max = hi + span * 1.3;
  }
  if (v >= 0 && min < 0 && lo >= 0) min = 0; // a measure that cannot go below zero should not show a zero-crossing scale
  min = Math.min(min, v - (max - min) * 0.06);
  max = Math.max(max, v + (max - min) * 0.06);
  const pos = (x: number): number => Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100));
  const bandL = Number.isFinite(lo) ? pos(lo) : 0;
  const bandR = Number.isFinite(hi) ? pos(hi) : 100;
  return `<div class="gauge ${status}"><div class="band-r" style="left:${bandL.toFixed(1)}%;width:${(bandR - bandL).toFixed(1)}%"></div><div class="mark" data-pos="${pos(v).toFixed(1)}" style="left:0%"></div></div>`;
}
