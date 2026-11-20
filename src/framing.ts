/** Live framing check: is the person where the analysis needs them? Pure logic, so it can be tested without a camera. */

export interface LivePt {
  x: number; // 0..1 across the frame
  y: number; // 0..1 down the frame
  v: number; // visibility 0..1
}

export interface Check {
  id: 'frame' | 'size' | 'angle' | 'light';
  label: string;
  ok: boolean;
  hint: string;
}

export interface Framing {
  checks: Check[];
  ready: boolean;
  /** The one thing to fix first, or a go-ahead. */
  say: string;
}

const NOBODY = 'Step into the frame so the tracker can find you.';
const NOSE = 0;
const SHOULDERS = [11, 12];
const HIPS = [23, 24];
const ANKLES = [27, 28];
const FEET = [31, 32];
const MARGIN = 0.02;
const VISIBLE = 0.5;
const MIN_FILL = 0.5; // the body should fill at least half of the frame height
const MAX_FILL = 0.8; // more than this leaves no room above the head to jump
const BODY_PER_SPAN = 0.89; // nose to ankle is about 89% of body height, same as the calibration
const MIN_HEADROOM = 0.1;
const MAX_SHOULDER_RATIO = 0.55; // shoulder width over torso length: about 0.3 side-on, 0.9 from the front
const MIN_BRIGHTNESS = 70; // 0..255

const inside = (p: LivePt): boolean => p.v >= VISIBLE && p.x > MARGIN && p.x < 1 - MARGIN && p.y > MARGIN && p.y < 1 - MARGIN;
const mid = (a: LivePt, b: LivePt): { x: number; y: number } => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** `lm` are the 33 pose landmarks of one frame (or null when nobody was found). `brightness` is the mean luma of the frame, if known. */
export function checkFraming(lm: LivePt[] | null, aspect: number, brightness?: number): Framing {
  const checks: Check[] = [];
  const found = !!lm && lm.length >= 33;

  const needed = found ? [NOSE, ...ANKLES, ...FEET].map((i) => lm![i]) : [];
  const whole = found && needed.every(inside) && lm![NOSE].y > MIN_HEADROOM;
  checks.push({
    id: 'frame',
    label: 'Whole body in frame',
    ok: whole,
    hint: !found ? NOBODY : lm![NOSE].y <= MIN_HEADROOM ? 'Leave room above your head for the jump.' : 'Feet to head must be in the frame. Move back or lower the phone.',
  });

  let fill = 0;
  if (found) fill = (Math.max(...FEET.map((i) => lm![i].y)) - lm![NOSE].y) / BODY_PER_SPAN;
  checks.push({
    id: 'size',
    label: 'Big enough, with room to jump',
    ok: found && fill >= MIN_FILL && fill <= MAX_FILL,
    hint: !found ? NOBODY : fill < MIN_FILL ? 'Too small. Move the phone closer or zoom in a little.' : 'Too big. Move the phone back so you can jump inside the frame.',
  });

  let ratio = 1;
  if (found) {
    const sw = Math.abs(lm![SHOULDERS[0]].x - lm![SHOULDERS[1]].x) * aspect; // aspect = width / height, so both axes are in the same units
    const a = mid(lm![SHOULDERS[0]], lm![SHOULDERS[1]]);
    const b = mid(lm![HIPS[0]], lm![HIPS[1]]);
    const torso = Math.hypot((a.x - b.x) * aspect, a.y - b.y) || 1;
    ratio = sw / torso;
  }
  checks.push({
    id: 'angle',
    label: 'Side-on',
    ok: found && ratio <= MAX_SHOULDER_RATIO,
    hint: found ? 'Turn so the camera sees your side, not your chest.' : NOBODY,
  });

  if (brightness !== undefined) {
    checks.push({ id: 'light', label: 'Enough light', ok: brightness >= MIN_BRIGHTNESS, hint: 'It is dark. Turn on a light or film near a window.' });
  }

  const first = checks.find((c) => !c.ok);
  return {
    checks,
    ready: !first,
    say: first ? first.hint : 'Looks good. Leave the phone exactly here and film with your camera app at 60 fps.',
  };
}
