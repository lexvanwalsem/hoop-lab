import type { Metric, Status } from './analysis';
import type { Data, Exercise, Session } from './store';

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

export function demoData(): Pick<Data, 'sessions' | 'exercises' | 'goalCm'> {
  const sessions: Session[] = [];
  const jumps = [51, 52, 54, 53, 55, 56, 55, 58, 57, 58, 60, 62];
  jumps.forEach((cm, i) => sessions.push({ id: `demo-j${i}`, date: day(56 - i * 5), kind: 'standing', headline: cm, metrics: jump(cm, i), tips: [], demo: true }));
  [68, 70, 72].forEach((cm, i) => sessions.push({ id: `demo-d${i}`, date: day(38 - i * 12), kind: 'dunk', headline: cm, metrics: jump(cm - 10, i), tips: [], demo: true }));
  const scores = [62, 70, 66, 74, 71, 78, 69, 80, 76, 82, 79, 85, 74, 88, 81, 86];
  scores.forEach((sc, i) => sessions.push({ id: `demo-s${i}`, date: day(34 - Math.floor(i / 2) * 4), kind: 'shot', headline: sc, metrics: shot(sc, i), tips: [], demo: true }));

  const exercises: Exercise[] = [];
  const plan: [string, number, number][] = [['Back squat', 4, 5], ['Box jump', 3, 6], ['Calf raise', 3, 12], ['Form shooting', 4, 10], ['Depth jump', 3, 5]];
  plan.forEach(([name, sets, reps], k) => {
    for (let w = 0; w < 6; w++) exercises.push({ id: `demo-e${k}-${w}`, date: day(w * 7 + k), name, sets, reps, notes: k === 0 ? '80 kg' : '', demo: true });
  });
  const oldestFirst = (a: { date: string }, b: { date: string }): number => a.date.localeCompare(b.date);
  return { sessions: sessions.sort(oldestFirst), exercises: exercises.sort(oldestFirst), goalCm: 70 };
}
