import type { Metric } from './analysis';

export interface Rec {
  title: string;
  why: string; // the cue, in plain words
  drills: string[];
}

const num = (m: Metric): number => parseFloat(m.value);

/** Turns flagged metrics (warn or bad) into advice with concrete drills. */
export function recommend(metrics: Metric[]): Rec[] {
  const recs: Rec[] = [];
  for (const m of metrics) {
    if (m.status !== 'warn' && m.status !== 'bad') continue;
    const r = rule(m);
    if (r) recs.push(r);
  }
  return recs;
}

function rule(m: Metric): Rec | null {
  switch (m.label) {
    // ----- jumps -----
    case 'Countermovement depth':
      return num(m) < 25
        ? { title: 'Load deeper before you jump', why: 'Your dip is shallow, so you build little force and elastic energy. Sink about a quarter to half squat (hips drop 25-50 cm), hips back, chest up.', drills: ['Countermovement jump: 3 x 5, focus on a controlled dip then explosive drive', 'Box squat to parallel: 3 x 5 with a moderate load', 'Goblet squat: 3 x 8, slow down, fast up'] }
        : { title: 'Make the dip shorter and faster', why: 'A very deep dip costs time and the stored energy fades. Dip less and reverse faster.', drills: ['Quarter-squat jumps: 3 x 5, quick reversal', 'Pogo hops: 3 x 15, stiff ankles, minimal ground time'] };
    case 'Dip bottom to takeoff':
      return { title: 'Be more reactive out of the dip', why: 'You wait too long between the bottom of the dip and takeoff, which wastes the stretch-reflex. Do not pause at the bottom, reverse immediately.', drills: ['Depth jump from 20-30 cm: 3 x 4, minimal ground contact, jump as high as possible', 'Pogo hops: 3 x 15', 'Skater or lateral bounds: 3 x 6 per side'] };
    case 'Landing knee angle':
      return { title: 'Land softer', why: 'You land stiff, which loads knees and back and costs you in repeated jumps. Land on both feet, bend ankles, knees and hips together and keep the knees over the toes.', drills: ['Drop landing from a low box (20-30 cm): 3 x 5, stick it for 2 s', 'Single-leg landing hold: 3 x 5 per leg', 'Tempo squat, 3 s down: 3 x 6'] };
    case 'Landing difference':
      return { title: 'Land evenly on both legs', why: 'One knee bends clearly less than the other when you land, so one leg takes more of the load. Over many jumps that side gets sore first. Land on both feet and let both knees bend the same.', drills: ['Single-leg landing hold: 3 x 5 per leg, start with the weaker side', 'Split squat: 3 x 8 per leg', 'Drop landing from a low box (20-30 cm): 3 x 5, stick it for 2 s'] };
    case 'Relative power':
      return { title: 'Build force, then convert it to speed', why: 'Your power for your body weight is on the low side. Force comes first: get stronger in the legs, then train speed with light jumps.', drills: ['Back squat or trap-bar deadlift: 4 x 4 heavy, 2-3 min rest', 'Romanian deadlift: 3 x 6', 'Jump squat with a light load: 4 x 4, as fast as possible', 'Bulgarian split squat: 3 x 6 per leg'] };
    case 'Approach speed':
      return { title: 'Bring more speed into the jump', why: 'Your run-up is slow. Accelerate over the last 3-5 steps, make the second-to-last step long and low, then convert the speed upwards.', drills: ['Sprint starts, 10-20 m: 6 x 1, full rest', 'Approach jumps from 3 steps, then 5 steps: 5 x 3', 'Hill sprints: 6 x 10 s'] };
    case 'Hand above rim (305 cm)':
      return { title: 'Gain reach and height', why: 'Your hand does not clear the rim by enough. Every cm of jump height and every cm of arm reach counts, so raise the jump and reach as high as possible at the top.', drills: ['Approach jump to touch a high target: 5 x 3', 'Overhead reach and stretch: 2 x 30 s per arm for shoulder mobility', 'Plyometric box jumps: 4 x 4'] };

    // ----- shooting -----
    case 'Knee bend (min angle)':
      return num(m) > 140
        ? { title: 'Use your legs', why: 'You barely bend your knees, so the shot comes from the arm only. Bend into the shot and let the legs push the ball up.', drills: ['Form shots with a deliberate knee dip: 5 x 10', 'Wall sit: 3 x 30 s', 'Bodyweight squat: 3 x 12'] }
        : { title: 'Do not sink so deep', why: 'A very deep dip slows the shot and costs timing. Dip only as far as you can push back up smoothly.', drills: ['Quick-dip form shots: 5 x 10', 'Quarter-squat jumps: 3 x 5'] };
    case 'Elbow at set point':
      return { title: 'Tuck the elbow under the ball', why: 'Your set point is not at about 90 degrees. Keep the elbow under the ball, in line with the basket, so the arm can extend straight.', drills: ['One-hand form shots close to the rim: 5 x 10', 'Mirror or video check of the set point, 10 reps', 'Wall elbow drill: touch the wall lightly with the elbow, 3 x 10'] };
    case 'Elbow at release':
      return { title: 'Finish the arm extension', why: 'Your arm is not fully extended when the ball leaves your hand. A full extension gives a more repeatable arc.', drills: ['Close-range form shooting, extend fully: 5 x 10', 'Follow-through freeze: hold the finish after every shot, 3 x 10'] };
    case 'Release above head':
      return { title: 'Release higher and in front', why: 'Your release point is low. Release above and slightly in front of the forehead so the shot is harder to block and the arc is higher.', drills: ['Form shots with the ball starting at the forehead: 5 x 10', 'Shoot over a stretched cord or hand-up defender: 3 x 10'] };
    case 'Set point to release':
      return { title: 'Speed up the release', why: 'The path from set point to release is slow. A shorter, smoother path gets the shot off before the defense reacts.', drills: ['Catch-and-shoot from the set position: 5 x 10', 'Chair or wall drill: start with the ball already at the set point, 3 x 10'] };
    case 'Wrist flick speed':
      return { title: 'Snap the wrist through the ball', why: 'Your wrist flick is slow. A fast, relaxed flick gives backspin and a soft touch.', drills: ['Lying-down backspin shots straight up: 3 x 15', 'One-hand shooting with a relaxed wrist: 5 x 10'] };
    case 'Follow-through hold':
      return { title: 'Hold the finish', why: 'You drop your hand early. Hold the follow-through, arm up and wrist relaxed, until the ball reaches the rim.', drills: ['Freeze the follow-through after every shot until the ball lands', 'Free throws with a 2 s hold: 20 shots'] };
    case 'Ball launch angle':
      return { title: 'Shoot with more arc', why: 'Your ball leaves your hand at a low angle. A launch angle around 45-55 degrees gives a steeper entry and a bigger target.', drills: ['Arc shots over a high target (e.g. a cord): 3 x 10', 'Free throws focusing on high release: 20 shots'] };
    case 'Release vs jump apex':
      return { title: 'Time the release to the top of the jump', why: 'You release away from the top of your jump. Releasing at the top gives the most stable base and consistent distance.', drills: ['Jump shots from a standstill: shoot at the apex, 5 x 10', 'Count out loud: up, hold, release, 3 x 10'] };
    case 'Forward drift':
      return { title: 'Jump straight up, land where you started', why: 'You drift forward during the shot, which changes your distance. Jump up, not forward, and land on the same spot.', drills: ['Mark a spot on the floor and land on it: 5 x 10', 'Two-foot jump shots with a taped line: 3 x 10'] };
    default:
      return null;
  }
}

/** The exercise name of a drill line: the part before the sets and reps ("Pogo hops: 3 x 15" gives "Pogo hops"). */
export function drillName(drill: string): string {
  return drill.split(/[:,(]/)[0].trim().slice(0, 70);
}

/** A YouTube search for how to do the drill. Opened only when the user clicks it, so nothing is requested otherwise. */
export function exampleUrl(drill: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${drillName(drill)} how to do`)}`;
}
