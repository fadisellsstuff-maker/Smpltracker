import type { Muscle } from '../muscles'
import { MUSCLES } from '../muscles'
import type { ExerciseRecord } from '../types'
import { muscleSetLoad } from './volume'

export type HeatLevel = 'untrained' | 'secondary' | 'primary'

export interface HeatmapData {
  /** Raw weighted set load per muscle in the window. */
  load: Record<Muscle, number>
  /** Categorical level matching the reference legend (gray/yellow/red). */
  level: Record<Muscle, HeatLevel>
  /** 0..1 intensity for optional opacity shading. */
  intensity: Record<Muscle, number>
}

/**
 * Turn a window of exercises into heat-map levels.
 * Thresholds are in "weighted sets": <1 untrained, 1–3.5 secondary, >3.5 primary.
 * Intensity scales each muscle against the busiest muscle in the window.
 */
export function computeHeatmap(exercises: ExerciseRecord[]): HeatmapData {
  const load = muscleSetLoad(exercises)
  const max = Math.max(1, ...MUSCLES.map((m) => load[m]))

  const level = {} as Record<Muscle, HeatLevel>
  const intensity = {} as Record<Muscle, number>
  for (const m of MUSCLES) {
    const v = load[m]
    level[m] = v >= 3.5 ? 'primary' : v >= 1 ? 'secondary' : 'untrained'
    intensity[m] = v / max
  }
  return { load, level, intensity }
}

export const HEAT_COLORS: Record<HeatLevel, string> = {
  primary: '#ef4444', // red-500
  secondary: '#f59e0b', // amber-500
  untrained: '#3f3f46', // zinc-700
}
