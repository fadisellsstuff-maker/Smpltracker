import { parseNote } from './parser'
import { saveWorkout } from './repo'
import { toISODate } from './parser/dates'

/**
 * Generate ~6 weeks of realistic demo notes (PPL split, 4 days/week) with
 * gradually increasing weights, then parse + save them so the app looks alive.
 */
export async function seedDemoData(): Promise<number> {
  const today = new Date()
  const sessions: { daysAgo: number; note: string }[] = []

  const weeks = 6
  for (let w = 0; w < weeks; w++) {
    const prog = weeks - 1 - w // older weeks = smaller weights
    const bench = 55 + prog * 2.5
    const squat = 90 + prog * 5
    const dead = 110 + prog * 5
    const ohp = 35 + prog * 1.5
    const row = 60 + prog * 2.5

    const base = (today.getDay() + 6) % 7
    const monday = w * 7 + base

    sessions.push({
      daysAgo: monday, // Push
      note: `Push day
Bench press 4x8 @${bench}kg
Overhead press 3x8 @${ohp}kg
Incline db press 22.5 x 10,10,8
Lateral raises 4x15
Tricep pushdowns 3x12
Dips bw x12,10,8`,
    })
    sessions.push({
      daysAgo: monday - 2, // Pull
      note: `Pull day
Deadlift 3x5 @${dead}kg
Barbell row 4x8 @${row}kg
Lat pulldown 3x10 @55
Pull ups bw x8,7,6
Bicep curls 3x12 @14
Face pulls 3x15`,
    })
    sessions.push({
      daysAgo: monday - 4, // Legs
      note: `Leg day
Squats 5x5 @${squat}kg
Romanian deadlift 3x10 @${dead - 40}kg
Leg press 200 x 12,12,10
Leg curls 3x12 @40
Calf raises 4x20`,
    })
    if (w % 2 === 0) {
      sessions.push({
        daysAgo: monday - 5, // extra upper
        note: `Upper accessory
Incline bench 3x10 @${bench - 10}kg
Cable row 3x12 @50
Hammer curls 3x12 @16
Overhead tricep extension 3x15
Planks 60s`,
      })
    }
  }

  let saved = 0
  for (const s of sessions) {
    if (s.daysAgo < 0) continue
    const d = new Date(today)
    d.setDate(d.getDate() - s.daysAgo)
    const noteWithDate = `${s.note}`
    const draft = parseNote(noteWithDate, { receivedAt: d })
    draft.date = toISODate(d)
    const valid = draft.exercises.filter((e) => e.canonicalId && e.sets.length > 0)
    if (valid.length === 0) continue
    await saveWorkout({ ...draft, exercises: valid }, s.note, 'seed')
    saved++
  }
  return saved
}
