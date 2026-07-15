import type { Muscle } from './muscles'

export type NoteSource = 'share' | 'paste' | 'file' | 'seed'

export interface NoteRecord {
  id?: number
  source: NoteSource
  rawText: string
  receivedAt: number // epoch ms
  workoutId?: number
}

export type ParsedWith = 'rules' | 'llm' | 'mixed'

export interface SetEntry {
  reps: number
  /** Always stored in kg; undefined = bodyweight / unweighted. */
  weightKg?: number
}

export interface ExerciseRecord {
  id?: number
  workoutId: number
  /** Display name as the user wrote it (cleaned up). */
  name: string
  /** Catalog id when matched; undefined when unrecognized. */
  canonicalId?: string
  sets: SetEntry[]
  rawLine: string
}

export interface WorkoutRecord {
  id?: number
  /** Workout date as YYYY-MM-DD (local). */
  date: string
  title?: string
  noteId?: number
  parsedWith: ParsedWith
  /** True when the date was auto-adjusted from a duplicate (forgotten date change). */
  moved?: boolean
}

/** User-taught alias -> canonical exercise id, learned from review-screen corrections. */
export interface UserAliasRecord {
  alias: string // normalized
  canonicalId: string
}

export interface CatalogExercise {
  id: string
  name: string
  aliases: string[]
  primary: Muscle[]
  secondary: Muscle[]
  /** True for bodyweight movements where a bare "3x8" carries no weight. */
  bodyweight?: boolean
}

/** A parsed-but-not-yet-saved workout shown on the review screen. */
export interface DraftExercise {
  name: string
  canonicalId?: string
  sets: SetEntry[]
  rawLine: string
  parsedBy: 'rules' | 'llm' | 'unparsed'
}

export interface DraftWorkout {
  date: string
  title?: string
  exercises: DraftExercise[]
  /** Lines we could not parse at all (kept so nothing is silently dropped). */
  unparsedLines: string[]
  /** Set when a bulk import re-dated this workout off a duplicate date. */
  moved?: boolean
}
