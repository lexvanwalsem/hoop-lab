// Run with: node --test tests/
// Unit tests for the pure logic around the analysis: targets, advice, storage and the video header reader.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recommend } from '../src/coach.ts';
import { demoData } from '../src/demo.ts';
import { gauge, parseTarget } from '../src/gauge.ts';
import { emptyData, exportBackup, importBackup, sanitize } from '../src/store.ts';
import { readFileFps } from '../src/video.ts';

test('parseTarget reads ranges, minimums and maximums', () => {
  assert.deepEqual(parseTarget('25-50 cm'), [25, 50]);
  assert.deepEqual(parseTarget('150+ deg'), [150, Infinity]);
  assert.deepEqual(parseTarget('under 140 deg'), [-Infinity, 140]);
  assert.deepEqual(parseTarget('-80 to 40 ms'), [-80, 40]);
  assert.equal(parseTarget('nonsense'), null);
});

test('gauge puts the marker inside the bar and skips values it cannot place', () => {
  const html = gauge('43 cm', '25-50 cm', 'good');
  const pos = Number(/data-pos="([\d.]+)"/.exec(html)?.[1]);
  assert.ok(pos > 0 && pos < 100, `marker at ${pos}`);
  assert.equal(gauge('right', '25-50 cm', 'info'), '');
  assert.equal(gauge('10 cm', undefined, 'info'), '');
});

test('recommend only advises on flagged metrics and tells low from high', () => {
  const shallow = recommend([{ label: 'Countermovement depth', value: '12 cm', status: 'bad' }]);
  const deep = recommend([{ label: 'Countermovement depth', value: '70 cm', status: 'warn' }]);
  assert.equal(shallow.length, 1);
  assert.equal(deep.length, 1);
  assert.notEqual(shallow[0].title, deep[0].title);
  assert.deepEqual(recommend([{ label: 'Countermovement depth', value: '40 cm', status: 'good' }]), []);
  assert.deepEqual(recommend([{ label: 'Flight time', value: '0.7 s', status: 'info' }]), []);
});

test('sanitize drops broken entries and keeps good ones, oldest first', () => {
  const clean = sanitize({
    heightCm: 193,
    sessions: [
      { id: 'b', date: '2026-02-01', kind: 'shot', headline: 80, metrics: [{ label: 'x', value: '1', status: 'good' }, { nope: true }], tips: ['t', 5] },
      { id: 'a', date: '2026-01-01', kind: 'standing', headline: 55, metrics: [] },
      { id: 'bad1', date: '2026-01-01', kind: 'swim', headline: 1, metrics: [] },
      { date: 'no id', kind: 'shot', headline: 1, metrics: [] },
      null,
    ],
    exercises: [{ id: 'e', date: '2026-01-02', name: 'Squat', sets: 3, reps: 5 }, { id: 'x', name: 'missing fields' }],
  });
  assert.equal(clean.heightCm, 193);
  assert.deepEqual(clean.sessions.map((s) => s.id), ['a', 'b']);
  assert.equal(clean.sessions[1].metrics.length, 1);
  assert.deepEqual(clean.sessions[1].tips, ['t']);
  assert.equal(clean.exercises.length, 1);
  assert.deepEqual(sanitize('garbage'), emptyData());
});

test('a backup round trip adds only what is new', () => {
  const demo = demoData();
  const source = { ...emptyData(), heightCm: 193, sessions: demo.sessions.slice(0, 3), exercises: demo.exercises.slice(0, 2) };
  const text = exportBackup(source);
  const target = { ...emptyData(), sessions: demo.sessions.slice(0, 1) };
  const added = importBackup(text, target);
  assert.deepEqual(added, { sessions: 2, exercises: 2 });
  assert.equal(target.sessions.length, 3);
  assert.equal(target.heightCm, 193);
  assert.deepEqual(importBackup(text, target), { sessions: 0, exercises: 0 }); // importing twice changes nothing
});

test('a backup that is not ours is refused', () => {
  const target = emptyData();
  assert.equal(importBackup('{not json', target), 'This file is not valid JSON.');
  assert.equal(importBackup('{"app":"something else"}', target), 'This is not a Hoop Lab backup.');
});

test('demo data is flagged, sorted and uses the same shape as real results', () => {
  const demo = demoData();
  assert.ok(demo.sessions.length > 20 && demo.sessions.every((s) => s.demo === true));
  assert.ok(demo.exercises.every((e) => e.demo === true));
  const dates = demo.sessions.map((s) => s.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.deepEqual(sanitize({ sessions: demo.sessions, exercises: demo.exercises }).sessions.length, demo.sessions.length);
});

// ---- the video header reader, on a tiny hand-built MP4 ----

const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const box = (type: string, ...parts: number[][]): number[] => {
  const body = parts.flat();
  return [...u32(8 + body.length), ...[...type].map((c) => c.charCodeAt(0)), ...body];
};

/** An MP4 with only the boxes the reader needs: a video track with `samples` frames of `delta` ticks at `timescale`. */
function fakeMp4(timescale: number, samples: number, delta: number, handler = 'vide'): File {
  const hdlr = box('hdlr', u32(0), u32(0), [...handler].map((c) => c.charCodeAt(0)), u32(0), u32(0), u32(0), [0]);
  const mdhd = box('mdhd', u32(0), u32(0), u32(0), u32(timescale), u32(samples * delta), u32(0));
  const stts = box('stts', u32(0), u32(1), u32(samples), u32(delta));
  const minf = box('minf', box('stbl', stts));
  const moov = box('moov', box('trak', box('mdia', mdhd, hdlr, minf)));
  const mdat = box('mdat', [1, 2, 3, 4]); // a body before the header, like a real phone file
  return new File([new Uint8Array([...box('ftyp', [...'isom'].map((c) => c.charCodeAt(0)), u32(0)), ...mdat, ...moov])], 'clip.mov');
}

test('readFileFps reads the exact frame rate from the header', async () => {
  assert.equal(Math.round((await readFileFps(fakeMp4(600, 120, 10))) ?? 0), 60);
  assert.equal(Math.round((await readFileFps(fakeMp4(30000, 90, 1001))) ?? 0), 30);
  const odd = (await readFileFps(fakeMp4(600, 1000, 10))) ?? 0;
  assert.ok(Math.abs(odd - 60) < 1e-9);
});

test('readFileFps ignores non-video tracks and files without a header', async () => {
  assert.equal(await readFileFps(fakeMp4(600, 120, 10, 'soun')), null);
  assert.equal(await readFileFps(new File([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8])], 'x.mov')), null);
});

// ---- the live framing check, on hand-made landmarks ----

import { checkFraming } from '../src/framing.ts';

/** A standing person: head at `top`, feet at `bottom`, shoulders `sw` apart (frame width units). */
function person(top: number, bottom: number, sw = 0.25): { x: number; y: number; v: number }[] {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 1 }));
  const span = bottom - top;
  lm[0] = { x: 0.5, y: top, v: 1 };
  lm[11] = { x: 0.5 - sw / 2, y: top + span * 0.2, v: 1 };
  lm[12] = { x: 0.5 + sw / 2, y: top + span * 0.2, v: 1 };
  lm[23] = { x: 0.5 - sw / 4, y: top + span * 0.55, v: 1 };
  lm[24] = { x: 0.5 + sw / 4, y: top + span * 0.55, v: 1 };
  for (const i of [27, 28, 31, 32]) lm[i] = { x: 0.5, y: bottom, v: 1 };
  return lm;
}

test('a well framed person at 45 degrees is ready', () => {
  const f = checkFraming(person(0.2, 0.88), 9 / 16, 120);
  assert.equal(f.ready, true, f.say);
});

test('the check names what is wrong', () => {
  assert.match(checkFraming(person(0.6, 0.9), 9 / 16, 120).say, /closer|zoom/i); // far away
  assert.match(checkFraming(person(0.02, 0.99), 9 / 16, 120).say, /room|back|lower/i); // too big, no headroom
  assert.match(checkFraming(person(0.2, 0.88, 0.4), 9 / 16, 120).say, /turn a little away/i); // facing the camera
  assert.match(checkFraming(person(0.2, 0.88, 0.03), 9 / 16, 120).say, /towards the camera/i); // fully sideways
  assert.match(checkFraming(person(0.2, 0.88), 9 / 16, 20).say, /dark|light/i);
  assert.match(checkFraming(null, 9 / 16).say, /step into/i);
});

test('feet outside the frame is not whole body', () => {
  const lm = person(0.2, 0.88);
  for (const i of [27, 28, 31, 32]) lm[i].y = 1.05;
  assert.equal(checkFraming(lm, 9 / 16, 120).checks.find((c) => c.id === 'frame')!.ok, false);
});

// ---- example links for drills ----

import { drillName, exampleUrl } from '../src/coach.ts';

test('a drill links to a search for its exercise name only', () => {
  assert.equal(drillName('Pogo hops: 3 x 15, stiff ankles'), 'Pogo hops');
  assert.equal(drillName('Depth jump from 20-30 cm: 3 x 4'), 'Depth jump from 20-30 cm');
  const url = exampleUrl('Back squat or trap-bar deadlift: 4 x 4 heavy');
  assert.ok(url.startsWith('https://www.youtube.com/results?search_query='));
  assert.ok(!url.includes('heavy'));
});

// ---- backup reminder ----

import { backupDue } from '../src/store.ts';

test('the backup reminder ignores demo data and waits a month', () => {
  const real = { ...emptyData(), sessions: [{ id: 'a', date: '2026-01-01', kind: 'shot' as const, headline: 1, metrics: [], tips: [] }] };
  const now = Date.parse('2026-06-01T00:00:00Z');
  assert.equal(backupDue(emptyData(), null, now), null);
  assert.equal(backupDue({ ...emptyData(), sessions: demoData().sessions }, null, now), null);
  assert.equal(backupDue(real, null, now), 'never');
  assert.equal(backupDue(real, '2026-05-20T00:00:00Z', now), null);
  assert.equal(backupDue(real, '2026-04-01T00:00:00Z', now), 'old');
});

// ---- key moment snapshots ----

import { buildSnapshots, sanitizeSnaps, KEEP } from '../src/snapshots.ts';

/** One frame of a standing person facing sideways, with an elbow bent to `elbowDeg`. */
function standingFrame(elbowDeg: number): { x: number; y: number }[] {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number): void => void (lm[i] = { x, y });
  set(0, 0.5, 0.2);
  set(12, 0.5, 0.3); set(11, 0.5, 0.3);
  set(24, 0.5, 0.55); set(23, 0.5, 0.55);
  set(26, 0.5, 0.72); set(25, 0.5, 0.72);
  set(28, 0.5, 0.9); set(27, 0.5, 0.9);
  set(32, 0.55, 0.9); set(31, 0.55, 0.9);
  // right arm: the upper arm goes down from the shoulder, the forearm bends up by (180 - elbow)
  set(14, 0.5, 0.42);
  const rad = ((180 - elbowDeg) * Math.PI) / 180;
  set(16, 0.5 + 0.12 * Math.sin(rad), 0.42 - 0.12 * Math.cos(rad) * -1 * -1 + 0.24 - 0.24);
  set(13, 0.5, 0.42); set(15, 0.5, 0.42);
  return lm;
}

test('snapshots keep the key moments with their angles and verdicts', () => {
  const pose = { fps: 60, width: 1000, height: 1000, frames: [standingFrame(90), standingFrame(150)], balls: [null, null], world: [] as never[] };
  const result = {
    kind: 'shot' as const, headline: 70, tips: [], detectionRate: 1,
    metrics: [
      { label: 'Elbow at set point', value: '90 deg', status: 'good' as const, target: '70-100 deg' },
      { label: 'Elbow at release', value: '132 deg', status: 'bad' as const, target: '150+ deg' },
    ],
    marks: [{ name: 'Set point', frame: 0 }, { name: 'Release', frame: 1 }, { name: 'Apex', frame: 1 }],
  };
  const snaps = buildSnapshots(pose, result);
  assert.deepEqual(snaps.map((s) => s.name), ['Set point', 'Release']); // the apex of a shot is not drawn
  const release = snaps[1];
  assert.equal(release.pts.length, KEEP.length);
  assert.equal(release.angles[0].deg, 132); // the metric's own value, so the picture and the number agree
  assert.equal(release.angles[0].status, 'bad');
  assert.equal(release.angles[0].target, '150+ deg');
  assert.equal(sanitizeSnaps(snaps).length, 2);
});

test('broken snapshots are dropped when loading', () => {
  const good = { name: 'Release', ar: 1, pts: Array.from({ length: KEEP.length }, () => [0.5, 0.5]), angles: [] };
  assert.equal(sanitizeSnaps([good, { ...good, pts: [[0, 0]] }, { ...good, name: 5 }, null]).length, 1);
  assert.deepEqual(sanitizeSnaps('nope'), []);
});

test('the turn is required for a shot but only advised for a jump', () => {
  const front = person(0.2, 0.88, 0.4);
  assert.equal(checkFraming(front, 9 / 16, 120, 'required').ready, false);
  const jump = checkFraming(front, 9 / 16, 120, 'advised');
  assert.equal(jump.ready, true);
  assert.match(jump.say, /joint angles/i);
});

// ---- a jump marked by hand ----

import { manualJump } from '../src/analysis.ts';

test('a jump marked by hand gives the height from the flight time', () => {
  const r = manualJump(0.6, 95);
  assert.ok(Math.abs(r.headline - 44.1) < 0.2); // g * t^2 / 8
  assert.equal(r.metrics[1].value, '0.60 s');
  assert.ok(r.metrics.some((m) => m.label === 'Peak power (Sayers)'));
});

// ---- phone tilt in the framing check ----

test('a tipped phone is flagged but does not block recording', () => {
  const ok = checkFraming(person(0.2, 0.88), 9 / 16, 120, 'advised', { pitch: 2, roll: 1 });
  assert.equal(ok.checks.find((c) => c.id === 'level')!.ok, true);
  const tipped = checkFraming(person(0.2, 0.88), 9 / 16, 120, 'advised', { pitch: 20, roll: 1 });
  assert.equal(tipped.ready, true);
  assert.match(tipped.say, /tilted 20 degrees/);
  assert.match(checkFraming(person(0.2, 0.88), 9 / 16, 120, 'advised', { pitch: 1, roll: 12 }).say, /leans 12 degrees/);
});

// ---- scale from two drawn lines ----

import { scaleRatio } from '../src/analysis.ts';

test('the scale ratio is nose-to-ankle over the drawn height', () => {
  // head line at 100 px, sole at 1100 px (1000 px tall), nose at 190 px, ankles at 1060 px: 870 / 1000
  assert.ok(Math.abs(scaleRatio(190, 1060, 100, 1100) - 0.87) < 1e-9);
});
