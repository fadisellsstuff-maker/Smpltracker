import { db } from './db'
import { toISODate } from './parser/dates'
import type {
  DraftWorkout,
  ExerciseRecord,
  NoteSource,
  WorkoutRecord,
} from './types'

export interface WorkoutWithExercises extends WorkoutRecord {
  exercises: ExerciseRecord[]
}

/** Persist a reviewed draft workout + its raw note; returns the new workout id. */
export async function saveWorkout(
  draft: DraftWorkout,
  rawText: string,
  source: NoteSource,
): Promise<number> {
  return db.transaction('rw', db.notes, db.workouts, db.exercises, db.userAliases, async () => {
    const usedLlm = draft.exercises.some((e) => e.parsedBy === 'llm')
    const usedRules = draft.exercises.some((e) => e.parsedBy === 'rules')
    const parsedWith = usedLlm && usedRules ? 'mixed' : usedLlm ? 'llm' : 'rules'

    const noteId = (await db.notes.add({ source, rawText, receivedAt: Date.now() })) as number
    const workoutId = (await db.workouts.add({
      date: draft.date,
      title: draft.title,
      noteId,
      parsedWith,
      moved: draft.moved,
    })) as number
    await db.notes.update(noteId, { workoutId })

    const rows: ExerciseRecord[] = draft.exercises
      .filter((e) => e.canonicalId && e.sets.length > 0)
      .map((e) => ({
        workoutId,
        name: e.name,
        canonicalId: e.canonicalId,
        sets: e.sets,
        rawLine: e.rawLine,
      }))
    if (rows.length) await db.exercises.bulkAdd(rows)

    return workoutId
  })
}

/** Learn a user alias so future notes match this name to this exercise. */
export async function learnAlias(alias: string, canonicalId: string): Promise<void> {
  const norm = alias.toLowerCase().trim()
  if (norm) await db.userAliases.put({ alias: norm, canonicalId })
}

export async function getUserAliasMap(): Promise<Map<string, string>> {
  const all = await db.userAliases.toArray()
  return new Map(all.map((a) => [a.alias, a.canonicalId]))
}

export async function getWorkoutsInRange(fromDate: string, toDate: string): Promise<WorkoutRecord[]> {
  return db.workouts.where('date').between(fromDate, toDate, true, true).toArray()
}

export async function getAllWorkouts(): Promise<WorkoutRecord[]> {
  return db.workouts.orderBy('date').toArray()
}

export async function getExercisesForWorkouts(workoutIds: number[]): Promise<ExerciseRecord[]> {
  if (!workoutIds.length) return []
  return db.exercises.where('workoutId').anyOf(workoutIds).toArray()
}

export async function getWorkoutDetail(workoutId: number): Promise<WorkoutWithExercises | undefined> {
  const workout = await db.workouts.get(workoutId)
  if (!workout) return undefined
  const exercises = await db.exercises.where('workoutId').equals(workoutId).toArray()
  return { ...workout, exercises }
}

export async function deleteWorkout(workoutId: number): Promise<void> {
  await db.transaction('rw', db.notes, db.workouts, db.exercises, async () => {
    await db.exercises.where('workoutId').equals(workoutId).delete()
    await db.notes.where('workoutId').equals(workoutId).delete()
    await db.workouts.delete(workoutId)
  })
}

/** ISO date N days before today (inclusive window helper). */
export function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISODate(d)
}

export interface ExportBundle {
  version: 1
  exportedAt: string
  notes: unknown[]
  workouts: unknown[]
  exercises: unknown[]
  userAliases: unknown[]
}

export async function exportAll(): Promise<ExportBundle> {
  const [notes, workouts, exercises, userAliases] = await Promise.all([
    db.notes.toArray(),
    db.workouts.toArray(),
    db.exercises.toArray(),
    db.userAliases.toArray(),
  ])
  return { version: 1, exportedAt: new Date().toISOString(), notes, workouts, exercises, userAliases }
}

export async function importAll(bundle: ExportBundle): Promise<void> {
  await db.transaction('rw', db.notes, db.workouts, db.exercises, db.userAliases, async () => {
    await Promise.all([db.notes.clear(), db.workouts.clear(), db.exercises.clear(), db.userAliases.clear()])
    await db.notes.bulkAdd(bundle.notes as never)
    await db.workouts.bulkAdd(bundle.workouts as never)
    await db.exercises.bulkAdd(bundle.exercises as never)
    await db.userAliases.bulkAdd(bundle.userAliases as never)
  })
}

export async function clearAll(): Promise<void> {
  await Promise.all([db.notes.clear(), db.workouts.clear(), db.exercises.clear(), db.userAliases.clear()])
}
