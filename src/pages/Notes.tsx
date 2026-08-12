import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../lib/db'
import { formatDMY } from '../lib/parser/dates'
import { Empty, SectionTitle } from '../components/ui'
import { NotesDoc } from './NotesDoc'

interface GridCard {
  id: number
  title: string
  date: string
  moved: boolean
  exercises: number
}

const DATE_LINE = /^\s*(?:\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?)\b/
type View = 'feed' | 'grid'
const VIEW_KEY = 'smpltrack.notesView'

export function Notes() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const shareMode = !!(params.get('text') || params.get('title') || params.get('append'))

  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) as View) || 'feed')
  // A shared/append deep-link always lands in the editable document.
  useEffect(() => {
    if (shareMode) setView('feed')
  }, [shareMode])
  const setViewPersist = (v: View) => {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  const cards = useLiveQuery(async (): Promise<GridCard[]> => {
    const workouts = await db.workouts.orderBy('date').reverse().toArray()
    const notes = await db.notes.toArray()
    const rawById = new Map(notes.map((n) => [n.id, n.rawText]))
    const exAll = await db.exercises.toArray()
    const exCount = new Map<number, number>()
    for (const e of exAll) exCount.set(e.workoutId, (exCount.get(e.workoutId) ?? 0) + 1)
    return workouts.map((w) => {
      const raw = (w.noteId != null ? rawById.get(w.noteId) : '') ?? ''
      const titleLine = raw.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !DATE_LINE.test(l))
      return {
        id: w.id!,
        title: w.title || titleLine || 'Workout',
        date: w.date,
        moved: !!w.moved,
        exercises: exCount.get(w.id!) ?? 0,
      }
    })
  }, [])

  const count = cards?.length ?? 0
  const headerHint = useMemo(() => (count ? `${count} workouts` : undefined), [count])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle hint={headerHint}>Notes</SectionTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-0.5">
            <ViewTab active={view === 'feed'} onClick={() => setViewPersist('feed')}>
              Feed
            </ViewTab>
            <ViewTab active={view === 'grid'} onClick={() => setViewPersist('grid')}>
              Grid
            </ViewTab>
          </div>
          <button
            onClick={() => navigate('/import')}
            className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300"
          >
            Import
          </button>
        </div>
      </div>

      {view === 'feed' ? (
        <NotesDoc />
      ) : !cards ? (
        <div className="py-16 text-center text-zinc-500">Loading…</div>
      ) : cards.length === 0 ? (
        <Empty title="No notes yet">
          Switch to <span className="text-green-400">Feed</span> to start typing, or Import your old
          notes.
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setViewPersist('feed')}
              className="flex h-28 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-left transition hover:border-zinc-700"
            >
              <div className="line-clamp-2 text-sm font-semibold text-zinc-100">{c.title}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                {c.moved && <span className="text-amber-400">●</span>}
                {formatDMY(c.date)}
              </div>
              <div className="mt-auto text-[10px] text-zinc-600">
                {c.exercises} exercise{c.exercises === 1 ? '' : 's'}
              </div>
            </button>
          ))}
        </div>
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
