import { describe, expect, it } from 'vitest'
import { parseNote, parseNotes } from './index'
import { parseSets } from './sets'
import { matchExercise } from './matcher'
import { detectDate } from './dates'

describe('parseSets', () => {
  it('parses NxR', () => {
    expect(parseSets('3x8')).toEqual({ sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }], unit: undefined })
  })

  it('parses NxR with weight after @', () => {
    const r = parseSets('3x8 @60kg')
    expect(r.sets).toEqual([
      { reps: 8, weightKg: 60 },
      { reps: 8, weightKg: 60 },
      { reps: 8, weightKg: 60 },
    ])
    expect(r.unit).toBe('kg')
  })

  it('parses weight-first "60kg 3x8"', () => {
    const r = parseSets('60kg 3x8')
    expect(r.sets.length).toBe(3)
    expect(r.sets.every((s) => s.weightKg === 60 && s.reps === 8)).toBe(true)
  })

  it('parses "3 sets of 10"', () => {
    expect(parseSets('3 sets of 10').sets).toEqual([{ reps: 10 }, { reps: 10 }, { reps: 10 }])
  })

  it('parses weight x rep chain "100x5,5,5"', () => {
    const r = parseSets('100x5,5,5')
    // 100 is weight, 5/5/5 reps
    expect(r.sets).toEqual([
      { reps: 5, weightKg: 100 },
      { reps: 5, weightKg: 100 },
      { reps: 5, weightKg: 100 },
    ])
  })

  it('parses rep list with weight "10,8,6 @ 22.5"', () => {
    const r = parseSets('10,8,6 @ 22.5')
    expect(r.sets).toEqual([
      { reps: 10, weightKg: 22.5 },
      { reps: 8, weightKg: 22.5 },
      { reps: 6, weightKg: 22.5 },
    ])
  })

  it('parses slash rep list "8/8/6"', () => {
    expect(parseSets('8/8/6').sets.map((s) => s.reps)).toEqual([8, 8, 6])
  })

  it('converts lbs to kg', () => {
    const r = parseSets('bench 135lbs 5x5')
    expect(r.unit).toBe('lbs')
    expect(r.sets[0].weightKg).toBeCloseTo(61.2, 1)
  })

  it('parses bodyweight rep chain "10x8x6" as reps', () => {
    // three numbers, none > 12 -> treat as reps
    const r = parseSets('10x8x6')
    expect(r.sets.map((s) => s.reps)).toEqual([10, 8, 6])
  })

  it('parses time-based plank when bodyweight', () => {
    const r = parseSets('60s', true)
    expect(r.sets).toEqual([{ reps: 60 }])
  })
})

describe('matchExercise', () => {
  it('matches abbreviations', () => {
    expect(matchExercise('bp')).toBe('bench-press')
    expect(matchExercise('ohp')).toBe('overhead-press')
    expect(matchExercise('rdl')).toBe('romanian-deadlift')
  })

  it('matches with filler words', () => {
    expect(matchExercise('some curls')).toBe('bicep-curl')
    expect(matchExercise('heavy squats')).toBe('squat')
  })

  it('tolerates typos', () => {
    expect(matchExercise('benchpres')).toBe('bench-press')
    expect(matchExercise('deadlfit')).toBe('deadlift')
  })

  it('respects user aliases', () => {
    const ua = new Map([['thing', 'bench-press']])
    expect(matchExercise('thing', ua)).toBe('bench-press')
  })

  it('returns undefined for gibberish', () => {
    expect(matchExercise('qwertyuiop asdf')).toBeUndefined()
  })

  it('expands bb/db/ez abbreviations', () => {
    expect(matchExercise('bb row')).toBe('barbell-row')
    expect(matchExercise('db bench')).toBe('db-bench-press')
    expect(matchExercise('db curl')).toBe('bicep-curl')
    expect(matchExercise('ez curls')).toBe('bicep-curl')
  })
})

describe('weighted & assisted bodyweight', () => {
  it('parses "(26)x7x2" as 2 sets of 7 at +26kg', () => {
    expect(parseSets('(26)x7x2').sets).toEqual([
      { reps: 7, weightKg: 26 },
      { reps: 7, weightKg: 26 },
    ])
  })

  it('parses "(19kg)x6x3" with a unit inside the parens', () => {
    const r = parseSets('(19kg)x6x3')
    expect(r.sets).toHaveLength(3)
    expect(r.sets[0]).toEqual({ reps: 6, weightKg: 19 })
  })

  it('logs assisted pull-ups as bodyweight (weight ignored)', () => {
    const w = parseNote('[v] pull ups 3x8 26kg ass')
    const ex = w.exercises.find((e) => e.canonicalId === 'pull-up')!
    expect(ex.sets).toHaveLength(3)
    expect(ex.sets.every((s) => s.weightKg === undefined)).toBe(true)
  })

  it('logs weighted dips (no "ass") with added load', () => {
    const w = parseNote('[v] dips (26)x7x2')
    const ex = w.exercises.find((e) => e.canonicalId === 'dip')!
    expect(ex.sets).toEqual([
      { reps: 7, weightKg: 26 },
      { reps: 7, weightKg: 26 },
    ])
  })
})

describe('detectDate', () => {
  const fb = new Date(2026, 6, 14) // 2026-07-14

  it('reads ISO date', () => {
    expect(detectDate('2026-03-02 push day', fb)).toBe('2026-03-02')
  })
  it('reads day-first slash date', () => {
    expect(detectDate('Push 12/03', fb)).toBe('2026-03-12')
  })
  it('reads "23 Jul @ 6:55 PM"', () => {
    expect(detectDate('23 Jul @ 6:55 PM', fb)).toBe('2026-07-23')
  })
  it('falls back to receivedAt', () => {
    expect(detectDate('leg day', fb)).toBe('2026-07-14')
  })
})

describe('parseNote (end to end)', () => {
  it('parses a realistic push-day note', () => {
    const note = `Push day 12/07
Bench press 3x8 @60kg
incline db press 22.5 x 10,8,8
lateral raises 4x15
tricep pushdowns 3x12
some dips bw x12x10x8`
    const w = parseNote(note, { receivedAt: new Date(2026, 6, 14) })
    expect(w.date).toBe('2026-07-12')
    expect(w.title?.toLowerCase()).toContain('push')
    const names = w.exercises.map((e) => e.canonicalId)
    expect(names).toContain('bench-press')
    expect(names).toContain('incline-db-press')
    expect(names).toContain('lateral-raise')
    expect(names).toContain('tricep-pushdown')
    expect(names).toContain('dip')
    const bench = w.exercises.find((e) => e.canonicalId === 'bench-press')!
    expect(bench.sets).toHaveLength(3)
    expect(bench.sets[0]).toEqual({ reps: 8, weightKg: 60 })
  })

  it('parses a messy legs note with typos and mixed formats', () => {
    const note = `leg day
squats 100kg 5x5
rdls 3 sets of 10 @80
leg press 200 x 12,12,10
calf raises 4x20
walking lunges 3x20`
    const w = parseNote(note)
    const ids = w.exercises.map((e) => e.canonicalId)
    expect(ids).toEqual(
      expect.arrayContaining(['squat', 'romanian-deadlift', 'leg-press', 'calf-raise', 'lunge']),
    )
    const squat = w.exercises.find((e) => e.canonicalId === 'squat')!
    expect(squat.sets).toHaveLength(5)
    expect(squat.sets[0].weightKg).toBe(100)
  })

  it('logs only checked [v] items and skips [ ]', () => {
    const note = `Upper day
[v] Bench press 3x8 40kg
[ ] Lat pulldowns 3x10
[v] Pull ups 3x8`
    const w = parseNote(note)
    const ids = w.exercises.map((e) => e.canonicalId)
    expect(ids).toContain('bench-press')
    expect(ids).toContain('pull-up')
    expect(ids).not.toContain('lat-pulldown') // unchecked → not done
  })

  it('reads "3x8,5,5 30,40kg" as 3 sets of 8,5,5 at the working weight', () => {
    const w = parseNote(`[v] bench 3x8,5,5 30,40kg`)
    const bench = w.exercises.find((e) => e.canonicalId === 'bench-press')!
    expect(bench.sets.map((s) => s.reps)).toEqual([8, 5, 5])
    expect(bench.sets[0].weightKg).toBe(40)
  })

  it('reads "25p" per-dumbbell weight and 4x8 sets', () => {
    const w = parseNote(`[v] incline db press 4x8 25p`)
    const ex = w.exercises.find((e) => e.canonicalId === 'incline-db-press')!
    expect(ex.sets).toHaveLength(4)
    expect(ex.sets[0]).toEqual({ reps: 8, weightKg: 25 })
  })

  it('does not read a large leading number as a set count ("25x10")', () => {
    // "25x10" = 25 kg for 10 reps, not 25 sets
    expect(parseSets('leg curl 25x10').sets).toEqual([{ reps: 10, weightKg: 25 }])
  })

  it('flags unparseable lines instead of dropping them', () => {
    const note = `Bench 3x8 @60
did some weird machine thing that has no name`
    const w = parseNote(note)
    const hasUnparsed =
      w.unparsedLines.length > 0 || w.exercises.some((e) => e.parsedBy === 'unparsed')
    expect(hasUnparsed).toBe(true)
    // The good line still parsed.
    expect(w.exercises.some((e) => e.canonicalId === 'bench-press')).toBe(true)
  })
})

describe('parseNotes (multi-workout history)', () => {
  it('splits a log into one workout per dated header', () => {
    const log = `27/1/23 Fri
Upper
[v] Bench 3x8 40kg
[v] Pull ups 3x8

28/1/23 Sat
Lower
[v] Squats 3x6 60kg
[v] RDL 3x10 50kg`
    const blocks = parseNotes(log)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].draft.date).toBe('2023-01-27')
    expect(blocks[1].draft.date).toBe('2023-01-28')
    expect(blocks[0].draft.exercises.map((e) => e.canonicalId)).toContain('bench-press')
    expect(blocks[1].draft.exercises.map((e) => e.canonicalId)).toContain('squat')
  })

  it('returns a single block for a note with no date headers', () => {
    const blocks = parseNotes(`Bench 3x8 40kg\nPull ups 3x8`)
    expect(blocks).toHaveLength(1)
  })
})
