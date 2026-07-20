# Theme & Design Tokens — SmplTrack

## Stack
- **Framework:** React 19 + TypeScript + Vite
- **Routing:** react-router-dom v7 (config-based, see `routes.md`)
- **CSS:** Tailwind CSS **v4** via `@tailwindcss/vite` (imported with `@import 'tailwindcss'` — there is **no `tailwind.config.js`**; theme is default Tailwind + the CSS below)
- **Charts:** Recharts
- **Storage:** Dexie (IndexedDB), local-first
- **PWA:** vite-plugin-pwa (installable, offline, Web Share Target)
- **Component library:** custom (no shadcn/MUI/Chakra). Primitives in `src/components/ui.tsx`.

## Visual language
- **Dark theme only.** Page background `#0a0a0a` (near-black). Text `#e4e4e7` (zinc-200).
- **Accent:** red-500 `#ef4444` (brand "Track", primary buttons, active nav, calendar day fills).
- **Surfaces:** cards use `bg-zinc-900/60` with `border-zinc-800`, rounded `rounded-2xl`; inner tiles `bg-zinc-800/50` rounded `rounded-xl`.
- **Type scale:** system sans; bold tabular-nums for stat numbers; `uppercase tracking-wide text-xs` section titles in zinc-300.
- **Mobile-first:** app is constrained to `max-w-md` (a phone column) centered, sticky top header, fixed bottom tab bar with a raised center "+" FAB.
- **Radii:** pills `rounded-full`, cards `rounded-2xl`, tiles/inputs `rounded-xl`/`rounded-lg`.

## Muscle heat-map colors (`src/lib/insights/heatmap.ts`)
```ts
export const HEAT_COLORS = {
  primary: '#ef4444',   // red-500  — trained hard (>= 3.5 weighted sets)
  secondary: '#f59e0b', // amber-500 — trained light / assister (1–3.5)
  untrained: '#3f3f46', // zinc-700 — < 1 weighted set
}
```

## Chart colors (`src/pages/Progress.tsx`)
```ts
const SERIES = '#f87171' // red-400 line (single series, strong on dark)
const PR = '#fbbf24'     // amber-400 PR markers
const GRID = '#2c2c2a'   // hairline gridlines
const AXIS = '#898781'   // muted axis/tick ink
```

## Global CSS — `src/index.css` (complete)
```css
@import 'tailwindcss';

:root {
  color-scheme: dark;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  background: #0a0a0a;
  color: #e4e4e7;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Respect the phone's safe areas when installed as a PWA. */
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
.safe-top {
  padding-top: env(safe-area-inset-top);
}
```

## Common Tailwind class idioms (reuse these when reproducing UI)
- Card: `rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4`
- Stat tile: `rounded-xl bg-zinc-800/50 px-3 py-2.5` → value `text-2xl font-bold text-zinc-50 tabular-nums`, label `text-xs text-zinc-400`
- Section title: `text-sm font-semibold tracking-wide text-zinc-300 uppercase`
- Primary button: `rounded-xl bg-red-500 py-3 font-semibold text-white`
- Secondary button: `rounded-xl bg-zinc-800 px-4 py-2.5 font-medium text-zinc-300`
- Pill (toggle): active `bg-zinc-100 text-zinc-900`, idle `bg-zinc-800 text-zinc-300 hover:bg-zinc-700`, both `rounded-full px-3 py-1 text-sm font-medium`
- Muted helper text: `text-xs text-zinc-500`
