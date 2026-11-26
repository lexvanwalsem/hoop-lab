/** Hand-drawn SVG icons and illustrations. Everything is inline, uses currentColor, and needs no network. */

const ICONS: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  analyze: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/>',
  jump: '<path d="M12 20V5M5.5 11.5L12 5l6.5 6.5"/>',
  camera: '<path d="M3 8.5a2 2 0 0 1 2-2h2l1.5-2h7l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.6"/>',
  dumbbell: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  user: '<circle cx="12" cy="7.5" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.7 5.7c3 3 3 9.6 0 12.6M18.3 5.7c-3 3-3 9.6 0 12.6"/>',
  spring: '<path d="M12 3v3l-4.5 2.2L16.5 11 7.5 14l9 2.6-4.5 2.2V21"/>',
  arms: '<circle cx="12" cy="5" r="2.2"/><path d="M12 8v8M12 10L5.5 5M12 10l6.5-5M12 16l-3 5M12 16l3 5"/>',
  landing: '<path d="M12 3v10M7.5 9l4.5 4.5L16.5 9M4 20h16M7.5 20v-3M16.5 20v-3"/>',
  bolt: '<path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19.5 7"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.2"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1A3.5 3.5 0 0 0 8 10.5M16 6h3.5v1A3.5 3.5 0 0 1 16 10.5M12 13v4M8.5 21h7M10 17h4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  play: '<path d="M7 4.5l13 7.5-13 7.5z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
};

export function icon(name: string, size = 22): string {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ICONS.check}</svg>`;
}

/** Top view: where the phone goes relative to the athlete. */
export function cameraDiagram(inline = false): string {
  // seen from above: the phone on the left, the athlete on the right, turned 45 degrees to the line between them
  return `<svg class="art cam${inline ? ' inline' : ''}" viewBox="0 0 360 220" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M62 100L268 40V160z" fill="currentColor" opacity="0.07" stroke="none"/>
    <path d="M62 100H262" stroke-dasharray="5 7" opacity="0.6"/>
    <g transform="translate(24 82)"><rect width="32" height="36" rx="8" fill="currentColor" stroke="none"/><circle cx="16" cy="18" r="6" fill="var(--bg)" stroke="none"/></g>
    <path d="M259 119L295 81" stroke-width="9" opacity="0.9"/>
    <circle cx="277" cy="100" r="13" fill="currentColor" stroke="none"/>
    <path d="M277 100L249 72M249 88V72H265"/>
    <path d="M230 100A47 47 0 0 1 244 67" stroke="var(--good)" stroke-width="3"/>
    <text x="196" y="84" text-anchor="middle" fill="var(--good)" stroke="none" font-size="22" font-weight="800">45&#176;</text>
    <path d="M62 178h200M62 172v12M262 172v12" opacity="0.6"/>
    <text x="162" y="203" text-anchor="middle" fill="currentColor" stroke="none" font-size="14" font-weight="600">4-5 m</text>
  </svg>`;
}

export const VERDICT = (ok: boolean): string =>
  `<svg class="verdict ${ok ? 'ok' : 'no'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10.5"/><path d="${ok ? 'M7 12.5l3.5 3.5L17 9' : 'M8 8l8 8M16 8l-8 8'}"/></svg>`;

/** One phone screen: what the camera sees. The scene is clipped to the screen. */
function phone(id: string, scene: string, extra = ''): string {
  return `<svg class="phone" viewBox="0 0 120 220" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs><clipPath id="${id}"><rect x="6" y="6" width="108" height="208" rx="12"/></clipPath></defs><rect x="3" y="3" width="114" height="214" rx="15"/><g clip-path="url(#${id})">${scene}</g>${extra}</svg>`;
}

function framingCell(ok: boolean, svg: string, title: string, text: string): string {
  return `<figure class="fcell ${ok ? 'right' : 'wrong'}">${svg}<figcaption>${VERDICT(ok)}<span><b>${title}</b>${text}</span></figcaption></figure>`;
}

/** A person standing at x, feet on groundY, `h` tall. Solid shapes, so it still reads when it is small. */
function standing(x: number, groundY: number, h: number): string {
  const s = h / 100;
  const top = groundY - h;
  const hip = top + 55 * s;
  return `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${x - 5 * s} ${groundY}L${x - 3 * s} ${hip}M${x + 5 * s} ${groundY}L${x + 3 * s} ${hip}" stroke-width="${7 * s}"/>
    <path d="M${x} ${top + 18 * s}V${hip}" stroke-width="${14 * s}"/>
    <path d="M${x - 8 * s} ${top + 21 * s}L${x - 11 * s} ${top + 46 * s}M${x + 8 * s} ${top + 21 * s}L${x + 11 * s} ${top + 46 * s}" stroke-width="${5 * s}"/>
    <circle cx="${x}" cy="${top + 8 * s}" r="${7.5 * s}" fill="currentColor" stroke="none"/></g>`;
}

/** Right and wrong framing side by side, plus where the phone goes. */
export function framingPanel(): string {
  const far = phone('cl-far', `<line x1="6" y1="196" x2="114" y2="196" opacity="0.3"/>${standing(60, 196, 38)}`);
  const cut = phone('cl-cut', standing(60, 262, 200));
  const good = phone(
    'cl-ok',
    `<line x1="6" y1="196" x2="114" y2="196" opacity="0.3"/><g class="zoom">${standing(60, 196, 112)}</g>`,
    '<path class="brk" pathLength="1" d="M20 84v112M14 84h12M14 196h12"/>',
  );
  return `<div class="fpanel">
    ${framingCell(false, far, 'Too far', 'The figure is small, so joint angles get noisy.')}
    ${framingCell(false, cut, 'Cut off', 'Feet or hands leave the frame, so they cannot be measured.')}
    ${framingCell(true, good, 'Just right', 'The whole body in frame, at least half of the height.')}
    <figure class="fcell top">${cameraDiagram(true)}<figcaption><span><b>Turned 45 degrees, 4-5 m</b>Phone at hip height on a tripod. Turn about 45 degrees to it.</span></figcaption></figure>
  </div>`;
}

/** Tiny trend line for a stat tile. */
export function sparkline(values: number[], w = 140, h = 36): string {
  if (values.length < 2) return '';
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 6) + 3).toFixed(1)},${(h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(',');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" aria-hidden="true"><polyline points="${pts.join(' ')}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="currentColor"/></svg>`;
}
