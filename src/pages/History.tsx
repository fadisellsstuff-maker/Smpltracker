import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { computeStreaks } from '../lib/insights/streaks'
import { formatDMY, toISODate } from '../lib/parser/dates'
import { Card, Empty, SectionTitle, Stat } from '../components/ui'

interface DayInfo {
  ids: number[]
  titles: string[]
  moved: boolean
}

export function History() {
  const [monthOffset, setMonthOffset] = useState(0)

  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [])
  const counts = useLiveQuery(async () => {
    const all = await db.exercises.toArray()
    const byWorkout = new Map<number, number>()
    for (const e of all) byWorkout.set(e.workoutId, (byWorkout.get(e.workoutId) ?? 0) + 1)
    return byWorkout
  }, [])

  // date -> workouts on that day (for calendar tooltips, links, moved dots).
  const byDate = useMemo(() => {
    const map = new Map<string, DayInfo>()
    for (const w of workouts ?? []) {
      const info = map.get(w.date) ?? { ids: [], titles: [], moved: false }
      info.ids.push(w.id!)
      info.titles.push(w.title || 'Workout')
      info.moved = info.moved || !!w.moved
      map.set(w.date, info)
    }
    return map
  }, [workouts])

  if (!workouts) return <div className="py-20 text-center text-zinc-500">Loading…</div>
  if (workouts.length === 0) {
    return (
      <div className="space-y-4">
        <SectionTitle>History</SectionTitle>
        <Empty title="No sessions logged yet">Your workout calendar will appear here.</Empty>
      </div>
    )
  }

  const streaks = computeStreaks(workouts)

  // Anchor the calendar on the most recent workout's month (data may be historical).
  const latest = workouts[0].date
  const anchorYear = +latest.slice(0, 4)
  const anchorMonth = +latest.slice(5, 7) - 1
  const base = new Date(anchorYear, anchorMonth + monthOffset, 1)
  const year = base.getFullYear()
  const month = base.getMonth()
  const monthName = base.toLocaleString('default', { month: 'long', year: 'numeric' })

  const startPad = (new Date(year, month, 1).getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISODate(new Date(year, month, i + 1))),
  ]
  const todayISO = toISODate(new Date())

  return (
    <div className="space-y-5">
      <SectionTitle>History</SectionTitle>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Sessions" value={streaks.totalSessions} />
        <Stat label="Best streak" value={`${streaks.longestDayStreak}d`} />
        <Stat label="Week streak" value={`${streaks.weekStreak}🔥`} />
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="px-3 py-1 text-zinc-400">
            ‹
          </button>
          <span className="text-sm font-medium text-zinc-200">{monthName}</span>
          <button
            onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            disabled={monthOffset >= 0}
            className="px-3 py-1 text-zinc-400 disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-600">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <span key={i} />
            const info = byDate.get(iso)
            const isToday = iso === todayISO
            const dayNum = +iso.slice(8)

            if (!info) {
              return (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-lg text-xs text-zinc-500 ${
                    isToday ? 'ring-1 ring-zinc-400' : ''
                  }`}
                >
                  {dayNum}
                </div>
              )
            }

            const tooltip = `${formatDMY(iso)} — ${info.titles.join(', ')}`
            return (
              <Link
                key={i}
                to={`/workout/${info.ids[0]}`}
                title={tooltip}
                className={`relative flex aspect-square items-center justify-center rounded-lg text-xs font-semibold text-white transition hover:brightness-125 ${
                  isToday ? 'bg-green-500 ring-1 ring-zinc-100' : 'bg-green-500/80'
                }`}
              >
                {dayNum}
                {info.moved && (
                  <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </Link>
            )
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-600">
          Tap a highlighted day to open its workout. <span className="text-amber-400">●</span> = date
          auto-adjusted from a duplicate.
        </p>
      </Card>

      <div className="space-y-2">
        <SectionTitle>Recent sessions</SectionTitle>
        {workouts.slice(0, 30).map((w) => (
          <Link
            key={w.id}
            to={`/workout/${w.id}`}
            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-zinc-700"
          >
            <div>
              <div className="font-medium text-zinc-100">{w.title || 'Workout'}</div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                {w.moved && <span className="text-amber-400">●</span>}
                {formatDMY(w.date)}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              {counts?.get(w.id!) ?? 0} exercises
              <span className="ml-2 text-zinc-600">›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
