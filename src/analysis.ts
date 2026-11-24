import type { Pose } from './pose';

export type Kind = 'standing' | 'dunk' | 'shot';
export type Status = 'good' | 'warn' | 'bad' | 'info';

export interface Metric {
  label: string;
  value: string;
  status: Status;
  target?: string; // what a good value looks like
}

export interface Result {
  kind: Kind;
  headline: number; // jump height in cm, or shot score 0-100
  metrics: Metric[];
  tips: string[];
  marks: { name: string; frame: number }[];
  detectionRate: number;
  /** How far the headline can be off, in cm: one frame of timing for a jump, the body-size assumption for a dunk. */
  precision?: number;
}

const G = 9.81;
const RIM_CM = 305;
type P = [number, number];

// ---------- small helpers ----------

function fillGaps(a: number[]): number[] {
  const out = a.slice();
  const known = out.map((v, i) => (Number.isNaN(v) ? -1 : i)).filter((i) => i >= 0);
  if (!known.length) return out;
  for (let i = 0; i < out.length; i++) {
    if (!Number.isNaN(out[i])) continue;
    const prev = known.filter((k) => k < i).pop();
    const next = known.find((k) => k > i);
    if (prev === undefined) out[i] = out[next!];
    else if (next === undefined) out[i] = out[prev];
    else out[i] = out[prev] + ((out[next] - out[prev]) * (i - prev)) / (next - prev);
  }
  return out;
}

function smooth(a: number[], w = 1): number[] {
  return a.map((_, i) => {
    const s = a.slice(Math.max(0, i - w), i + w + 1);
    return s.reduce((x, y) => x + y, 0) / s.length;
  });
}

/** Builds a per-frame series from pixel-space landmarks. */
function series(pose: Pose, f: (p: (k: number) => P) => number): number[] {
  const raw = pose.frames.map((lm) => {
    if (!lm) return NaN;
    return f((k) => [lm[k].x * pose.width, lm[k].y * pose.height]);
  });
  return smooth(fillGaps(raw));
}

/** Angle at b in degrees, for points with any number of dimensions. */
export function angle(a: number[], b: number[], c: number[]): number {
  const v1 = a.map((v, i) => v - b[i]);
  const v2 = c.map((v, i) => v - b[i]);
  const dot = v1.reduce((s, v, i) => s + v * v2[i], 0);
  const cos = dot / (Math.hypot(...v1) * Math.hypot(...v2) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/**
 * Joint angle per frame at landmark b. Uses the 3D world landmarks when available, so the
 * result does not depend on the camera angle (a knee bending towards the camera still counts).
 */
function angleSeries(pose: Pose, a: number, b: number, c: number): number[] {
  const raw = pose.frames.map((lm, i) => {
    const w = pose.world?.[i];
    if (w) return angle([w[a].x, w[a].y, w[a].z], [w[b].x, w[b].y, w[b].z], [w[c].x, w[c].y, w[c].z]);
    if (!lm) return NaN;
    const px = (k: number) => [lm[k].x * pose.width, lm[k].y * pose.height];
    return angle(px(a), px(b), px(c));
  });
  return smooth(fillGaps(raw));
}

function percentile(a: number[], q: number): number {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function argmin(a: number[], from: number, to: number): number {
  let best = from;
  for (let i = from; i <= to; i++) if (a[i] < a[best]) best = i;
  return best;
}

function argmax(a: number[], from: number, to: number): number {
  let best = from;
  for (let i = from; i <= to; i++) if (a[i] > a[best]) best = i;
  return best;
}

/** 1 inside [lo, hi], falling linearly to 0 at `tol` outside the range. */
function band(v: number, lo: number, hi: number, tol: number): number {
  const d = v < lo ? lo - v : v > hi ? v - hi : 0;
  return Math.max(0, 1 - d / tol);
}

function status(score: number): Status {
  return score >= 0.99 ? 'good' : score >= 0.5 ? 'warn' : 'bad';
}

// ---------- calibration and ground ----------

/**
 * Centimetres per pixel, from the user's height and the nose-to-ankle span when upright.
 * Crouching, jumping and walking into frame only make the span smaller, so a high
 * percentile over the whole clip finds the upright moments.
 */
export const AVERAGE_NOSE_ANKLE = 0.89;

/** Nose-to-ankle as a share of body height, from the tracker's nose and ankle and the two lines the person drew (all in pixels, same frame). */
export function scaleRatio(noseY: number, ankleY: number, headY: number, soleY: number): number {
  return (ankleY - noseY) / (soleY - headY);
}

function calibrate(pose: Pose, heightCm: number, from = 0, to = pose.frames.length, ratio = AVERAGE_NOSE_ANKLE): number {
  const spans: number[] = [];
  for (const lm of pose.frames.slice(Math.max(0, from), to)) {
    if (!lm) continue;
    const ankle = ((lm[27].y + lm[28].y) / 2) * pose.height;
    spans.push(ankle - lm[0].y * pose.height);
  }
  if (!spans.length) throw new Error('No person found in the video');
  return (heightCm * ratio) / percentile(spans, 0.9); // nose-to-ankle is about 89% of body height, unless it was measured on this person
}

function lowestFoot(pose: Pose): { low: number[]; ground: number } {
  const low = series(pose, (p) => Math.max(p(29)[1], p(30)[1], p(31)[1], p(32)[1]));
  return { low, ground: percentile(low, 0.9) };
}

interface Flight {
  takeoff: number; // last frame on the ground
  landing: number; // first frame back on the ground
  ground: number; // floor level (pixel y) at the place of takeoff
  peak: number; // highest foot clearance in cm
}

/**
 * Finds every flight phase (both feet more than 5 cm off the ground). The floor level is
 * measured per flight, from the second before takeoff, because the floor line in the image
 * shifts when the person moves towards or away from the camera.
 */
function findFlights(pose: Pose, cm: number, near?: [number, number]): Flight[] {
  const { low } = lowestFoot(pose);
  // floor level per frame: the lowest foot position within 1 s around it, so a floor that
  // shifts in the image (person moves closer or further away) does not look like flight
  const reach = pose.fps;
  const floor = low.map((_, i) => percentile(low.slice(Math.max(0, i - reach), i + reach + 1), 0.9));
  const lift = low.map((y, i) => (floor[i] - y) * cm);
  const minLen = Math.max(3, Math.round(pose.fps * 0.1));
  const flights: Flight[] = [];
  let start = -1;
  for (let i = 0; i <= lift.length; i++) {
    const up = i < lift.length && lift[i] > 5;
    if (up && start < 0) start = i;
    if (!up && start >= 0) {
      const end = i - 1;
      const inWindow = !near || (end >= near[0] && start <= near[1]);
      if (inWindow && end - start + 1 >= minLen) {
        // the 5 cm threshold finds the flight late; walk back to the real moment of contact
        // (at most 0.12 s, and not into floor noise, or the walk drifts into the countermovement)
        const maxWalk = Math.round(0.12 * pose.fps);
        let takeoff = Math.max(0, start - 1);
        for (let w = 0; w < maxWalk && takeoff > 0 && lift[takeoff - 1] <= lift[takeoff] && lift[takeoff] > 1.5; w++) takeoff--;
        let landing = Math.min(lift.length - 1, end + 1);
        for (let w = 0; w < maxWalk && landing < lift.length - 1 && lift[landing + 1] <= lift[landing] && lift[landing] > 1.5; w++) landing++;
        const ground = percentile(low.slice(Math.max(0, takeoff - pose.fps), takeoff + 1), 0.9);
        const peak = (ground - Math.min(...low.slice(start, end + 1))) * cm;
        flights.push({ takeoff, landing, ground, peak });
      }
      start = -1;
    }
  }
  return flights;
}

/** The highest flight, used for a shot where only the jump around the release counts. */
function findFlight(pose: Pose, cm: number, near?: [number, number]): Flight {
  const flights = findFlights(pose, cm, near);
  if (!flights.length) throw new Error('No jump found. Check the filming guide.');
  return flights.reduce((a, b) => (b.peak > a.peak ? b : a));
}

function detectionRate(pose: Pose): number {
  return pose.frames.filter(Boolean).length / pose.frames.length;
}

// ---------- jump (standing and dunk) ----------

/**
 * Analyzes every jump in the clip (the highest one for a dunk). Each jump is calibrated
 * on the 4 s before its takeoff, so scale and floor match the place where the jump happens.
 */
export function analyzeJumps(pose: Pose, heightCm: number, kind: 'standing' | 'dunk', weightKg?: number, ratio = AVERAGE_NOSE_ANKLE): Result[] {
  let flights = findFlights(pose, calibrate(pose, heightCm, 0, pose.frames.length, ratio)).filter((f) => f.peak >= 20); // ignore steps and small hops
  if (!flights.length) throw new Error('No jump found. Check the filming guide.');
  if (kind === 'dunk') flights = [flights.reduce((a, b) => (b.peak > a.peak ? b : a))];
  const results = flights.map((fl) => jumpResult(pose, fl, calibrate(pose, heightCm, fl.takeoff - 4 * pose.fps, fl.takeoff, ratio), kind, weightKg));
  // A real jump lifts the hips too. Feet that seem to leave the floor while the hips stay put are a floor that shifts in the
  // picture (walking towards the camera, a tilted phone), and a flight longer than 0.9 s is not a human jump.
  const clean = results.filter((r) => {
    const rise = metricValue(r, 'Jump height (hip');
    const hang = metricValue(r, 'Jump height (flight');
    return kind === 'dunk' ? rise >= 15 : hang <= 110 && rise >= 0.4 * hang;
  });
  if (!clean.length) throw new Error('No clean jump found. The tracker saw feet leave the floor, but your hips did not rise with them. Stay on one spot, turn about 45 degrees to the camera and jump again.');
  return clean;
}

const metricValue = (r: Result, label: string): number => parseFloat(r.metrics.find((m) => m.label.startsWith(label))?.value ?? '0');

/**
 * A jump measured by hand: the person marked the first frame in the air and the first frame back on the floor.
 * Only the flight time counts, so it works from any camera angle and distance, even when the tracker cannot follow the body.
 */
export function manualJump(flightSeconds: number, weightKg?: number, fps = 60): Result {
  const hang = (100 * G * flightSeconds * flightSeconds) / 8;
  const metrics: Metric[] = [
    { label: 'Jump height (flight time)', value: `${hang.toFixed(1)} cm`, status: 'info' },
    { label: 'Flight time', value: `${flightSeconds.toFixed(2)} s`, status: 'info' },
  ];
  if (weightKg) {
    const power = 60.7 * hang + 45.3 * weightKg - 2055;
    metrics.push({ label: 'Peak power (Sayers)', value: `${power.toFixed(0)} W`, status: 'info' });
    metrics.push({ label: 'Relative power', value: `${(power / weightKg).toFixed(1)} W/kg`, status: status(band(power / weightKg, 55, 200, 20)), target: '55+ W/kg' });
  }
  return { kind: 'standing', headline: hang, metrics, tips: ['Marked by hand, so there are no joint angles. Film at 60 fps and about 45 degrees to get the full analysis.'], marks: [], detectionRate: 1, precision: (100 * G * flightSeconds) / 4 / fps };
}

/**
 * A phone that leans sideways (roll) tilts the whole picture. Someone standing upright shows how much: the line from the
 * ankles to the shoulders should be vertical. The median over the clip is used to turn every point back. Tilt up or down
 * (pitch) cannot be seen in the picture; the phone's own sensor reports it when you record in the app.
 */
export function levelPose(pose: Pose): { pose: Pose; rollDeg: number } {
  const lean: number[] = [];
  for (const lm of pose.frames) {
    if (!lm) continue;
    const dx = ((lm[11].x + lm[12].x) / 2 - (lm[27].x + lm[28].x) / 2) * pose.width;
    const dy = ((lm[27].y + lm[28].y) / 2 - (lm[11].y + lm[12].y) / 2) * pose.height; // upwards
    if (dy > pose.height * 0.2) lean.push((Math.atan2(dx, dy) * 180) / Math.PI);
  }
  const roll = lean.length >= 10 ? percentile(lean, 0.5) : 0;
  // a real tilt is the same all clip long; someone who leans, bends or is badly tracked gives a scattered lean, and then nothing is changed
  const spread = percentile(lean.map((v) => Math.abs(v - roll)), 0.5);
  if (Math.abs(roll) < 2 || Math.abs(roll) > 20 || spread > 3) return { pose, rollDeg: 0 }; // too small to matter, too large to be tilt alone, or not steady
  const phi = (roll * Math.PI) / 180;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const cx = pose.width / 2;
  const cy = pose.height / 2;
  const turn = <T extends { x: number; y: number }>(p: T): T => {
    const x = p.x * pose.width - cx;
    const y = p.y * pose.height - cy;
    return { ...p, x: (x * c + y * s + cx) / pose.width, y: (-x * s + y * c + cy) / pose.height };
  };
  return { pose: { ...pose, frames: pose.frames.map((f) => (f ? f.map(turn) : null)), balls: (pose.balls ?? []).map((b) => (b ? turn(b) : null)) }, rollDeg: roll };
}

/** Single jump: the highest one in the clip. */
export function analyzeJump(pose: Pose, heightCm: number, kind: 'standing' | 'dunk', weightKg?: number): Result {
  const all = analyzeJumps(pose, heightCm, kind, weightKg);
  return all.reduce((a, b) => (b.headline > a.headline ? b : a));
}

function jumpResult(pose: Pose, fl: Flight, cm: number, kind: 'standing' | 'dunk', weightKg?: number): Result {
  const fps = pose.fps;
  const hipY = series(pose, (p) => (p(23)[1] + p(24)[1]) / 2);
  const hipX = series(pose, (p) => (p(23)[0] + p(24)[0]) / 2);
  const handTop = series(pose, (p) => Math.min(p(15)[1], p(16)[1], p(19)[1], p(20)[1]));
  const kneeL = angleSeries(pose, 23, 25, 27);
  const kneeR = angleSeries(pose, 24, 26, 28);
  const kneeAngle = kneeL.map((v, i) => (v + kneeR[i]) / 2);

  const apex = argmin(hipY, fl.takeoff, fl.landing);
  const rise = (hipY[fl.takeoff] - hipY[apex]) * cm;
  // takeoff and landing are both frames with a foot still on the floor, so the real flight is about a frame shorter
  const flightTime = (fl.landing - fl.takeoff - 1) / fps;
  const hangHeight = (100 * G * flightTime * flightTime) / 8;

  // countermovement: how far the hips lower in the last 0.8 s before takeoff
  const winStart = Math.max(0, fl.takeoff - Math.round(0.8 * fps));
  const bottom = argmax(hipY, winStart, fl.takeoff);
  const dip = (hipY[bottom] - hipY[fl.takeoff]) * cm;
  const dipMs = ((fl.takeoff - bottom) / fps) * 1000;

  const landEnd = Math.min(pose.frames.length - 1, fl.landing + Math.round(0.15 * fps));
  const landKnee = Math.min(...kneeAngle.slice(fl.landing, landEnd + 1));

  const metrics: Metric[] = [];
  const tips: string[] = [];
  metrics.push({ label: 'Jump height (hip rise)', value: `${rise.toFixed(1)} cm`, status: 'info' });
  metrics.push({ label: 'Jump height (flight time)', value: `${hangHeight.toFixed(1)} cm`, status: 'info' });
  metrics.push({ label: 'Flight time', value: `${flightTime.toFixed(2)} s`, status: 'info' });
  if (weightKg) {
    // Sayers et al. (1999): peak power in watts from jump height (cm) and body mass (kg)
    const power = 60.7 * hangHeight + 45.3 * weightKg - 2055;
    metrics.push({ label: 'Peak power (Sayers)', value: `${power.toFixed(0)} W`, status: 'info' });
    const rel = power / weightKg;
    metrics.push({ label: 'Relative power', value: `${rel.toFixed(1)} W/kg`, status: status(band(rel, 55, 200, 20)), target: '55+ W/kg' });
  }
  const dipScore = band(dip, 25, 50, 20);
  metrics.push({ label: 'Countermovement depth', value: `${dip.toFixed(0)} cm`, status: status(dipScore), target: '25-50 cm' });
  metrics.push({ label: 'Dip bottom to takeoff', value: `${dipMs.toFixed(0)} ms`, status: status(band(dipMs, 150, 350, 150)), target: '150-350 ms' });
  const landScore = band(landKnee, 0, 140, 30);
  metrics.push({ label: 'Landing knee angle', value: `${landKnee.toFixed(0)} deg`, status: status(landScore), target: 'under 140 deg' });

  if (dipScore < 1) tips.push(dip < 25 ? 'Dip deeper before takeoff to load more.' : 'Dip is very deep. A shorter, faster dip often gives more spring.');
  if (landScore < 1) tips.push('Land with more knee bend to absorb the impact.');
  if (Math.abs(rise - hangHeight) > 10) tips.push('Hip rise and flight time disagree by more than 10 cm. Check calibration and camera angle.');

  const marks = [
    { name: 'Dip bottom', frame: bottom },
    { name: 'Takeoff', frame: fl.takeoff },
    { name: 'Apex', frame: apex },
    { name: 'Landing', frame: fl.landing },
  ];

  if (kind === 'dunk') {
    const back = Math.max(0, fl.takeoff - Math.round(0.4 * fps));
    const speed = (Math.abs(hipX[fl.takeoff] - hipX[back]) * cm) / 100 / ((fl.takeoff - back) / fps || 1);
    const reach = (fl.ground - Math.min(...handTop.slice(fl.takeoff, fl.landing + 1))) * cm;
    const aboveRim = reach - RIM_CM;
    metrics.push({ label: 'Approach speed', value: `${speed.toFixed(1)} m/s`, status: status(band(speed, 4, 10, 2)), target: '4+ m/s' });
    if (weightKg) metrics.push({ label: 'Approach kinetic energy', value: `${(0.5 * weightKg * speed * speed).toFixed(0)} J`, status: 'info' });
    metrics.push({ label: 'Max reach height', value: `${reach.toFixed(0)} cm`, status: 'info' });
    metrics.push({
      label: 'Hand above rim (305 cm)',
      value: `${aboveRim.toFixed(0)} cm`,
      status: aboveRim >= 10 ? 'good' : aboveRim >= 0 ? 'warn' : 'bad',
      target: '10+ cm',
    });
    if (aboveRim < 0) tips.push(`You need about ${(-aboveRim + 10).toFixed(0)} cm more reach to dunk comfortably.`);
    if (speed < 3) tips.push('Approach is slow. Build speed over the last 2-3 steps and convert it with a long, low last step.');
  }

  // standing jump: flight time is the standard field measure and is more stable than the hip path;
  // dunk: take-off and landing are not alike, so use the hip rise
  const headline = kind === 'standing' ? hangHeight : rise;
  // flight time is only known to a frame: dh = g * t * dt / 4. A dunk rests on the pixel scale, which assumes average body proportions (about 3 percent).
  const precision = kind === 'standing' ? (100 * G * flightTime) / 4 / fps : headline * 0.03;
  return { kind, headline, metrics, tips, marks, detectionRate: detectionRate(pose), precision };
}

// ---------- shot ----------

function slicePose(pose: Pose, from: number, to: number): Pose {
  return { ...pose, frames: pose.frames.slice(from, to), balls: pose.balls.slice(from, to), world: pose.world?.slice(from, to) };
}

/** Finds each shot in a clip: a moment where the shooting wrist goes above the nose. Returns frame windows. */
export function findShotWindows(pose: Pose): [number, number][] {
  const n = pose.frames.length;
  const wl = series(pose, (p) => p(15)[1]);
  const wr = series(pose, (p) => p(16)[1]);
  const wristY = Math.min(...wr) < Math.min(...wl) ? wr : wl;
  const noseY = series(pose, (p) => p(0)[1]);
  const right = wristY === wr;
  const elbow = angleSeries(pose, right ? 12 : 11, right ? 14 : 13, right ? 16 : 15);
  const minLen = Math.max(2, Math.round(pose.fps * 0.1));
  const reach = Math.round(0.3 * pose.fps);

  const peaks: number[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const up = i < n && wristY[i] < noseY[i];
    if (up && start < 0) start = i;
    if (!up && start >= 0) {
      const pk = argmin(wristY, start, i - 1);
      // a real shot extends the arm; raising a hand to catch or block does not
      const extended = Math.max(...elbow.slice(Math.max(0, pk - reach), pk + reach + 1)) >= 120;
      if (i - start >= minLen && extended) peaks.push(pk);
      start = -1;
    }
  }
  // a second peak within 2 s is the catch after the shot, not a new shot: keep the first
  const shots: number[] = [];
  for (const pk of peaks) {
    const last = shots[shots.length - 1];
    if (last === undefined || pk - last >= 2 * pose.fps) shots.push(pk);
  }
  // window: up to 1.5 s before and 1 s after the peak, never reaching into the neighbouring shot
  return shots.map((pk, i) => {
    const prev = shots[i - 1];
    const next = shots[i + 1];
    const from = Math.max(pk - Math.round(1.5 * pose.fps), prev === undefined ? 0 : Math.round((prev + pk) / 2));
    const to = Math.min(pk + Math.round(pose.fps), next === undefined ? n : Math.round((pk + next) / 2));
    return [from, to];
  });
}

/** Analyzes every shot found in the clip. Mark frames are relative to the full clip. */
export function analyzeShots(pose: Pose, heightCm: number, ratio = AVERAGE_NOSE_ANKLE): Result[] {
  const windows = findShotWindows(pose);
  if (!windows.length) throw new Error('No shot found: your shooting hand never goes above your head.');
  const cm = calibrate(pose, heightCm, 0, pose.frames.length, ratio); // calibrate on the whole clip, a single shot is mostly crouched
  return windows.map(([from, to]) => {
    const r = analyzeShot(slicePose(pose, from, to), heightCm, cm);
    return { ...r, marks: r.marks.map((m) => ({ ...m, frame: m.frame + from })) };
  });
}

export function analyzeShot(pose: Pose, heightCm: number, cmOverride?: number): Result {
  const cm = cmOverride ?? calibrate(pose, heightCm);
  const fps = pose.fps;
  const n = pose.frames.length;
  const { ground } = lowestFoot(pose);

  // shooting side = the wrist that gets highest
  const wl = series(pose, (p) => p(15)[1]);
  const wr = series(pose, (p) => p(16)[1]);
  const right = Math.min(...wr) < Math.min(...wl);
  const k = right ? { sh: 12, el: 14, wr: 16, ix: 20, hip: 24, kn: 26, an: 28 } : { sh: 11, el: 13, wr: 15, ix: 19, hip: 23, kn: 25, an: 27 };
  const wristY = right ? wr : wl;
  const elbow = angleSeries(pose, k.sh, k.el, k.wr);
  const wristAngle = angleSeries(pose, k.el, k.wr, k.ix);
  const knee = angleSeries(pose, k.hip, k.kn, k.an);
  const noseY = series(pose, (p) => p(0)[1]);
  const shoulderY = series(pose, (p) => p(k.sh)[1]);
  const hipY = series(pose, (p) => p(k.hip)[1]);
  const hipX = series(pose, (p) => p(k.hip)[0]);

  // set point = most bent elbow before the highest wrist; release = elbow nearly fully extended
  const peak = argmin(wristY, 0, n - 1);
  const setPoint = argmin(elbow, Math.max(0, peak - Math.round(1.2 * fps)), peak);
  const scanEnd = Math.min(n - 1, peak + Math.round(0.3 * fps));
  const maxElbow = Math.max(...elbow.slice(setPoint, scanEnd + 1));
  let release = setPoint;
  while (release < scanEnd && elbow[release] < maxElbow - 5) release++;

  // with ball tracking, release is the first frame the ball is more than 35 cm from the shooting wrist
  const wristX = series(pose, (p) => p(k.wr)[0]);
  const ballAt = (i: number) => (pose.balls[i] ? { x: pose.balls[i]!.x * pose.width, y: pose.balls[i]!.y * pose.height } : null);
  let ballRelease: number | null = null;
  for (let i = setPoint; i <= Math.min(n - 1, peak + Math.round(0.5 * fps)); i++) {
    const b = ballAt(i);
    // the arm must be mostly extended, otherwise the ball is just being moved around
    if (b && elbow[i] > 100 && Math.hypot(b.x - wristX[i], b.y - wristY[i]) * cm > 35) {
      ballRelease = i;
      break;
    }
  }
  if (ballRelease !== null) release = ballRelease;

  const kneeMin = Math.min(...knee.slice(Math.max(0, release - fps), release + 1));
  const releaseHeight = (ground - wristY[release]) * cm;
  const aboveHead = (noseY[release] - wristY[release]) * cm;
  const quickMs = ((release - setPoint) / fps) * 1000;

  // flick: wrist angle change and speed around the release
  const fw = Math.max(0, release - Math.round(0.1 * fps));
  const fe = Math.min(n - 1, release + Math.round(0.3 * fps));
  let flickSpeed = 0;
  for (let i = fw + 1; i <= fe; i++) flickSpeed = Math.max(flickSpeed, Math.abs(wristAngle[i] - wristAngle[i - 1]) * fps);

  // follow-through: how long the shooting hand stays above the shoulder after release
  let hold = release;
  while (hold < n - 1 && hold - release < fps && wristY[hold] < shoulderY[hold]) hold++;
  const holdMs = ((hold - release) / fps) * 1000;

  const metrics: Metric[] = [];
  const tips: string[] = [];
  const scores: number[] = [];
  const add = (label: string, value: string, score: number | null, tip?: string, target?: string) => {
    metrics.push({ label, value, status: score === null ? 'info' : status(score), target });
    if (score !== null) scores.push(score);
    if (score !== null && score < 1 && tip) tips.push(tip);
  };

  add('Shooting hand', right ? 'right' : 'left', null);
  add('Knee bend (min angle)', `${kneeMin.toFixed(0)} deg`, band(kneeMin, 100, 140, 30), 'Bend your knees to roughly 100-140 degrees to load the shot with your legs.', '100-140 deg');
  add('Elbow at set point', `${elbow[setPoint].toFixed(0)} deg`, band(elbow[setPoint], 70, 100, 25), 'Keep the elbow near 90 degrees at the set point, under the ball.', '70-100 deg');
  add('Elbow at release', `${elbow[release].toFixed(0)} deg`, band(elbow[release], 150, 180, 30), 'Extend the arm fully at release for a consistent arc.', '150+ deg');
  add('Release height', `${releaseHeight.toFixed(0)} cm`, null);
  add('Release above head', `${aboveHead.toFixed(0)} cm`, band(aboveHead, 10, 100, 20), 'Release higher, in front of and above the forehead.', '10+ cm');
  add('Set point to release', `${quickMs.toFixed(0)} ms`, band(quickMs, 150, 450, 200), 'Your release is slow. Shorten the path from set point to release.', '150-450 ms');
  add('Wrist flick speed', `${flickSpeed.toFixed(0)} deg/s`, band(flickSpeed, 300, 5000, 300), 'Snap the wrist harder through the ball for more backspin.', '300+ deg/s');
  add('Follow-through hold', `${holdMs.toFixed(0)} ms`, band(holdMs, 250, 1000, 200), 'Hold the follow-through (arm up, wrist relaxed) until the ball lands.', '250+ ms');

  const marks = [
    { name: 'Set point', frame: setPoint },
    { name: 'Release', frame: release },
  ];

  if (pose.balls.some(Boolean)) {
    if (ballRelease === null) {
      tips.push('The ball was not tracked at release, so release timing is estimated from the elbow.');
    } else {
      // launch angle from the first and last ball position in the 0.2 s after release
      const flight = [];
      for (let i = release; i <= Math.min(n - 1, release + Math.round(0.2 * fps)); i++) {
        const b = ballAt(i);
        if (b) flight.push(b);
      }
      const a = flight[0];
      const z = flight[flight.length - 1];
      const deg = flight.length >= 3 ? (Math.atan2(a.y - z.y, Math.abs(z.x - a.x)) * 180) / Math.PI : 0;
      // a ball that appears to go down after release is a false detection, skip it
      if (deg > 0) {
        add('Ball launch angle', `${deg.toFixed(0)} deg`, band(deg, 45, 55, 15), 'Aim for a launch angle of about 45-55 degrees: shoot higher, with a steeper arc.', '45-55 deg');
      }
    }
  }

  try {
    // only the flight around this shot counts, the clip can hold other jumps
    const fl = findFlight(pose, cm, [release - Math.round(1.5 * fps), release + Math.round(0.5 * fps)]);
    const apex = argmin(hipY, fl.takeoff, fl.landing);
    const rise = (hipY[fl.takeoff] - hipY[apex]) * cm;
    const relMs = ((release - apex) / fps) * 1000;
    const drift = Math.abs(hipX[fl.landing] - hipX[fl.takeoff]) * cm;
    add('Jump height', `${rise.toFixed(0)} cm`, null);
    add('Release vs jump apex', `${relMs.toFixed(0)} ms`, band(relMs, -80, 40, 120), relMs > 40 ? 'You release after the apex. Release at or just before the top of the jump.' : 'You release too early on the way up. Wait for the top of the jump.', '-80 to 40 ms');
    add('Forward drift', `${drift.toFixed(0)} cm`, band(drift, 0, 30, 30), 'You drift forward a lot. Jump straight up and land where you took off.', 'under 30 cm');
    marks.push({ name: 'Takeoff', frame: fl.takeoff }, { name: 'Apex', frame: apex }, { name: 'Landing', frame: fl.landing });
  } catch {
    tips.push('No jump detected, so jump timing and drift were skipped (fine for a set shot).');
  }

  const score = Math.round((100 * scores.reduce((a, b) => a + b, 0)) / scores.length);
  marks.sort((a, b) => a.frame - b.frame);
  return { kind: 'shot', headline: score, metrics, tips, marks, detectionRate: detectionRate(pose) };
}
