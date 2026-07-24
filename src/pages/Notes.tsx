import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { formatDMY } from '../lib/parser/dates'
import { Empty, SectionTitle } from '../components/ui'

interface NoteCard {
  id: number
  title: string
  date: string
  moved: boolean
  lines: string[]
  exercises: number
}

const DATE_LINE = /^\s*(?:\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?)\b/

/** Turn "[v] bench 3x8" into "✓ bench 3x8" and "[ ] x" into "▢ x" for previews. */
function prettyLine(line: string): { glyph?: 'done' | 'todo'; text: string } {
  const m = line.match(/^\s*(?:[-*•]\s*)?\[([ xXvV])\]\s?(.*)$/)
  if (m) return { glyph: /[xXvV]/.test(m[1]) ? 'done' : 'todo', text: m[2] }
  return { text: line.replace(/^\s*[-*•]\s*/, '') }
}

export function Notes() {
  const navigate = useNavigate()

  const cards = useLiveQuery(async (): Promise<NoteCard[]> => {
    const workouts = await db.workouts.orderBy('date').reverse().toArray()
    const notes = await db.notes.toArray()
    const rawById = new Map(notes.map((n) => [n.id, n.rawText]))
    const exAll = await db.exercises.toArray()
    const exCount = new Map<number, number>()
    for (const e of exAll) exCount.set(e.workoutId, (exCount.get(e.workoutId) ?? 0) + 1)

    return workouts.map((w) => {
      const raw = (w.noteId != null ? rawById.get(w.noteId) : '') ?? ''
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const titleLine = lines.find((l) => !DATE_LINE.test(l))
      return {
        id: w.id!,
        title: w.title || titleLine || 'Workout',
        date: w.date,
        moved: !!w.moved,
        lines: lines.slice(0, 5),
        exercises: exCount.get(w.id!) ?? 0,
      }
    })
  }, [])

  const count = cards?.length ?? 0
  const headerHint = useMemo(() => (count ? `${count} notes` : undefined), [count])

  return (
    <div className="space-y-4">
      <SectionTitle hint={headerHint}>Notes</SectionTitle>

      <div className="flex gap-2">
        <button
          onClick={() => navigate('/notes/new')}
          className="flex-1 rounded-xl bg-green-500 py-2.5 font-semibold text-white"
        >
          ✎ New note
        </button>
        <button
          onClick={() => navigate('/import')}
          className="rounded-xl bg-zinc-800 px-4 py-2.5 font-medium text-zinc-300"
        >
          Import old notes
        </button>
      </div>

      {!cards ? (
        <div className="py-16 text-center text-zinc-500">Loading…</div>
      ) : cards.length === 0 ? (
        <Empty title="No notes yet">
          Tap <span className="text-green-400">New note</span> to jot down a workout, or import your
          old notes.
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/notes/${c.id}`)}
              className="flex h-44 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-left transition hover:border-zinc-700"
            >
              <div className="line-clamp-1 text-sm font-semibold text-zinc-100">{c.title}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
                {c.moved && <span className="text-amber-400">●</span>}
                {formatDMY(c.date)}
              </div>
              <div className="mt-2 flex-1 space-y-0.5 overflow-hidden text-[11px] leading-4 text-zinc-500">
                {c.lines.map((l, i) => {
                  const p = prettyLine(l)
                  return (
                    <div key={i} className="line-clamp-1">
                      {p.glyph && (
                        <span className={p.glyph === 'done' ? 'text-green-400' : 'text-zinc-600'}>
                          {p.glyph === 'done' ? '✓ ' : '▢ '}
                        </span>
                      )}
                      {p.text}
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 text-[10px] text-zinc-600">
                {c.exercises} exercise{c.exercises === 1 ? '' : 's'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
