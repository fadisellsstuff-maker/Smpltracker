import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { formatDMY } from '../lib/parser/dates'
import { parseRawToLines, richToLines, type Line } from '../lib/richtext'
import { sanitizeHtml } from '../lib/richdom'
import { Empty, SectionTitle } from '../components/ui'

interface NoteCard {
  id: number
  title: string
  date: string
  moved: boolean
  lines: Line[]
  more: boolean
  exercises: number
}

const DATE_LINE = /^\s*(?:\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?)\b/
const MAX_PREVIEW = 6

type View = 'feed' | 'grid'
const VIEW_KEY = 'smpltrack.notesView'

export function Notes() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>(
    () => ((localStorage.getItem(VIEW_KEY) as View) || 'feed'),
  )
  const setViewPersist = (v: View) => {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  const cards = useLiveQuery(async (): Promise<NoteCard[]> => {
    const workouts = await db.workouts.orderBy('date').reverse().toArray()
    const notes = await db.notes.toArray()
    const noteById = new Map(notes.map((n) => [n.id, n]))
    const exAll = await db.exercises.toArray()
    const exCount = new Map<number, number>()
    for (const e of exAll) exCount.set(e.workoutId, (exCount.get(e.workoutId) ?? 0) + 1)

    return workouts.map((w) => {
      const note = w.noteId != null ? noteById.get(w.noteId) : undefined
      const raw = note?.rawText ?? ''
      const allLines = richToLines(note?.rich) ?? parseRawToLines(raw)
      // Drop date-only header lines and blanks from the preview.
      const shown = allLines.filter((l) => l.html.trim() && !DATE_LINE.test(l.html))
      const titleLine = shown[0]
      return {
        id: w.id!,
        title: w.title || (titleLine ? titleLine.html.replace(/<[^>]+>/g, '') : '') || 'Workout',
        date: w.date,
        moved: !!w.moved,
        lines: shown.slice(0, MAX_PREVIEW),
        more: shown.length > MAX_PREVIEW,
        exercises: exCount.get(w.id!) ?? 0,
      }
    })
  }, [])

  const count = cards?.length ?? 0
  const headerHint = useMemo(() => (count ? `${count} notes` : undefined), [count])
  const newestId = cards?.[0]?.id

  const addNewNote = () => {
    if (newestId != null) navigate(`/notes/${newestId}?append=1`)
    else navigate('/notes/new')
  }

  return (
    <div className="space-y-4 pb-14">
      <div className="flex items-center justify-between">
        <SectionTitle hint={headerHint}>Notes</SectionTitle>
        <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-0.5">
          <ViewTab active={view === 'feed'} onClick={() => setViewPersist('feed')}>
            Feed
          </ViewTab>
          <ViewTab active={view === 'grid'} onClick={() => setViewPersist('grid')}>
            Grid
          </ViewTab>
        </div>
      </div>

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
          Import
        </button>
      </div>

      {!cards ? (
        <div className="py-16 text-center text-zinc-500">Loading…</div>
      ) : cards.length === 0 ? (
        <Empty title="No notes yet">
          Tap <span className="text-green-400">New note</span> to jot down a workout, or Import your
          old notes.
        </Empty>
      ) : view === 'grid' ? (
        <GridView cards={cards} onOpen={(id) => navigate(`/notes/${id}`)} />
      ) : (
        <FeedView cards={cards} onOpen={(id) => navigate(`/notes/${id}`)} />
      )}

      {/* Sticky "add new note" bar → appends to the newest note. */}
      {cards && cards.length > 0 && (
        <button
          onClick={addNewNote}
          className="safe-bottom fixed inset-x-0 bottom-[76px] z-10 mx-auto flex max-w-md items-center gap-2 border-t border-zinc-800 bg-[#0a0a0a]/95 px-5 py-3 text-left text-sm font-medium text-zinc-300 backdrop-blur"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
            +
          </span>
          Add new note
        </button>
      )}
    </div>
  )
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400'
      }`}
    >
      {children}
    </button>
  )
}

/** Rendered line with real checkbox glyph + inline formatting. */
function PreviewLine({ line }: { line: Line }) {
  const glyph = line.kind === 'done' ? '✓' : line.kind === 'todo' ? '▢' : null
  return (
    <div className="flex items-start gap-1.5 leading-5">
      {glyph && (
        <span className={line.kind === 'done' ? 'text-green-400' : 'text-zinc-600'}>{glyph}</span>
      )}
      <span
        className={`min-w-0 flex-1 ${line.kind === 'done' ? 'text-zinc-500 line-through' : ''}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(line.html) }}
      />
    </div>
  )
}

function FeedView({ cards, onOpen }: { cards: NoteCard[]; onOpen: (id: number) => void }) {
  return (
    <div className="space-y-3">
      {cards.map((c) => (
        <div
          key={c.id}
          onClick={() => onOpen(c.id)}
          onDoubleClick={() => onOpen(c.id)}
          className="cursor-pointer rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-700"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
            {c.moved && <span className="text-amber-400">●</span>}
            {formatDMY(c.date)}
            <span className="text-zinc-700">·</span>
            {c.exercises} exercise{c.exercises === 1 ? '' : 's'}
          </div>
          <div className="space-y-0.5 text-[15px] text-zinc-100">
            {c.lines.map((l, i) => (
              <div key={i} className={i === 0 && l.kind === 'text' ? 'text-lg font-semibold text-zinc-50' : ''}>
                <PreviewLine line={l} />
              </div>
            ))}
            {c.more && <div className="pt-0.5 text-xs text-zinc-600">…</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function GridView({ cards, onOpen }: { cards: NoteCard[]; onOpen: (id: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpen(c.id)}
          className="flex h-44 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-left transition hover:border-zinc-700"
        >
          <div className="line-clamp-1 text-sm font-semibold text-zinc-100">{c.title}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-500">
            {c.moved && <span className="text-amber-400">●</span>}
            {formatDMY(c.date)}
          </div>
          <div className="mt-2 flex-1 space-y-0.5 overflow-hidden text-[11px] leading-4 text-zinc-500">
            {c.lines.map((l, i) => (
              <div key={i} className="line-clamp-1">
                <PreviewLine line={l} />
              </div>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-zinc-600">
            {c.exercises} exercise{c.exercises === 1 ? '' : 's'}
          </div>
        </button>
      ))}
    </div>
  )
}
