import { useMemo } from 'react'
import { EXERCISE_CATALOG } from '../lib/catalog/exercises'
import { MUSCLE_LABELS } from '../lib/muscles'
import type { DraftExercise, DraftWorkout } from '../lib/types'
import { getExercise } from '../lib/catalog/exercises'
import { displayWeight, type Units } from '../lib/settings'
import { Card } from './ui'

const CATALOG_OPTIONS = [...EXERCISE_CATALOG]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((e) => ({ id: e.id, name: e.name }))

interface Props {
  draft: DraftWorkout
  units: Units
  onChange: (draft: DraftWorkout) => void
}

/** Editable review of a parsed workout before saving. */
export function ReviewWorkout({ draft, units, onChange }: Props) {
  const setEx = (idx: number, patch: Partial<DraftExercise>) => {
    const exercises = draft.exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e))
    onChange({ ...draft, exercises })
  }
  const removeEx = (idx: number) =>
    onChange({ ...draft, exercises: draft.exercises.filter((_, i) => i !== idx) })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-zinc-400">
          Date
          <input
            type="date"
            value={draft.date}
            onChange={(e) => onChange({ ...draft, date: e.target.value })}
            className="mt-1 w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="text-xs text-zinc-400">
          Title
          <input
            type="text"
            value={draft.title ?? ''}
            placeholder="Workout"
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            className="mt-1 w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </div>

      {draft.exercises.map((ex, idx) => (
        <ExerciseRow
          key={idx}
          ex={ex}
          units={units}
          onPatch={(patch) => setEx(idx, patch)}
          onRemove={() => removeEx(idx)}
        />
      ))}

      {draft.unparsedLines.length > 0 && (
        <Card className="border-amber-900/50 bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-400">Couldn't parse these lines</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            {draft.unparsedLines.map((l, i) => (
              <li key={i} className="truncate">
                • {l}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function ExerciseRow({
  ex,
  units,
  onPatch,
  onRemove,
}: {
  ex: DraftExercise
  units: Units
  onPatch: (patch: Partial<DraftExercise>) => void
  onRemove: () => void
}) {
  const muscles = useMemo(() => {
    if (!ex.canonicalId) return null
    const cat = getExercise(ex.canonicalId)
    if (!cat) return null
    return cat.primary.map((m) => MUSCLE_LABELS[m]).join(', ')
  }, [ex.canonicalId])

  const setSet = (i: number, patch: Partial<{ reps: number; weightKg?: number }>) =>
    onPatch({ sets: ex.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const addSet = () => {
    const last = ex.sets[ex.sets.length - 1] ?? { reps: 10 }
    onPatch({ sets: [...ex.sets, { ...last }] })
  }
  const removeSet = (i: number) => onPatch({ sets: ex.sets.filter((_, j) => j !== i) })

  const unmatched = !ex.canonicalId

  return (
    <Card className={unmatched ? 'border-amber-900/50' : ''}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <select
            value={ex.canonicalId ?? ''}
            onChange={(e) => {
              const id = e.target.value || undefined
              onPatch({
                canonicalId: id,
                name: id ? getExercise(id)!.name : ex.rawLine,
              })
            }}
            className={`w-full rounded-lg bg-zinc-800 px-2 py-2 text-sm font-medium ${
              unmatched ? 'text-amber-300' : 'text-zinc-100'
            }`}
          >
            <option value="">— pick exercise ({ex.rawLine.slice(0, 24)}) —</option>
            {CATALOG_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {muscles && <p className="mt-1 text-[11px] text-zinc-500">{muscles}</p>}
        </div>
        <button
          onClick={onRemove}
          className="rounded-lg px-2 py-2 text-zinc-500 hover:text-red-400"
          aria-label="Remove exercise"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {ex.sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-right text-xs text-zinc-500">{i + 1}</span>
            <input
              type="number"
              step="0.5"
              value={displayWeight(s.weightKg, units) ?? ''}
              placeholder="BW"
              onChange={(e) => {
                const val = e.target.value
                if (val === '') return setSet(i, { weightKg: undefined })
                const kg = units === 'lbs' ? +val * 0.45359237 : +val
                setSet(i, { weightKg: Math.round(kg * 10) / 10 })
              }}
              className="w-20 rounded-md bg-zinc-800 px-2 py-1 text-center tabular-nums"
            />
            <span className="text-xs text-zinc-500">{units}</span>
            <input
              type="number"
              value={s.reps}
              onChange={(e) => setSet(i, { reps: +e.target.value })}
              className="w-16 rounded-md bg-zinc-800 px-2 py-1 text-center tabular-nums"
            />
            <span className="text-xs text-zinc-500">reps</span>
            <button
              onClick={() => removeSet(i)}
              className="ml-auto text-xs text-zinc-600 hover:text-red-400"
            >
              remove
            </button>
          </div>
        ))}
      </div>
      <button onClick={addSet} className="mt-2 text-xs font-medium text-green-400 hover:text-green-300">
        + add set
      </button>
    </Card>
  )
}
