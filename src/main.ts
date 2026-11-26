import '@fontsource-variable/geist';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import type { Chart } from 'chart.js';
import './style.css';
import { shortDate, trendChart, volumeChart, type Series } from './charts';
import { analyzeJumps, analyzeShots, AVERAGE_NOSE_ANKLE, levelPose, manualJump, reachJump, scaleRatio, type Kind, type Metric, type Result } from './analysis';
import { drillName, exampleUrl, recommend, type Rec } from './coach';
import { guideFor, jumpGuide, type Section } from './guide';
import { createLivePose, extractPose, type Pose } from './pose';
import { demoData } from './demo';
import { exportBackup, importBackup, load, newId, save, sortByDate, today, type Data, type Session, backupDue, lastBackup, markBackup } from './store';
import { probeVideo, type VideoInfo } from './video';
import { openFramingCheck } from './camera';
import { MAX_PITCH, MAX_ROLL, type Tilt } from './framing';
import { installHelp, keepAwake, tick, toast, watchUpdates } from './native';
import { EXERCISES, exercisesFor, GROUP_LABEL, GROUP_NOTE, type Exercise, type Group } from './exercises';
import { clearPhotos, deletePhotos, getPhotoUrl, keepPhotos, savePhotos, setKeepPhotos } from './photos';
import { snapSvg } from './snapview';
import { buildSnapshots, type Snap } from './snapshots';
import { framingPanel, icon, sparkline } from './art';
import { gauge } from './gauge';

const data: Data = load();
const app = document.getElementById('app')!;
type Tab = 'dashboard' | 'analyze' | 'log' | 'settings';
let tab: Tab = 'dashboard';
let charts: Chart[] = [];

const KIND_LABEL: Record<Kind, string> = { standing: 'Standing jump', dunk: 'Dunk approach jump', shot: 'Jump shot' };
const KIND_SHORT: Record<Kind, string> = { standing: 'Jump', dunk: 'Dunk', shot: 'Shot' };
const KIND_ICON: Record<Kind, string> = { standing: 'jump', dunk: 'bolt', shot: 'ball' };
const KIND_DESC: Record<Kind, string> = { standing: 'Jump as high as you can from a stand. Height, power, dip and landing.', dunk: 'A run-up jump. Approach speed and how far your hand clears the rim.', shot: 'Your shooting form. Release, arc, flick and follow-through, per shot.' };
/** Each discipline has its own colour and its own wording, so the pages feel made for what you are doing. */
const THEME: Record<Kind, { title: string; sub: string; film: string; reco: string; noun: string }> = {
  standing: { title: 'Standing jump', sub: 'Your vertical from a stand: height, power, dip and landing.', film: 'Film your jump', reco: 'Record your jump', noun: 'jump' },
  dunk: { title: 'Dunk approach', sub: 'A run-up jump: approach speed and how far your hand clears the rim.', film: 'Film your approach', reco: 'Record your approach', noun: 'approach jump' },
  shot: { title: 'Jump shot', sub: 'Your shooting form: release, arc, flick and follow-through, per shot.', film: 'Film your shot', reco: 'Record your shot', noun: 'shot' },
};
/** The solid colour of each discipline, the same in light and dark: white text sits on it. */
const BAND: Record<Kind, string> = { standing: '#ff5000', dunk: '#6e0ff6', shot: '#1151ff' };
const KIND_COLOR: Record<Kind, string> = { standing: 'var(--jump)', dunk: 'var(--dunk)', shot: 'var(--shot)' };
/**
 * A handful of the card's icon, scattered over its background at random sizes and angles, drifting slowly.
 * The positions come from the card's name, so a card always looks the same and nothing moves when the page redraws.
 */
function scatter(name: string, seed: string, cols: number, rows: number, keep: number, max: number): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = (): number => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9;
    return ((h >>> 0) % 10000) / 10000;
  };
  // the card is a grid of cells, a cell is a grid of four quarters: an icon sits in one quarter, so none overlap and none pile up
  const cells = Array.from({ length: cols * rows }, (_, i) => i).filter((i) => !(rows >= 3 && Math.floor(i / cols) === 1 && i % cols > 0 && i % cols < cols - 1)).sort(() => rnd() - 0.5).slice(0, keep);
  const html = cells
    .map((i) => {
      const x = ((i % cols) + 0.5 + (rnd() < 0.5 ? -0.17 : 0.17)) / cols;
      const y = (Math.floor(i / cols) + 0.5 + (rnd() < 0.5 ? -0.17 : 0.17)) / rows;
      const s = Math.round(max * (0.6 + rnd() * 0.4));
      return `<span class="sc" style="--x:${(x * 100).toFixed(1)}%;--y:${(y * 100).toFixed(1)}%;--s:${s}px;--r:${Math.round(rnd() * 70 - 35)}deg;--o:${(0.08 + rnd() * 0.08).toFixed(2)};--t:${(5 + rnd() * 6).toFixed(1)}s;--w:${(-rnd() * 6).toFixed(1)}s">${icon(name, 24)}</span>`;
    })
    .join('');
  return `<span class="scatter" aria-hidden="true">${html}</span>`;
}
const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const dayKey = (d: Date): string => d.toLocaleDateString('sv-SE'); // local day, same format as the store
const WEEK_TARGET = 4; // training sessions per week that fill the Training meter

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- shell, navigation, motion ----------

const TAB_ICON: Record<Tab, string> = { dashboard: 'dashboard', analyze: 'analyze', log: 'dumbbell', settings: 'dashboard' };
let inked = false;

/** Announcement bar, header and tabs are built once, so they never flicker or move when you switch pages. */
function shell(): void {
  const tabs: [Tab, string][] = [['dashboard', 'Home'], ['analyze', 'Analyze'], ['log', 'Training']];
  app.innerHTML = `<header><div class="wrap"><a class="brand" href="#dashboard" aria-label="Hoop Lab, home">Hoop Lab<b>.</b></a><nav class="tabs" aria-label="Pages"><i class="tab-ink no-anim"></i>${tabs
      .map(([id, label]) => `<button class="tab" data-tab="${id}" aria-label="${label}">${icon(TAB_ICON[id], 22)}<span>${label}</span></button>`)
      .join('')}</nav><div class="head-right"><button class="jobpill" id="jobpill" hidden></button></div></div></header>
    <div id="view"></div>`;
  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => navigate(b.dataset.tab as Tab)));
  app.querySelectorAll<HTMLButtonElement>('#jobpill').forEach((b) => (b.onclick = () => navigate('analyze')));
}

// ---------- routing: every page has an address, so reload, links and the back button work ----------

const TABS: Tab[] = ['dashboard', 'analyze', 'log', 'settings'];
const OLD_TABS: Record<string, Tab> = { jump: 'analyze', filming: 'analyze', guide: 'analyze' }; // addresses from before the pages were merged

function routeFromHash(): { tab: Tab; session?: string } {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('session/')) return { tab: 'dashboard', session: h.slice('session/'.length) };
  return { tab: (TABS as string[]).includes(h) ? (h as Tab) : OLD_TABS[h] ?? 'dashboard' };
}

/** Goes to a page through the address bar, so the browser history records it. */
function navigate(next: Tab): void {
  if (location.hash === `#${next}`) void show(next);
  else location.hash = next;
}

async function route(): Promise<void> {
  // safety: the scroll lock belongs to an open sheet or camera view only, never to a normal page
  if (!document.querySelector('.sheet, .camcheck')) {
    document.documentElement.classList.remove('sheet-open');
    app.inert = false;
  }
  const r = routeFromHash();
  if (r.session) {
    const s = data.sessions.find((x) => x.id === r.session);
    if (!s) return void navigate('dashboard');
    if (tab !== 'dashboard' || !document.getElementById('view')!.childElementCount) await show('dashboard');
    if (!document.querySelector('.sheet')) openSheet(s);
    return;
  }
  closeSheet();
  if (r.tab !== tab || !document.getElementById('view')!.childElementCount) await show(r.tab);
}
window.addEventListener('hashchange', () => void route());

// ---------- the analysis job lives outside the page, so changing tabs never kills it ----------

interface Job {
  running: boolean;
  progress: number; // 0..1
  status: string;
  failed: boolean;
  controller: AbortController | null;
  video: HTMLVideoElement | null;
  pose: Pose | null;
  results: Result[] | null;
  ids: string[] | null; // the saved session of each result, to find its photos
}
const job: Job = { running: false, progress: 0, status: '', failed: false, controller: null, video: null, pose: null, results: null, ids: null };
let paintJob: () => void = () => {};
/** Set by the Analyze page: opens the hand correction with the detected takeoff and landing. */
let onAdjust: ((d: { sid: string; takeoff: number; landing: number; fps: number }) => void) | null = null; // set by the Analyze page while it is on screen

/** Updates everything that shows the job: the Analyze page and the pill in the header. */
function jobChanged(): void {
  const pill = document.getElementById('jobpill');
  if (pill) {
    pill.hidden = !job.running || tab === 'analyze';
    pill.innerHTML = `<span class="pl">Analyzing </span>${(job.progress * 100).toFixed(0)}%`;
    pill.setAttribute('aria-label', `Analyzing, ${(job.progress * 100).toFixed(0)} percent. Open the analysis.`);
  }
  paintJob();
}
window.addEventListener('beforeunload', (e) => {
  if (job.running) e.preventDefault(); // leaving now would throw the tracking away
});

/** On a phone this opens the share sheet (Files, iCloud, Drive, mail), elsewhere it downloads. Resolves false when the user cancelled. */
async function saveFile(name: string, text: string, type: string): Promise<boolean> {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return false; // the user closed the share sheet
      // any other failure: fall through to a normal download
    }
  }
  downloadText(name, text, type);
  return true;
}

function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The underline slides under the active link. */
function moveInk(instant: boolean): void {
  const ink = app.querySelector<HTMLElement>('.tab-ink');
  const active = app.querySelector<HTMLElement>('.tab.active');
  if (!ink || !active) return;
  ink.classList.toggle('no-anim', instant);
  ink.style.width = `${active.offsetWidth}px`;
  ink.style.transform = `translateX(${active.offsetLeft}px)`;
}
window.addEventListener('resize', () => moveInk(true));

let showToken = 0;
const observers: IntersectionObserver[] = [];

/** Runs `fn` once, when the element first scrolls into view (so a chart does not animate off screen). */
function whenVisible(el: Element, fn: () => void): void {
  if (reduceMotion) return fn();
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      io.disconnect();
      fn();
    }
  }, { threshold: 0.2 });
  observers.push(io);
  io.observe(el);
}

/** soft = redraw in place after an edit (no scroll reset, no fade, no entrance animation). */
async function show(next: Tab, soft = false): Promise<void> {
  const token = ++showToken;
  tab = next;
  app.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab);
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  paintJob = () => {}; // the Analyze page sets it again when it renders
  jobChanged();
  moveInk(!inked);
  inked = true;
  const view = document.getElementById('view')!;
  if (!soft && view.childElementCount && !reduceMotion) {
    view.classList.add('leaving'); // the old page fades out first
    await new Promise((resolve) => setTimeout(resolve, 140));
    if (token !== showToken) return; // a newer click took over
  }
  view.classList.remove('themed');
  delete view.dataset.kind;
  document.body.classList.remove('wizard');
  document.querySelector('.wizbtns')?.remove();
  charts.forEach((c) => c.destroy());
  charts = [];
  observers.forEach((o) => o.disconnect());
  observers.length = 0;
  view.classList.remove('leaving');
  view.classList.toggle('still', soft);
  if (!soft) window.scrollTo({ top: 0, behavior: 'instant' });
  ({
    dashboard,
    analyze,
    log,
    settings,
  })[tab](view);
  phoneLayout(view);
  animateIn(view, soft);
}

/**
 * One entrance system. A `.rise` card stays hidden until it scrolls into view, then it rises once,
 * and everything inside it (counters, meters, gauges, sparklines) starts at that moment.
 * Only opacity, transform and the width or position of fixed boxes animate, so nothing in the layout moves.
 */
const phoneQuery = window.matchMedia('(max-width: 700px)');

/** On a phone, lists of cards become swipeable rows with position dots, and long tables show only the latest rows. */
function phoneLayout(root: HTMLElement): void {
  if (!phoneQuery.matches) return;
  root.querySelectorAll<HTMLElement>('.stats, .recs, .cards, .week, .picker, .fpanel, .snaps').forEach((row) => {
    const n = row.children.length;
    if (n < 2 || row.nextElementSibling?.classList.contains('dots')) return;
    const dots = document.createElement('div');
    dots.className = 'dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<i></i>'.repeat(n);
    row.after(dots);
    const paint = (): void => {
      const span = row.scrollWidth - row.clientWidth;
      const at = span > 0 ? Math.round((row.scrollLeft / span) * (n - 1)) : 0;
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === at));
    };
    row.addEventListener('scroll', paint, { passive: true });
    paint();
  });
  root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const rows = [...table.querySelectorAll('tr')].slice(1);
    if (rows.length <= 7 || table.nextElementSibling?.classList.contains('more')) return;
    rows.slice(7).forEach((r) => (r.hidden = true));
    const more = document.createElement('button');
    more.className = 'btn more';
    more.textContent = `Show all ${rows.length}`;
    more.onclick = () => {
      rows.forEach((r) => (r.hidden = false));
      more.remove();
    };
    table.after(more);
  });
}

function animateIn(root: HTMLElement, instant = false): void {
  // reserve the final width of every counter first, so the unit next to it never shifts
  root.querySelectorAll<HTMLElement>('.count').forEach((el) => {
    el.style.display = 'inline-block';
    el.style.minWidth = `${el.offsetWidth}px`;
  });
  const play = (card: HTMLElement, delay: number, now: boolean): void => {
    const mine = (sel: string): HTMLElement[] => [...card.querySelectorAll<HTMLElement>(sel), ...(card.matches(sel) ? [card] : [])].filter((n) => n.closest('.rise') === card);
    const run = (fn: () => void, wait: number): void => void (now ? fn() : setTimeout(fn, wait));
    mine('[data-w]').forEach((n) => run(() => (n.style.width = `${n.dataset.w}%`), delay + 200));
    mine('.mark[data-pos]').forEach((n) => run(() => (n.style.left = `${n.dataset.pos}%`), delay + 200));
    mine('.count').forEach((n) => {
      const to = Number(n.dataset.to);
      const dec = Number(n.dataset.dec ?? 0);
      if (now) return void (n.textContent = to.toFixed(dec));
      n.textContent = (0).toFixed(dec);
      const start = performance.now() + delay + 150;
      const tick = (t: number): void => {
        const p = Math.min(1, Math.max(0, (t - start) / 700));
        n.textContent = (to * (1 - Math.pow(1 - p, 4))).toFixed(dec);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(() => (n.textContent = to.toFixed(dec)), delay + 1000); // always end on the real value, even if frames are paused
    });
  };
  const cards = [...root.querySelectorAll<HTMLElement>('.rise')];
  if (instant || reduceMotion) {
    cards.forEach((c) => {
      c.classList.add('in');
      play(c, 0, true);
    });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    // cards that appear together rise in reading order, 55 ms apart
    const batch = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top || x.boundingClientRect.left - y.boundingClientRect.left);
    batch.forEach((e, i) => open(e.target as HTMLElement, Math.min(i, 6) * 55));
  }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
  const open = (card: HTMLElement, delay: number): void => {
    if (card.classList.contains('in')) return;
    card.style.setProperty('--d', `${delay}ms`);
    card.classList.add('in');
    play(card, delay, false);
    io.unobserve(card);
  };
  observers.push(io);
  cards.forEach((c) => io.observe(c));
  // safety net: whatever is on screen after a second is shown, even if the observer never fired (hidden tab)
  setTimeout(() => cards.forEach((c) => {
    const r = c.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) open(c, 0);
  }), 1000);
}
const count = (v: number, dec = 0): string => `<span class="count" data-to="${v}" data-dec="${dec}">${v.toFixed(dec)}</span>`;

// ---------- shared pieces ----------

function delta(now: number, before: number | undefined, unit: string): string {
  if (before === undefined) return 'first result';
  const d = now - before;
  const cls = d > 0.5 ? 'up' : d < -0.5 ? 'down' : '';
  return `<span class="delta ${cls}">${d > 0 ? '+' : ''}${d.toFixed(0)} ${unit}</span> vs previous`;
}

/** Puts the saved photo under a drawing, when there is one. The drawing is cut to the same area, so the angles land on the body. */
function hydratePhotos(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.snap[data-sid]').forEach((fig) => {
    void getPhotoUrl(fig.dataset.sid!, Number(fig.dataset.i)).then((url) => {
      const svg = fig.querySelector('svg');
      if (!url || !svg || svg.classList.contains('photo')) return;
      const vb = svg.viewBox.baseVal;
      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      img.setAttribute('href', url);
      img.setAttribute('x', String(vb.x));
      img.setAttribute('y', String(vb.y));
      img.setAttribute('width', String(vb.width));
      img.setAttribute('height', String(vb.height));
      img.setAttribute('preserveAspectRatio', 'none');
      svg.prepend(img);
      svg.classList.add('photo');
    });
  });
}

/** The key moments as small drawings with the joint angles. Flagged angles are coloured, so the problem is easy to spot. */
function snapSection(snaps: Snap[], sid?: string): string {
  if (!snaps.length) return '';
  const flagged = (s: Snap): boolean => s.angles.some((a) => a.status === 'bad' || a.status === 'warn');
  const chip = (a: Snap['angles'][number]): string => `<span class="chip ${a.status === 'info' ? '' : a.status}">${esc(a.label)} ${a.deg}&deg;${a.status === 'bad' || a.status === 'warn' ? (a.target ? ` &middot; target ${esc(a.target)}` : '') : ''}</span>`;
  return `<section class="section"><div class="section-head rise"><h2>${snaps.some(flagged) ? 'Where it went wrong' : 'Key moments'}</h2></div>
    <div class="snaps">${snaps.map((s, i) => `<figure ${sid ? `data-sid="${esc(sid)}" data-i="${i}" ` : ''}class="snap rise${s.angles.some((a) => a.status === 'bad') ? ' flag' : flagged(s) ? ' flag warn' : ''}">${snapSvg(s)}<figcaption><b>${esc(s.name)}</b><span class="chips">${s.angles.map(chip).join('')}</span></figcaption></figure>`).join('')}</div></section>`;
}

function recCards(recs: Rec[], meta: (i: number) => string = () => ''): string {
  return `<div class="recs">${recs
    .map((r, i) => `<div class="rec rise">${meta(i) ? `<div class="meta">${meta(i)}</div>` : ''}<h3>${esc(r.title)}</h3><p class="muted small">${esc(r.why)}</p><ul>${r.drills.map((d) => `<li>${esc(d)} <a class="watch" href="${exampleUrl(d)}" target="_blank" rel="noopener noreferrer" aria-label="Watch examples of ${esc(drillName(d))} (opens YouTube)">Watch</a></li>`).join('')}</ul></div>`)
    .join('')}</div>`;
}

/** Splits "65.0 cm" into a big number and a small unit, so the unit never wraps or competes with the number. */
function valueHtml(v: string): string {
  const m = v.match(/^(-?[\d.]+)\s*(.*)$/);
  return m && m[2] ? `${esc(m[1])}<small>${esc(m[2])}</small>` : esc(v);
}

const tile = (m: Metric): string => `<div class="metric ${m.status}"><div class="name">${esc(m.label)}</div><div class="val">${valueHtml(m.value)}</div>${gauge(m.value, m.target, m.status)}${m.target ? `<div class="target">Target ${esc(m.target)}</div>` : ''}</div>`;

const countStatus = (metrics: Metric[], s: string): number => metrics.filter((m) => m.status === s).length;
const statusChips = (metrics: Metric[]): string => `<span class="chip good">${countStatus(metrics, 'good')} on target</span><span class="chip warn">${countStatus(metrics, 'warn')} close</span><span class="chip bad">${countStatus(metrics, 'bad')} to fix</span>`;

/** Reps per week for the last 8 weeks (weeks start on Monday), for the training volume chart. */
function weeksData(): { label: string; value: number }[] {
  const monday = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 8 }, (_, i) => {
    const start = monday(new Date(Date.now() - (7 - i) * 7 * 864e5));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7); // calendar days, so a daylight saving change cannot shift it
    const value = data.exercises.filter((e) => e.date >= dayKey(start) && e.date < dayKey(end)).reduce((a, e) => a + e.sets * e.reps, 0);
    return { label: shortDate(dayKey(start)), value };
  });
}

// ---------- session detail (the deep layer) ----------

let sheetEl: HTMLElement | null = null;
let sheetOpener: Element | null = null;
let sheetKey: ((e: KeyboardEvent) => void) | null = null;

/** Closes the detail sheet with its fade-out. Safe to call when none is open. */
function closeSheet(): void {
  const el = sheetEl;
  if (!el) return;
  sheetEl = null;
  el.classList.remove('open');
  document.documentElement.classList.remove('sheet-open');
  app.inert = false;
  if (sheetKey) window.removeEventListener('keydown', sheetKey);
  if (sheetOpener instanceof HTMLElement) sheetOpener.focus();
  setTimeout(() => el.remove(), 340); // after the fade-out
}

function openSheet(s: Session): void {
  closeSheet();
  const unit = s.kind === 'shot' ? '/ 100' : 'cm';
  const recs = recommend(s.metrics);
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<div class="sheet-card" role="dialog" aria-modal="true" aria-label="${KIND_LABEL[s.kind]} details" style="--c:${KIND_COLOR[s.kind]};--band:${BAND[s.kind]}">
    <div class="sheet-head">${scatter(KIND_ICON[s.kind], s.id, 6, 2, 5, 34)}
      <div class="row between"><div class="kicker"><i></i>${KIND_LABEL[s.kind]}, ${shortDate(s.date)}${s.demo ? ' (demo data)' : ''}</div><div class="row"><button class="btn small" data-delete>Delete</button><button class="btn small" data-close>Close</button></div></div>
      <div class="row" style="gap:20px;margin-top:12px"><div class="numeral md">${count(s.headline)}<small>${unit}</small></div><div class="chips">${statusChips(s.metrics)}</div></div>
    </div>
    <div class="sheet-body">
      <div class="section-head"><h2>What to work on</h2></div>
      ${recs.length ? recCards(recs) : '<p class="muted">Nothing flagged in this session.</p>'}
      <div class="section-head" style="margin-top:32px"><h2>Numbers</h2></div>
      <div class="metrics rise">${s.metrics.map(tile).join('')}</div>
      ${snapSection(s.snaps ?? [], s.id)}
    </div>
  </div>`;
  sheetEl = el;
  sheetOpener = document.activeElement;
  const dismiss = (): void => {
    if (location.hash.startsWith('#session/')) history.replaceState(null, '', `${location.pathname}${location.search}#${tab}`);
    closeSheet();
  };
  sheetKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') dismiss();
  };
  el.onclick = (e) => {
    const target = e.target as HTMLElement;
    if (target === el || target.closest('[data-close]')) return dismiss();
    if (target.closest('[data-delete]') && confirm('Delete this session? This cannot be undone.')) {
      data.sessions = data.sessions.filter((x) => x.id !== s.id);
      void deletePhotos(s.id);
      save(data);
      dismiss();
      void show(tab, true);
    }
  };
  window.addEventListener('keydown', sheetKey);
  document.documentElement.classList.add('sheet-open');
  document.body.appendChild(el);
  app.inert = true; // the page behind cannot take focus while the sheet is open
  phoneLayout(el);
  hydratePhotos(el);
  animateIn(el);
  setTimeout(() => el.classList.add('open'), 30); // after the first paint, so the transition runs
  el.querySelector<HTMLElement>('[data-close]')?.focus();
}
// ---------- dashboard ----------

/** The shape of a chart before there is data: a grid, a faint rising line and one sentence. */
function ghostChart(text: string): string {
  return `<div class="ghostchart"><svg viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1" opacity="0.5">${[20, 55, 90, 125].map((y) => `<line x1="0" x2="320" y1="${y}" y2="${y}"/>`).join('')}</g><polyline points="10,120 60,105 110,112 160,80 210,70 260,45 310,30" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/></svg><p class="muted">${text}</p></div>`;
}

/** Grey placeholder cards for what a full page would show. */
function ghostCards(n: number): string {
  return `<div class="ghosts">${Array.from({ length: n }, () => '<div class="ghost"><i></i><i></i><i></i></div>').join('')}</div><p class="muted small ghostnote">Your first test shows what to work on.</p>`;
}

function ghostRows(n: number): string {
  return `<div class="ghostrows">${Array.from({ length: n }, () => '<div class="ghostrow"><i></i><i></i></div>').join('')}</div>`;
}

function focusAreas(): string {
  const counts = new Map<string, { rec: Rec; n: number; of: number }>();
  for (const kind of ['standing', 'dunk', 'shot'] as Kind[]) {
    const recent = data.sessions.filter((s) => s.kind === kind).slice(-5);
    for (const s of recent) {
      for (const r of recommend(s.metrics)) {
        const e = counts.get(r.title) ?? { rec: r, n: 0, of: recent.length };
        e.n++;
        counts.set(r.title, e);
      }
    }
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 3);
  if (!top.length) return '<p class="muted">Nothing to fix right now. Analyze more videos to see what to work on.</p>';
  return recCards(top.map((t) => t.rec), (i) => `Flagged in ${top[i].n} of your last ${top[i].of}`);
}

let trendSel: 'standing' | 'dunk' | 'shot' | 'vol' = 'standing';

function dashboard(view: HTMLElement): void {
  const due = backupDue(data, lastBackup());
  const of = (k: Kind): Session[] => data.sessions.filter((s) => s.kind === k);
  const standing = of('standing');
  const best = standing.length ? Math.max(...standing.map((s) => s.headline)) : null;
  const last = standing[standing.length - 1];
  const prev = standing[standing.length - 2];
  const shots = of('shot').slice(-5);
  const goal = data.goalCm;
  const weekAgo = dayKey(new Date(Date.now() - 7 * 864e5));
  const workouts = data.exercises.filter((e) => e.date >= weekAgo).length;
  const isPb = last !== undefined && standing.length > 1 && last.headline > Math.max(...standing.slice(0, -1).map((s) => s.headline));
  const jumpPct = best === null ? 0 : goal ? Math.min(100, (best / goal) * 100) : last ? (last.headline / best) * 100 : 0;
  const shotAvg = shots.length ? avg(shots.map((s) => s.headline)) : 0;
  const isDemo = data.sessions.some((s) => s.demo) || data.exercises.some((e) => e.demo);
  const active = new Set([...data.sessions.map((s) => s.date), ...data.exercises.map((e) => e.date)]);
  const dots = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 864e5))
    .map((d, i) => `<span class="${active.has(dayKey(d)) ? 'on' : ''} ${i === 6 ? 'today' : ''}" style="--k:${i}">${d.toLocaleDateString('en', { weekday: 'narrow' })}</span>`)
    .join('');

  view.innerHTML = `
    <section class="band home"><div class="wrap">
      <button class="wtop" data-go="settings" type="button" aria-label="Settings${due ? ', back up your data' : ''}" style="left:auto;right:16px">${icon('gear', 22)}${due ? '<i class="wdot"></i>' : ''}</button>
      <div class="hero-row rise"><div class="stack" style="gap:16px"><h1 class="display">Your numbers</h1></div></div>
      <div class="testrow rise"><button class="btn small" data-test="standing" type="button">Test jump</button><button class="btn small" data-test="dunk" type="button">Test dunk</button><button class="btn small" data-test="shot" type="button">Test shot</button></div>
      <div class="kpis">
        <div class="stat rise" style="--c:var(--jump)">
          <div class="kicker"><i></i>Jump</div>
          <div class="numeral">${best === null ? '-' : count(best)}${best === null ? '' : '<small>cm</small>'}</div>
          <div class="meter"><div data-w="${jumpPct}"></div></div>
          <p class="sub">${last ? `Latest ${last.headline.toFixed(0)} cm, ${delta(last.headline, prev?.headline, 'cm')}` : 'No jumps yet'}${goal && best !== null ? `<br>${jumpPct.toFixed(0)}% of your ${goal} cm goal` : ''}</p>
          ${isPb ? `<span class="pb">${icon('trophy')} New personal best</span>` : sparkline(standing.slice(-12).map((s) => s.headline))}
        </div>
        <div class="stat shot rise">
          <div class="kicker"><i></i>Shot</div>
          <div class="numeral">${shots.length ? count(shotAvg) : '-'}${shots.length ? '<small>/100</small>' : ''}</div>
          <div class="meter"><div data-w="${shotAvg}"></div></div>
          <p class="sub">${shots.length ? `Average of your last ${shots.length} shots` : 'No shots yet'}</p>
          ${sparkline(of('shot').slice(-12).map((s) => s.headline))}
        </div>
        <div class="stat train rise">
          <div class="kicker"><i></i>Training</div>
          <div class="numeral">${count(workouts)}<small>/${WEEK_TARGET} this week</small></div>
          <div class="meter"><div data-w="${Math.min(100, (workouts / WEEK_TARGET) * 100)}"></div></div>
          <p class="sub">Sessions logged in the last 7 days</p>
          <div class="week-dots">${dots}</div>
        </div>
      </div>
    </div></section>

    <div class="wrap">
      ${isDemo ? `<div class="demo-bar rise"><span class="chip">Demo data</span><span class="muted small">These numbers are made up. Analyze a video to see your own.</span><button class="btn small" id="clearDemo">Clear demo data</button></div>` : ''}

      <section class="section">
        <div class="section-head rise"><h2>Trend</h2>
          <div class="pills" id="trendseg">${(['standing', 'dunk', 'shot', 'vol'] as const).map((k) => `<button class="pill ${k === trendSel ? 'on' : ''}" data-t="${k}" aria-pressed="${k === trendSel}">${k === 'vol' ? 'Training' : KIND_SHORT[k]}</button>`).join('')}</div></div>
        <div class="trend rise" id="trendcard"><div class="row between"><div class="kicker"><i></i><span id="trendname"></span></div><span class="muted small" id="trendnote"></span></div><div class="chartbox" id="chartbox"><canvas id="c1"></canvas></div></div>
      </section>

      <section class="section"><div class="section-head rise"><h2>Work on this</h2></div>${data.sessions.length ? focusAreas() : ghostCards(3)}</section>

      <section class="section"><div class="section-head rise"><h2>Recent sessions</h2></div>
        ${data.sessions.length ? `<div class="sessions">${data.sessions.slice(-6).reverse().map((s) => `<button class="srow ${s.kind} rise" data-sid="${s.id}"><span class="big">${s.headline.toFixed(0)}<small>${s.kind === 'shot' ? '/100' : 'cm'}</small></span><span class="what"><b>${KIND_LABEL[s.kind]}</b><span>${shortDate(s.date)}</span></span><span class="chips">${statusChips(s.metrics)}</span><span class="go">&rsaquo;</span></button>`).join('')}</div>` : ghostRows(3)}
      </section>

      ${data.sessions.length ? '' : '<section class="section"><div class="empty rise"><p class="muted">Want to look around first?</p><button class="btn" id="loadDemo" type="button">Try with demo data</button></div></section>'}
    </div>
`;
  view.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => (b.onclick = () => {
    setKind(b.dataset.test as Kind);
    wizardStart = 1;
    navigate('analyze');
  }));
  view.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => (b.onclick = () => navigate(b.dataset.go as Tab)));
  view.querySelectorAll<HTMLButtonElement>('[data-sid]').forEach((b) => (b.onclick = () => (location.hash = `session/${b.dataset.sid}`)));
  view.querySelector<HTMLButtonElement>('#loadDemo')?.addEventListener('click', () => {
    const demo = demoData();
    data.sessions.push(...demo.sessions);
    data.exercises.push(...demo.exercises);
    sortByDate(data);
    save(data);
    void show('dashboard');
  });
  view.querySelector<HTMLButtonElement>('#clearDemo')?.addEventListener('click', () => {
    data.sessions = data.sessions.filter((s) => !s.demo);
    data.exercises = data.exercises.filter((e) => !e.demo);
    save(data);
    void show('dashboard');
  });
  // one big chart with a switch: the middle layer, shown only when asked for
  const draw = (sel: typeof trendSel): void => {
    trendSel = sel;
    charts.forEach((c) => c.destroy());
    charts = [];
    const card = view.querySelector<HTMLElement>('#trendcard')!;
    card.style.setProperty('--c', sel === 'vol' ? 'var(--train)' : KIND_COLOR[sel]);
    view.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => {
      b.classList.toggle('on', b.dataset.t === sel);
      b.setAttribute('aria-pressed', String(b.dataset.t === sel));
    });
    const box = view.querySelector<HTMLElement>('#chartbox')!;
    box.innerHTML = '<canvas id="c1"></canvas>';
    view.querySelector<HTMLElement>('#trendname')!.textContent = sel === 'vol' ? 'Weekly training volume' : sel === 'shot' ? 'Shot score' : `${KIND_LABEL[sel]} height`;
    view.querySelector<HTMLElement>('#trendnote')!.textContent = sel === 'vol' ? 'reps per week' : sel === 'standing' && goal ? `goal ${goal} cm` : '';
    const canvas = box.querySelector<HTMLCanvasElement>('canvas')!;
    if (sel === 'vol') {
      if (data.exercises.length) whenVisible(canvas, () => charts.push(volumeChart(canvas, weeksData())));
      else box.innerHTML = ghostChart('Log an exercise to see your weekly volume');
      return;
    }
    const hex = css(sel === 'standing' ? '--jump' : sel === 'dunk' ? '--dunk' : '--shot');
    const series: Series[] = [{ label: KIND_SHORT[sel], kind: sel, color: hex }];
    const mine = data.sessions.filter((s) => s.kind === sel);
    if (mine.length === 1) {
      box.innerHTML = `<div class="empty"><div class="numeral md">${mine[0].headline.toFixed(0)}<small>${sel === 'shot' ? '/100' : 'cm'}</small></div><p class="muted">Your first result. The trend starts with the second one.</p></div>`;
      return;
    }
    if (mine.length) whenVisible(canvas, () => charts.push(trendChart(canvas, data.sessions, series, sel === 'shot' ? '' : 'cm', sel === 'standing' ? goal : 0)));
    else box.innerHTML = ghostChart('Your first test starts the trend');
  };
  view.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => (b.onclick = () => draw(b.dataset.t as typeof trendSel)));
  draw(trendSel);
}

// ---------- settings ----------

const BACK_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

function settings(view: HTMLElement): void {
  const due = backupDue(data, lastBackup());
  const goal = data.goalCm || 0;
  view.innerHTML = `
    <section class="band home"><div class="wrap"><button class="wtop" id="wTop" type="button" aria-label="Back">${BACK_ICON}</button><div class="stack rise" style="gap:16px"><h1 class="display">Settings</h1></div></div></section>
    <div class="wrap">
      <section class="section"><div class="section-head rise"><h2>About you</h2></div>
        <div class="tile stack rise"><div class="two"><label class="field">Height (cm)<input id="pHeight" type="number" min="120" max="240" value="${data.heightCm || ''}" placeholder="Height"></label><label class="field">Weight (kg)<input id="pWeight" type="number" min="30" max="200" value="${data.weightKg || ''}" placeholder="Weight"></label></div>
          <p class="muted small">These are the starting values when you analyze a video. They stay on this device.</p><button class="btn primary" id="pSave" type="button">Save</button></div></section>
      <section class="section"><div class="section-head rise"><h2>Jump goal</h2></div>
        <div class="tile row between rise"><p class="muted">Set a target for your standing jump. The Jump meter fills towards it.</p><div class="row"><div style="width:140px"><input id="goal" type="number" min="10" max="200" placeholder="Goal in cm" value="${goal || ''}" aria-label="Jump goal in centimetres"></div><button class="btn primary" id="setGoal">${goal ? 'Update goal' : 'Set goal'}</button></div></div>
      </section>

      ${installSection()}
      <section class="section" style="padding-bottom:80px"><div class="section-head rise"><h2>Your data</h2></div>
        ${due ? `<div class="demo-bar rise" role="status"><span class="chip warn">Back up</span><span class="muted small">${due === 'never' ? 'Your results only live on this device. Export a backup so you do not lose them.' : 'Your last backup is more than a month old. Export a new one.'}</span><button class="btn small" id="remindExport">Export backup</button></div>` : ''}
        <div class="tile row between rise"><p class="muted">Everything is stored in this browser only, and videos are never kept. Export a backup to move it to another device or keep it safe.<br><span class="small" id="storeNote">${lastBackup() ? `Last backup: ${shortDate(lastBackup()!.slice(0, 10))}.` : 'No backup yet.'}</span></p>
          <div class="row"><button class="btn" id="exportData">Export backup</button><button class="btn" id="importData">Import backup</button><button class="btn" id="wipeData">Delete all</button><input type="file" id="importFile" accept="application/json,.json" hidden></div></div>
        <p class="small error" id="dataNote" role="status" style="min-height:1.5em;margin-top:10px"></p>
      </section>

      <p class="muted small" style="text-align:center;padding:8px 0 24px">Version ${__BUILD__}</p>
    </div>`;
  view.querySelector<HTMLButtonElement>('#wTop')!.onclick = () => navigate('dashboard');
  view.querySelector<HTMLButtonElement>('#pSave')!.onclick = () => {
    const h = Number(view.querySelector<HTMLInputElement>('#pHeight')!.value);
    const w = Number(view.querySelector<HTMLInputElement>('#pWeight')!.value);
    if ((h && (h < 120 || h > 240)) || (w && (w < 30 || w > 200))) return toast('Check the numbers: height 120-240 cm, weight 30-200 kg');
    data.heightCm = h || 0;
    data.weightKg = w || 0;
    save(data);
    toast('Saved');
  };
  const installBtn = view.querySelector<HTMLButtonElement>('#installBtn');
  if (installBtn) installBtn.onclick = () => installHelp()?.action?.();
  view.querySelector<HTMLButtonElement>('#setGoal')!.onclick = () => {
    data.goalCm = Number(view.querySelector<HTMLInputElement>('#goal')!.value) || 0;
    save(data);
    void show('settings', true);
  };

  // demo data, backup and wipe
  const note = (text: string, ok = false): void => {
    const el = view.querySelector<HTMLElement>('#dataNote')!;
    el.textContent = text;
    el.classList.toggle('error', !ok);
  };
  const exportNow = async (): Promise<void> => {
    if (!data.sessions.length && !data.exercises.length) return note('Nothing to export yet.');
    if (!(await saveFile(`hoop-lab-backup-${today()}.json`, exportBackup(data), 'application/json'))) return;
    markBackup();
    note('Backup saved. Keep the file somewhere safe, for example in Files or your cloud drive.', true);
    view.querySelector('#storeNote')!.textContent = `Last backup: ${shortDate(today())}.`;
  };
  view.querySelector<HTMLButtonElement>('#exportData')!.onclick = () => void exportNow();
  view.querySelector<HTMLButtonElement>('#remindExport')?.addEventListener('click', () => void exportNow());
  // tells whether the browser promised not to clear this data when storage runs low
  void navigator.storage?.persisted?.().then((p) => {
    const el = view.querySelector('#storeNote');
    if (el) el.textContent += p ? ' Protected from automatic clearing.' : ' Not protected from automatic clearing: install the app to the home screen and keep a backup.';
  });
  const importFile = view.querySelector<HTMLInputElement>('#importFile')!;
  view.querySelector<HTMLButtonElement>('#importData')!.onclick = () => importFile.click();
  importFile.onchange = async () => {
    const f = importFile.files?.[0];
    if (!f) return;
    const res = importBackup(await f.text(), data);
    if (typeof res === 'string') return note(res);
    if (!save(data)) return note('Imported, but the browser could not store it (storage full or blocked).');
    void show('settings', true);
  };
  view.querySelector<HTMLButtonElement>('#wipeData')!.onclick = () => {
    if (!confirm('Delete all sessions, exercises, your goal and your height and weight from this browser? Export a backup first if you want to keep them.')) return;
    data.sessions = [];
    void clearPhotos();
    data.exercises = [];
    data.goalCm = 0;
    data.heightCm = 0;
    data.weightKg = 0;
    save(data);
    void show('settings');
  };


}

// ---------- analyze ----------

/** The test you did last is the one you probably do next, so it is remembered. */
const KIND_KEY = 'hooplab.kind';
function loadKind(): Kind {
  try {
    const v = localStorage.getItem(KIND_KEY);
    return v === 'dunk' || v === 'shot' ? v : 'standing';
  } catch {
    return 'standing';
  }
}
function setKind(k: Kind): void {
  selKind = k;
  try {
    localStorage.setItem(KIND_KEY, k);
  } catch {
    // it just is not remembered
  }
}
let selKind: Kind = loadKind();
const STEPS = ['Test', 'Film', 'Details', 'Result'];
/** Set by Home: a new test always begins at the first step. */
let wizardStart: number | null = null;
let chosen: { file: File; video: HTMLVideoElement; info: VideoInfo; tilt?: Tilt } | null = null;

/** A clip recorded in the framing view: it waits here until the Analyze page can take it. */
let incoming: { file: File; fps?: number; tilt?: Tilt } | null = null;
let acceptClip: ((file: File, fps?: number, tilt?: Tilt) => void) | null = null;
function recorded(file: File, fps?: number, tilt?: Tilt): void {
  if (tab === 'analyze' && acceptClip) return acceptClip(file, fps, tilt);
  incoming = { file, fps, tilt };
  navigate('analyze');
}

/** Rough tracking time in seconds: the shot also runs ball detection, which is slower. */
const estimateSeconds = (info: VideoInfo, kind: Kind): number => info.duration * info.sampleFps * (kind === 'shot' ? 0.22 : 0.09);

function fpsNote(info: VideoInfo, kind: Kind): string {
  if (info.fps >= 50) return `<span class="chip good">${info.fps.toFixed(0)} fps, good</span>`;
  if (kind === 'shot') return `<span class="chip warn">${info.fps.toFixed(0)} fps: shot timing is coarse (${(1000 / info.fps).toFixed(0)} ms per frame). Film at 60 fps or more.</span>`;
  return `<span class="chip warn">${info.fps.toFixed(0)} fps: jump height is fine, takeoff and landing are less exact. 60 fps is better.</span>`;
}

/** A chip with the phone tilt measured while recording, red when it is enough to distort the scale. */
function tiltNote(t?: Tilt): string {
  if (!t) return '';
  const bad = Math.abs(t.pitch) > MAX_PITCH || Math.abs(t.roll) > MAX_ROLL;
  return `<span class="chip ${bad ? 'warn' : 'good'}">${bad ? `phone tilted ${Math.abs(t.pitch).toFixed(0)} up/down, ${Math.abs(t.roll).toFixed(0)} sideways` : 'phone upright'}</span>`;
}

/** Colours the whole page for the chosen discipline: the band, the main buttons, the dots and the guide. */
function theme(view: HTMLElement): void {
  view.classList.add('themed');
  view.dataset.kind = selKind;
}

function analyze(view: HTMLElement): void {
  theme(view);
  view.innerHTML = `
    <section class="band"><div class="wrap"><button class="wtop" id="wTop" type="button" aria-label="Back">${BACK_ICON}</button><div class="stack rise" style="gap:16px"><h1 class="display" id="ptitle"></h1><p class="sub" id="psub" style="max-width:520px"></p></div>
      <div class="wsteps" id="steps">${STEPS.map((s, i) => `<button type="button" class="wstep" data-step-go="${i + 1}"><b></b><span>${s}</span></button>`).join('')}</div></div></section>
    <div class="wrap">
      <section class="section" data-step="1"><div class="section-head rise"><h2>What are you testing?</h2></div>
        <div class="picker kinds rise" id="kinds">${(['standing', 'dunk', 'shot'] as Kind[]).map((k) => `<button class="pick ${k} ${k === selKind ? 'on' : ''}" data-k="${k}" aria-pressed="${k === selKind}">${scatter(KIND_ICON[k], k, 4, 3, 7, 40)}<span><span class="name">${KIND_LABEL[k]}</span><p>${KIND_DESC[k]}</p></span></button>`).join('')}</div></section>

      <section class="section" data-step="2"><div class="section-head rise"><h2 id="h2add">Film your jump</h2></div>
        <div class="col rise">
          <button class="btn primary big" data-cam id="recBtn">Record with the camera</button>
          <button class="btn big" id="drop" type="button">${chosen ? 'Choose another video' : 'Choose a video'}</button>
          <p class="muted small">Or pick a clip from your camera roll or your files.</p>
          <input id="file" type="file" accept="video/*,.mp4,.mov,.m4v,.webm" hidden>
          <div id="info" class="chips"></div>
        </div></section>

      <div class="guide-grid" data-step="2" id="kindguide"></div>

      <section class="section" data-step="3"><div class="section-head rise"><h2>Your details</h2></div>
        <div class="col rise">
          <div id="form" class="stack"><div class="two">
            <label class="field" id="heightField">Height (cm)<input id="height" type="number" min="120" max="240" value="${data.heightCm || ''}" placeholder="193"></label>
            <label class="field" id="weightField">Weight (kg)<input id="weight" type="number" min="30" max="200" value="${data.weightKg || ''}" placeholder="95"></label>
          </div>
          <p class="muted small" id="bodyNote"></p>
          <p class="muted small" id="scaleNote"></p>
          <label class="check"><input type="checkbox" id="keepPhotos"${keepPhotos() ? ' checked' : ''}><span>Keep a photo of each key moment<small class="muted">Stored on this device only, about 25 KB each, not in backups.</small></span></label></div>
          <button id="run" class="btn primary big">Analyze</button>
          <div class="busy" id="busy" hidden><div class="numeral md" id="pct">0<small>%</small></div><div class="stack" style="flex:1;min-width:0"><div class="meter"><div id="pbar" style="width:0"></div></div><p id="status" class="muted" role="status">Choose a video to begin.</p><div class="row"><button class="btn small" id="cancel" hidden>Cancel</button></div></div></div>
          <details class="more" id="tools" hidden><summary>More ways to measure</summary>
            <div class="stack">
              <button class="btn small" id="calBtn" type="button" hidden>Set my scale from the video</button>
              <button class="btn small" id="manualBtn" type="button" hidden>Measure by hand</button>
              <button class="btn small" id="reachBtn" type="button" hidden>Measure reach</button>
            </div>
          </details>
        </div></section>

      <section class="section" data-step="3" id="calib" hidden><div class="section-head rise"><h2>Set your scale</h2></div>
        <div class="tile stack rise">
          <p class="muted">Pick a frame where you stand tall and still. Drag the top line to the top of your head and the bottom line to the soles of your feet. That distance is your height, so the app knows how big a pixel is.</p>
          <div class="calbox" id="calbox"><div class="calline" data-l="top" style="top:15%"><i></i><span>Top of head</span></div><div class="calline" data-l="bottom" style="top:88%"><i></i><span>Soles</span></div></div>
          <input id="calscrub" type="range" min="0" max="1000" value="0" aria-label="Moment in the clip">
          <div class="row"><button class="btn" id="calReset" type="button">Back to average</button><button class="btn primary" id="calSave" type="button">Use these lines</button></div>
          <p class="muted" id="calOut" role="status"></p>
        </div></section>

      <section class="section" data-step="3" id="reach" hidden><div class="section-head rise"><h2>Measure reach</h2></div>
        <div class="tile stack rise">
          <p class="muted">The classic reach test. Stand at a wall or backboard with the phone on a tripod and do not move it. The wall and you must be at the same distance from the camera.</p>
          <ol class="howto"><li>Pick a frame where you stand tall at the wall, arm up. Put the lines on your head, soles and fingertip, then tap step 1.</li><li>Pick the frame where your fingertip is highest in the jump. Move only the fingertip line, then tap step 2.</li></ol>
          <div class="calbox" id="rbox"><div class="calline" data-l="head" style="top:12%"><i></i><span>Top of head</span></div><div class="calline" data-l="sole" style="top:88%"><i></i><span>Soles</span></div><div class="calline" data-l="finger" style="top:3%"><i></i><span>Fingertip</span></div></div>
          <input id="rscrub" type="range" min="0" max="1000" value="0" aria-label="Moment in the clip">
          <div class="row"><button class="btn" id="rStand" type="button">1. Standing reach</button><button class="btn" id="rTouch" type="button">2. Jump touch</button></div>
          <p class="muted" id="rOut" role="status">Start with step 1.</p>
          <button class="btn primary big" id="rSave" type="button" disabled>Save this jump</button>
        </div></section>

      <section class="section" data-step="3" id="manual" hidden><div class="section-head rise"><h2>Measure by hand</h2></div>
        <div class="tile stack rise">
          <p class="muted">This works from any angle and distance, even when the tracker cannot follow you. Step to the first frame your feet are in the air and mark it, then to the first frame they touch the floor again.</p>
          <div id="mvbox"></div>
          <input id="mscrub" type="range" min="0" max="0" value="0" aria-label="Frame">
          <div class="row"><button class="btn" id="mPrev" type="button">Back a frame</button><span class="muted small" id="mFrame"></span><button class="btn" id="mNext" type="button">Forward a frame</button></div>
          <div class="row"><button class="btn" id="mTake" type="button">Mark: in the air</button><button class="btn" id="mLand" type="button">Mark: back on the floor</button></div>
          <p class="muted" id="mOut" role="status"></p>
          <button class="btn primary big" id="mSave" type="button" disabled>Save this jump</button>
        </div></section>

      <div id="out" data-step="4" class="scroll-target"></div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => (view.querySelector<T>('#' + id) ?? document.getElementById(id)) as T;
  // the test buttons live inside the tab bar itself, so they sit exactly where the tabs sit
  document.querySelector('.wizbtns')?.remove();
  const wiz = document.createElement('div');
  wiz.className = 'wizbtns';
  wiz.innerHTML = '<button class="btn big" id="wB" type="button"></button><button class="btn primary big" id="wA" type="button"></button>';
  // pinned to the bottom edge of the screen, the way the tab bar is
  document.body.append(wiz);
  $<HTMLInputElement>('keepPhotos').onchange = (e) => setKeepPhotos((e.target as HTMLInputElement).checked);
  const statusEl = $('status');
  let shown: Result[] | null = null;

  // the four steps: one screen each, one clear button
  let step = wizardStart ?? (job.running ? 3 : job.results ? 4 : chosen ? 3 : 1);
  if (wizardStart !== null) shown = job.results; // a new test starts clean: the old result is not shown again
  wizardStart = null;
  const centreKind = (): void => {
    const kinds = $('kinds');
    const on = kinds.querySelector<HTMLElement>('.on');
    if (phoneQuery.matches && on) kinds.scrollLeft = on.offsetLeft + on.offsetWidth / 2 - kinds.clientWidth / 2;
  };
  /** The two floating buttons change with the step: the main action on the right, the other way on the left. */
  const paintBar = (): void => {
    wiz.style.setProperty('--disc', BAND[selKind]);
    const A = $<HTMLButtonElement>('wA');
    const B = $<HTMLButtonElement>('wB');
    const set = (btn: HTMLButtonElement, label: string, fn: () => void, disabled = false): void => {
      btn.hidden = !label;
      btn.textContent = label;
      btn.disabled = disabled;
      btn.onclick = fn;
    };
    if (step === 1) {
      set(A, 'Film it', () => goStep(2));
      set(B, '', () => undefined);
    } else if (step === 2) {
      if (chosen) {
        set(A, 'Continue', () => goStep(3));
        set(B, 'Choose another', () => $('drop').click());
      } else {
        set(A, 'Record', () => $('recBtn').click());
        set(B, 'Choose video', () => $('drop').click());
      }
    } else if (step === 3) {
      set(A, job.running ? 'Analyzing...' : 'Analyze', () => $('run').click(), job.running);
      set(B, job.running ? 'Cancel' : '', () => $('cancel').click());
    } else {
      set(A, 'New test', () => goStep(1));
      set(B, 'Done', () => navigate('dashboard'));
    }
  };
  const goStep = (n: number, scroll = true): void => {
    step = n;
    document.body.classList.add('wizard');
    view.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => el.classList.toggle('offstep', Number(el.dataset.step) !== n));
    view.querySelectorAll<HTMLButtonElement>('[data-step-go]').forEach((b) => {
      const i = Number(b.dataset.stepGo);
      b.className = 'wstep ' + (i === n ? 'on' : i < n ? 'done' : '');
      b.disabled = i >= n || n === 4;
    });
    const head = [['What are you testing?', 'Swipe to choose.'], [THEME[selKind].film, THEME[selKind].sub], ['Your details', ''], ['Your result', '']][n - 1];
    $('ptitle').textContent = head[0];
    $('psub').textContent = head[1];
    $('psub').hidden = !head[1];
    paintBar();
    if (n === 1) requestAnimationFrame(centreKind);
    if (scroll) window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  $('wTop').onclick = () => (step === 1 || step === 4 ? navigate('dashboard') : goStep(step - 1));
  view.querySelectorAll<HTMLButtonElement>('[data-step-go]').forEach((b) => (b.onclick = () => goStep(Number(b.dataset.stepGo))));

  /** Draws the job on this page. Registered as paintJob, so it keeps up while you are on another tab and catches up when you come back. */
  const paint = (): void => {
    const pct = job.progress * 100;
    $('pbar').style.width = `${pct.toFixed(0)}%`;
    $('pct').innerHTML = `${pct.toFixed(0)}<small>%</small>`;
    statusEl.className = job.failed ? 'error' : 'muted';
    if (job.status) statusEl.textContent = job.status;
    const run = $<HTMLButtonElement>('run');
    run.disabled = job.running;
    run.textContent = job.running ? 'Analyzing...' : 'Analyze';
    $('cancel').hidden = !job.running;
    $('form').hidden = job.running;
    paintBar();
    $('manualBtn').hidden = selKind === 'shot' || !chosen || job.running;
    $('busy').hidden = !chosen && !job.running && !job.failed;
    $('tools').hidden = !chosen || job.running;
    $('calBtn').hidden = !chosen || job.running;
    $('reachBtn').hidden = selKind === 'shot' || !chosen || job.running;
    if (job.results && job.video && job.pose && job.results !== shown && !job.running) {
      shown = job.results;
      goStep(4);
      renderResults($('out'), job.video, job.pose, job.results, job.ids ?? []);
    }
  };
  paintJob = paint;
  goStep(step, false);
  paint();

  /** The guide of the chosen test, right under the swipe row. */
  const renderGuide = (): void => {
    const t = THEME[selKind];
    const shot = selKind === 'shot';
    theme(view);
    goStep(step, false);
    $('recBtn').textContent = t.reco;
    $('weightField').hidden = shot;
    $('heightField').childNodes[0].textContent = shot ? 'Height (cm, optional)' : 'Height (cm)';
    $('bodyNote').textContent = shot ? 'Height only makes the distances in centimetres exact. Leave it empty and they are estimates.' : 'They set the scale and the power estimate, so use your real values.';
    $('reachBtn').hidden = shot || !chosen || job.running;
    $('manualBtn').hidden = shot || !chosen || job.running;
    const host = $('kindguide');
    host.innerHTML = guideHtml(guideFor(selKind), false, false) + `<details class="tile guide"${phoneQuery.matches ? '' : ' open'}><summary><h2>What the camera should see</h2></summary>${framingPanel()}<div style="margin-top:16px"><button class="btn" data-cam>Check my framing with the camera</button></div></details>`;
    settleGuide(host);
    phoneLayout(host);
  };

  const renderInfo = (): void => {
    renderGuide();
    if (!chosen) return;
    const i = chosen.info;
    const mins = Math.max(1, Math.round(estimateSeconds(i, selKind) / 60));
    $('info').innerHTML = `<span class="chip">${KIND_LABEL[selKind]}</span><span class="chip good">${esc(chosen.file.name)}</span><span class="chip">${i.width}x${i.height}</span><span class="chip">${i.duration.toFixed(1)} s</span>${fpsNote(i, selKind)}<span class="chip">about ${mins} min to analyze</span>${tiltNote(chosen.tilt)}`;
  };
  renderInfo();

  const choose = (k: Kind): void => {
    if (k === selKind) return;
    setKind(k);
    view.querySelectorAll<HTMLElement>('[data-k]').forEach((x) => {
      x.classList.toggle('on', x.dataset.k === k);
      x.setAttribute('aria-pressed', String(x.dataset.k === k));
    });
    renderInfo();
  };
  const kinds = $('kinds');
  view.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => (b.onclick = () => {
    choose(b.dataset.k as Kind);
    if (phoneQuery.matches) b.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  }));
  if (phoneQuery.matches) {
    // the card in the middle is the chosen one: it is picked as soon as the swipe settles
    const cards = [...kinds.children] as HTMLElement[];
    const centre = (): HTMLElement => {
      const mid = kinds.scrollLeft + kinds.clientWidth / 2;
      return cards.reduce((a, c) => (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(a.offsetLeft + a.offsetWidth / 2 - mid) ? c : a));
    };
    let settle = 0;
    kinds.addEventListener('scroll', () => {
      if (step !== 1) return;
      clearTimeout(settle);
      settle = window.setTimeout(() => choose(centre().dataset.k as Kind), 90);
    }, { passive: true });
    requestAnimationFrame(centreKind);
  }

  /** Safari only decodes and seeks a video that is part of the page, so it waits there, invisible, until it is needed. */
  const parkVideo = (video: HTMLVideoElement): void => {
    video.controls = false;
    video.setAttribute('playsinline', '');
    video.removeAttribute('style');
    Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0', pointerEvents: 'none' });
    document.body.append(video);
  };
  const take = async (file: File, fps?: number, tilt?: Tilt): Promise<void> => {
    if (job.running) return; // one analysis at a time
    chosen?.video.remove();
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = URL.createObjectURL(file);
    parkVideo(video);
    try {
      chosen = { file, video, info: await probeVideo(file, video, fps), tilt };
      // a short play wakes the decoder, so the first seeks answer quickly on a phone
      try {
        await video.play();
        video.pause();
        video.currentTime = 0;
      } catch {
        // the browser refused: seeking still works, only the first seek may be slower
      }
      manual.v = null;
      cal.v = null;
      reach.v = null;
      reach.stand = reach.touch = -1;
      $('calib').hidden = true;
      $('reach').hidden = true;
      job.results = null;
      job.pose = null;
      job.progress = 0;
      job.failed = false;
      job.status = 'Ready. Check your height and weight, then analyze.';
      shown = null;
      $('out').innerHTML = '';
      manual.take = manual.land = -1;
      $('manual').hidden = true;
      $('drop').textContent = 'Choose another video';
      renderInfo();
      // on to the details, with the next thing to do in view
      goStep(3);
      const needs = selKind !== 'shot' && (!Number($<HTMLInputElement>('height').value) || !Number($<HTMLInputElement>('weight').value));
      if (!needs) {
        $('run').classList.add('nudge');
        setTimeout(() => $('run').classList.remove('nudge'), 1600);
      }
    } catch (e) {
      job.failed = true;
      job.status = e instanceof Error ? e.message : String(e);
    }
    paint();
  };
  // setting the scale: two lines on a frame where you stand tall say how many pixels your height is
  const cal = { v: null as HTMLVideoElement | null, top: 0.15, bottom: 0.88 };
  const scaleNote = (): void => {
    $('scaleNote').textContent = data.noseAnkle
      ? `Scale: measured on you (nose to ankle is ${(data.noseAnkle * 100).toFixed(1)}% of your height, the average is ${AVERAGE_NOSE_ANKLE * 100}%).`
      : 'Scale: average body proportions. Setting it from the video makes the hip rise and the reach more exact.';
  };
  scaleNote();
  const showCal = (): void => {
    if (!chosen) return;
    const v = (cal.v ??= Object.assign(document.createElement('video'), { src: chosen.video.src, muted: true, playsInline: true, controls: false }));
    const box = $('calbox');
    if (!box.contains(v)) box.prepend(v);
    $('calib').hidden = false;
    $('calOut').textContent = '';
    $('calib').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  $('calBtn').onclick = showCal;
  $<HTMLInputElement>('calscrub').oninput = (e) => {
    if (cal.v && chosen) cal.v.currentTime = (Number((e.target as HTMLInputElement).value) / 1000) * chosen.info.duration;
  };
  $('calbox').querySelectorAll<HTMLElement>('.calline').forEach((line) => {
    line.onpointerdown = (e) => {
      line.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent): void => {
        const r = cal.v!.getBoundingClientRect();
        let y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
        if (line.dataset.l === 'top') y = Math.min(y, cal.bottom - 0.1);
        else y = Math.max(y, cal.top + 0.1);
        cal[line.dataset.l as 'top' | 'bottom'] = y;
        line.style.top = `${y * 100}%`;
      };
      const up = (): void => {
        line.removeEventListener('pointermove', move);
        line.removeEventListener('pointerup', up);
      };
      line.addEventListener('pointermove', move);
      line.addEventListener('pointerup', up);
    };
  });
  $('calReset').onclick = () => {
    delete data.noseAnkle;
    save(data);
    scaleNote();
    $('calOut').textContent = 'Back to average body proportions.';
  };
  $('calSave').onclick = async () => {
    const v = cal.v;
    if (!v) return;
    const out = $('calOut');
    out.textContent = 'Reading your body in this frame...';
    try {
      if (v.seeking) await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
      const live = await createLivePose();
      const lm = live.detect(v);
      live.close();
      if (!lm) return void (out.textContent = 'No person found in this frame. Pick a frame where you are fully in view.');
      const h = v.videoHeight;
      const ratio = scaleRatio(lm[0].y * h, ((lm[27].y + lm[28].y) / 2) * h, cal.top * h, cal.bottom * h);
      if (!(ratio >= 0.8 && ratio <= 0.97)) return void (out.textContent = `That gives ${(ratio * 100).toFixed(0)}%, which is not a human proportion. Put the lines on the top of your head and your soles, in a frame where you stand upright.`);
      // a line can be placed to about one pixel on screen, so a small figure on a small preview gives a coarse scale
      const spanOnScreen = (cal.bottom - cal.top) * v.getBoundingClientRect().height;
      const exact = 200 / spanOnScreen; // percent, two lines of one pixel each
      if (exact > 3) return void (out.textContent = `At this size the lines are only good to about ${exact.toFixed(1)}%, no better than the average. Pick a frame where you are bigger, or film closer.`);
      data.noseAnkle = ratio;
      save(data);
      scaleNote();
      out.textContent = `Saved. Your nose to ankle is ${(ratio * 100).toFixed(1)}% of your height (lines good to about ${exact.toFixed(1)}%). It is used for every analysis from now on.`;
    } catch (e) {
      out.textContent = e instanceof Error ? e.message : String(e);
    }
  };

  // the reach method: touch height minus standing reach on the same wall
  const reach = { v: null as HTMLVideoElement | null, head: 0.12, sole: 0.88, finger: 0.03, stand: -1, touch: -1 };
  const heightNow = (): number => Number($<HTMLInputElement>('height').value);
  const reachOf = (): number => (reach.stand < 0 || reach.touch < 0 ? NaN : ((reach.stand - reach.touch) / (reach.sole - reach.head)) * heightNow());
  $('reachBtn').onclick = () => {
    if (!chosen) return;
    reach.v ??= Object.assign(document.createElement('video'), { src: chosen.video.src, muted: true, playsInline: true, controls: false });
    const box = $('rbox');
    if (!box.contains(reach.v)) box.prepend(reach.v);
    $('reach').hidden = false;
    $('reach').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  $<HTMLInputElement>('rscrub').oninput = (e) => {
    if (reach.v && chosen) reach.v.currentTime = (Number((e.target as HTMLInputElement).value) / 1000) * chosen.info.duration;
  };
  $('rbox').querySelectorAll<HTMLElement>('.calline').forEach((line) => {
    line.onpointerdown = (e) => {
      line.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent): void => {
        const r = reach.v!.getBoundingClientRect();
        const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
        reach[line.dataset.l as 'head' | 'sole' | 'finger'] = y;
        line.style.top = `${y * 100}%`;
      };
      const up = (): void => {
        line.removeEventListener('pointermove', move);
        line.removeEventListener('pointerup', up);
      };
      line.addEventListener('pointermove', move);
      line.addEventListener('pointerup', up);
    };
  });
  const reachText = (): void => {
    const height = heightNow();
    const out = $('rOut');
    if (!(height >= 120 && height <= 240)) return void (out.textContent = 'Enter your height above first, it sets the scale.');
    const onScreen = (reach.sole - reach.head) * (reach.v?.getBoundingClientRect().height ?? 0);
    const cmOff = onScreen > 0 ? (2 / onScreen) * height : 99; // two lines, each good to about a pixel on screen
    const j = reachOf();
    const ok = j > 5 && j < 150;
    $<HTMLButtonElement>('rSave').disabled = !ok;
    if (reach.stand < 0) out.textContent = 'Start with step 1.';
    else if (reach.touch < 0) out.textContent = 'Now find the highest touch of the jump and tap step 2.';
    else if (!ok) out.textContent = `That gives ${j.toFixed(0)} cm, which does not look like a jump. Check the fingertip lines.`;
    else out.textContent = `Jump about ${j.toFixed(0)} cm, give or take ${cmOff.toFixed(1)} cm from placing the lines.${cmOff > 3 ? ' You are small on screen, so this is coarse.' : ''}`;
  };
  $('rStand').onclick = () => {
    reach.stand = reach.finger;
    reachText();
  };
  $('rTouch').onclick = () => {
    reach.touch = reach.finger;
    reachText();
  };
  $('rSave').onclick = () => {
    const weight = Number($<HTMLInputElement>('weight').value);
    const r = reachJump(heightNow(), reach.head, reach.sole, reach.stand, reach.touch, weight >= 30 && weight <= 200 ? weight : undefined);
    data.sessions.push({ id: newId(), date: today(), kind: 'standing', headline: r.headline, metrics: r.metrics, tips: r.tips });
    $('rOut').textContent = save(data) ? `Saved: ${r.headline.toFixed(0)} cm. It is on your dashboard.` : 'The browser could not store it (storage full or blocked). Export what you need.';
    $<HTMLButtonElement>('rSave').disabled = true;
  };

  // measuring by hand: only the flight time counts, so any filming set-up works
  const manual = { cur: 0, take: -1, land: -1, v: null as HTMLVideoElement | null, sid: null as string | null };
  const fpsOf = (): number => chosen!.info.fps;
  const lastFrame = (): number => Math.max(0, Math.floor(chosen!.info.duration * fpsOf()) - 1);
  const goto = (i: number): void => {
    if (!chosen) return;
    manual.cur = Math.min(lastFrame(), Math.max(0, i));
    if (manual.v) manual.v.currentTime = (manual.cur + 0.5) / fpsOf();
    $<HTMLInputElement>('mscrub').value = String(manual.cur);
    $('mFrame').textContent = `frame ${manual.cur}`;
  };
  const flightOf = (): number => (manual.take >= 0 && manual.land > manual.take ? (manual.land - manual.take) / fpsOf() : 0);
  const showManual = (): void => {
    if (!chosen) return;
    // its own video, so the replay in the result keeps working
    const v = (manual.v ??= Object.assign(document.createElement('video'), { src: chosen.video.src, muted: true, playsInline: true, controls: false }));
    v.style.cssText = 'width:100%;max-height:38dvh;margin-inline:auto;display:block;border-radius:12px;background:#000';
    $('mvbox').append(v);
    $<HTMLInputElement>('mscrub').max = String(lastFrame());
    $('manual').hidden = false;
    goto(manual.take >= 0 ? manual.take : 0);
    $('manual').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  const updateManual = (): void => {
    const t = flightOf();
    const out = $('mOut');
    $<HTMLButtonElement>('mSave').disabled = !(t >= 0.15 && t <= 1.2);
    if (manual.take < 0 || manual.land < 0) out.textContent = manual.take < 0 ? 'Mark the first frame in the air.' : 'Now mark the first frame back on the floor.';
    else if (t < 0.15 || t > 1.2) out.textContent = 'That flight time does not look like a jump. Mark the frames again.';
    else out.textContent = `${manual.sid ? 'Found by the tracker. If it is off, move to the right frame and mark again. ' : ''}Flight time ${t.toFixed(2)} s, jump height about ${manualJump(t, undefined, fpsOf()).headline.toFixed(0)} cm (give or take ${manualJump(t, undefined, fpsOf()).precision!.toFixed(0)}).`;
  };
  $('manualBtn').onclick = () => {
    manual.sid = null;
    manual.take = manual.land = -1;
    updateManual();
    showManual();
  };
  // "Not right?" under an automatic result: the detected takeoff and landing become the starting marks, to be nudged
  onAdjust = (d) => {
    if (!chosen) return;
    const toFrame = (poseFrame: number): number => Math.round(((poseFrame + 0.5) / d.fps) * fpsOf() - 0.5);
    manual.sid = d.sid;
    manual.take = toFrame(d.takeoff + 1);
    manual.land = toFrame(d.landing);
    updateManual();
    showManual();
  };
  $<HTMLInputElement>('mscrub').oninput = (e) => goto(Number((e.target as HTMLInputElement).value));
  $('mPrev').onclick = () => goto(manual.cur - 1);
  $('mNext').onclick = () => goto(manual.cur + 1);
  $('mTake').onclick = () => { manual.take = manual.cur; updateManual(); };
  $('mLand').onclick = () => { manual.land = manual.cur; updateManual(); };
  $('mSave').onclick = () => {
    const weight = Number($<HTMLInputElement>('weight').value);
    const r = manualJump(flightOf(), weight >= 30 && weight <= 200 ? weight : undefined, fpsOf());
    const old = manual.sid ? data.sessions.find((s) => s.id === manual.sid) : undefined;
    if (old) {
      // a correction: the measured values are replaced, everything else about the jump stays
      const fresh = new Map(r.metrics.map((m) => [m.label, m]));
      old.metrics = old.metrics.map((m) => fresh.get(m.label) ?? m);
      old.headline = r.headline;
      old.tips = old.tips.filter((t) => !t.startsWith('Hip rise and flight time disagree')).concat('Takeoff and landing were adjusted by hand.');
      const i = job.ids?.indexOf(old.id) ?? -1;
      if (i >= 0 && job.results) {
        job.results[i].headline = r.headline;
        job.results[i].metrics = old.metrics;
        job.results[i].tips = old.tips;
        renderResults($('out'), job.video!, job.pose!, job.results, job.ids!);
      }
    } else data.sessions.push({ id: newId(), date: today(), kind: 'standing', headline: r.headline, metrics: r.metrics, tips: r.tips });
    $('mOut').textContent = save(data) ? `Saved: ${r.headline.toFixed(0)} cm. ${old ? 'Your dashboard is updated.' : 'It is on your dashboard.'}` : 'The browser could not store it (storage full or blocked). Export what you need.';
    $<HTMLButtonElement>('mSave').disabled = true;
  };
  acceptClip = (file, fps, tilt) => void take(file, fps, tilt);
  if (incoming) {
    const clip = incoming;
    incoming = null;
    void take(clip.file, clip.fps, clip.tilt);
  }
  $<HTMLInputElement>('file').onchange = (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) void take(f);
  };
  const drop = $('drop');
  drop.onclick = () => $<HTMLInputElement>('file').click();
  drop.ondragover = (ev) => { ev.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (ev) => {
    ev.preventDefault();
    drop.classList.remove('over');
    const f = ev.dataTransfer?.files[0];
    if (f) void take(f);
  };

  $('cancel').onclick = () => job.controller?.abort();

  $('run').onclick = async () => {
    if (job.running) return;
    const fail = (text: string): void => {
      job.failed = true;
      job.status = text;
      paint();
    };
    if (!chosen) return fail('Choose a video first.');
    const typed = Number($<HTMLInputElement>('height').value);
    const noHeight = selKind === 'shot' && !typed; // a shot is judged on form: the height only turns distances into centimetres
    const height = noHeight ? 175 : typed;
    const weight = selKind === 'shot' ? data.weightKg || 80 : Number($<HTMLInputElement>('weight').value);
    if (selKind === 'shot' ? !noHeight && (height < 120 || height > 240) : height < 120 || height > 240 || weight < 30 || weight > 200) return fail(selKind === 'shot' ? 'Height must be 120-240 cm, or leave it empty.' : 'Enter your real height (120-240 cm) and weight (30-200 kg) first. Scale and power depend on them.');
    if (!noHeight) data.heightCm = height;
    if (selKind !== 'shot') data.weightKg = weight;
    save(data);

    const { video, info } = chosen;
    if (!video.isConnected) parkVideo(video);
    const kind = selKind;
    const started = performance.now();
    job.running = true;
    keepAwake(true);
    job.failed = false;
    job.progress = 0;
    job.results = null;
    job.ids = null;
    job.pose = null;
    job.status = 'Starting...';
    job.controller = new AbortController();
    shown = null;
    $('out').innerHTML = '';
    jobChanged();
    try {
      const pose = await extractPose(video, info.sampleFps, (p) => {
        const el = (performance.now() - started) / 1000;
        job.progress = p;
        job.status = `Tracking your body${kind === 'shot' ? ' and the ball' : ''}${p > 0.05 ? `, about ${Math.ceil(el / p - el)} s left` : ''}. Keep the app open until it is done.`;
        jobChanged();
      }, kind === 'shot', job.controller.signal);
      const level = levelPose(pose); // a phone that leaned sideways is turned back before measuring
      const results = kind === 'shot' ? analyzeShots(level.pose, height, data.noseAnkle) : analyzeJumps(level.pose, height, kind, weight, data.noseAnkle);
      if (noHeight) results.forEach((r) => r.tips.push('No height was entered, so distances in centimetres (release height, jump height) are estimates for a 175 cm player.'));
      if (level.rollDeg) results.forEach((r) => r.tips.push(`The phone leaned about ${Math.abs(level.rollDeg).toFixed(0)} degrees sideways. That was corrected.`));
      const snaps = results.map((r) => buildSnapshots(pose, r));
      const ids = results.map(() => newId());
      results.forEach((r, i) => data.sessions.push({ id: ids[i], date: today(), kind, headline: r.headline, metrics: r.metrics, tips: r.tips, snaps: snaps[i] }));
      const saved = save(data);
      if (saved && keepPhotos()) {
        job.status = 'Saving photos of the key moments...';
        jobChanged();
        await savePhotos(video, info.sampleFps, results.map((_, i) => ({ id: ids[i], snaps: snaps[i] })));
      }
      job.ids = ids;
      job.pose = pose;
      job.video = video;
      job.results = results;
      job.failed = !saved;
      job.status = `Done: ${results.length} ${results.length > 1 ? 'results' : 'result'} saved to your dashboard.${saved ? '' : ' The browser could not store them (storage full or blocked), so export what you need.'}`;
    } catch (e) {
      const cancelled = e instanceof DOMException && e.name === 'AbortError';
      job.failed = !cancelled;
      job.status = cancelled ? 'Cancelled.' : `${e instanceof Error ? e.message : String(e)} You can also measure the jump by hand.`;
    } finally {
      job.running = false;
      keepAwake(false);
      job.controller = null;
      jobChanged();
    }
    if (job.results && view.isConnected) $('out').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
}
// ---------- results ----------

const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];

/** Shows one result, or a picker plus a summary when the clip held several jumps or shots. */
function renderResults(out: HTMLElement, video: HTMLVideoElement, pose: Pose, results: Result[], ids: string[]): void {
  if (results.length === 1) return renderResult(out, video, pose, results[0], ids[0]);
  const kind = results[0].kind;
  const noun = kind === 'shot' ? 'Shot' : 'Jump';
  const unit = kind === 'shot' ? '' : ' cm';
  const scores = results.map((r) => r.headline);
  out.innerHTML = `<section class="section"><div class="section-head rise"><h2>${results.length} ${noun.toLowerCase()}s found</h2></div>
    <p class="muted rise">Average <b style="color:var(--fg)">${avg(scores).toFixed(0)}${unit}</b>, from ${Math.min(...scores).toFixed(0)} to ${Math.max(...scores).toFixed(0)}${unit}. Pick one to inspect it.</p>
    <div class="pills rise" style="margin-top:16px">${results.map((r, i) => `<button class="pill" data-shot="${i}">${noun} ${i + 1} (${r.headline.toFixed(0)})</button>`).join('')}</div></section><div id="shot"></div>`;
  phoneLayout(out);
  animateIn(out);
  let tallest = 0; // the result area never shrinks while you switch, so the page below does not jump
  const pick = (i: number): void => {
    out.querySelectorAll<HTMLButtonElement>('[data-shot]').forEach((b, j) => b.classList.toggle('on', i === j));
    const holder = out.querySelector<HTMLElement>('#shot')!;
    renderResult(holder, video, pose, results[i], ids[i]);
    tallest = Math.max(tallest, holder.offsetHeight);
    holder.style.minHeight = `${tallest}px`;
  };
  out.querySelectorAll<HTMLButtonElement>('[data-shot]').forEach((b) => (b.onclick = () => pick(Number(b.dataset.shot))));
  pick(0);
}

/** Where a frame sits on the replay timeline, in percent (the marks span 80% of the bar, with room at both ends). */
function markPos(r: Result, frame: number): number {
  const lo = r.marks[0].frame;
  const hi = r.marks[r.marks.length - 1].frame;
  return 10 + ((frame - lo) / Math.max(1, hi - lo)) * 80;
}

function renderResult(out: HTMLElement, video: HTMLVideoElement, pose: Pose, r: Result, sid?: string): void {
  const isShot = r.kind === 'shot';
  const recs = recommend(r.metrics);
  const bestSoFar = Math.max(...data.sessions.filter((s) => s.kind === r.kind).map((s) => s.headline), r.headline);
  const pct = isShot ? r.headline : (r.headline / bestSoFar) * 100;
  out.innerHTML = `
    <section class="section">
      <div class="hero-tile rise" style="--c:${KIND_COLOR[r.kind]};--hero:${BAND[r.kind]}">
        <div class="kicker"><i></i>${KIND_LABEL[r.kind]}</div>
        <div class="numeral big">${count(r.headline)}<small>${isShot ? '/ 100' : 'cm'}</small></div>
        <div class="stack" style="gap:10px;max-width:420px"><div class="meter" style="--c:${KIND_COLOR[r.kind]}"><div data-w="${pct}"></div></div><span class="muted small">${isShot ? 'Shot score' : `${pct.toFixed(0)}% of your best`}</span></div>
        <div class="chips">${statusChips(r.metrics)}${r.precision ? `<span class="chip" title="${isShot ? '' : 'One frame of timing'}">about ± ${Math.max(1, Math.round(r.precision))} cm</span>` : ''}</div>
        ${!isShot && sid && r.marks.some((m) => m.name === 'Takeoff') ? '<button class="btn small" data-adjust type="button">Not right? Adjust takeoff and landing</button>' : ''}
        ${r.detectionRate < 0.85 ? `<p class="error small">Body found in only ${(r.detectionRate * 100).toFixed(0)}% of frames. Results may be unreliable.</p>` : ''}
      </div>
    </section>
    <section class="section"><div class="section-head rise"><h2>What to work on</h2></div>
      ${recs.length ? recCards(recs) : '<p class="muted">Nothing flagged. Keep it up and test again in 1-2 weeks.</p>'}
      ${r.tips.length ? `<p class="muted small" style="margin-top:16px"><b>Notes:</b> ${r.tips.map(esc).join(' ')}</p>` : ''}
      ${isShot ? '' : '<div style="margin-top:20px"><button class="btn" data-go="log">How to jump higher</button></div>'}
    </section>
    ${assignmentHtml(r.kind)}
    <div class="grid g12" id="resultgrid" style="margin-top:12px">
      <div class="tile rise" style="--c:${KIND_COLOR[r.kind]}"><div class="kicker" style="margin-bottom:14px"><i></i>Replay</div><div class="stage"><canvas></canvas></div>
        <div class="timeline">${r.marks.map((m, i) => `<button class="dot" data-mark="${i}" title="${m.name}" style="left:${markPos(r, m.frame).toFixed(1)}%"></button>`).join('')}<i class="head" style="left:0%"></i></div>
        <div class="pills">${r.marks.map((m, i) => `<button class="pill" data-mark="${i}">${m.name}</button>`).join('')}</div></div>
      <div class="tile rise"><div class="kicker" style="margin-bottom:14px">Metrics</div><div class="metrics">${r.metrics.map(tile).join('')}</div></div>
    </div>
    ${snapSection(buildSnapshots(pose, r), sid)}`;

  out.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => (b.onclick = () => navigate(b.dataset.go as Tab)));
  out.querySelectorAll<HTMLButtonElement>('[data-assign] [data-log]').forEach((b) => (b.onclick = () => {
    const ex = EXERCISES.find((e) => e.name === b.dataset.log);
    if (!ex) return;
    data.exercises.push({ id: newId(), date: today(), name: ex.name, sets: ex.sets, reps: ex.reps, notes: '' });
    save(data);
    toast(`Logged ${ex.sets} x ${ex.reps} ${ex.name}`);
    b.disabled = true;
    b.textContent = 'Logged';
  }));
  const adjust = out.querySelector<HTMLButtonElement>('[data-adjust]');
  if (adjust && sid) {
    const frameOf = (name: string): number => r.marks.find((m) => m.name === name)!.frame;
    adjust.onclick = () => onAdjust?.({ sid, takeoff: frameOf('Takeoff'), landing: frameOf('Landing'), fps: pose.fps });
  }
  phoneLayout(out);
  hydratePhotos(out);
  animateIn(out);
  const stage = out.querySelector<HTMLElement>('.stage')!;
  const canvas = stage.querySelector('canvas')!;
  video.removeAttribute('style'); // it was parked invisible while it was read
  video.controls = true;
  video.muted = true;
  stage.style.setProperty('--ar', String(pose.width / pose.height));
  stage.prepend(video);
  canvas.width = pose.width;
  canvas.height = pose.height;
  const ctx = canvas.getContext('2d')!;
  const bone = '#ffffff';
  // the frame on screen: the browser says which one it presented, otherwise the clock decides
  const rv = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number }).requestVideoFrameCallback;
  let shownAt = -1;
  if (rv) {
    const on = (_now: number, meta: { mediaTime: number }): void => {
      shownAt = meta.mediaTime;
      if (canvas.isConnected) rv.call(video, on);
    };
    rv.call(video, on);
  }
  const frameNow = (): number => (shownAt >= 0 ? Math.round(shownAt * pose.fps) : Math.floor(video.currentTime * pose.fps));
  const at = (frame: number): void => {
    shownAt = -1;
    video.currentTime = (frame + 0.5) / pose.fps; // the middle of the frame, as when it was tracked
  };
  at(r.marks[0].frame); // start at the first phase
  out.querySelectorAll<HTMLButtonElement>('[data-mark]').forEach((b) => (b.onclick = () => at(r.marks[Number(b.dataset.mark)].frame)));

  const draw = (): void => {
    if (!canvas.isConnected) return; // stop when this result is replaced
    // the playhead follows the video, so the timeline is alive while you scrub or play
    const head = out.querySelector<HTMLElement>('.timeline .head');
    if (head) head.style.left = `${Math.max(0, Math.min(100, markPos(r, frameNow())))}%`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lm = pose.frames[Math.max(0, Math.min(pose.frames.length - 1, frameNow()))];
    ctx.strokeStyle = bone;
    ctx.lineWidth = Math.max(3, pose.width / 220);
    ctx.lineCap = 'round';
    if (lm) {
      ctx.beginPath();
      for (const [a, b] of BONES) {
        ctx.moveTo(lm[a].x * pose.width, lm[a].y * pose.height);
        ctx.lineTo(lm[b].x * pose.width, lm[b].y * pose.height);
      }
      ctx.stroke();
    }
    const ball = pose.balls[Math.max(0, Math.min(pose.balls.length - 1, frameNow()))];
    if (ball) {
      ctx.strokeStyle = css('--jump');
      ctx.beginPath();
      ctx.arc(ball.x * pose.width, ball.y * pose.height, pose.width / 50, 0, 2 * Math.PI);
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  };
  draw();
}

// ---------- guides ----------

/** The folding sections of a guide. On a phone they fold; on a larger screen everything stays open. */
function guideHtml(sections: Section[], firstOpen: boolean, rise = true): string {
  const legend = [['strength', 'Strength', 'var(--jump)'], ['speed', 'Speed', 'var(--fg)'], ['plyo', 'Plyometrics', 'var(--shot)'], ['rest', 'Rest', 'var(--border)']];
  const body = (s: Section): string => {
    if (s.layout === 'steps') {
      return `<div class="steps">${s.items.map((it, i) => `<div class="step"><div class="bub">${i + 1}</div><div><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div></div>`).join('')}</div>`;
    }
    if (s.layout === 'week') {
      return `<div class="legend">${legend.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div><div class="week">${s.items.map((it) => `<div class="day ${it.tag ?? 'rest'}"><span class="dn">${esc(it.t)}</span>${icon(it.icon ?? 'check', 22)}<p>${esc(it.d)}</p></div>`).join('')}</div>`;
    }
    return `<div class="cards">${s.items.map((it) => `<div class="cardi">${scatter(it.icon ?? 'check', it.t, 4, 2, 4, 34)}<h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div>`).join('')}</div>`;
  };
  return sections
    .map((s, i) => {
      const wide = s.layout === 'week' || (s.layout === 'cards' && s.items.length >= 5);
      return `<details class="tile guide${rise ? ' rise' : ''}" style="${wide ? 'grid-column:1/-1' : ''}"${!phoneQuery.matches || (firstOpen && i === 0) ? ' open' : ''}><summary><h2>${esc(s.title)}</h2></summary>${s.intro ? `<p class="intro">${esc(s.intro)}</p>` : ''}${body(s)}</details>`;
    })
    .join('');
}

/** Folding sections only fold on a phone; on a larger screen a click on the heading does nothing. */
function settleGuide(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('details.guide > summary').forEach((s) => (s.onclick = (e) => {
    if (!phoneQuery.matches) e.preventDefault();
  }));
  if (window.matchMedia('(max-width: 900px)').matches) root.querySelectorAll<HTMLElement>('.guide').forEach((el) => (el.style.gridColumn = 'auto'));
}

/** A small choice for the quick buttons on the dashboard: what is in the video? Resolves to null when closed. */
/** Used by the camera panel when you tap Change: remembers the choice. */
async function pickKind(): Promise<Kind | null> {
  const k = await askKind('What are you recording?');
  if (k) setKind(k);
  return k;
}

function askKind(title: string): Promise<Kind | null> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'pickkind';
    el.innerHTML = `<div class="pk-card" role="dialog" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${(['standing', 'dunk', 'shot'] as Kind[]).map((k) => `<button class="btn big${k === selKind ? ' primary' : ''}" data-pk="${k}">${KIND_LABEL[k]}</button>`).join('')}<button class="btn small" data-pk="">Cancel</button></div>`;
    const done = (k: Kind | null): void => {
      el.remove();
      resolve(k);
    };
    el.onclick = (e) => {
      const t = (e.target as Element).closest<HTMLElement>('[data-pk]');
      if (t) done((t.dataset.pk || null) as Kind | null);
      else if (e.target === el) done(null);
    };
    document.body.append(el);
    el.querySelector<HTMLElement>('button')!.focus();
  });
}

// ---------- training log ----------


const ICON_OF: Record<Group, string> = { strength: 'dumbbell', jumps: 'jump', shooting: 'ball' };

/** Three things to do this week, picked for the test and rotated so they change from one result to the next. */
function assignmentHtml(kind: Kind): string {
  const list = exercisesFor(kind);
  const n = data.sessions.length;
  const want: [Group, number][] = kind === 'shot' ? [['shooting', 2], ['strength', 1]] : [['jumps', 2], ['strength', 1]];
  const picks: Exercise[] = [];
  want.forEach(([g, count], gi) => {
    const pool = list.filter((e) => e.group === g && e.level !== 'Advanced');
    for (let k = 0; k < count && pool.length; k++) {
      const e = pool[(n + gi + k) % pool.length];
      if (!picks.includes(e)) picks.push(e);
    }
  });
  return `<section class="section"><div class="section-head rise"><h2>Do this next</h2></div><p class="muted small note rise" style="text-align:center">Three things for this week. One tap logs them in Training. Test again in 1 to 2 weeks to see what moved.</p><div class="exlist" data-assign>${picks.map(exerciseCard).join('')}</div></section>`;
}

function exerciseCard(e: Exercise): string {
  const per = e.per ? ` ${e.per}` : '';
  return `<article class="ex">${scatter(ICON_OF[e.group], e.name, 3, 2, 3, 30)}<h3>${esc(e.name)}</h3><div class="chips"><span class="chip">${e.level}</span><span class="chip">${e.sets} x ${e.reps}${per}</span></div><p class="muted small">${esc(e.why)}</p><details class="ex-how"><summary>How to do it</summary><ul>${e.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details><div class="row"><button class="btn small primary" data-log="${esc(e.name)}">Log ${e.sets} x ${e.reps}</button><a class="btn small" href="${exampleUrl(e.name)}" target="_blank" rel="noopener noreferrer">Watch</a></div></article>`;
}

const TRAIN_SUB: Record<Kind, string> = {
  standing: 'Strength and jumps that raise your vertical.',
  dunk: 'Fast, reactive jumps and the strength behind them.',
  shot: 'Clean repetitions and the leg strength behind your range.',
};
const KIND_SHORT_TAB: Record<Kind, string> = { standing: 'Jump', dunk: 'Dunk', shot: 'Shot' };

/** The guide that belongs to the discipline: how to jump higher for the two jumps, nothing extra for the shot. */
function planHtml(): string {
  if (selKind === 'shot') return '';
  return `<details class="fold plan"${phoneQuery.matches ? '' : ' open'}><summary>How to jump higher</summary><div class="guide-grid">${guideHtml(jumpGuide, false)}</div></details>`;
}

function log(view: HTMLElement): void {
  const weekAgo = dayKey(new Date(Date.now() - 7 * 864e5));
  const week = data.exercises.filter((e) => e.date >= weekAgo);
  const sets = week.reduce((a, e) => a + e.sets, 0);
  const reps = week.reduce((a, e) => a + e.sets * e.reps, 0);
  theme(view);
  view.innerHTML = `
    <section class="band"><div class="wrap">
      <div class="stack rise" style="gap:16px"><h1 class="display">Train for the ${THEME[selKind].noun}</h1><p class="sub">${TRAIN_SUB[selKind]}</p></div>
      <div class="pills tabsbar rise" id="exgroups">${(['standing', 'dunk', 'shot'] as Kind[]).map((k) => `<button class="pill ${k === selKind ? 'on' : ''}" data-g="${k}" aria-pressed="${k === selKind}">${KIND_SHORT_TAB[k]}</button>`).join('')}</div>
      <div class="kpis">
        <div class="stat train rise"><div class="kicker"><i></i>Sessions</div><div class="numeral">${count(week.length)}<small>/${WEEK_TARGET}</small></div><div class="meter"><div data-w="${Math.min(100, (week.length / WEEK_TARGET) * 100)}"></div></div><p class="sub">Exercises logged in the last 7 days</p></div>
        <div class="stat train rise"><div class="kicker"><i></i>Sets</div><div class="numeral">${count(sets)}</div><p class="sub">Sets in the last 7 days</p></div>
        <div class="stat train rise"><div class="kicker"><i></i>Reps</div><div class="numeral">${count(reps)}</div><p class="sub">Sets x reps in the last 7 days</p></div>
      </div>
    </div></section>
    <div class="wrap">
      
      <div id="kindplan">${planHtml()}</div>
      <section class="section"><div id="exlist"></div></section>

      <section class="section"><div class="section-head rise"><h2>Weekly volume</h2></div>${data.exercises.length ? '<div class="chartbox rise"><canvas id="vol"></canvas></div>' : '<div class="empty rise"><p class="muted">Log an exercise above and your weekly volume shows up here.</p></div>'}</section>

      <section class="section"><div class="section-head rise"><h2>History</h2></div>
        ${data.exercises.length ? `<table><tr><th>Date</th><th>Exercise</th><th>Volume</th><th>Notes</th><th></th></tr>${data.exercises.slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => `<tr><td>${shortDate(e.date)}</td><td><b>${esc(e.name)}</b></td><td>${e.sets} x ${e.reps}</td><td class="muted">${esc(e.notes)}</td><td><button class="btn small" data-del="${e.id}">Delete</button></td></tr>`).join('')}</table>` : '<div class="empty rise"><p class="muted">Nothing logged yet.</p></div>'}
      </section>

      <details class="fold"><summary>Log your own exercise</summary>
        <section class="section"><div class="section-head rise fold-title"><h2>Log your own exercise</h2></div>
          <form id="f" class="col">
            <input name="name" placeholder="Exercise" required>
            <div class="two"><input name="sets" type="number" min="1" placeholder="Sets" required><input name="reps" type="number" min="1" placeholder="Reps" required></div>
            <input name="notes" placeholder="Notes (load, how it felt)">
            <button class="btn primary big">Add</button>
          </form></section>
      </details>


    </div>`;
  settleGuide(view);
  const paintEx = (): void => {
    theme(view);
    const groups = (['strength', 'jumps', 'shooting'] as Group[]).filter((g) => exercisesFor(selKind).some((e) => e.group === g));
    view.querySelector<HTMLElement>('#exlist')!.innerHTML = groups
      .map((g) => `<div class="exgroup"><h3 class="exhead">${GROUP_LABEL[g]}</h3><p class="muted small note">${GROUP_NOTE[g]}</p><div class="exlist">${exercisesFor(selKind).filter((e) => e.group === g).map(exerciseCard).join('')}</div></div>`)
      .join('');
    view.querySelector<HTMLElement>('#kindplan')!.innerHTML = planHtml();
    settleGuide(view);
    view.querySelectorAll<HTMLButtonElement>('#exgroups [data-g]').forEach((b) => {
      b.classList.toggle('on', b.dataset.g === selKind);
      b.setAttribute('aria-pressed', String(b.dataset.g === selKind));
    });
    view.querySelector<HTMLElement>('.band h1')!.textContent = `Train for the ${THEME[selKind].noun}`;
    view.querySelector<HTMLElement>('.band .sub')!.textContent = TRAIN_SUB[selKind];
  };
  paintEx();
  view.querySelectorAll<HTMLButtonElement>('#exgroups [data-g]').forEach((b) => (b.onclick = () => {
    setKind(b.dataset.g as Kind);
    paintEx();
  }));
  // one tap logs the suggested sets and reps for today
  view.querySelector<HTMLElement>('#exlist')!.onclick = (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('[data-log]');
    const ex = btn && EXERCISES.find((e) => e.name === btn.dataset.log);
    if (!ex) return;
    data.exercises.push({ id: newId(), date: today(), name: ex.name, sets: ex.sets, reps: ex.reps, notes: '' });
    save(data);
    toast(`Logged ${ex.sets} x ${ex.reps} ${ex.name}`);
    void show('log', true);
  };
  const volCanvas = view.querySelector<HTMLCanvasElement>('#vol');
  if (volCanvas) whenVisible(volCanvas, () => charts.push(volumeChart(volCanvas, weeksData())));
  const form = view.querySelector<HTMLFormElement>('#f')!;
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    data.exercises.push({ id: newId(), date: today(), name: String(f.get('name')), sets: Number(f.get('sets')), reps: Number(f.get('reps')), notes: String(f.get('notes') ?? '') });
    save(data);
    toast('Logged');
    void show('log', true);
  };
  view.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => (b.onclick = () => {
    data.exercises = data.exercises.filter((e) => e.id !== b.dataset.del);
    save(data);
    void show('log', true);
  }));
}

// wait for the fonts, so text does not reflow after the first paint (but never longer than 1.5 s)
void Promise.race([
  Promise.all([document.fonts.load('700 1em "Barlow Condensed"'), document.fonts.load('400 1em "Geist Variable"'), document.fonts.load('500 1em "Geist Variable"')]),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]).then(() => {
  // ?demo shows sample data without saving it (used for the screenshots in the README)
  if (new URLSearchParams(location.search).has('demo') && !data.sessions.length && !data.exercises.length) {
    const demo = demoData();
    data.sessions.push(...demo.sessions);
    data.exercises.push(...demo.exercises);
  }
  shell();
  void route();
});

document.addEventListener('pointerdown', (e) => {
  if ((e.target as Element).closest('.btn.primary, .tab, .pill, .pick')) tick();
});

document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-cam]')) openFramingCheck({ kind: selKind, askKind: pickKind, onRecorded: recorded });
});

// Offline support and durable storage. Only in the production build: during development a cache gets in the way.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // the address carries the build, so every new version of the app installs a new worker; coming back to the app checks again
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`./sw.js?v=${__BUILD__}`)
      .then((reg) => document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void reg.update().catch(() => undefined)))
      .catch(() => undefined);
  });
  watchUpdates();
}

function installSection(): string {
  const h = installHelp();
  if (!h) return '';
  return `<section class="section"><div class="section-head rise"><h2>Install</h2></div><div class="tile row between rise"><p class="muted">${h.text}</p>${h.action ? `<button class="btn primary" id="installBtn">${h.label}</button>` : ''}</div></section>`;
}
// asks the browser not to evict results when storage is tight (iOS Safari clears idle sites otherwise)
void navigator.storage?.persist?.().catch(() => undefined);
