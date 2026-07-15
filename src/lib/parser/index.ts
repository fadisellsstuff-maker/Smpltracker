import { getExercise } from '../catalog/exercises'
import type { DraftExercise, DraftWorkout } from '../types'
import { detectDate, toISODate } from './dates'
import { matchExercise } from './matcher'
import { parseSets } from './sets'

/** Opening keyword that marks a header/label line rather than an exercise. */
const HEADER_START_RE =
  /^(push|pull|legs?|upper|lower|full\s?body|chest|back|shoulders?|arms?|day|workout|session|gym|rest|ppl|cardio|advanced)\b/i

/** A line whose whole content is a date (+ optional weekday), e.g. "27/1/23 Fri". */
const DATE_HEADER_LINE_RE =
  /^\s*(?:\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?)\s*[a-zA-Z]*\.?\s*$/

/** A line carries real set notation (x-reps, @weight, or a unit) — not just prose. */
function hasSetContent(line: string): boolean {
  const withoutDate = line
    .replace(/\b\d{1,4}[/.\-]\d{1,4}(?:[/.\-]\d{2,4})?\b/g, '')
    .replace(/\b\d{1,2}:\d{2}\s*(am|pm)?/gi, '')
  return /\d\s*[x×*]\s*\d|@\s*\d|\d\s*(kg|lbs?|#|p)\b/i.test(withoutDate)
}

type CheckState = 'checked' | 'unchecked' | 'none'

// Leading checkbox markers, optionally after a bullet. `[v]` is Samsung Notes'
// exported "done" tick; we also accept x/✓ and the unicode box glyphs.
const CHECKED_RE = /^[\s\-*•]*(?:\[[xXvV✓✔]\]|[☑☒✅✔✓])\s*/
const UNCHECKED_RE = /^[\s\-*•]*(?:\[\s?\]|[☐□⬜◻○])\s*/

/** Strip a leading checkbox marker and report whether the item was checked. */
function readCheckbox(line: string): { state: CheckState; rest: string } {
  if (CHECKED_RE.test(line)) return { state: 'checked', rest: line.replace(CHECKED_RE, '').trim() }
  if (UNCHECKED_RE.test(line)) return { state: 'unchecked', rest: line.replace(UNCHECKED_RE, '').trim() }
  return { state: 'none', rest: line }
}

function isNoiseLine(line: string): boolean {
  const t = line.trim()
  if (!t || t.length < 2) return true
  if (/^[-*•+\s]+$/.test(t)) return true
  return false
}

/**
 * Split a line into (exerciseName, setText): the set text is the tail starting
 * at the first numeric token; the name is everything before it. Leading bullets,
 * "+", and list numbering ("1.", "2)") are stripped first.
 */
function splitLine(line: string): { name: string; setText: string } {
  const cleaned = line
    .replace(/^[\s\-*•+]+/, '')
    .replace(/^\d+[.)]\s*/, '') // list numbering like "1." or "2)"
    .trim()

  // Set text starts at the first number, keeping a leading "(" (weighted "(26)x7x2").
  const m = cleaned.match(/[:\-–]?\s*(\(?\d.*)$/)
  if (!m) return { name: cleaned, setText: '' }

  const idx = cleaned.indexOf(m[1])
  const name = cleaned.slice(0, idx).replace(/[:\-–]\s*$/, '').trim()
  const setText = cleaned.slice(idx).trim()
  return { name: name || cleaned, setText }
}

export interface ParseOptions {
  /** Timestamp used when the note has no date (e.g. share receivedAt). */
  receivedAt?: Date
  userAliases?: Map<string, string>
}

/**
 * Parse a single workout note into a draft. If the note uses checkboxes at all,
 * only checked (`[v]`) items are logged — the rest are treated as planned.
 * Unrecognized lines go to `unparsedLines` so nothing is silently dropped.
 */
export function parseNote(text: string, opts: ParseOptions = {}): DraftWorkout {
  const fallback = opts.receivedAt ?? new Date()
  const date = detectDate(text, fallback)

  const scanned = text.split(/\r?\n/).map((l) => readCheckbox(l.trim()))
  const usesCheckboxes = scanned.some((s) => s.state !== 'none')

  const exercises: DraftExercise[] = []
  const unparsedLines: string[] = []
  let title: string | undefined

  for (const { state, rest } of scanned) {
    const line = rest.trim()
    if (isNoiseLine(line)) continue

    // Date header — already captured via detectDate; never an exercise.
    if (DATE_HEADER_LINE_RE.test(line)) continue

    // Title from a workout-keyword header line without set notation.
    if (HEADER_START_RE.test(line) && !hasSetContent(line)) {
      if (!title) title = line.replace(/[-*•:]/g, ' ').replace(/\s+/g, ' ').trim()
      continue
    }

    // In checkbox mode, only log explicitly checked items.
    if (usesCheckboxes && state !== 'checked') continue

    const { name, setText } = splitLine(line)
    const canonicalId = matchExercise(name, opts.userAliases)
    const bodyweight = canonicalId ? !!getExercise(canonicalId)?.bodyweight : false
    const parsed = parseSets(setText || line, bodyweight)

    // "ass"/"assisted" means the weight made the lift easier, not added load —
    // log it as bodyweight so it never inflates weighted PRs.
    const assisted = /\bassist(ed|ance)?\b|\bass\b/i.test(line)
    const sets = assisted ? parsed.sets.map((s) => ({ reps: s.reps })) : parsed.sets

    if (!canonicalId && sets.length === 0) {
      unparsedLines.push(line)
      continue
    }

    exercises.push({
      name: canonicalId ? getExercise(canonicalId)!.name : name || line,
      canonicalId,
      sets,
      rawLine: line,
      parsedBy: canonicalId && sets.length > 0 ? 'rules' : 'unparsed',
    })
  }

  return { date, title, exercises, unparsedLines }
}

export interface ParsedBlock {
  draft: DraftWorkout
  rawText: string
}

/**
 * Parse a note that may contain many workouts, each introduced by a date-header
 * line (e.g. an exported Samsung Notes log). Returns one block per dated
 * workout; a note with no date headers yields a single block.
 */
export function parseNotes(text: string, opts: ParseOptions = {}): ParsedBlock[] {
  const lines = text.split(/\r?\n/)
  const blocks: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    if (DATE_HEADER_LINE_RE.test(line.trim())) {
      if (current.length) blocks.push(current)
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length) blocks.push(current)

  const parsed = blocks
    .map((b) => b.join('\n'))
    .map((rawText) => ({ rawText, draft: parseNote(rawText, opts) }))
    .filter((p) => p.draft.exercises.length > 0)

  // No date headers (or nothing split out): treat the whole note as one block.
  if (parsed.length === 0) {
    const draft = parseNote(text, opts)
    return [{ rawText: text, draft }]
  }
  return parsed
}

export { toISODate }
