// Run with: node --test tests/ (or node tests/synthetic.test.ts for the plain list)
// Builds a fake stick-figure pose sequence with a known jump and checks the analysis output.
import { analyzeJump, analyzeJumps, analyzeShot, analyzeShots } from '../src/analysis.ts';

const FPS = 60;
const W = 1000;
const H = 1000;
let PX_PER_CM = 4;
const BODY_CM = 185;
let GROUND = 900;
const G = 9.81;

interface Opts {
  jumpCm: number; // true apex rise
  dipCm: number;
  runSpeed: number; // m/s horizontal before takeoff, 0 for standing
  pxPerCm?: number; // camera scale, bigger = person closer
  ground?: number; // floor level in pixels
}

function buildPose(o: Opts) {
  PX_PER_CM = o.pxPerCm ?? 4;
  GROUND = o.ground ?? 900;
  const standTime = 1.6;
  const dipTime = 0.4;
  const riseTime = 0.25;
  const flight = 2 * Math.sqrt((2 * (o.jumpCm / 100)) / G);
  const total = standTime + dipTime + riseTime + flight + 1;
  const frames = [];
  let x = 300;
  for (let i = 0; i < total * FPS; i++) {
    const t = i / FPS;
    let lift = 0; // cm feet are above ground
    let hipDrop = 0; // cm hips are lowered
    const tDip = t - standTime;
    const tFly = t - (standTime + dipTime + riseTime);
    if (tDip > 0 && tDip < dipTime) hipDrop = o.dipCm * Math.sin((Math.PI * tDip) / dipTime / 2);
    else if (tDip >= dipTime && tFly < 0) hipDrop = o.dipCm * (1 - (tDip - dipTime) / riseTime);
    if (tFly > 0 && tFly < flight) lift = 100 * (G * tFly * ((flight - tFly) / 2));
    if (o.runSpeed > 0 && t > 0.8 && tFly < flight) x += (o.runSpeed * 100 * PX_PER_CM) / FPS;

    const ankleY = GROUND - 8 - lift * PX_PER_CM;
    const noseY = ankleY - 0.89 * BODY_CM * PX_PER_CM + 8;
    const hipY = ankleY - 0.5 * BODY_CM * PX_PER_CM + hipDrop * PX_PER_CM;
    const kneeY = (hipY + ankleY) / 2;
    const handY = o.runSpeed > 0 && lift > 0 ? noseY - 80 * PX_PER_CM : hipY;
    const lm = Array.from({ length: 33 }, () => ({ x: x / W, y: hipY / H }));
    const set = (k: number, px: number, py: number) => (lm[k] = { x: px / W, y: py / H });
    set(0, x, noseY);
    for (const [k, dx] of [[11, -5], [12, 5], [23, -5], [24, 5]] as const) set(k, x + dx, k < 20 ? (noseY + hipY) / 2 : hipY);
    for (const [k, dx] of [[25, 25], [26, 25]] as const) set(k, x + dx, kneeY);
    for (const k of [27, 28]) set(k, x, ankleY);
    for (const k of [29, 30]) set(k, x - 10, ankleY + 8);
    for (const k of [31, 32]) set(k, x + 20, ankleY + 8);
    for (const k of [13, 14, 15, 16, 19, 20]) set(k, x, handY);
    frames.push(lm);
  }
  return { fps: FPS, width: W, height: H, frames };
}

let failed = 0;
function check(name: string, actual: number, expected: number, tol: number) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${actual.toFixed(1)} (expected ${expected} +/- ${tol})`);
}

const metric = (r: ReturnType<typeof analyzeJump>, label: string) => parseFloat(r.metrics.find((m) => m.label.startsWith(label))!.value);

const standing = analyzeJump(buildPose({ jumpCm: 40, dipCm: 30, runSpeed: 0 }), BODY_CM, 'standing');
check('standing: hip rise (cm)', metric(standing, 'Jump height (hip'), 40, 4);
check('standing: headline = flight time (cm)', standing.headline, 40, 6);
check('standing: flight-time height (cm)', metric(standing, 'Jump height (flight'), 40, 6);
check('standing: dip (cm)', metric(standing, 'Countermovement'), 30, 5);

const dunk = analyzeJump(buildPose({ jumpCm: 60, dipCm: 15, runSpeed: 5 }), BODY_CM, 'dunk');
check('dunk: hip rise (cm)', dunk.headline, 60, 6);
check('dunk: approach speed (m/s)', metric(dunk, 'Approach'), 5, 1);

// ---- shot: right arm goes hang -> set point (t=1.7) -> extended (t=2.0), ball leaves the hand at t=1.95 at 50 degrees ----
function buildShot() {
  const rad = (d: number) => (d * Math.PI) / 180;
  const lerp = (a: number, b: number, p: number) => a + (b - a) * Math.min(1, Math.max(0, p));
  const S = { x: 500, y: 330 };
  const frames = [];
  const balls = [];
  let ballOrigin = { x: 0, y: 0 };
  for (let i = 0; i < 3 * FPS; i++) {
    const t = i / FPS;
    // upper arm angle and forearm angle, measured up from horizontal-forward
    const beta = t < 1.7 ? lerp(-90, 0, (t - 1.5) / 0.2) : lerp(0, 60, (t - 1.7) / 0.3);
    const gamma = t < 1.7 ? lerp(-90, 90, (t - 1.5) / 0.2) : lerp(90, 60, (t - 1.7) / 0.3);
    const psi = lerp(0, 40, (t - 2.0) / 0.2); // wrist flick after release
    const E = { x: S.x + 120 * Math.cos(rad(beta)), y: S.y - 120 * Math.sin(rad(beta)) };
    const Wr = { x: E.x + 110 * Math.cos(rad(gamma)), y: E.y - 110 * Math.sin(rad(gamma)) };
    const I = { x: Wr.x + 25 * Math.cos(rad(gamma - psi)), y: Wr.y - 25 * Math.sin(rad(gamma - psi)) };
    const lm = Array.from({ length: 33 }, () => ({ x: 500 / W, y: 550 / H }));
    const set = (k: number, p: { x: number; y: number }) => (lm[k] = { x: p.x / W, y: p.y / H });
    set(0, { x: 500, y: 233 });
    set(11, S); set(12, S); set(14, E); set(16, Wr); set(20, I);
    set(13, { x: 500, y: 550 }); set(15, { x: 500, y: 550 }); set(19, { x: 500, y: 550 });
    set(23, { x: 500, y: 550 }); set(24, { x: 500, y: 550 });
    set(25, { x: 560, y: 720 }); set(26, { x: 560, y: 720 });
    for (const k of [27, 28]) set(k, { x: 500, y: 892 });
    for (const k of [29, 30, 31, 32]) set(k, { x: 500, y: 900 });
    frames.push(lm);
    if (t < 1.95) {
      ballOrigin = { x: Wr.x, y: Wr.y - 28 };
      balls.push({ x: ballOrigin.x / W, y: ballOrigin.y / H });
    } else {
      const dt = t - 1.95;
      balls.push({ x: (ballOrigin.x + 800 * Math.cos(rad(50)) * dt) / W, y: (ballOrigin.y - 800 * Math.sin(rad(50)) * dt) / H });
    }
  }
  return { fps: FPS, width: W, height: H, frames, balls };
}

const shot = analyzeShot(buildShot(), BODY_CM);
const mark = (name: string) => shot.marks.find((m) => m.name === name)!.frame / FPS;
check('shot: set point time (s)', mark('Set point'), 1.7, 0.05);
check('shot: ball release time (s)', mark('Release'), 2.12, 0.1);
check('shot: ball launch angle (deg)', metric(shot as never, 'Ball launch'), 50, 8);

// ---- two jumps in one clip, the second with the person closer to the camera (bigger, floor lower in the image) ----
const a = buildPose({ jumpCm: 40, dipCm: 30, runSpeed: 0 });
const b = buildPose({ jumpCm: 50, dipCm: 30, runSpeed: 0, pxPerCm: 5, ground: 950 });
const jumps = analyzeJumps({ ...a, frames: [...a.frames, ...b.frames] }, BODY_CM, 'standing');
check('two jumps: count', jumps.length, 2, 0);
check('two jumps: first (cm)', jumps[0].headline, 40, 6);
check('two jumps: second, closer to camera (cm)', jumps[1].headline, 50, 7);

// ---- two shots in one clip ----
const one = buildShot();
const two = { ...one, frames: [...one.frames, ...one.frames], balls: [...one.balls, ...one.balls] };
const many = analyzeShots(two as never, BODY_CM);
check('multi: shots found', many.length, 2, 0);
const setPoints = many.map((r) => r.marks.find((m) => m.name === 'Set point')!.frame / FPS);
check('multi: first set point (s)', setPoints[0], 1.7, 0.1);
check('multi: second set point (s)', setPoints[1], 4.7, 0.1);
check('multi: same score for identical shots', many[1].headline, many[0].headline, 2);

process.exit(failed ? 1 : 0);

