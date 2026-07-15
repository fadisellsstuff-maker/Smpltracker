import Dexie, { type EntityTable } from 'dexie'
import type { ExerciseRecord, NoteRecord, UserAliasRecord, WorkoutRecord } from './types'

export const db = new Dexie('smpltrack') as Dexie & {
  notes: EntityTable<NoteRecord, 'id'>
  workouts: EntityTable<WorkoutRecord, 'id'>
  exercises: EntityTable<ExerciseRecord, 'id'>
  userAliases: EntityTable<UserAliasRecord, 'alias'>
}

db.version(1).stores({
  notes: '++id, receivedAt, workoutId',
  workouts: '++id, date, noteId',
  exercises: '++id, workoutId, canonicalId',
  userAliases: 'alias',
})
