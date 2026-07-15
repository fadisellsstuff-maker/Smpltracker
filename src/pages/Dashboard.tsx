import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { daysAgoISO } from '../lib/repo'
import { computeHeatmap } from '../lib/insights/heatmap'
import { computeStreaks } from '../lib/insights/streaks'
import { muscleSetLoad } from '../lib/insights/volume'
import { MUSCLES } from '../lib/muscles'
import { MuscleHeatmap } from '../components/MuscleHeatmap/Heatmap'
import { Card, Empty, Pill, SectionTitle, Stat } from '../components/ui'
import { useSettings } from '../SettingsContext'

export function Dashboard() {
  const { settings, update } = useSettings()
  const windowDays = settings.heatWindowDays
  const from = daysAgoISO(windowDays - 1)

  const data = useLiveQuery(async () => {
    const allWorkouts = await db.workouts.orderBy('date').toArray()
    const windowWorkouts = allWorkouts.filter((w) => w.date >= from)
    const ids = windowWorkouts.map((w) => w.id!).filter(Boolean)
    const exercises = ids.length ? await db.exercises.where('workoutId').anyOf(ids).toArray() : []
    return { allWorkouts, windowWorkouts, exercises }
  }, [from])

  if (!data) return <div className="py-20 text-center text-zinc-500">Loading…</div>

  if (data.allWorkouts.length === 0) {
    return (
      <div className="space-y-4">
        <SectionTitle>Muscle Map</SectionTitle>
        <Empty title="No workouts yet">
          <p>
            Add your first note on the <Link to="/add" className="text-red-400">Add</Link> tab, or
            load demo data from <Link to="/settings" className="text-red-400">Settings</Link> to see
            how it looks.
          </p>
        </Empty>
      </div>
    )
  }

  const heat = computeHeatmap(data.exercises)
  const streaks = computeStreaks(data.allWorkouts)
  const load = muscleSetLoad(data.exercises)
  const totalSets = MUSCLES.reduce((s, m) => s + Math.round(load[m]), 0)
  const trainedCount = MUSCLES.filter((m) => heat.level[m] !== 'untrained').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionTitle>Muscle Map</SectionTitle>
        <div className="flex gap-2">
          <Pill active={windowDays === 7} onClick={() => update({ heatWindowDays: 7 })}>
            7d
          </Pill>
          <Pill active={windowDays === 30} onClick={() => update({ heatWindowDays: 30 })}>
            30d
          </Pill>
        </div>
      </div>

      <Card>
        <MuscleHeatmap data={heat} />
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Sessions" value={streaks.totalSessions} />
        <Stat label="This week" value={`${streaks.daysThisWeek}d`} sub="days trained" />
        <Stat label="Week streak" value={`${streaks.weekStreak}🔥`} />
      </div>

      <Card>
        <SectionTitle hint={`${windowDays}d window`}>Coverage</SectionTitle>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-zinc-50">{trainedCount}</span>
          <span className="text-zinc-400">/ {MUSCLES.length} muscle groups hit</span>
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          {Math.round(totalSets)} weighted sets logged in the last {windowDays} days.
        </div>
      </Card>
    </div>
  )
}
