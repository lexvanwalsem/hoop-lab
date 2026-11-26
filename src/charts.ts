import Chart from 'chart.js/auto';
import type { Kind } from './analysis';
import type { Session } from './store';

export interface Series {
  label: string;
  kind: Kind;
  color: string; // hex, so an alpha can be appended
}

const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const shortDate = (iso: string): string => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function setDefaults(): void {
  Chart.defaults.font.family = css('--body') || 'system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.font.weight = 500;
  Chart.defaults.color = css('--muted');
  Chart.defaults.borderColor = css('--border-soft');
}

/** Flat tooltip: the inverse of the page, no shadow. */
const tooltip = () => ({
  backgroundColor: css('--fg'),
  titleColor: css('--bg'),
  bodyColor: css('--bg'),
  padding: 12,
  cornerRadius: 12,
  boxPadding: 4,
  titleFont: { weight: 600 as const },
});

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  const done: number[] = [];
  return values.map((v) => {
    if (v === null) return null;
    done.push(v);
    const recent = done.slice(-window);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  });
}

/**
 * One point per session in the order they happened. Shots also get a 3-shot moving average
 * (the trend you care about), and a jump chart can show a dashed goal line.
 * Flat on purpose: solid lines, no fill, no glow.
 */
export function trendChart(canvas: HTMLCanvasElement, sessions: Session[], series: Series[], unit: string, goal = 0): Chart {
  setDefaults();
  const wanted = sessions.filter((s) => series.some((d) => d.kind === s.kind)).sort((a, b) => a.date.localeCompare(b.date)); // stable, keeps the order within a day
  const labels = wanted.map((s) => shortDate(s.date));
  const dense = wanted.length > 25;
  const datasets: object[] = [];

  series.forEach((d) => {
    const raw = wanted.map((s) => (s.kind === d.kind ? s.headline : null));
    const isShot = d.kind === 'shot';
    datasets.push({
      label: isShot ? 'Each shot' : d.label,
      data: raw,
      borderColor: isShot ? d.color + '77' : d.color,
      backgroundColor: 'transparent',
      borderWidth: isShot ? 1.5 : 3,
      tension: 0, // straight segments: sharp, not soft
      spanGaps: true,
      pointRadius: dense ? 0 : isShot ? 3 : 5,
      pointHoverRadius: 7,
      pointBackgroundColor: isShot ? d.color : css('--bg'),
      pointBorderColor: d.color,
      pointBorderWidth: isShot ? 0 : 2.5,
    });
    if (isShot) {
      datasets.push({
        label: 'Trend (3-shot average)',
        data: movingAverage(raw, 3),
        borderColor: d.color,
        backgroundColor: 'transparent',
        borderWidth: 3.5,
        tension: 0,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 5,
      });
    }
  });

  if (goal > 0) {
    datasets.push({ label: 'Goal', data: wanted.map(() => goal), borderColor: css('--fg'), borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, fill: false });
  }

  return new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: datasets as never },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart', delay: (ctx) => (ctx.type === 'data' ? ctx.dataIndex * 25 : 0) },
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8 } },
      plugins: {
        legend: { display: datasets.length > 1, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 18 } },
        tooltip: {
          ...tooltip(),
          filter: (item) => item.parsed.y !== null,
          callbacks: {
            title: (items) => `${items[0].label}, session ${items[0].dataIndex + 1}`,
            label: (c) => ` ${c.dataset.label}: ${(c.parsed.y ?? 0).toFixed(0)}${unit ? ' ' + unit : ''}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          // show a date only where it changes, so several sessions on one day stay readable
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, callback: (_v, i) => (i === 0 || labels[i] !== labels[i - 1] ? labels[i] : '') },
        },
        y: { grace: '12%', border: { display: false }, grid: { color: css('--border-soft') }, ticks: { maxTicksLimit: 5, callback: (v) => (unit ? `${v} ${unit}` : String(v)) } },
      },
    },
  });
}

/** Training volume (sets x reps) per week, newest week last. */
export function volumeChart(canvas: HTMLCanvasElement, weeks: { label: string; value: number }[]): Chart {
  setDefaults();
  return new Chart(canvas, {
    type: 'bar',
    data: { labels: weeks.map((w) => w.label), datasets: [{ label: 'Reps', data: weeks.map((w) => w.value), backgroundColor: css('--train'), borderRadius: 4, borderSkipped: false, maxBarThickness: 40 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart', delay: (ctx) => (ctx.type === 'data' ? ctx.dataIndex * 60 : 0) },
      plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: (c) => ` ${c.parsed.y} reps` } } },
      scales: { x: { grid: { display: false }, border: { display: false } }, y: { beginAtZero: true, border: { display: false }, grid: { color: css('--border-soft') }, ticks: { maxTicksLimit: 5 } } },
    },
  });
}
