// The "one continuous document" model: all workouts live in a single editable
// notes file. The formatted document (source of truth for the editor) is cached
// in localStorage; the workouts/exercises tables are rebuilt from it for the
// insights/history views. Building from the DB is the migration path on first run.
import { db } from './db'
import { DATE_HEADER_LINE_RE, parseNote, type ParsedBlock } from './parser'
import { formatDMY } from './parser/dates'
import { resolveDuplicateDates } from './importDates'
import { getUserAliasMap } from './repo'
import type { ExerciseRecord } from './types'
import {
  type Line,
  linesToRich,
  newLineId,
  parseRawToLines,
  plainOf,
  richToLines,
  serializeLines,
} from './richtext'

const MASTER_KEY = 'smpltrack.notesdoc'

/** A line whose whole content is a date — starts a workout / draws a divider.
 *  Uses the parser's exact rule so document sections align 1:1 with workouts. */
export function isDateLine(line: Line): boolean {
  return DATE_HEADER_LINE_RE.test(plainOf(line.html).trim())
}

export function loadMaster(): Line[] | null {
  try {
    return richToLines(localStorage.getItem(MASTER_KEY))
  } catch {
    return null
  }
}
export function saveMaster(lines: Line[]): void {
  try {
    localStorage.setItem(MASTER_KEY, linesToRich(lines))
  } catch {
    /* quota — ignore, DB rebuild still holds the data */
  }
}
/** Drop the cache so the document rebuilds fresh from the DB (after import/clear). */
export function clearMaster(): void {
  localStorage.removeItem(MASTER_KEY)
}

/** Concatenate every workout (oldest→newest) into one line list. Each section is
 *  guaranteed to start with a date line so re-parsing splits it back correctly. */
export async function buildLinesFromDb(): Promise<Line[]> {
  const workouts = await db.workouts.orderBy('date').toArray() // ascending
  const notes = await db.notes.toArray()
  const noteById = new Map(notes.map((n) => [n.id, n]))
  const out: Line[] = []
  for (const w of workouts) {
    const note = w.noteId != null ? noteById.get(w.noteId) : undefined
    const wl = richToLines(note?.rich) ?? parseRawToLines(note?.rawText ?? '')
    const firstReal = wl.find((l) => plainOf(l.html).trim())
    if (!firstReal || !isDateLine(firstReal)) {
      out.push({ id: newLineId(), kind: 'text', html: formatDMY(w.date) })
    }
    out.push(...wl)
  }
  return out.length ? out : [{ id: newLineId(), kind: 'text', html: '' }]
}

/** The document, formatted: cached master, else built from the DB (and cached). */
export async function loadDocLines(): Promise<Line[]> {
  const cached = loadMaster()
  if (cached) return cached
  const built = await buildLinesFromDb()
  saveMaster(built)
  return built
}

/** Split the document into one section per date line (loose match), keeping the
 *  same boundaries the editor draws dividers at. */
export function splitSections(lines: Line[]): Line[][] {
  const sections: Line[][] = []
  for (const l of lines) {
    if (isDateLine(l) || sections.length === 0) sections.push([l])
    else sections[sections.length - 1].push(l)
  }
  return sections
}

let rebuilding = false

/** Re-parse the whole document and rebuild the derived workout tables. Unlike a
 *  bulk import, EVERY dated section becomes a workout — even ones with no logged
 *  exercises — so editing the document never drops a note. Runs as ONE atomic
 *  transaction (fast + no partial state) and is guarded against concurrent runs. */
export async function rebuildFromLines(lines: Line[]): Promise<number> {
  if (rebuilding) return 0
  rebuilding = true
  try {
    const aliases = await getUserAliasMap()
    const blocks: ParsedBlock[] = splitSections(lines)
      .map((sec) => serializeLines(sec))
      .filter((rawText) => rawText.trim())
      .map((rawText) => ({ rawText, draft: parseNote(rawText, { userAliases: aliases }) }))
    resolveDuplicateDates(blocks)

    await db.transaction('rw', db.notes, db.workouts, db.exercises, async () => {
      await db.notes.clear()
      await db.workouts.clear()
      await db.exercises.clear()
      for (const { draft, rawText } of blocks) {
        const noteId = (await db.notes.add({ source: 'note', rawText, receivedAt: Date.now() })) as number
        const workoutId = (await db.workouts.add({
          date: draft.date,
          title: draft.title,
          noteId,
          parsedWith: 'rules',
          moved: draft.moved,
        })) as number
        await db.notes.update(noteId, { workoutId })
        const rows: ExerciseRecord[] = draft.exercises
          .filter((e) => e.canonicalId && e.sets.length > 0)
          .map((e) => ({ workoutId, name: e.name, canonicalId: e.canonicalId, sets: e.sets, rawLine: e.rawLine }))
        if (rows.length) await db.exercises.bulkAdd(rows)
      }
    })
    saveMaster(lines)
    return blocks.length
  } finally {
    rebuilding = false
  }
}
