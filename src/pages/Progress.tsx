import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Dot,
} from 'recharts'
import { db } from '../lib/db'
import { getExercise } from '../lib/catalog/exercises'
import { buildProgressSeries, type ProgressPoint } from '../lib/insights/progress'
import { displayWeight } from '../lib/settings'
import { Card, Empty, Pill, SectionTitle, Stat } from '../components/ui'
import { useSettings } from '../SettingsContext'

type Metric = 'est1RM' | 'topSet' | 'volume'
const METRICS: { key: Metric; label: string; weight: boolean }[] = [
  { key: 'est1RM', label: 'Est. 1RM', weight: true },
  { key: 'topSet', label: 'Top set', weight: true },
  { key: 'volume', label: 'Volume', weight: true },
]

const SERIES = '#4ade80' // green-400: single-series mark, strong on the dark surface
const PR = '#fbbf24' // amber-400: PR highlight
const GRID = '#2c2c2a'
const AXIS = '#898781'

export function Progress() {
  const { settings } = useSettings()
  const [metric, setMetric] = useState<Metric>('est1RM')

  const data = useLiveQuery(async () => {
    const workouts = await db.workouts.orderBy('date').toArray()
    const exercises = await db.exercises.toArray()
    return { workouts, exercises }
  }, [])

  const options = useMemo(() => {
    if (!data) return []
    const ids = new Set<string>()
    for (const e of data.exercises) if (e.canonicalId) ids.add(e.canonicalId)
    return [...ids]
      .map((id) => ({ id, name: getExercise(id)?.name ?? id, count: 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const [selected, setSelected] = useState<string>('')
  const active = selected || options[0]?.id || ''

  const series: ProgressPoint[] = useMemo(() => {
    if (!data || !active) return []
    return buildProgressSeries(data.workouts, data.exercises, active)
  }, [data, active])

  if (!data) return <div className="py-20 text-center text-zinc-500">Loading…</div>
  if (options.length === 0) {
    return (
      <div className="space-y-4">
        <SectionTitle>Progress</SectionTitle>
        <Empty title="No exercises logged yet">Add a workout to start tracking progress.</Empty>
      </div>
    )
  }

  const toDisplay = (p: ProgressPoint) => {
    if (metric === 'volume') return Math.round(displayWeight(p.volume, settings.units) ?? 0)
    if (metric === 'topSet') return displayWeight(p.topSet, settings.units) ?? 0
    return displayWeight(p.est1RM, settings.units) ?? 0
  }
  const chartData = series
    .map((p) => ({ ...p, value: toDisplay(p), label: p.date.slice(5) }))
    // For weight metrics, drop sessions with no parseable weight (would plot as 0).
    .filter((p) => metric === 'volume' || p.value > 0)
  const prCount = series.filter((p) => p.isPR).length
  const best = series.reduce((m, p) => Math.max(m, toDisplay(p)), 0)
  const latest = chartData[chartData.length - 1]?.value ?? 0
  const first = chartData[0]?.value ?? 0
  const delta = latest - first
  const isBodyweight = series.every((p) => p.est1RM === 0)

  return (
    <div className="space-y-4">
      <SectionTitle>Progress</SectionTitle>

      <select
        value={active}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-xl bg-zinc-800 px-3 py-3 font-medium text-zinc-100"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        {METRICS.map((m) => (
          <Pill key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)}>
            {m.label}
          </Pill>
        ))}
      </div>

      {isBodyweight && metric !== 'volume' && (
        <p className="text-xs text-zinc-500">
          Bodyweight exercise — weight-based metrics may be empty; check Volume/reps.
        </p>
      )}

      <Card>
        {chartData.length < 2 ? (
          <p className="py-10 text-center text-sm text-zinc-500">
            Only one session so far. Log more to see a trend.
          </p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: -12 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                />
                <YAxis
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#e4e4e7' }}
                  formatter={(v: number) => [
                    `${v} ${metric === 'volume' ? `${settings.units}·reps` : settings.units}`,
                    METRICS.find((m) => m.key === metric)!.label,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={SERIES}
                  strokeWidth={2}
                  dot={<PrDot />}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Stat label={`Best ${METRICS.find((m) => m.key === metric)!.label}`} value={best} />
        <Stat
          label="Change"
          value={`${delta >= 0 ? '+' : ''}${Math.round(delta)}`}
          sub="first → latest"
        />
        <Stat label="PRs" value={`${prCount}🏆`} />
      </div>
    </div>
  )
}

// PR sessions get an amber dot; others a small series dot.
function PrDot(props: { cx?: number; cy?: number; payload?: ProgressPoint }) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return null
  if (payload?.isPR) return <Dot cx={cx} cy={cy} r={5} fill={PR} stroke="#0a0a0a" strokeWidth={2} />
  return <Dot cx={cx} cy={cy} r={3} fill={SERIES} />
}
