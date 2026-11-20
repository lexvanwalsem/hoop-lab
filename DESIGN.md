# Hoop Lab design

Sporty and sharp. This file is the contract for how the interface looks and moves. The values live in `src/style.css`.

## Principles

1. **The interface is monochrome.** Text is near-black on white. In dark mode it is white on near-black. Greys carry every change of surface.
2. **Colour only means something.** There are four data colours and three status colours, and nothing is decorative:
   - Jump orange `#FF5000`, Dunk purple `#6E0FF6`, Shot blue `#1151FF`, Training is black or white.
   - Good green `#007D48`, Warn amber `#FCA600`, Bad red `#D30005`.
3. **Massive condensed type, only for display.** Barlow Condensed 700, uppercase, line height 0.9, for page titles and the big numbers. Everything else is Geist in weight 500 (interactive) or 400 (body).
4. **Flat.** No shadows, no glow, no gradients, no hover lift. A state change is a grey shift, an underline or an outline.
5. **Pills and plain tiles.** Buttons and filters are pills (30 px radius). Tiles are `#F5F5F5` with a 20 px radius and no border.
6. **A dense 8 px grid.** Tight gaps (8 to 16 px) between tiles, large breaks (48 to 80 px) between sections.
7. **Three layers of detail.** First the glanceable numbers, then the trend, then the full session behind a click.

## Motion

- One easing curve and three durations: 160 ms for hover and press, 320 ms for panels and the underline, 560 ms for entrances.
- A card is hidden until it scrolls into view, then it rises once. Counters, meters, gauges, sparklines and charts start at that moment, never off screen.
- Only `opacity`, `transform` and the width or position of fixed boxes animate, so nothing in the layout moves.
- The page fades out for 140 ms when you switch tabs. The detail sheet fades and slides both ways.
- `prefers-reduced-motion` turns all of it off and shows the final state.

## Rules that keep it stable

- Every counter reserves its final width before it counts.
- The scrollbar gutter is always reserved.
- Anything that scrolls scrolls inside its own box: the detail sheet never grows taller than the screen.
- Layout is checked from 360 to 2560 px wide and on short laptop heights.

## Components

- **Announcement bar**: black strip with 12 px white text.
- **Header**: white, 60 px, wordmark left, text links with a 2 px underline for the active page, a pill button on the right. On phones the links move to a bar at the bottom.
- **Hero band**: full-bleed near-black section with a giant uppercase title and the key numbers.
- **Stat**: label, display numeral, unit, a 4 px meter and one line of context.
- **Tile**: grey surface, 20 px radius, 24 px padding.
- **Pill filter**: outlined 1.5 px; selected is filled with the text colour.
- **Gauge**: a thin bar; the target range is a darker band and the current value is a dot.
