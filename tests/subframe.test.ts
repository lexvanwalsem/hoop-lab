// The flight-time height when the jump does not start exactly on a frame: many heights, many offsets, at 30 and 60 fps.
// Takeoff and landing are pinned between frames, so even 30 fps stays within a few centimetres.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeJump } from '../src/analysis.ts';

const G = 9.81;
const W = 1000;
const H = 1000;
const BODY_CM = 185;

function build(jumpCm: number, fps: number, offset: number) {
  const px = 4;
  const ground = 900;
  const stand = 1.6 + offset / fps;
  const dip = 0.4;
  const rise = 0.25;
  const flight = 2 * Math.sqrt((2 * (jumpCm / 100)) / G);
  const total = stand + dip + rise + flight + 1;
  const frames = [];
  for (let i = 0; i < total * fps; i++) {
    const t = i / fps;
    let lift = 0;
    let hipDrop = 0;
    const tDip = t - stand;
    const tFly = t - (stand + dip + rise);
    if (tDip > 0 && tDip < dip) hipDrop = 30 * Math.sin((Math.PI * tDip) / dip / 2);
    else if (tDip >= dip && tFly < 0) hipDrop = 30 * (1 - (tDip - dip) / rise);
    if (tFly > 0 && tFly < flight) lift = 100 * (G * tFly * ((flight - tFly) / 2));
    const ankleY = ground - 8 - lift * px;
    const noseY = ankleY - 0.89 * BODY_CM * px + 8;
    const hipY = ankleY - 0.5 * BODY_CM * px + hipDrop * px;
    const kneeY = (hipY + ankleY) / 2;
    const lm = Array.from({ length: 33 }, () => ({ x: 300 / W, y: hipY / H }));
    const set = (k: number, x: number, y: number) => (lm[k] = { x: x / W, y: y / H });
    set(0, 300, noseY);
    for (const [k, dx] of [[11, -5], [12, 5], [23, -5], [24, 5]] as const) set(k, 300 + dx, k < 20 ? (noseY + hipY) / 2 : hipY);
    for (const k of [25, 26]) set(k, 325, kneeY);
    for (const k of [27, 28]) set(k, 300, ankleY);
    for (const k of [29, 30]) set(k, 290, ankleY + 8);
    for (const k of [31, 32]) set(k, 320, ankleY + 8);
    for (const k of [13, 14, 15, 16, 19, 20]) set(k, 300, hipY);
    frames.push(lm);
  }
  return { fps, width: W, height: H, frames, balls: [], world: [] };
}

const LIMITS: Record<number, { mean: number; worst: number }> = { 30: { mean: 2.5, worst: 5 }, 60: { mean: 0.8, worst: 2 } };
for (const fps of [30, 60]) {
  test(`flight-time height is exact to a few cm at ${fps} fps, wherever the jump falls between frames`, () => {
    const errs: number[] = [];
    for (const cm of [30, 40, 50, 60, 70]) {
      for (let o = 0; o < 1; o += 0.1) {
        const r = analyzeJump(build(cm, fps, o) as never, BODY_CM, 'standing');
        errs.push(Math.abs(parseFloat(r.metrics.find((m) => m.label.startsWith('Jump height (flight'))!.value) - cm));
      }
    }
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    assert.ok(mean <= LIMITS[fps].mean, `mean error ${mean.toFixed(2)} cm`);
    assert.ok(Math.max(...errs) <= LIMITS[fps].worst, `worst error ${Math.max(...errs).toFixed(2)} cm`);
  });
}
