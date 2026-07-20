import type { Muscle } from '../../lib/muscles'
import { SLUG_TO_MUSCLES } from '../../lib/muscles'
import { HEAT_COLORS, type HeatLevel, type HeatmapData } from '../../lib/insights/heatmap'
import { anteriorData, posteriorData, type BodyPolygon } from './bodyData'

const BASE = '#5b6472' // resting body / non-muscle fill (matches HEAT_COLORS.untrained)
const OUTLINE = '#0f1115' // dark seam between muscles for definition

/** Custom polygons for groups the library lacks (lats + side delts). */
interface Overlay {
  muscle: Muscle
  points: string
}
const ANTERIOR_OVERLAYS: Overlay[] = [
  // side delts — outer cap of each shoulder
  { muscle: 'side-delts', points: '17.5 44 23.5 42 25 50 19.5 54.5' },
  { muscle: 'side-delts', points: '82.5 44 76.5 42 75 50 80.5 54.5' },
]
const POSTERIOR_OVERLAYS: Overlay[] = [
  { muscle: 'side-delts', points: '16.5 44 22.5 42 24 50 18.5 54.5' },
  { muscle: 'side-delts', points: '83.5 44 77.5 42 76 50 81.5 54.5' },
  // lats — sweep from under the armpit toward the waist
  { muscle: 'lats', points: '34 58 47.2 71 46.5 92 38 97 30 78 29 66' },
  { muscle: 'lats', points: '66 58 52.8 71 53.5 92 62 97 70 78 71 66' },
]

function levelForSlug(slug: string, data: HeatmapData): HeatLevel {
  const muscles = SLUG_TO_MUSCLES[slug]
  if (!muscles) return 'untrained'
  return muscles.reduce<HeatLevel>((best, m) => {
    const lvl = data.level[m]
    if (lvl === 'primary') return 'primary'
    if (lvl === 'secondary' && best !== 'primary') return 'secondary'
    return best
  }, 'untrained')
}

function fillForSlug(slug: string, data: HeatmapData): string {
  const muscles = SLUG_TO_MUSCLES[slug]
  if (!muscles) return BASE // head/neck/knees
  return HEAT_COLORS[levelForSlug(slug, data)]
}

function BodyView({
  polygons,
  overlays,
  data,
  label,
}: {
  polygons: BodyPolygon[]
  overlays: Overlay[]
  data: HeatmapData
  label: string
}) {
  return (
    <svg viewBox="0 0 100 200" className="h-full w-full" role="img" aria-label={label}>
      {polygons.map((poly) =>
        poly.svgPoints.map((points, i) => (
          <polygon
            key={`${poly.muscle}-${i}`}
            points={points}
            fill={fillForSlug(poly.muscle, data)}
            stroke={OUTLINE}
            strokeWidth={0.4}
          />
        )),
      )}
      {overlays.map((o, i) => (
        <polygon
          key={`ov-${i}`}
          points={o.points}
          fill={HEAT_COLORS[data.level[o.muscle]]}
          stroke={OUTLINE}
          strokeWidth={0.4}
        />
      ))}
    </svg>
  )
}

export function MuscleHeatmap({ data }: { data: HeatmapData }) {
  return (
    <div>
      <div className="flex items-start justify-center gap-4">
        <div className="h-72 w-1/2 max-w-[150px]">
          <BodyView polygons={anteriorData} overlays={ANTERIOR_OVERLAYS} data={data} label="Front muscle map" />
        </div>
        <div className="h-72 w-1/2 max-w-[150px]">
          <BodyView polygons={posteriorData} overlays={POSTERIOR_OVERLAYS} data={data} label="Back muscle map" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-zinc-400">
        <Legend color={HEAT_COLORS.primary} label="Primary" />
        <Legend color={HEAT_COLORS.secondary} label="Secondary" />
        <Legend color={HEAT_COLORS.untrained} label="Untrained" />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
