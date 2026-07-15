import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { getExercise } from '../lib/catalog/exercises'
import { computeBalance, findNeglected } from '../lib/insights/balance'
import { toISODate } from '../lib/parser/dates'
import { daysAgoISO } from '../lib/repo'
import type { Muscle, SplitGroup } from '../lib/muscles'
import { Card, Empty, SectionTitle } from '../components/ui'

const SPLIT_META: { key: SplitGroup; label: string; color: string }[] = [
  { key: 'push', label: 'Push', color: '#f87171' },
  { key: 'pull', label: 'Pull', color: '#60a5fa' },
  { key: 'legs', label: 'Legs', color: '#34d399' },
  { key: 'core', label: 'Core', color: '#fbbf24' },
]

export function Insights() {
  const from30 = daysAgoISO(29)

  const data = useLiveQuery(async () => {
    const workouts = await db.workouts.orderBy('date').toArray()
    const recent = workouts.filter((w) => w.date >= from30)
    const recentIds = recent.map((w) => w.id!).filter(Boolean)
    const recentExercises = recentIds.length
      ? await db.exercises.where('workoutId').anyOf(recentIds).toArray()
      : []
    const allExercises = await db.exercises.toArray()
    return { workouts, recentExercises, allExercises }
  }, [from30])

  const lastTrained = useMemo(() => {
    if (!data) return {}
    const dateById = new Map<number, string>()
    for (const w of data.workouts) if (w.id != null) dateById.set(w.id, w.date)
    const map: Partial<Record<Muscle, string>> = {}
    for (const ex of data.allExercises) {
      if (!ex.canonicalId) continue
      const cat = getExercise(ex.canonicalId)
      const date = dateById.get(ex.workoutId)
      if (!cat || !date) continue
      for (const m of cat.primary) {
        if (!map[m] || date > map[m]!) map[m] = date
      }
    }
    return map
  }, [data])

  if (!data) return <div className="py-20 text-center text-zinc-500">Loading…</div>
  if (data.workouts.length === 0) {
    return (
      <div className="space-y-4">
        <SectionTitle>Insights</SectionTitle>
        <Empty title="No data yet">Log a few workouts to see training balance.</Empty>
      </div>
    )
  }

  const balance = computeBalance(data.recentExercises)
  const totalSplit = SPLIT_META.reduce((s, m) => s + balance.split[m.key], 0) || 1
  const neglected = findNeglected(lastTrained, toISODate(new Date()), 10)
  const maxMuscle = Math.max(1, ...balance.perMuscle.map((m) => m.sets))

  return (
    <div className="space-y-5">
      <SectionTitle hint="last 30 days">Training balance</SectionTitle>

      <Card>
        <div className="mb-3 flex h-4 overflow-hidden rounded-full bg-zinc-800">
          {SPLIT_META.map((m) => {
            const pct = (balance.split[m.key] / totalSplit) * 100
            return pct > 0 ? (
              <div
                key={m.key}
                style={{ width: `${pct}%`, background: m.color }}
                className="h-full"
                title={`${m.label} ${Math.round(pct)}%`}
              />
            ) : null
          })}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {SPLIT_META.map((m) => (
            <div key={m.key}>
              <div className="text-lg font-bold text-zinc-50 tabular-nums">
                {Math.round((balance.split[m.key] / totalSplit) * 100)}%
              </div>
              <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-400">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.color }} />
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {neglected.length > 0 && (
        <Card className="border-amber-900/40 bg-amber-950/10">
          <SectionTitle>Neglected muscles</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {neglected.map((n) => (
              <span
                key={n.muscle}
                className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-amber-300"
              >
                {n.label}
                <span className="ml-1 text-zinc-500">
                  {n.daysSince === null ? 'never' : `${n.daysSince}d`}
                </span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            No primary work in 10+ days. SmplTrack just shows the gaps — what you do about them is
            up to you.
          </p>
        </Card>
      )}

      <Card>
        <SectionTitle hint="weighted sets">Volume per muscle</SectionTitle>
        <div className="space-y-1.5">
          {balance.perMuscle
            .filter((m) => m.sets > 0)
            .map((m) => (
              <div key={m.muscle} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-zinc-400">{m.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-red-400"
                    style={{ width: `${(m.sets / maxMuscle) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-zinc-500 tabular-nums">{m.sets}</span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}
