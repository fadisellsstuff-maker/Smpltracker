import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { getExercise } from '../lib/catalog/exercises'
import { deleteWorkout, getWorkoutDetail, type WorkoutWithExercises } from '../lib/repo'
import { computeHeatmap } from '../lib/insights/heatmap'
import { formatDMY } from '../lib/parser/dates'
import { displayWeight } from '../lib/settings'
import { MuscleHeatmap } from '../components/MuscleHeatmap/Heatmap'
import { Card } from '../components/ui'
import { useSettings } from '../SettingsContext'

export function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [detail, setDetail] = useState<WorkoutWithExercises | null | undefined>(undefined)
  const [rawNote, setRawNote] = useState<string>('')
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    const wid = Number(id)
    getWorkoutDetail(wid).then(async (d) => {
      setDetail(d ?? null)
      if (d?.noteId != null) {
        const note = await db.notes.get(d.noteId)
        setRawNote(note?.rawText ?? '')
      }
    })
  }, [id])

  if (detail === undefined) return <div className="py-20 text-center text-zinc-500">Loading…</div>
  if (detail === null) return <div className="py-20 text-center text-zinc-500">Workout not found.</div>

  const heat = computeHeatmap(detail.exercises)

  async function handleDelete() {
    if (!confirm('Delete this workout? This cannot be undone.')) return
    await deleteWorkout(Number(id))
    navigate('/history')
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-zinc-400">
        ‹ Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-zinc-50">{detail.title || 'Workout'}</h1>
        <p className="text-sm text-zinc-500">
          {formatDMY(detail.date)} · parsed by {detail.parsedWith}
          {detail.moved && <span className="ml-2 text-amber-400">● date auto-adjusted</span>}
        </p>
      </div>

      <Card>
        <MuscleHeatmap data={heat} />
      </Card>

      <div className="space-y-2">
        {detail.exercises.map((ex) => {
          const cat = ex.canonicalId ? getExercise(ex.canonicalId) : undefined
          return (
            <Card key={ex.id}>
              <div className="flex items-baseline justify-between">
                <span className="font-medium text-zinc-100">{ex.name}</span>
                <span className="text-xs text-zinc-500">{ex.sets.length} sets</span>
              </div>
              {cat && (
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {cat.primary.map((m) => m.replace('-', ' ')).join(', ')}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ex.sets.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 tabular-nums"
                  >
                    {s.weightKg != null ? (
                      <>
                        {displayWeight(s.weightKg, settings.units)}
                        {settings.units}
                        <span className="text-zinc-500"> × {s.reps}</span>
                      </>
                    ) : (
                      <>
                        {s.reps}
                        <span className="text-zinc-500"> reps</span>
                      </>
                    )}
                  </span>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      {rawNote && (
        <Card>
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-sm font-medium text-zinc-400"
          >
            {showRaw ? 'Hide' : 'Show'} original note
          </button>
          {showRaw && (
            <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-500">{rawNote}</pre>
          )}
        </Card>
      )}

      <button
        onClick={handleDelete}
        className="w-full rounded-xl border border-red-900/50 py-3 text-sm font-medium text-red-400"
      >
        Delete workout
      </button>
    </div>
  )
}
