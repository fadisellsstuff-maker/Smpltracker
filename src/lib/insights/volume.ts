import { getExercise } from '../catalog/exercises'
import type { Muscle } from '../muscles'
import { MUSCLES } from '../muscles'
import type { ExerciseRecord, SetEntry } from '../types'

/** Total reps × weight (kg) for a set; bodyweight sets count as reps only. */
export function setVolume(s: SetEntry): number {
  return s.reps * (s.weightKg ?? 1)
}

/** Number of working sets across an exercise. */
export function setCount(ex: Pick<ExerciseRecord, 'sets'>): number {
  return ex.sets.length
}

/**
 * Weighted set contribution per muscle: a primary muscle gets the full set,
 * a secondary muscle gets half. This drives heat-map intensity.
 */
export function muscleSetLoad(exercises: ExerciseRecord[]): Record<Muscle, number> {
  const load = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  for (const ex of exercises) {
    if (!ex.canonicalId) continue
    const cat = getExercise(ex.canonicalId)
    if (!cat) continue
    const sets = ex.sets.length
    for (const m of cat.primary) load[m] += sets
    for (const m of cat.secondary) load[m] += sets * 0.5
  }
  return load
}

/** Tonnage (reps × kg) per muscle, primary full / secondary half. */
export function muscleTonnage(exercises: ExerciseRecord[]): Record<Muscle, number> {
  const load = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  for (const ex of exercises) {
    if (!ex.canonicalId) continue
    const cat = getExercise(ex.canonicalId)
    if (!cat) continue
    const vol = ex.sets.reduce((sum, s) => sum + setVolume(s), 0)
    for (const m of cat.primary) load[m] += vol
    for (const m of cat.secondary) load[m] += vol * 0.5
  }
  return load
}
