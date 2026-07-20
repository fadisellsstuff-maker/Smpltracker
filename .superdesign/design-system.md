# SmplTrack — Design System

## Product context
SmplTrack is a **local-first mobile PWA** that turns free-form workout notes into
insights. It never prescribes routines — it reflects what you did. The Home
(Dashboard) page is the hero screen: a **muscle heat map** plus training stats.
Audience: lifters who log casually. Feel: focused, data-dense but calm, premium
fitness-tracker (think Whoop / Fitbod / Strava), not clinical.

## Layout
- **Mobile-first, single column**, constrained to `max-w-md` (~448px), centered on a near-black page.
- **Sticky top header** (wordmark left, gear/settings right).
- **Fixed bottom tab bar**, 5 items; the center "Add" is a **raised circular red FAB**; other tabs are icon + tiny label; active tab is red.
- Content uses `px-4`, generous vertical rhythm (`space-y-5`), bottom padding clears the nav (`pb-28`).

## Color (dark theme only — do NOT introduce light mode or new hues)
| Role | Hex | Use |
|------|-----|-----|
| Page background | `#0a0a0a` | app canvas |
| Surface / card | `zinc-900/60` over border `zinc-800` | cards |
| Inner tile | `zinc-800/50` | stat tiles |
| Primary text | `#e4e4e7` (zinc-200) / `zinc-50` for numbers | |
| Secondary text | `zinc-400` | labels |
| Muted text | `zinc-500` / `zinc-600` | hints |
| **Brand accent** | **red-500 `#ef4444`** (and red-400 `#f87171`) | FAB, primary buttons, active nav, heat "primary", calendar |
| Secondary accent | **amber-500 `#f59e0b`** / amber-400 `#fbbf24` | heat "secondary", PR markers |
| Neutral heat | zinc-700 `#3f3f46` | untrained muscle |
| Chart grid | `#2c2c2a` | |
| Chart axis ink | `#898781` | |

**Muscle heat levels:** Primary = red `#ef4444`, Secondary = amber `#f59e0b`, Untrained = gray `#3f3f46`.

## Typography
- Family: system sans (`ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`). **No serif, no decorative, no display font.**
- Big stat numbers: `font-bold` + `tabular-nums`, sizes `text-2xl`–`text-3xl`.
- Section titles: `text-sm font-semibold uppercase tracking-wide text-zinc-300`.
- Labels: `text-xs text-zinc-400`; hints `text-[10px]/[11px] text-zinc-500`.

## Radii / shadow / spacing
- Radii: cards `rounded-2xl`, tiles/inputs `rounded-xl`/`rounded-lg`, pills & FAB `rounded-full`.
- Shadow: subtle; the FAB has `shadow-lg shadow-red-500/30`. Avoid heavy layered shadows.
- Borders: hairline `border-zinc-800` on surfaces, `border-zinc-900` on header/nav.

## Components (see components.md / layouts.md for source)
- **Card** — `rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4`
- **Stat tile** — big tabular value + label (+ optional sub), on `bg-zinc-800/50`
- **SectionTitle** — uppercase zinc-300 heading + optional right hint
- **Pill** — rounded-full toggle; active `bg-zinc-100 text-zinc-900`, idle `bg-zinc-800 text-zinc-300`
- **Empty** — dashed-border empty state
- **MuscleHeatmap** — front + back anatomical SVG bodies, muscles shaded red/amber/gray, 3-item legend
- **BottomNav** — 5 tabs, center red FAB
- Buttons: primary `bg-red-500 text-white rounded-xl`; secondary `bg-zinc-800 text-zinc-300 rounded-xl`

## Home / Dashboard content (what the page shows)
1. "Muscle Map" section title + **7d / 30d** pill toggle.
2. **Muscle heat-map card** — front & back bodies side by side + Primary/Secondary/Untrained legend.
3. Row of 3 stat tiles: **Sessions**, **This week** (days trained), **Week streak** (🔥).
4. **Coverage card** — "N / 18 muscle groups hit" + weighted-sets-this-window line.

## Motion
- Subtle only: `transition` on interactive elements, hover brightness on tappable cells, `backdrop-blur` on sticky header/nav. No large parallax or flashy animation.

## Hard constraints
- Keep the dark canvas, red/amber accents, system font, and the muscle-map as the hero.
- Do not invent new fonts, colors, gradients, or a light theme. Everything must come from the tokens above.
