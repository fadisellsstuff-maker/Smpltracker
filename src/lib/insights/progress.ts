import type { ExerciseRecord, SetEntry, WorkoutRecord } from '../types'

/** Epley estimated 1-rep-max. Bodyweight sets (no weight) return 0. */
export function estimate1RM(set: SetEntry): number {
  if (!set.weightKg) return 0
  return set.weightKg * (1 + set.reps / 30)
}

export function topSetWeight(sets: SetEntry[]): number {
  return sets.reduce((max, s) => Math.max(max, s.weightKg ?? 0), 0)
}

export function best1RM(sets: SetEntry[]): number {
  return sets.reduce((max, s) => Math.max(max, estimate1RM(s)), 0)
}

export function totalVolume(sets: SetEntry[]): number {
  return sets.reduce((sum, s) => sum + s.reps * (s.weightKg ?? 0), 0)
}

export function totalReps(sets: SetEntry[]): number {
  return sets.reduce((sum, s) => sum + s.reps, 0)
}

export interface ProgressPoint {
  date: string
  topSet: number
  est1RM: number
  volume: number
  reps: number
  /** True when this session set a new best estimated 1RM (or reps, if bodyweight). */
  isPR: boolean
}

/**
 * Build a per-date progress series for a single exercise (by canonicalId).
 * `exercisesByWorkout` maps workoutId -> that workout's matching exercise rows.
 */
export function buildProgressSeries(
  workouts: WorkoutRecord[],
  exercises: ExerciseRecord[],
  canonicalId: string,
): ProgressPoint[] {
  const dateById = new Map<number, string>()
  for (const w of workouts) if (w.id != null) dateById.set(w.id, w.date)

  // Group the target exercise's sets by workout date.
  const byDate = new Map<string, SetEntry[]>()
  for (const ex of exercises) {
    if (ex.canonicalId !== canonicalId) continue
    const date = dateById.get(ex.workoutId)
    if (!date) continue
    const arr = byDate.get(date) ?? []
    arr.push(...ex.sets)
    byDate.set(date, arr)
  }

  const points = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sets]) => ({
      date,
      topSet: topSetWeight(sets),
      est1RM: Math.round(best1RM(sets) * 10) / 10,
      volume: totalVolume(sets),
      reps: totalReps(sets),
      isPR: false,
    }))

  // Flag PRs: weighted -> best est1RM so far; bodyweight -> best single-session reps.
  const isBodyweight = points.every((p) => p.est1RM === 0)
  let best = 0
  for (const p of points) {
    const metric = isBodyweight ? p.reps : p.est1RM
    if (metric > best + 1e-9) {
      p.isPR = true
      best = metric
    }
  }
  return points
}
