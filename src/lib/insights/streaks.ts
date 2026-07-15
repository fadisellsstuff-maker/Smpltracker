import { toISODate } from '../parser/dates'
import type { WorkoutRecord } from '../types'

export interface StreakData {
  /** Consecutive weeks (incl. current) with at least one workout. */
  weekStreak: number
  /** Distinct training days in the last 7 days. */
  daysThisWeek: number
  /** Total sessions logged. */
  totalSessions: number
  /** Longest run of consecutive training days ever. */
  longestDayStreak: number
}

function weekKey(iso: string): string {
  // ISO week-ish bucket: year + week number (Monday start).
  const d = new Date(iso + 'T00:00:00')
  const day = (d.getDay() + 6) % 7 // Mon=0
  d.setDate(d.getDate() - day)
  return toISODate(d)
}

export function computeStreaks(workouts: WorkoutRecord[]): StreakData {
  const dates = [...new Set(workouts.map((w) => w.date))].sort()
  const totalSessions = workouts.length

  // Days this week (last 7 calendar days).
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 6)
  const cutoffISO = toISODate(cutoff)
  const daysThisWeek = new Set(dates.filter((d) => d >= cutoffISO)).size

  // Longest consecutive-day streak.
  let longestDayStreak = 0
  let run = 0
  let prev: string | null = null
  for (const d of dates) {
    if (prev && Date.parse(d) - Date.parse(prev) === 86_400_000) run += 1
    else run = 1
    longestDayStreak = Math.max(longestDayStreak, run)
    prev = d
  }

  // Consecutive-week streak ending at the current week.
  const weeks = new Set(dates.map(weekKey))
  let weekStreak = 0
  const cursor = new Date()
  const curDay = (cursor.getDay() + 6) % 7
  cursor.setDate(cursor.getDate() - curDay) // start of this week
  while (weeks.has(toISODate(cursor))) {
    weekStreak += 1
    cursor.setDate(cursor.getDate() - 7)
  }

  return { weekStreak, daysThisWeek, totalSessions, longestDayStreak }
}
