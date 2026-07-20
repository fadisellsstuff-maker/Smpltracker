# Shared UI Components — SmplTrack

The only shared primitive module is `src/components/ui.tsx`. Everything else is a
page component or the muscle heat map. Full source below.

## `src/components/ui.tsx`
Primitives: `Card`, `SectionTitle`, `Stat`, `Empty`, `Pill`.
```tsx
import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase">{children}</h2>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-zinc-800/50 px-3 py-2.5">
      <div className="text-2xl font-bold text-zinc-50 tabular-nums">{value}</div>
      <div className="text-xs text-zinc-400">{label}</div>
      {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center">
      <p className="text-zinc-300 font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-zinc-500">{children}</div>}
    </div>
  )
}

export function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}
```

## `src/components/MuscleHeatmap/Heatmap.tsx`
Anterior + posterior body figures drawn from vendored SVG polygon data
(`bodyData.ts`, from react-body-highlighter, MIT), colored by heat level, with
hand-added lat + side-delt overlays and a legend. Takes `data: HeatmapData`
(`{ level: Record<Muscle, 'primary'|'secondary'|'untrained'>, ... }`).
```tsx
import type { Muscle } from '../../lib/muscles'
import { SLUG_TO_MUSCLES } from '../../lib/muscles'
import { HEAT_COLORS, type HeatLevel, type HeatmapData } from '../../lib/insights/heatmap'
import { anteriorData, posteriorData, type BodyPolygon } from './bodyData'

const BASE = '#3f3f46'   // untrained / non-muscle fill
const OUTLINE = '#18181b'

interface Overlay { muscle: Muscle; points: string }
const ANTERIOR_OVERLAYS: Overlay[] = [
  { muscle: 'side-delts', points: '17.5 44 23.5 42 25 50 19.5 54.5' },
  { muscle: 'side-delts', points: '82.5 44 76.5 42 75 50 80.5 54.5' },
]
const POSTERIOR_OVERLAYS: Overlay[] = [
  { muscle: 'side-delts', points: '16.5 44 22.5 42 24 50 18.5 54.5' },
  { muscle: 'side-delts', points: '83.5 44 77.5 42 76 50 81.5 54.5' },
  { muscle: 'lats', points: '34 58 47.2 71 46.5 92 38 97 30 78 29 66' },
  { muscle: 'lats', points: '66 58 52.8 71 53.5 92 62 97 70 78 71 66' },
]

// ...maps each polygon slug -> our Muscle(s) -> max HeatLevel -> HEAT_COLORS.
// Renders two <svg viewBox="0 0 100 200"> side by side (h-72, max-w-[150px] each)
// plus a legend row: Primary (red) / Secondary (amber) / Untrained (gray).
export function MuscleHeatmap({ data }: { data: HeatmapData }) { /* see file */ }
```

> Note: `Card` + `Stat` + `SectionTitle` + `Pill` are used on nearly every page.
> The dashboard, insights, history and workout-detail screens are built almost
> entirely from these four primitives plus Recharts and the heat map.
