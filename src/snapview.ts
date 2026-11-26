import { slotOf } from './snapshots';
import type { AngleMark, Snap } from './snapshots';

/** Drawing of a key moment: the body, and for every measured joint a wedge, the angle and the verdict in colour. */

const H = 300; // drawing units for the frame height
const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];

const f = (n: number): string => n.toFixed(1);

/**
 * The wedge for one angle runs between the two limbs as they are drawn, so it always lines up with the skeleton.
 * The number is the joint angle measured in 3D: when the camera does not see the joint from the side, the wedge on screen
 * looks wider or narrower than that number, because the picture is flat and the joint is not.
 */
function wedge(p: (i: number) => [number, number], m: AngleMark, u: number): string {
  const b = p(m.b);
  const ua = [p(m.a)[0] - b[0], p(m.a)[1] - b[1]];
  const uc = [p(m.c)[0] - b[0], p(m.c)[1] - b[1]];
  const t1 = Math.atan2(ua[1], ua[0]);
  // the turn from the first limb to the second, the short way round, exactly as the two lines lie in the picture
  let d = Math.atan2(uc[1], uc[0]) - t1;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  const r = 11 * u;
  const at = (t: number, rad: number): string => `${f(b[0] + rad * Math.cos(t))} ${f(b[1] + rad * Math.sin(t))}`;
  const mid = t1 + d / 2;
  const path = `M${f(b[0])} ${f(b[1])}L${at(t1, r)}A${f(r)} ${f(r)} 0 0 ${d > 0 ? 1 : 0} ${at(t1 + d, r)}Z`;
  const [lx, ly] = [b[0] + (r + 7 * u) * Math.cos(mid), b[1] + (r + 7 * u) * Math.sin(mid) + 2.5 * u];
  const flagged = m.status === 'bad' || m.status === 'warn';
  return `<g class="ang ${m.status}">
    ${flagged ? `<path class="limb" d="M${f(p(m.a)[0])} ${f(p(m.a)[1])}L${f(b[0])} ${f(b[1])}L${f(p(m.c)[0])} ${f(p(m.c)[1])}"/>` : ''}
    <path class="wedge" d="${path}"/>
    <text x="${f(lx)}" y="${f(ly)}" text-anchor="middle" class="deg">${m.deg}&#176;</text>
  </g>`;
}

/** The crop around the person, in drawing units and as a share of the frame (for cutting a photo that lines up). */
export function snapBox(s: Snap): { vx: number; vy: number; boxW: number; boxH: number; u: number; norm: { x: number; y: number; w: number; h: number } } {
  const xs = s.pts.map((q) => q[0] * s.ar * H);
  const ys = s.pts.map((q) => q[1] * H);
  const bodyH = Math.max(Math.max(...ys) - Math.min(...ys), 40);
  const bodyW = Math.max(Math.max(...xs) - Math.min(...xs), 10);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  // a steady 4:5 box around the person, so the cards line up
  const boxH = Math.max(bodyH * 1.5, (bodyW * 1.6) / 0.8);
  const boxW = boxH * 0.8;
  const vx = cx - boxW / 2;
  const vy = cy - boxH / 2;
  return { vx, vy, boxW, boxH, u: bodyH / 100, norm: { x: vx / (s.ar * H), y: vy / H, w: boxW / (s.ar * H), h: boxH / H } };
}

export function snapSvg(s: Snap): string {
  const p = (i: number): [number, number] => [s.pts[i][0] * s.ar * H, s.pts[i][1] * H];
  const { vx, vy, boxW, boxH, u } = snapBox(s);
  const bones = BONES.map(([a, b]) => `M${f(p(slotOf(a))[0])} ${f(p(slotOf(a))[1])}L${f(p(slotOf(b))[0])} ${f(p(slotOf(b))[1])}`).join('');
  const head = p(slotOf(0));
  const headR = 6 * u;
  const label = `${s.name}: ${s.angles.map((a) => `${a.label} ${a.deg} degrees`).join(', ') || 'body position'}`;
  return `<svg class="snap-svg" style="--u:${u.toFixed(2)}" viewBox="${f(vx)} ${f(vy)} ${f(boxW)} ${f(boxH)}" role="img" aria-label="${label}">
    <path class="bones" d="${bones}"/>
    <circle class="headdot" cx="${f(head[0])}" cy="${f(head[1] - headR * 0.4)}" r="${f(headR)}"/>
    ${KEEP_DOTS(p, u)}
    ${s.angles.map((a) => wedge(p, a, u)).join('')}
  </svg>`;
}

/** Small joint dots so the skeleton reads as joints, not just lines. */
function KEEP_DOTS(p: (i: number) => [number, number], u: number): string {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => `<circle class="joint" cx="${f(p(i)[0])}" cy="${f(p(i)[1])}" r="${f(1.5 * u)}"/>`).join('');
}
