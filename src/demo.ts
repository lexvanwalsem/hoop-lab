import type { Metric, Status } from './analysis';
import type { Data, Exercise, Session } from './store';
import type { Snap } from './snapshots';

/**
 * Sample data so the dashboard has something to show before you have analyzed a video.
 * Every entry is flagged `demo` and can be removed in one click. The numbers are made up.
 */

const day = (daysAgo: number): string => new Date(Date.now() - daysAgo * 864e5).toLocaleDateString('sv-SE');
const m = (label: string, value: string, status: Status, target?: string): Metric => ({ label, value, status, ...(target ? { target } : {}) });

/** A standing jump of `cm` height (flight time method), with the metrics the real analysis produces. */
function jump(cm: number, i: number): Metric[] {
  const flight = Math.sqrt((8 * cm) / 100 / 9.81);
  const power = 60.7 * cm + 45.3 * 95 - 2055;
  const dip = 36 + ((i * 7) % 12);
  return [
    m('Jump height (hip rise)', `${(cm * 1.12).toFixed(1)} cm`, 'info'),
    m('Jump height (flight time)', `${cm.toFixed(1)} cm`, 'info'),
    m('Flight time', `${flight.toFixed(2)} s`, 'info'),
    m('Peak power (Sayers)', `${power.toFixed(0)} W`, 'info'),
    m('Relative power', `${(power / 95).toFixed(1)} W/kg`, power / 95 >= 55 ? 'good' : 'warn', '55+ W/kg'),
    m('Countermovement depth', `${dip} cm`, 'good', '25-50 cm'),
    m('Dip bottom to takeoff', `${220 + ((i * 13) % 60)} ms`, 'good', '150-350 ms'),
    m('Landing knee angle', `${90 + ((i * 5) % 14)} deg`, 'good', 'under 140 deg'),
  ];
}

/** One jump shot with a score. A few flaws repeat, like a real shooter's habits. */
function shot(score: number, i: number): Metric[] {
  const late = i % 4 === 3;
  return [
    m('Shooting hand', 'right', 'info'),
    m('Knee bend (min angle)', `${112 + ((i * 3) % 12)} deg`, 'good', '100-140 deg'),
    m('Elbow at set point', `${60 + ((i * 2) % 8)} deg`, 'warn', '70-100 deg'),
    m('Elbow at release', `${127 + ((i * 3) % 10)} deg`, 'bad', '150+ deg'),
    m('Release height', `${212 + ((i * 3) % 12)} cm`, 'info'),
    m('Release above head', `${17 + (i % 5)} cm`, 'good', '10+ cm'),
    m('Set point to release', `${(score > 75 ? 300 : 420) + ((i * 11) % 60)} ms`, 'good', '150-450 ms'),
    m('Wrist flick speed', `${240 + ((i * 29) % 160)} deg/s`, 'warn', '300+ deg/s'),
    m('Follow-through hold', `${380 + ((i * 37) % 260)} ms`, 'good', '250+ ms'),
    m('Jump height', `${12 + (i % 9)} cm`, 'info'),
    m('Release vs jump apex', `${late ? 380 : 20 + ((i * 17) % 80)} ms`, late ? 'bad' : 'good', '-80 to 40 ms'),
    m('Forward drift', `${10 + ((i * 3) % 14)} cm`, 'good', 'under 30 cm'),
  ];
}

/** A side-on figure from joint angles, as the 15 points a snapshot keeps. Made up, like the rest of the demo. */
function figure(o: { knee: number; hip: number; elbow?: number; armUp?: number; lift?: number }): [number, number][] {
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const go = (p: [number, number], deg: number, len: number): [number, number] => [p[0] + len * Math.sin(rad(deg)), p[1] - len * Math.cos(rad(deg))];
  const ankle: [number, number] = [0.45, 0.88 - (o.lift ?? 0)];
  const knee = go(ankle, 0, 0.21);
  const thighDir = -(180 - o.knee);
  const hip = go(knee, thighDir, 0.22);
  const torsoDir = thighDir + 180 - o.hip + 180 - 180; // upright when hip is 180
  const shoulder = go(hip, torsoDir, 0.27);
  const nose = go(shoulder, torsoDir, 0.1);
  const upperDir = o.armUp ?? 20;
  const elbow = go(shoulder, upperDir, 0.14);
  const wrist = go(elbow, upperDir - (180 - (o.elbow ?? 160)), 0.13);
  const foot: [number, number] = [ankle[0] + 0.07, ankle[1] + 0.01];
  // order of KEEP: nose, shoulders, elbows, wrists, hips, knees, ankles, feet (left and right drawn on top of each other)
  return [nose, shoulder, shoulder, elbow, elbow, wrist, wrist, hip, hip, knee, knee, ankle, ankle, foot, foot].map((q) => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]);
}

/** Key moments for the demo sessions, with the same shape the real analysis produces. */
function demoSnaps(kind: 'standing' | 'dunk' | 'shot', metrics: Metric[], i: number): Snap[] {
  const slotOf = (a: number, b: number, c: number): { a: number; b: number; c: number } => ({ a, b, c });
  const knee = slotOf(7, 9, 11);
  const hip = slotOf(1, 7, 9);
  const elbow = slotOf(1, 3, 5);
  const metric = (label: string): Metric | undefined => metrics.find((x) => x.label === label);
  const ang = (t: { a: number; b: number; c: number }, deg: number, label: string, m?: Metric): Snap['angles'][number] => ({ ...t, deg, label, status: m?.status ?? 'info', ...(m?.target ? { target: m.target } : {}) });
  const snap = (name: string, pts: [number, number][], angles: Snap['angles']): Snap => ({ name, ar: 0.75, pts, angles });
  if (kind === 'shot') {
    const set = parseFloat(metric('Elbow at set point')?.value ?? '66');
    const rel = parseFloat(metric('Elbow at release')?.value ?? '132');
    return [
      snap('Set point', figure({ knee: 121, hip: 160, elbow: set, armUp: 20 }), [ang(elbow, Math.round(set), 'Elbow', metric('Elbow at set point')), ang(knee, 121, 'Knee')]),
      snap('Release', figure({ knee: 165, hip: 175, elbow: rel, armUp: 5, lift: 0.06 }), [ang(elbow, Math.round(rel), 'Elbow', metric('Elbow at release'))]),
      snap('Landing', figure({ knee: 148, hip: 165, elbow: 150, armUp: 25 }), [ang(knee, 148, 'Knee')]),
    ].slice(0, 3 + (i % 1));
  }
  const land = parseFloat(metric('Landing knee angle')?.value ?? '100');
  return [
    snap('Dip bottom', figure({ knee: 98, hip: 85, elbow: 170, armUp: -60 }), [ang(knee, 98, 'Knee'), ang(hip, 85, 'Hip')]),
    snap('Takeoff', figure({ knee: 165, hip: 175, elbow: 175, armUp: 150, lift: 0.01 }), [ang(knee, 165, 'Knee')]),
    snap('Apex', figure({ knee: 150, hip: 170, elbow: 175, armUp: 160, lift: 0.18 }), []),
    snap('Landing', figure({ knee: land, hip: 120, elbow: 170, armUp: 40 }), [ang(knee, Math.round(land), 'Knee', metric('Landing knee angle'))]),
  ];
}

export function demoData(): Pick<Data, 'sessions' | 'exercises' | 'goalCm'> {
  const sessions: Session[] = [];
  const jumps = [51, 52, 54, 53, 55, 56, 55, 58, 57, 58, 60, 62];
  jumps.forEach((cm, i) => sessions.push({ id: `demo-j${i}`, date: day(56 - i * 5), kind: 'standing', headline: cm, metrics: jump(cm, i), tips: [], snaps: demoSnaps('standing', jump(cm, i), i), demo: true }));
  [68, 70, 72].forEach((cm, i) => sessions.push({ id: `demo-d${i}`, date: day(38 - i * 12), kind: 'dunk', headline: cm, metrics: jump(cm - 10, i), tips: [], snaps: demoSnaps('dunk', jump(cm - 10, i), i), demo: true }));
  const scores = [62, 70, 66, 74, 71, 78, 69, 80, 76, 82, 79, 85, 74, 88, 81, 86];
  scores.forEach((sc, i) => sessions.push({ id: `demo-s${i}`, date: day(34 - Math.floor(i / 2) * 4), kind: 'shot', headline: sc, metrics: shot(sc, i), tips: [], snaps: demoSnaps('shot', shot(sc, i), i), demo: true }));

  const exercises: Exercise[] = [];
  const plan: [string, number, number][] = [['Back squat', 4, 5], ['Box jump', 3, 6], ['Calf raise', 3, 12], ['Form shooting', 4, 10], ['Depth jump', 3, 5]];
  plan.forEach(([name, sets, reps], k) => {
    for (let w = 0; w < 6; w++) exercises.push({ id: `demo-e${k}-${w}`, date: day(w * 7 + k), name, sets, reps, notes: k === 0 ? '80 kg' : '', demo: true });
  });
  const oldestFirst = (a: { date: string }, b: { date: string }): number => a.date.localeCompare(b.date);
  return { sessions: sessions.sort(oldestFirst), exercises: exercises.sort(oldestFirst), goalCm: 70 };
}
