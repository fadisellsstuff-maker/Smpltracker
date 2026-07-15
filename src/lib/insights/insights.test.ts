import { describe, expect, it } from 'vitest'
import type { ExerciseRecord, WorkoutRecord } from '../types'
import { computeHeatmap } from './heatmap'
import { buildProgressSeries, estimate1RM } from './progress'
import { computeBalance, findNeglected } from './balance'
import { computeStreaks } from './streaks'

function ex(canonicalId: string, sets: { reps: number; weightKg?: number }[], workoutId = 1): ExerciseRecord {
  return { workoutId, name: canonicalId, canonicalId, sets, rawLine: '' }
}

describe('heatmap', () => {
  it('marks a legs session: quads/glutes primary, calves lighter, upper body untrained', () => {
    const exercises = [
      ex('squat', Array.from({ length: 5 }, () => ({ reps: 5, weightKg: 100 }))),
      ex('leg-curl', Array.from({ length: 3 }, () => ({ reps: 10, weightKg: 40 }))),
      ex('calf-raise', [{ reps: 20 }]),
    ]
    const h = computeHeatmap(exercises)
    expect(h.level.quads).toBe('primary')
    expect(h.level.glutes).toBe('primary')
    expect(h.level.hamstrings).toBe('primary') // 3 sets leg curl + squat secondary
    expect(h.level.chest).toBe('untrained')
    expect(h.level.calves).toBe('secondary') // only 1 set
  })
})

describe('progress', () => {
  it('epley 1RM', () => {
    expect(estimate1RM({ reps: 10, weightKg: 100 })).toBeCloseTo(133.3, 1)
    expect(estimate1RM({ reps: 8, weightKg: 0 })).toBe(0)
  })

  it('builds a rising series and flags PRs', () => {
    const workouts: WorkoutRecord[] = [
      { id: 1, date: '2026-06-01', parsedWith: 'rules' },
      { id: 2, date: '2026-06-08', parsedWith: 'rules' },
      { id: 3, date: '2026-06-15', parsedWith: 'rules' },
    ]
    const exercises = [
      ex('bench-press', [{ reps: 5, weightKg: 60 }], 1),
      ex('bench-press', [{ reps: 5, weightKg: 65 }], 2),
      ex('bench-press', [{ reps: 5, weightKg: 62 }], 3),
    ]
    const series = buildProgressSeries(workouts, exercises, 'bench-press')
    expect(series.map((p) => p.topSet)).toEqual([60, 65, 62])
    expect(series[0].isPR).toBe(true) // first is always a PR
    expect(series[1].isPR).toBe(true) // heavier
    expect(series[2].isPR).toBe(false) // lighter than best
  })
})

describe('balance', () => {
  it('splits push/pull/legs and finds neglected muscles', () => {
    const exercises = [
      ex('bench-press', Array.from({ length: 4 }, () => ({ reps: 8, weightKg: 60 }))),
      ex('squat', Array.from({ length: 4 }, () => ({ reps: 5, weightKg: 100 }))),
    ]
    const b = computeBalance(exercises)
    expect(b.split.push).toBeGreaterThan(0)
    expect(b.split.legs).toBeGreaterThan(0)
    expect(b.perMuscle[0].sets).toBeGreaterThan(0)

    const neglected = findNeglected({ chest: '2026-07-13', quads: '2026-07-01' }, '2026-07-14', 10)
    const labels = neglected.map((n) => n.muscle)
    expect(labels).toContain('quads') // 13 days ago
    expect(labels).not.toContain('chest') // 1 day ago
    expect(labels).toContain('biceps') // never trained
  })
})

describe('streaks', () => {
  it('counts consecutive days', () => {
    const workouts: WorkoutRecord[] = [
      { id: 1, date: '2026-07-01', parsedWith: 'rules' },
      { id: 2, date: '2026-07-02', parsedWith: 'rules' },
      { id: 3, date: '2026-07-03', parsedWith: 'rules' },
      { id: 4, date: '2026-07-06', parsedWith: 'rules' },
    ]
    const s = computeStreaks(workouts)
    expect(s.totalSessions).toBe(4)
    expect(s.longestDayStreak).toBe(3)
  })
})
