/** Hand-drawn SVG icons and illustrations. Everything is inline, uses currentColor, and needs no network. */

const ICONS: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  analyze: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/>',
  jump: '<path d="M12 20V5M5.5 11.5L12 5l6.5 6.5"/>',
  camera: '<path d="M3 8.5a2 2 0 0 1 2-2h2l1.5-2h7l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.6"/>',
  dumbbell: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  user: '<circle cx="12" cy="7.5" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.7 5.7c3 3 3 9.6 0 12.6M18.3 5.7c-3 3-3 9.6 0 12.6"/>',
  spring: '<path d="M12 3v3l-4.5 2.2L16.5 11 7.5 14l9 2.6-4.5 2.2V21"/>',
  arms: '<circle cx="12" cy="5" r="2.2"/><path d="M12 8v8M12 10L5.5 5M12 10l6.5-5M12 16l-3 5M12 16l3 5"/>',
  landing: '<path d="M12 3v10M7.5 9l4.5 4.5L16.5 9M4 20h16M7.5 20v-3M16.5 20v-3"/>',
  bolt: '<path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19.5 7"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.2"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1A3.5 3.5 0 0 0 8 10.5M16 6h3.5v1A3.5 3.5 0 0 1 16 10.5M12 13v4M8.5 21h7M10 17h4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  play: '<path d="M7 4.5l13 7.5-13 7.5z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
};

export function icon(name: string, size = 22): string {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ICONS.check}</svg>`;
}

// ---------- figure: a skeleton with fixed bone lengths, moved by joint angles ----------

interface Pose { thigh: number; flex: number; torso: number; arm: number; fore: number; ankle: number }
interface Key extends Pose { t: number }

const BONE = { thigh: 54, shank: 52, foot: 20, torso: 64, upper: 34, fore: 32, head: 11 };
const GROUND = 266;
const PLANT = 112; // where the standing foot is planted
const FLIGHT = { from: 0.42, to: 0.76, height: 52 }; // takeoff and landing times, apex height in px
const rad = (d: number): number => (d * Math.PI) / 180;
/** Direction for an angle measured from straight down: 90 = forward, 180 = straight up. y points down. */
const dir = (d: number): [number, number] => [Math.sin(rad(d)), Math.cos(rad(d))];

// key poses across one jump, as fractions of the cycle
const KEYS: Key[] = [
  { t: 0.0, thigh: 0, flex: 0, torso: 4, arm: 8, fore: 12, ankle: 90 }, // stand
  { t: 0.1, thigh: 10, flex: 14, torso: 10, arm: -22, fore: -12, ankle: 90 }, // arms swing back
  { t: 0.22, thigh: 62, flex: 98, torso: 32, arm: -50, fore: -42, ankle: 84 }, // bottom of the dip
  { t: 0.34, thigh: 22, flex: 26, torso: 16, arm: 120, fore: 130, ankle: 50 }, // drive
  { t: 0.42, thigh: 2, flex: 2, torso: 2, arm: 176, fore: 178, ankle: 8 }, // takeoff on the toes
  { t: 0.59, thigh: 20, flex: 34, torso: 0, arm: 172, fore: 176, ankle: 14 }, // apex, knees tucked a little
  { t: 0.69, thigh: 8, flex: 10, torso: 4, arm: 140, fore: 150, ankle: 30 }, // descent, legs reach down
  { t: 0.76, thigh: 34, flex: 62, torso: 20, arm: 96, fore: 100, ankle: 78 }, // landing
  { t: 0.86, thigh: 56, flex: 92, torso: 30, arm: 60, fore: 70, ankle: 88 }, // absorb
  { t: 1.0, thigh: 0, flex: 0, torso: 4, arm: 8, fore: 12, ankle: 90 }, // stand again
];
const PARAMS = ['thigh', 'flex', 'torso', 'arm', 'fore', 'ankle'] as const;

/** Cubic Hermite through the key poses (Catmull-Rom tangents), so the motion is smooth, not robotic. */
function poseAt(t: number): Pose {
  let i = KEYS.findIndex((k, n) => n < KEYS.length - 1 && t >= k.t && t <= KEYS[n + 1].t);
  if (i < 0) i = KEYS.length - 2;
  const k0 = KEYS[Math.max(0, i - 1)];
  const k1 = KEYS[i];
  const k2 = KEYS[i + 1];
  const k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const span = k2.t - k1.t;
  const u = (t - k1.t) / span;
  const out = {} as Pose;
  for (const key of PARAMS) {
    const m1 = ((k2[key] - k0[key]) / (k2.t - k0.t || 1)) * span;
    const m2 = ((k3[key] - k1[key]) / (k3.t - k1.t || 1)) * span;
    out[key] = (2 * u ** 3 - 3 * u ** 2 + 1) * k1[key] + (u ** 3 - 2 * u ** 2 + u) * m1 + (-2 * u ** 3 + 3 * u ** 2) * k2[key] + (u ** 3 - u ** 2) * m2;
  }
  return out;
}

type Pt = [number, number];
const add = (a: Pt, b: Pt, len: number): Pt => [a[0] + b[0] * len, a[1] + b[1] * len];

interface Limbs { knee: Pt; ankle: Pt; toe: Pt; neck: Pt; head: Pt; elbow: Pt; hand: Pt }

/** Joint positions relative to the hip at (0, 0). `far` rotates the far-side limbs a little, for depth. */
function joints(p: Pose, far: number): Limbs {
  const hip: Pt = [0, 0];
  const knee = add(hip, dir(p.thigh + far * 9), BONE.thigh);
  const ankle = add(knee, dir(p.thigh + far * 9 - p.flex), BONE.shank);
  const toe = add(ankle, dir(p.ankle), BONE.foot);
  const up: Pt = [Math.sin(rad(p.torso)), -Math.cos(rad(p.torso))];
  const neck = add(hip, up, BONE.torso);
  const head = add(neck, up, BONE.head + 6);
  const elbow = add(neck, dir(p.arm + far * 12), BONE.upper);
  const hand = add(elbow, dir(p.fore + far * 12), BONE.fore);
  return { knee, ankle, toe, neck, head, elbow, hand };
}

const line = (pts: Pt[]): string => pts.map((q, n) => `${n ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('');

/** One cycle position t (0..1): feet stay on the floor, the jump follows a parabola. */
function drawFigure(svg: SVGElement, t: number, state: { hipX: number }): void {
  const p = poseAt(t);
  const near = joints(p, 0);
  const far = joints(p, 1);
  const flying = t > FLIGHT.from && t < FLIGHT.to;
  const u = (t - FLIGHT.from) / (FLIGHT.to - FLIGHT.from);
  const lift = flying ? FLIGHT.height * 4 * u * (1 - u) : 0;
  const lowest = Math.max(near.ankle[1], near.toe[1], far.ankle[1], far.toe[1]);
  const hipY = GROUND - lowest - lift;
  if (!flying) state.hipX = PLANT - near.ankle[0]; // while on the floor the planted ankle stays put
  const at = (q: Pt): Pt => [state.hipX + q[0], hipY + q[1]];
  const set = (cls: string, d: string): void => svg.querySelector(`.${cls}`)?.setAttribute('d', d);
  const hip = at([0, 0]);
  set('f-farleg', line([hip, at(far.knee), at(far.ankle), at(far.toe)]));
  set('f-fararm', line([at(far.neck), at(far.elbow), at(far.hand)]));
  set('f-torso', line([hip, at(near.neck)]));
  set('f-leg', line([hip, at(near.knee), at(near.ankle), at(near.toe)]));
  set('f-arm', line([at(near.neck), at(near.elbow), at(near.hand)]));
  const head = at(near.head);
  const h = svg.querySelector('.f-head');
  h?.setAttribute('cx', head[0].toFixed(1));
  h?.setAttribute('cy', head[1].toFixed(1));
  const sh = svg.querySelector('.f-shadow');
  sh?.setAttribute('cx', (state.hipX + near.ankle[0]).toFixed(1));
  sh?.setAttribute('rx', (34 - lift * 0.35).toFixed(1));
  sh?.setAttribute('opacity', (0.22 - lift * 0.0025).toFixed(3));
}

const PHASES = ['Dip', 'Takeoff', 'Apex', 'Landing'];
/** Same names as the replay phases in the results. */
const phaseAt = (t: number): number => (t < 0.3 ? 0 : t < 0.5 ? 1 : t < 0.7 ? 2 : 3);

const FIGURE_BODY = `<line x1="14" y1="${GROUND}" x2="226" y2="${GROUND}" stroke-width="2" opacity="0.3"/>
    <ellipse class="f-shadow" cx="${PLANT}" cy="${GROUND}" rx="34" ry="5" fill="currentColor" stroke="none" opacity="0.2"/>
    <path class="f-fararm" opacity="0.38"/><path class="f-farleg" opacity="0.38"/>
    <path class="f-torso"/><path class="f-leg"/><path class="f-arm"/>
    <circle class="f-head" r="11" fill="currentColor" stroke="none"/>`;

/** The jumper: one cycle of dip, takeoff, apex and landing, looping. Started by runFigures. */
export function jumpFigure(): string {
  return `<svg class="art figure" viewBox="0 -50 240 330" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-fig>${FIGURE_BODY}</svg>`;
}

/** Same skeleton, frozen in the takeoff pose, for small diagrams. */
export function stillFigure(x: number, y: number, size: number): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${(size * 330) / 240}" viewBox="0 -50 240 330" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" data-fig data-still>${FIGURE_BODY}</svg>`;
}

/** Starts every figure under `root` and the phase captions next to it. Stops itself when scrolled away. Returns a stop function. */
export function runFigures(root: HTMLElement, reduceMotion: boolean): () => void {
  const stops: (() => void)[] = [];
  root.querySelectorAll<SVGElement>('svg[data-fig]').forEach((svg) => {
    const state = { hipX: PLANT };
    if (svg.hasAttribute('data-still') || reduceMotion) {
      drawFigure(svg, 0.42, state);
      return;
    }
    const band = svg.closest('.band, .tile');
    const spans = band ? [...band.querySelectorAll<HTMLElement>('.phases span')] : [];
    let raf = 0;
    let visible = true;
    const cycle = 4200;
    const t0 = performance.now();
    const frame = (now: number): void => {
      const t = ((now - t0) % cycle) / cycle;
      drawFigure(svg, t, state);
      const on = phaseAt(t);
      spans.forEach((s, i) => s.classList.toggle('on', i === on));
      if (visible) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(frame);
    });
    io.observe(svg as unknown as Element);
    raf = requestAnimationFrame(frame);
    stops.push(() => {
      cancelAnimationFrame(raf);
      io.disconnect();
    });
  });
  return () => stops.forEach((s) => s());
}

export const phaseNames = PHASES;
/** Top view: where the phone goes relative to the athlete. */
export function cameraDiagram(): string {
  return `<svg class="art cam" viewBox="0 0 360 220" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M62 110L250 52V168z" fill="currentColor" opacity="0.1" stroke="none"/>
    <path class="flow" d="M62 110H238" stroke-dasharray="5 7"/>
    <g transform="translate(26 92)"><rect width="30" height="36" rx="7" fill="currentColor" stroke="none" opacity="0.9"/><circle cx="15" cy="18" r="6" fill="var(--on-accent)" stroke="none"/></g>
    <circle cx="276" cy="110" r="13" fill="currentColor" stroke="none"/>
    <path d="M276 126v22M276 148l-8 18M276 148l8 18M276 132l-14 10M276 132l14 10"/>
    <path d="M62 188h188M62 182v12M250 182v12"/>
    <text x="156" y="210" text-anchor="middle" fill="currentColor" stroke="none" font-size="15" font-weight="700">4-5 m</text>
    <path d="M300 74a30 30 0 0 1 0 72" stroke-dasharray="3 6" opacity="0.7"/>
    <text x="318" y="114" fill="currentColor" stroke="none" font-size="13" font-weight="700">90&#176;</text>
  </svg>`;
}

/** The athlete should fill at least half of the frame height. */
export function frameDiagram(): string {
  return `<svg class="art frame" viewBox="0 0 150 240" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="30" y="8" width="90" height="224" rx="14"/>
    ${stillFigure(45, 36, 60)}
    <path class="flow" d="M16 66v118M10 66h12M10 184h12" stroke-dasharray="4 5"/>
    <text x="75" y="222" text-anchor="middle" fill="currentColor" stroke="none" font-size="11" font-weight="600">50%+ of height</text>
  </svg>`;
}
/** Tiny trend line for a stat tile. */
export function sparkline(values: number[], w = 140, h = 36): string {
  if (values.length < 2) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 6) + 3).toFixed(1)},${(h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(',');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" aria-hidden="true"><polyline points="${pts.join(' ')}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="currentColor"/></svg>`;
}
