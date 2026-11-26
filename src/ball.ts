import type { Pt } from './pose';

/**
 * Picks the ball that belongs to the player when the detector sees several (a rack, a ball on the floor, a teammate's).
 * It starts with the ball nearest to the hands, then follows the ball nearest to where it was the frame before, as long as
 * it moved a believable distance. When the ball is lost for half a second it looks near the hands again.
 */

const WRISTS = [15, 16];
const NOSE = 0;
const ANKLES = [27, 28];
const LOST_SECONDS = 0.5;

/** Body height on screen in pixels for a frame: nose to the middle of the ankles. */
function bodyPx(lm: Pt[] | null, width: number, height: number): number | null {
  if (!lm) return null;
  const ax = ((lm[ANKLES[0]].x + lm[ANKLES[1]].x) / 2) * width;
  const ay = ((lm[ANKLES[0]].y + lm[ANKLES[1]].y) / 2) * height;
  const d = Math.hypot(lm[NOSE].x * width - ax, lm[NOSE].y * height - ay);
  return d > 1 ? d : null;
}

export function pickBalls(frames: (Pt[] | null)[], cands: Pt[][], width: number, height: number, fps: number): (Pt | null)[] {
  // a steady body size for the whole clip: the median over the frames where the person was found
  const sizes = frames.map((lm) => bodyPx(lm, width, height)).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const body = sizes.length ? sizes[Math.floor(sizes.length / 2)] : height / 2;
  const px = (p: Pt): [number, number] => [p.x * width, p.y * height];
  const dist = (a: Pt, b: Pt): number => {
    const [ax, ay] = px(a);
    const [bx, by] = px(b);
    return Math.hypot(ax - bx, ay - by);
  };

  const out: (Pt | null)[] = [];
  let last: Pt | null = null;
  let lastAt = -Infinity;
  for (let i = 0; i < cands.length; i++) {
    const here = cands[i] ?? [];
    let pick: Pt | null = null;
    if (last && i - lastAt <= LOST_SECONDS * fps) {
      // follow: the candidate nearest to the last position, within what a thrown ball can travel in that time
      const gate = Math.min(body * 1.5, body * 0.2 * (i - lastAt) * (60 / fps));
      let best = gate;
      for (const c of here) {
        const d = dist(c, last);
        if (d <= best) {
          best = d;
          pick = c;
        }
      }
    } else {
      // start, or start again: the ball nearest to a hand, if it is close enough to be in play
      const lm = frames[i];
      if (lm) {
        let best = body * 0.6;
        for (const c of here) {
          for (const w of WRISTS) {
            const d = dist(c, lm[w]);
            if (d <= best) {
              best = d;
              pick = c;
            }
          }
        }
      }
    }
    if (pick) {
      last = pick;
      lastAt = i;
    }
    out.push(pick);
  }
  return out;
}
