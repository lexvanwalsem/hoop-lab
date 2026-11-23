import '@fontsource-variable/geist';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import type { Chart } from 'chart.js';
import './style.css';
import { shortDate, trendChart, volumeChart, type Series } from './charts';
import { analyzeJumps, analyzeShots, type Kind, type Metric, type Result } from './analysis';
import { drillName, exampleUrl, recommend, type Rec } from './coach';
import { filmingGuide, jumpGuide, type Section } from './guide';
import { extractPose, type Pose } from './pose';
import { demoData } from './demo';
import { exportBackup, importBackup, load, newId, save, sortByDate, today, type Data, type Session, backupDue, lastBackup, markBackup } from './store';
import { probeVideo, type VideoInfo } from './video';
import { openFramingCheck } from './camera';
import { framingPanel, icon, jumpFigure, phaseNames, runFigures, sparkline } from './art';
import { gauge } from './gauge';

const data: Data = load();
const app = document.getElementById('app')!;
type Tab = 'dashboard' | 'analyze' | 'jump' | 'filming' | 'log';
let tab: Tab = 'dashboard';
let charts: Chart[] = [];

const KIND_LABEL: Record<Kind, string> = { standing: 'Standing jump', dunk: 'Dunk approach jump', shot: 'Jump shot' };
const KIND_SHORT: Record<Kind, string> = { standing: 'Jump', dunk: 'Dunk', shot: 'Shot' };
const KIND_ICON: Record<Kind, string> = { standing: 'jump', dunk: 'bolt', shot: 'ball' };
const KIND_DESC: Record<Kind, string> = { standing: 'Jump as high as you can from a stand. Height, power, dip and landing.', dunk: 'A run-up jump. Approach speed and how far your hand clears the rim.', shot: 'Your shooting form. Release, arc, flick and follow-through, per shot.' };
const KIND_COLOR: Record<Kind, string> = { standing: 'var(--jump)', dunk: 'var(--dunk)', shot: 'var(--shot)' };
const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const dayKey = (d: Date): string => d.toLocaleDateString('sv-SE'); // local day, same format as the store
const WEEK_TARGET = 4; // training sessions per week that fill the Training meter

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- shell, navigation, motion ----------

const TAB_ICON: Record<Tab, string> = { dashboard: 'dashboard', analyze: 'analyze', jump: 'jump', filming: 'camera', log: 'dumbbell' };
let inked = false;

/** Announcement bar, header and tabs are built once, so they never flicker or move when you switch pages. */
function shell(): void {
  const tabs: [Tab, string][] = [['dashboard', 'Today'], ['analyze', 'Analyze'], ['jump', 'Jump higher'], ['filming', 'Filming'], ['log', 'Training']];
  app.innerHTML = `<div class="announce">Film side-on, 4-5 m away, at 60 fps or more for the most exact numbers.</div>
    <header><div class="wrap"><a class="brand" href="#dashboard" aria-label="Hoop Lab, home">Hoop Lab<b>.</b></a><nav class="tabs" aria-label="Pages"><i class="tab-ink no-anim"></i>${tabs
      .map(([id, label]) => `<button class="tab" data-tab="${id}" aria-label="${label}">${icon(TAB_ICON[id], 22)}<span>${label}</span></button>`)
      .join('')}</nav><div class="head-right"><button class="jobpill" id="jobpill" hidden></button><button class="btn primary head-cta" data-go="analyze">Analyze a video</button></div></div></header>
    <div id="view"></div>`;
  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => navigate(b.dataset.tab as Tab)));
  app.querySelectorAll<HTMLButtonElement>('header [data-go], #jobpill').forEach((b) => (b.onclick = () => navigate('analyze')));
}

// ---------- routing: every page has an address, so reload, links and the back button work ----------

const TABS: Tab[] = ['dashboard', 'analyze', 'jump', 'filming', 'log'];

function routeFromHash(): { tab: Tab; session?: string } {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('session/')) return { tab: 'dashboard', session: h.slice('session/'.length) };
  return { tab: (TABS as string[]).includes(h) ? (h as Tab) : 'dashboard' };
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
}
const job: Job = { running: false, progress: 0, status: '', failed: false, controller: null, video: null, pose: null, results: null };
let paintJob: () => void = () => {}; // set by the Analyze page while it is on screen

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
let stopFigures: () => void = () => {};
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
  charts.forEach((c) => c.destroy());
  charts = [];
  stopFigures();
  observers.forEach((o) => o.disconnect());
  observers.length = 0;
  view.classList.remove('leaving');
  view.classList.toggle('still', soft);
  if (!soft) window.scrollTo({ top: 0, behavior: 'instant' });
  ({
    dashboard,
    analyze,
    jump: () => guidePage(view, 'Jump higher', 'Technique, training and how to read your numbers.', jumpFigure(), jumpGuide, true),
    filming: () => guidePage(view, 'Filming', 'Good footage in, good numbers out.', '', filmingGuide, false, framingPanel()),
    log,
  })[tab](view);
  phoneLayout(view);
  animateIn(view, soft);
  stopFigures = runFigures(view, reduceMotion);
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
  root.querySelectorAll<HTMLElement>('.stats, .recs, .cards, .week, .picker, .fpanel').forEach((row) => {
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
  el.innerHTML = `<div class="sheet-card" role="dialog" aria-modal="true" aria-label="${KIND_LABEL[s.kind]} details" style="--c:${KIND_COLOR[s.kind]}">
    <div class="sheet-head">
      <div class="row between"><div class="kicker"><i></i>${KIND_LABEL[s.kind]}, ${shortDate(s.date)}${s.demo ? ' (demo data)' : ''}</div><div class="row"><button class="btn small" data-delete>Delete</button><button class="btn small" data-close>Close</button></div></div>
      <div class="row" style="gap:28px;margin-top:8px"><div class="numeral md">${count(s.headline)}<small>${unit}</small></div><div class="chips">${statusChips(s.metrics)}</div></div>
    </div>
    <div class="sheet-body">
      <div class="metrics rise">${s.metrics.map(tile).join('')}</div>
      <div class="section-head" style="margin-top:32px"><h2>How to improve</h2></div>
      ${recs.length ? recCards(recs) : '<p class="muted">Nothing flagged in this session.</p>'}
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
  animateIn(el);
  setTimeout(() => el.classList.add('open'), 30); // after the first paint, so the transition runs
  el.querySelector<HTMLElement>('[data-close]')?.focus();
}
// ---------- dashboard ----------

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
  const hide = data.sessions.length ? '' : ' is-empty';
  const isDemo = data.sessions.some((s) => s.demo) || data.exercises.some((e) => e.demo);
  const active = new Set([...data.sessions.map((s) => s.date), ...data.exercises.map((e) => e.date)]);
  const dots = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 864e5))
    .map((d, i) => `<span class="${active.has(dayKey(d)) ? 'on' : ''} ${i === 6 ? 'today' : ''}" style="--k:${i}">${d.toLocaleDateString('en', { weekday: 'narrow' })}</span>`)
    .join('');

  view.innerHTML = `
    <section class="band"><div class="wrap">
      <div class="hero-row rise"><div class="stack" style="gap:16px"><div class="kicker">Today</div><h1 class="display">Ready to jump?</h1></div><button class="btn on-band big" data-go="analyze">Analyze a video</button></div>
      <div class="stats">
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
      ${data.sessions.length ? '' : `<section class="section rise"><div class="tile"><div class="welcome"><div class="stack"><h2>Start here</h2><p class="muted">Film a jump or a shot, upload it, and get your numbers plus what to work on.</p><div class="row"><button class="btn primary" data-go="analyze">Analyze a video</button><button class="btn" data-go="filming">How to film</button><button class="btn" id="loadDemo">Try with demo data</button></div></div>${jumpFigure()}</div></div></section>`}

      <section class="section${hide}">
        <div class="section-head rise"><h2>Trend</h2>
          <div class="pills" id="trendseg">${(['standing', 'dunk', 'shot', 'vol'] as const).map((k) => `<button class="pill ${k === trendSel ? 'on' : ''}" data-t="${k}" aria-pressed="${k === trendSel}">${k === 'vol' ? 'Training' : KIND_SHORT[k]}</button>`).join('')}</div></div>
        <div class="trend rise" id="trendcard"><div class="row between"><div class="kicker"><i></i><span id="trendname"></span></div><span class="muted small" id="trendnote"></span></div><div class="chartbox" id="chartbox"><canvas id="c1"></canvas></div></div>
      </section>

      <section class="section${hide}"><div class="section-head rise"><h2>Work on this</h2></div>${focusAreas()}</section>

      <section class="section${hide}"><div class="section-head rise"><h2>Recent sessions</h2></div>
        ${data.sessions.length ? `<div class="sessions">${data.sessions.slice(-6).reverse().map((s) => `<button class="srow ${s.kind} rise" data-sid="${s.id}"><span class="big">${s.headline.toFixed(0)}<small>${s.kind === 'shot' ? '/100' : 'cm'}</small></span><span class="what"><b>${KIND_LABEL[s.kind]}</b><span>${shortDate(s.date)}</span></span><span class="chips">${statusChips(s.metrics)}</span><span class="go">&rsaquo;</span></button>`).join('')}</div>` : '<p class="muted">No sessions yet.</p>'}
      </section>

      <details class="fold"${!phoneQuery.matches || due ? ' open' : ''}><summary>Settings and backup${due ? ' <span class="chip warn">Back up</span>' : ''}</summary>
      <section class="section"><div class="section-head rise"><h2>Jump goal</h2></div>
        <div class="tile row between rise"><p class="muted">Set a target for your standing jump. The Jump meter fills towards it.</p><div class="row"><div style="width:140px"><input id="goal" type="number" min="10" max="200" placeholder="Goal in cm" value="${goal || ''}" aria-label="Jump goal in centimetres"></div><button class="btn primary" id="setGoal">${goal ? 'Update goal' : 'Set goal'}</button></div></div>
      </section>

      <section class="section" style="padding-bottom:80px"><div class="section-head rise"><h2>Your data</h2></div>
        ${due ? `<div class="demo-bar rise" role="status"><span class="chip warn">Back up</span><span class="muted small">${due === 'never' ? 'Your results only live on this device. Export a backup so you do not lose them.' : 'Your last backup is more than a month old. Export a new one.'}</span><button class="btn small" id="remindExport">Export backup</button></div>` : ''}
        <div class="tile row between rise"><p class="muted">Everything is stored in this browser only, and videos are never kept. Export a backup to move it to another device or keep it safe.<br><span class="small" id="storeNote">${lastBackup() ? `Last backup: ${shortDate(lastBackup()!.slice(0, 10))}.` : 'No backup yet.'}</span></p>
          <div class="row"><button class="btn" id="exportData">Export backup</button><button class="btn" id="importData">Import backup</button><button class="btn" id="wipeData">Delete all</button><input type="file" id="importFile" accept="application/json,.json" hidden></div></div>
        <p class="small error" id="dataNote" role="status" style="min-height:1.5em;margin-top:10px"></p>
      </section>
      </details>
    </div>`;

  view.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => (b.onclick = () => navigate(b.dataset.go as Tab)));
  view.querySelectorAll<HTMLButtonElement>('[data-sid]').forEach((b) => (b.onclick = () => (location.hash = `session/${b.dataset.sid}`)));
  view.querySelector<HTMLButtonElement>('#setGoal')!.onclick = () => {
    data.goalCm = Number(view.querySelector<HTMLInputElement>('#goal')!.value) || 0;
    save(data);
    void show('dashboard', true);
  };

  // demo data, backup and wipe
  const note = (text: string, ok = false): void => {
    const el = view.querySelector<HTMLElement>('#dataNote')!;
    el.textContent = text;
    el.classList.toggle('error', !ok);
  };
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
    void show('dashboard', true);
  };
  view.querySelector<HTMLButtonElement>('#wipeData')!.onclick = () => {
    if (!confirm('Delete all sessions, exercises, your goal and your height and weight from this browser? Export a backup first if you want to keep them.')) return;
    data.sessions = [];
    data.exercises = [];
    data.goalCm = 0;
    data.heightCm = 0;
    data.weightKg = 0;
    save(data);
    void show('dashboard');
  };

  // one big chart with a switch: the middle layer, shown only when asked for
  const draw = (sel: typeof trendSel): void => {
    trendSel = sel;
    charts.forEach((c) => c.destroy());
    charts = [];
    const card = view.querySelector<HTMLElement>('#trendcard')!;
    card.style.setProperty('--c', sel === 'vol' ? 'var(--fg)' : KIND_COLOR[sel]);
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
      else box.innerHTML = '<p class="muted">Log exercises in the Training tab to see your weekly volume.</p>';
      return;
    }
    const hex = css(sel === 'standing' ? '--jump' : sel === 'dunk' ? '--dunk' : '--shot');
    const series: Series[] = [{ label: KIND_SHORT[sel], kind: sel, color: hex }];
    if (data.sessions.some((s) => s.kind === sel)) whenVisible(canvas, () => charts.push(trendChart(canvas, data.sessions, series, sel === 'shot' ? '' : 'cm', sel === 'standing' ? goal : 0)));
    else box.innerHTML = '<p class="muted">No data yet. Analyze a video to start your trend.</p>';
  };
  view.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) => (b.onclick = () => draw(b.dataset.t as typeof trendSel)));
  draw(trendSel);
}

// ---------- analyze ----------

let selKind: Kind = 'standing';
let chosen: { file: File; video: HTMLVideoElement; info: VideoInfo } | null = null;

/** Rough tracking time in seconds: the shot also runs ball detection, which is slower. */
const estimateSeconds = (info: VideoInfo, kind: Kind): number => info.duration * info.sampleFps * (kind === 'shot' ? 0.22 : 0.09);

function fpsNote(info: VideoInfo, kind: Kind): string {
  if (info.fps >= 50) return `<span class="chip good">${info.fps.toFixed(0)} fps, good</span>`;
  if (kind === 'shot') return `<span class="chip warn">${info.fps.toFixed(0)} fps: shot timing is coarse (${(1000 / info.fps).toFixed(0)} ms per frame). Film at 60 fps or more.</span>`;
  return `<span class="chip warn">${info.fps.toFixed(0)} fps: jump height is fine, takeoff and landing are less exact. 60 fps is better.</span>`;
}

function analyze(view: HTMLElement): void {
  view.innerHTML = `
    <section class="band"><div class="wrap"><div class="stack rise" style="gap:16px"><div class="kicker">Analyze</div><h1 class="display">Test yourself</h1><p class="sub" style="max-width:520px">Upload a video of a jump or a shot. Body tracking measures it and tells you what to work on.</p></div></div></section>
    <div class="wrap">
      <section class="section"><div class="section-head rise"><h2>1. What are you testing?</h2></div>
        <div class="picker rise" id="kinds">${(['standing', 'dunk', 'shot'] as Kind[]).map((k) => `<button class="pick ${k} ${k === selKind ? 'on' : ''}" data-k="${k}" aria-pressed="${k === selKind}">${icon(KIND_ICON[k], 32)}<span><span class="name">${KIND_LABEL[k]}</span><p>${KIND_DESC[k]}</p></span></button>`).join('')}</div></section>

      <section class="section"><div class="section-head rise"><h2>2. Your video and you</h2></div>
        <div class="grid g21">
          <div class="tile stack rise">
            <label class="dropzone" id="drop" for="file" tabindex="0" role="button">${icon('upload', 32)}<strong>${chosen ? esc(chosen.file.name) : 'Choose a video'}</strong><span class="muted">${chosen ? 'click to choose another' : 'or drop it here'}</span></label>
            <input id="file" type="file" accept="video/*" hidden>
            <div id="info" class="chips"></div>
            <button class="btn small" data-cam>Check my framing first</button>
          </div>
          <div class="tile stack rise">
            <label class="field">Height (cm)<input id="height" type="number" min="120" max="240" value="${data.heightCm || ''}" placeholder="193"></label>
            <label class="field">Weight (kg)<input id="weight" type="number" min="30" max="200" value="${data.weightKg || ''}" placeholder="95"></label>
            <p class="muted small">They set the scale and the power estimate, so use your real values.</p>
            <button id="run" class="btn primary big push">Analyze</button>
          </div>
        </div></section>

      <section class="section"><div class="section-head rise"><h2>3. Analysis</h2></div>
        <div class="tile busy rise"><div class="numeral md" id="pct">0<small>%</small></div><div class="stack" style="flex:1;min-width:0"><div class="meter"><div id="pbar" style="width:0"></div></div><p id="status" class="muted" role="status">Choose a video to begin.</p><div><button class="btn small" id="cancel" hidden>Cancel</button></div></div></div></section>

      <div id="out" class="scroll-target"></div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => view.querySelector<T>('#' + id)!;
  const statusEl = $('status');
  let shown: Result[] | null = null;

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
    if (job.results && job.video && job.pose && job.results !== shown && !job.running) {
      shown = job.results;
      renderResults($('out'), job.video, job.pose, job.results);
    }
  };
  paintJob = paint;
  paint();

  const renderInfo = (): void => {
    if (!chosen) return;
    const i = chosen.info;
    const mins = Math.max(1, Math.round(estimateSeconds(i, selKind) / 60));
    $('info').innerHTML = `<span class="chip">${i.width}x${i.height}</span><span class="chip">${i.duration.toFixed(1)} s</span>${fpsNote(i, selKind)}<span class="chip">about ${mins} min to analyze</span>`;
  };
  renderInfo();

  view.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) => (b.onclick = () => {
    selKind = b.dataset.k as Kind;
    view.querySelectorAll<HTMLElement>('[data-k]').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    renderInfo();
  }));

  const take = async (file: File): Promise<void> => {
    if (job.running) return; // one analysis at a time
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);
    try {
      chosen = { file, video, info: await probeVideo(file, video) };
      job.results = null;
      job.pose = null;
      job.progress = 0;
      job.failed = false;
      job.status = 'Ready. Check your height and weight, then analyze.';
      shown = null;
      $('out').innerHTML = '';
      $('drop').innerHTML = `${icon('upload', 32)}<strong>${esc(file.name)}</strong><span class="muted">click to choose another</span>`;
      renderInfo();
    } catch (e) {
      job.failed = true;
      job.status = e instanceof Error ? e.message : String(e);
    }
    paint();
  };
  $<HTMLInputElement>('file').onchange = (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (f) void take(f);
  };
  const drop = $('drop');
  drop.onkeydown = (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      $<HTMLInputElement>('file').click();
    }
  };
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
    const height = Number($<HTMLInputElement>('height').value);
    const weight = Number($<HTMLInputElement>('weight').value);
    if (height < 120 || height > 240 || weight < 30 || weight > 200) return fail('Enter your real height (120-240 cm) and weight (30-200 kg) first. Scale and power depend on them.');
    data.heightCm = height;
    data.weightKg = weight;
    save(data);

    const { video, info } = chosen;
    const kind = selKind;
    const started = performance.now();
    job.running = true;
    job.failed = false;
    job.progress = 0;
    job.results = null;
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
        job.status = `Tracking your body${kind === 'shot' ? ' and the ball' : ''}${p > 0.05 ? `, about ${Math.ceil(el / p - el)} s left` : ''}. You can switch tabs, but keep this one open.`;
        jobChanged();
      }, kind === 'shot', job.controller.signal);
      const results = kind === 'shot' ? analyzeShots(pose, height) : analyzeJumps(pose, height, kind, weight);
      for (const r of results) data.sessions.push({ id: newId(), date: today(), kind, headline: r.headline, metrics: r.metrics, tips: r.tips });
      const saved = save(data);
      job.pose = pose;
      job.video = video;
      job.results = results;
      job.failed = !saved;
      job.status = `Done: ${results.length} ${results.length > 1 ? 'results' : 'result'} saved to your dashboard.${saved ? '' : ' The browser could not store them (storage full or blocked), so export what you need.'}`;
    } catch (e) {
      const cancelled = e instanceof DOMException && e.name === 'AbortError';
      job.failed = !cancelled;
      job.status = cancelled ? 'Cancelled.' : e instanceof Error ? e.message : String(e);
    } finally {
      job.running = false;
      job.controller = null;
      jobChanged();
    }
    if (job.results && view.isConnected) $('out').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
}
// ---------- results ----------

const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];

/** Shows one result, or a picker plus a summary when the clip held several jumps or shots. */
function renderResults(out: HTMLElement, video: HTMLVideoElement, pose: Pose, results: Result[]): void {
  if (results.length === 1) return renderResult(out, video, pose, results[0]);
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
    renderResult(holder, video, pose, results[i]);
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

function renderResult(out: HTMLElement, video: HTMLVideoElement, pose: Pose, r: Result): void {
  const isShot = r.kind === 'shot';
  const recs = recommend(r.metrics);
  const bestSoFar = Math.max(...data.sessions.filter((s) => s.kind === r.kind).map((s) => s.headline), r.headline);
  const pct = isShot ? r.headline : (r.headline / bestSoFar) * 100;
  out.innerHTML = `
    <section class="section">
      <div class="section-head rise"><h2>Result</h2></div>
      <div class="hero-tile rise" style="--c:${KIND_COLOR[r.kind]}">
        <div class="kicker"><i></i>${KIND_LABEL[r.kind]}</div>
        <div class="numeral big">${count(r.headline)}<small>${isShot ? '/ 100' : 'cm'}</small></div>
        <div class="stack" style="gap:10px;max-width:420px"><div class="meter" style="--c:${KIND_COLOR[r.kind]}"><div data-w="${pct}"></div></div><span class="muted small">${isShot ? 'Shot score' : `${pct.toFixed(0)}% of your best`}</span></div>
        <div class="chips">${statusChips(r.metrics)}</div>
        ${r.detectionRate < 0.85 ? `<p class="error small">Body found in only ${(r.detectionRate * 100).toFixed(0)}% of frames. Results may be unreliable.</p>` : ''}
      </div>
    </section>
    <div class="grid g12" id="resultgrid" style="margin-top:12px">
      <div class="tile rise" style="--c:${KIND_COLOR[r.kind]}"><div class="kicker" style="margin-bottom:14px"><i></i>Replay</div><div class="stage"><canvas></canvas></div>
        <div class="timeline">${r.marks.map((m, i) => `<button class="dot" data-mark="${i}" title="${m.name}" style="left:${markPos(r, m.frame).toFixed(1)}%"></button>`).join('')}<i class="head" style="left:0%"></i></div>
        <div class="pills">${r.marks.map((m, i) => `<button class="pill" data-mark="${i}">${m.name}</button>`).join('')}</div></div>
      <div class="tile rise"><div class="kicker" style="margin-bottom:14px">Metrics</div><div class="metrics">${r.metrics.map(tile).join('')}</div></div>
    </div>
    <section class="section"><div class="section-head rise"><h2>How to improve</h2></div>
      ${recs.length ? recCards(recs) : '<p class="muted">Nothing flagged. Keep it up and test again in 1-2 weeks.</p>'}
      ${r.tips.length ? `<p class="muted small" style="margin-top:16px"><b>Notes:</b> ${r.tips.map(esc).join(' ')}</p>` : ''}
      ${isShot ? '' : '<div style="margin-top:20px"><button class="btn" data-go="jump">Open the Jump higher guide</button></div>'}
    </section>`;

  out.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => (b.onclick = () => navigate(b.dataset.go as Tab)));
  phoneLayout(out);
  animateIn(out);
  const stage = out.querySelector<HTMLElement>('.stage')!;
  const canvas = stage.querySelector('canvas')!;
  video.controls = true;
  video.muted = true;
  stage.prepend(video);
  canvas.width = pose.width;
  canvas.height = pose.height;
  const ctx = canvas.getContext('2d')!;
  const bone = '#ffffff';
  video.currentTime = r.marks[0].frame / pose.fps; // start at the first phase
  out.querySelectorAll<HTMLButtonElement>('[data-mark]').forEach((b) => (b.onclick = () => (video.currentTime = r.marks[Number(b.dataset.mark)].frame / pose.fps)));

  const draw = (): void => {
    if (!canvas.isConnected) return; // stop when this result is replaced
    // the playhead follows the video, so the timeline is alive while you scrub or play
    const head = out.querySelector<HTMLElement>('.timeline .head');
    if (head) head.style.left = `${Math.max(0, Math.min(100, markPos(r, video.currentTime * pose.fps)))}%`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lm = pose.frames[Math.min(pose.frames.length - 1, Math.round(video.currentTime * pose.fps))];
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
    const ball = pose.balls[Math.min(pose.balls.length - 1, Math.round(video.currentTime * pose.fps))];
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

function guidePage(view: HTMLElement, title: string, subtitle: string, art: string, sections: Section[], phases: boolean, lead = ''): void {
  const legend = [['strength', 'Strength', 'var(--jump)'], ['speed', 'Speed', 'var(--fg)'], ['plyo', 'Plyometrics', 'var(--shot)'], ['rest', 'Rest', 'var(--border)']];
  const body = (s: Section): string => {
    if (s.layout === 'steps') {
      return `<div class="steps">${s.items.map((it, i) => `<div class="step"><div class="bub">${i + 1}</div><div><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div></div>`).join('')}</div>`;
    }
    if (s.layout === 'week') {
      return `<div class="legend">${legend.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div><div class="week">${s.items.map((it) => `<div class="day ${it.tag ?? 'rest'}"><span class="dn">${esc(it.t)}</span>${icon(it.icon ?? 'check', 22)}<p>${esc(it.d)}</p></div>`).join('')}</div>`;
    }
    return `<div class="cards">${s.items.map((it) => `<div class="cardi"><div class="bub">${icon(it.icon ?? 'check', 24)}</div><h3>${esc(it.t)}</h3><p>${esc(it.d)}</p></div>`).join('')}</div>`;
  };
  view.innerHTML = `
    <section class="band guide-band${art ? '' : ' plain'}">${art}<div class="wrap"><div class="kicker rise">Guide</div><h1 class="display rise">${esc(title)}</h1><p class="rise">${esc(subtitle)}</p>${phases ? `<div class="phases rise">${phaseNames.map((n) => `<span>${n}</span>`).join('')}</div>` : ''}</div></section>
    <div class="wrap"><div class="section guide-grid" style="padding-bottom:80px">
      ${lead ? `<section class="tile lead rise"><h2>What the camera should see</h2>${lead}<div style="margin-top:16px"><button class="btn" data-cam>Check my framing with the camera</button></div></section>` : ''}
      ${sections
        .map((s, i) => {
          const wide = s.layout === 'week' || (s.layout === 'cards' && s.items.length >= 5);
          return `<details class="tile guide rise" style="${wide ? 'grid-column:1/-1' : ''}"${!phoneQuery.matches || i === 0 ? ' open' : ''}><summary><h2>${esc(s.title)}</h2></summary>${s.intro ? `<p class="intro">${esc(s.intro)}</p>` : ''}${body(s)}</details>`;
        })
        .join('')}
    </div></div>`;
  // sections only fold on a phone; on a larger screen everything stays open
  view.querySelectorAll<HTMLElement>('details.guide > summary').forEach((s) => s.addEventListener('click', (e) => !phoneQuery.matches && e.preventDefault()));
  if (window.matchMedia('(max-width: 900px)').matches) view.querySelectorAll<HTMLElement>('.guide').forEach((el) => (el.style.gridColumn = 'auto'));
}

// ---------- training log ----------

const SUGGESTIONS = ['Back squat', 'Trap-bar deadlift', 'Romanian deadlift', 'Split squat', 'Box jump', 'Depth jump', 'Pogo hops', 'Calf raise', 'Jump squat', 'Form shooting', 'Free throws'];

function log(view: HTMLElement): void {
  const weekAgo = dayKey(new Date(Date.now() - 7 * 864e5));
  const week = data.exercises.filter((e) => e.date >= weekAgo);
  const sets = week.reduce((a, e) => a + e.sets, 0);
  const reps = week.reduce((a, e) => a + e.sets * e.reps, 0);
  view.innerHTML = `
    <section class="band"><div class="wrap">
      <div class="stack rise" style="gap:16px"><div class="kicker">Training</div><h1 class="display">Build the engine</h1></div>
      <div class="stats">
        <div class="stat train rise"><div class="kicker"><i></i>Sessions</div><div class="numeral">${count(week.length)}<small>/${WEEK_TARGET}</small></div><div class="meter"><div data-w="${Math.min(100, (week.length / WEEK_TARGET) * 100)}"></div></div><p class="sub">Exercises logged in the last 7 days</p></div>
        <div class="stat train rise"><div class="kicker"><i></i>Sets</div><div class="numeral">${count(sets)}</div><p class="sub">Sets in the last 7 days</p></div>
        <div class="stat train rise"><div class="kicker"><i></i>Reps</div><div class="numeral">${count(reps)}</div><p class="sub">Sets x reps in the last 7 days</p></div>
      </div>
    </div></section>
    <div class="wrap">
      <section class="section"><div class="grid g21">
        <div class="rise"><div class="section-head"><h2>Weekly volume</h2></div>${data.exercises.length ? '<div class="chartbox"><canvas id="vol"></canvas></div>' : '<p class="muted">Log exercises to see your weekly volume.</p>'}</div>
        <div class="tile stack rise"><h2>Log an exercise</h2>
          <div class="pills">${SUGGESTIONS.map((s) => `<button class="pill" data-s="${s}" data-sug>${s}</button>`).join('')}</div>
          <form id="f" class="stack">
            <input name="name" placeholder="Exercise" required>
            <div class="row" style="flex-wrap:nowrap"><input name="sets" type="number" min="1" placeholder="Sets" required><input name="reps" type="number" min="1" placeholder="Reps" required></div>
            <input name="notes" placeholder="Notes (load, how it felt)">
            <button class="btn primary big">Add</button>
          </form></div>
      </div></section>
      <section class="section" style="padding-bottom:80px"><div class="section-head rise"><h2>History</h2></div>
        ${data.exercises.length ? `<table><tr><th>Date</th><th>Exercise</th><th>Volume</th><th>Notes</th><th></th></tr>${data.exercises.slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => `<tr><td>${shortDate(e.date)}</td><td><b>${esc(e.name)}</b></td><td>${e.sets} x ${e.reps}</td><td class="muted">${esc(e.notes)}</td><td><button class="btn small" data-del="${e.id}">Delete</button></td></tr>`).join('')}</table>` : '<p class="muted">Nothing logged yet.</p>'}
      </section>
    </div>`;
  const volCanvas = view.querySelector<HTMLCanvasElement>('#vol');
  if (volCanvas) whenVisible(volCanvas, () => charts.push(volumeChart(volCanvas, weeksData())));
  const form = view.querySelector<HTMLFormElement>('#f')!;
  view.querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) => (b.onclick = () => ((form.elements.namedItem('name') as HTMLInputElement).value = b.dataset.s!)));
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    data.exercises.push({ id: newId(), date: today(), name: String(f.get('name')), sets: Number(f.get('sets')), reps: Number(f.get('reps')), notes: String(f.get('notes') ?? '') });
    save(data);
    show('log', true);
  };
  view.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((b) => (b.onclick = () => {
    data.exercises = data.exercises.filter((e) => e.id !== b.dataset.del);
    save(data);
    show('log', true);
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

document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-cam]')) openFramingCheck();
});

// Offline support and durable storage. Only in the production build: during development a cache gets in the way.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
// asks the browser not to evict results when storage is tight (iOS Safari clears idle sites otherwise)
void navigator.storage?.persist?.().catch(() => undefined);
