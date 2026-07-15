import type { Muscle, SplitGroup } from '../muscles'
import { MUSCLES, MUSCLE_LABELS, MUSCLE_SPLIT } from '../muscles'
import type { ExerciseRecord } from '../types'
import { muscleSetLoad } from './volume'

export interface BalanceData {
  /** Weighted set load per push/pull/legs/core group. */
  split: Record<SplitGroup, number>
  /** Weighted set load per muscle, high to low. */
  perMuscle: { muscle: Muscle; label: string; sets: number }[]
}

export function computeBalance(exercises: ExerciseRecord[]): BalanceData {
  const load = muscleSetLoad(exercises)
  const split: Record<SplitGroup, number> = { push: 0, pull: 0, legs: 0, core: 0 }
  for (const m of MUSCLES) split[MUSCLE_SPLIT[m]] += load[m]

  const perMuscle = MUSCLES.map((m) => ({
    muscle: m,
    label: MUSCLE_LABELS[m],
    sets: Math.round(load[m] * 10) / 10,
  })).sort((a, b) => b.sets - a.sets)

  return { split, perMuscle }
}

export interface NeglectedMuscle {
  muscle: Muscle
  label: string
  daysSince: number | null // null = never trained in the loaded history
}

/**
 * Muscles not trained (as a primary mover) within `thresholdDays`.
 * `lastTrained` maps muscle -> most recent ISO date it was a primary target.
 */
export function findNeglected(
  lastTrained: Partial<Record<Muscle, string>>,
  today: string,
  thresholdDays = 10,
): NeglectedMuscle[] {
  const todayMs = Date.parse(today)
  const out: NeglectedMuscle[] = []
  for (const m of MUSCLES) {
    const last = lastTrained[m]
    const daysSince = last ? Math.round((todayMs - Date.parse(last)) / 86_400_000) : null
    if (daysSince === null || daysSince >= thresholdDays) {
      out.push({ muscle: m, label: MUSCLE_LABELS[m], daysSince })
    }
  }
  return out.sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
}
