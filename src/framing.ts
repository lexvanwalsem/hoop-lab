/** Live framing check: is the person where the analysis needs them? Pure logic, so it can be tested without a camera. */

export interface LivePt {
  x: number; // 0..1 across the frame
  y: number; // 0..1 down the frame
  v: number; // visibility 0..1
}

export interface Check {
  id: 'frame' | 'size' | 'angle' | 'level' | 'light';
  label: string;
  ok: boolean;
  hint: string;
  /** A nice-to-have: when it fails it is shown, but it does not stop "ready". */
  advisory?: boolean;
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
// shoulder width over torso length: about 0.1 to 0.2 fully sideways, 0.6 at 45 degrees, 0.9 from the front.
// Fully sideways hides the far arm and leg from the tracker, so 45 degrees is what to aim for.
const MIN_SHOULDER_RATIO = 0.3;
const MAX_SHOULDER_RATIO = 0.8;
const MIN_BRIGHTNESS = 70; // 0..255

const inside = (p: LivePt): boolean => p.v >= VISIBLE && p.x > MARGIN && p.x < 1 - MARGIN && p.y > MARGIN && p.y < 1 - MARGIN;
const mid = (a: LivePt, b: LivePt): { x: number; y: number } => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** `lm` are the 33 pose landmarks of one frame (or null when nobody was found). `brightness` is the mean luma of the frame, if known. */
/**
 * `angle` says how much the turn matters: a shot needs about 45 degrees (the elbow and the arc must show, and both arms must stay
 * visible), a jump does not (its height comes from flight time and works from any angle), but joint angles are better at 45 degrees.
 */
/** How far the phone is tilted, in degrees, from its motion sensor: pitch is up or down, roll is sideways. */
export interface Tilt {
  pitch: number;
  roll: number;
}
export const MAX_PITCH = 8;
export const MAX_ROLL = 5;

export function checkFraming(lm: LivePt[] | null, aspect: number, brightness?: number, angle: 'required' | 'advised' = 'required', tilt?: Tilt): Framing {
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
    label: angle === 'required' ? 'Turned 45 degrees' : 'Any angle works for jump height',
    ok: angle === 'required' ? found && ratio >= MIN_SHOULDER_RATIO && ratio <= MAX_SHOULDER_RATIO : found,
    hint: !found ? NOBODY : ratio > MAX_SHOULDER_RATIO ? 'Turn a little away from the camera, to about 45 degrees. Then your knee and elbow bend show and the tracker still sees both sides of you.' : 'Turn a little towards the camera, to about 45 degrees. Fully sideways hides your far arm and leg from the tracker.',
    ...(angle === 'advised' ? { advisory: true } : {}),
  });

  if (tilt) {
    const flat = Math.abs(tilt.pitch) <= MAX_PITCH;
    checks.push({
      id: 'level',
      label: 'Phone upright',
      ok: flat && Math.abs(tilt.roll) <= MAX_ROLL,
      advisory: true,
      hint: !flat ? `The phone is tilted ${Math.round(Math.abs(tilt.pitch))} degrees up or down. Stand it straight, with the lens at hip height, or the scale and angles drift.` : `The phone leans ${Math.round(Math.abs(tilt.roll))} degrees sideways. Stand it straight.`,
    });
  }

  if (brightness !== undefined) {
    checks.push({ id: 'light', label: 'Enough light', ok: brightness >= MIN_BRIGHTNESS, hint: 'It is dark. Turn on a light or film near a window.' });
  }

  const first = checks.find((c) => !c.ok && !c.advisory);
  const tip = checks.find((c) => !c.ok && c.advisory);
  return {
    checks,
    ready: !first,
    say: first ? first.hint : tip && found ? (tip.id === 'angle' ? 'Good to go. Turning to about 45 degrees would give better joint angles, but the jump height works from here.' : `Good to go. ${tip.hint}`) : 'Looks good. You can record now, or film with your camera app at 60 fps.',
  };
}

/** A measured frame rate rounded to the usual one it is meant to be (59.7 is 60), otherwise to the nearest whole number. */
export function snapFps(measured: number): number {
  const usual = [24, 25, 30, 50, 60, 90, 120, 240];
  const near = usual.find((u) => Math.abs(measured - u) <= u * 0.06);
  return near ?? Math.max(1, Math.round(measured));
}
