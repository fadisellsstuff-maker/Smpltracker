import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { parseNotes } from '../lib/parser'
import { detectDate, formatDMY, toISODate } from '../lib/parser/dates'
import { resolveDuplicateDates } from '../lib/importDates'
import { getUserAliasMap, getWorkoutText, saveWorkout, updateWorkout } from '../lib/repo'
import { displayWeight } from '../lib/settings'
import { useSettings } from '../SettingsContext'

type Kind = 'text' | 'todo' | 'done'
interface Line {
  id: number
  kind: Kind
  text: string
}

const PLACEHOLDER = 'Push day…'
const CHECKBOX_RE = /^\s*(?:[-*•]\s*)?\[([ xXvV])\]\s?(.*)$/

let idSeq = 1
const newId = () => idSeq++

function parseRawToLines(raw: string): Line[] {
  const rows = raw.split(/\r?\n/)
  const lines = rows.map((r): Line => {
    const m = r.match(CHECKBOX_RE)
    if (m) return { id: newId(), kind: /[xXvV]/.test(m[1]) ? 'done' : 'todo', text: m[2] }
    return { id: newId(), kind: 'text', text: r }
  })
  return lines.length ? lines : [{ id: newId(), kind: 'text', text: '' }]
}

function serialize(lines: Line[]): string {
  return lines
    .map((l) => (l.kind === 'done' ? `[v] ${l.text}` : l.kind === 'todo' ? `[ ] ${l.text}` : l.text))
    .join('\n')
}

function grow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export function NoteEditor() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { settings } = useSettings()

  const [lines, setLines] = useState<Line[]>(() => [{ id: newId(), kind: 'text', text: '' }])
  const [loaded, setLoaded] = useState(editId == null)
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [pending, setPending] = useState<{ id: number; caret: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputs = useRef(new Map<number, HTMLTextAreaElement>())

  // Load existing note or a shared payload.
  useEffect(() => {
    if (editId != null) {
      getWorkoutText(editId).then((t) => {
        setLines(parseRawToLines(t))
        setLoaded(true)
      })
    } else {
      const shared = [params.get('title'), params.get('text')].filter(Boolean).join('\n')
      if (shared) setLines(parseRawToLines(shared))
    }
  }, [editId, params])

  const text = useMemo(() => serialize(lines), [lines])

  // Live parse for the counter + save confirm (rules only).
  const preview = useMemo(() => {
    const blocks = parseNotes(text)
    const exercises = blocks.flatMap((b) => b.draft.exercises).filter((e) => e.canonicalId)
    const unmatched = blocks.flatMap((b) => b.draft.unparsedLines).length
    const date = text.trim() ? detectDate(text, new Date()) : toISODate(new Date())
    return { count: exercises.length, exercises, unmatched, date, multi: blocks.length > 1 }
  }, [text])

  // Grow every textarea when content changes; apply pending focus.
  useLayoutEffect(() => {
    inputs.current.forEach((el) => grow(el))
  }, [lines])
  useLayoutEffect(() => {
    if (!pending) return
    const el = inputs.current.get(pending.id)
    if (el) {
      el.focus()
      el.setSelectionRange(pending.caret, pending.caret)
      grow(el)
    }
    setPending(null)
  }, [pending])

  const setText = (lineId: number, value: string) =>
    setLines((ls) => ls.map((l) => (l.id === lineId ? { ...l, text: value } : l)))

  const toggleDone = (lineId: number) =>
    setLines((ls) =>
      ls.map((l) => (l.id === lineId ? { ...l, kind: l.kind === 'done' ? 'todo' : 'done' } : l)),
    )

  // Toolbar: turn the focused line into / out of a checklist item.
  const toggleFocusedCheckbox = () => {
    const target = focusedId ?? lines[lines.length - 1]?.id
    if (target == null) return
    setLines((ls) =>
      ls.map((l) => (l.id === target ? { ...l, kind: l.kind === 'text' ? 'todo' : 'text' } : l)),
    )
    setPending({ id: target, caret: 0 })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) {
    const line = lines[index]
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const caret = el.selectionStart
      // Empty checklist item + Enter → drop the checkbox (exit the list).
      if (line.kind !== 'text' && line.text === '') {
        setLines((ls) => ls.map((l, i) => (i === index ? { ...l, kind: 'text' } : l)))
        return
      }
      const before = line.text.slice(0, caret)
      const after = line.text.slice(caret)
      const nid = newId()
      const nextKind: Kind = line.kind === 'text' ? 'text' : 'todo'
      setLines((ls) => {
        const copy = ls.map((l, i) => (i === index ? { ...l, text: before } : l))
        copy.splice(index + 1, 0, { id: nid, kind: nextKind, text: after })
        return copy
      })
      setPending({ id: nid, caret: 0 })
    } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (line.kind !== 'text') {
        e.preventDefault()
        setLines((ls) => ls.map((l, i) => (i === index ? { ...l, kind: 'text' } : l)))
      } else if (index > 0) {
        e.preventDefault()
        const prev = lines[index - 1]
        const caret = prev.text.length
        setLines((ls) => {
          const copy = ls.map((l, i) =>
            i === index - 1 ? { ...l, text: prev.text + line.text } : l,
          )
          copy.splice(index, 1)
          return copy
        })
        setPending({ id: prev.id, caret })
      }
    }
  }

  async function doSave() {
    setSaving(true)
    try {
      const aliases = await getUserAliasMap()
      const blocks = parseNotes(text, { userAliases: aliases })
      if (editId != null) {
        await updateWorkout(editId, blocks[0].draft, blocks[0].rawText || text)
      } else {
        if (blocks.length > 1) resolveDuplicateDates(blocks)
        for (const b of blocks) await saveWorkout(b.draft, b.rawText, 'note')
      }
      navigate('/notes')
    } finally {
      setSaving(false)
    }
  }

  const canSave = text.trim().length > 0
  if (!loaded) return <div className="py-20 text-center text-zinc-500">Loading…</div>

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-zinc-400 hover:text-zinc-200">
          ‹ Notes
        </button>
        <button
          onClick={() => setConfirming(true)}
          disabled={!canSave}
          className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>

      {/* Line-based notes surface: [ ]/[v] lines are real checkboxes. */}
      <div className="flex-1 space-y-0.5">
        {lines.map((line, i) => (
          <div key={line.id} className="flex items-start gap-2">
            {line.kind !== 'text' && (
              <button
                onClick={() => toggleDone(line.id)}
                aria-label={line.kind === 'done' ? 'Mark not done' : 'Mark done'}
                className={`mt-[3px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border-2 text-[12px] leading-none text-white ${
                  line.kind === 'done' ? 'border-green-500 bg-green-500' : 'border-zinc-600'
                }`}
              >
                {line.kind === 'done' ? '✓' : ''}
              </button>
            )}
            <textarea
              ref={(el) => {
                if (el) inputs.current.set(line.id, el)
                else inputs.current.delete(line.id)
              }}
              value={line.text}
              rows={1}
              autoFocus={i === 0 && line.text === '' && editId == null}
              placeholder={i === 0 ? PLACEHOLDER : ''}
              spellCheck={false}
              onFocus={() => setFocusedId(line.id)}
              onChange={(e) => {
                setText(line.id, e.target.value)
                grow(e.target)
              }}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`w-full resize-none overflow-hidden bg-transparent leading-6 outline-none placeholder:text-zinc-600 ${
                i === 0 && line.kind === 'text'
                  ? 'text-lg font-semibold text-zinc-50'
                  : line.kind === 'done'
                    ? 'text-[15px] text-zinc-500 line-through'
                    : 'text-[15px] text-zinc-100'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Format bar + live status, above the tab bar. */}
      <div className="sticky bottom-24 mt-2 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 backdrop-blur">
        <button
          onClick={toggleFocusedCheckbox}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200"
        >
          <span className="text-green-400">☑</span> Checkbox
        </button>
        <span className="text-xs text-zinc-500">
          {preview.count > 0
            ? `${preview.count} exercise${preview.count > 1 ? 's' : ''} · ${formatDMY(preview.date)}`
            : 'Type your workout…'}
        </span>
      </div>

      {confirming && (
        <ConfirmSheet
          preview={preview}
          units={settings.units}
          saving={saving}
          onCancel={() => setConfirming(false)}
          onSave={doSave}
        />
      )}
    </div>
  )
}

function ConfirmSheet({
  preview,
  units,
  saving,
  onCancel,
  onSave,
}: {
  preview: {
    count: number
    exercises: { name: string; sets: { reps: number; weightKg?: number }[] }[]
    unmatched: number
    date: string
    multi: boolean
  }
  units: 'kg' | 'lbs'
  saving: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onCancel}>
      <div
        className="mx-auto w-full max-w-md rounded-t-2xl border-t border-zinc-800 bg-zinc-950 p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-base font-semibold text-zinc-100">Save note</h3>
          <span className="text-xs text-zinc-500">{formatDMY(preview.date)}</span>
        </div>
        <p className="text-sm text-zinc-400">
          {preview.count > 0
            ? `${preview.count} exercise${preview.count > 1 ? 's' : ''} detected`
            : 'No exercises detected — the note will still be saved.'}
          {preview.unmatched > 0 && (
            <span className="text-zinc-500"> · {preview.unmatched} line(s) not recognized</span>
          )}
          {preview.multi && <span className="text-zinc-500"> · multiple days</span>}
        </p>

        {preview.count > 0 && (
          <div className="mt-3 max-h-52 space-y-1 overflow-y-auto">
            {preview.exercises.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 text-sm">
                <span className="text-zinc-200">{e.name}</span>
                <span className="text-xs text-zinc-500 tabular-nums">
                  {e.sets.length}×{e.sets[0]?.reps ?? 0}
                  {e.sets[0]?.weightKg != null && ` · ${displayWeight(e.sets[0].weightKg, units)}${units}`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-zinc-800 py-3 font-medium text-zinc-300">
            Keep editing
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-[2] rounded-xl bg-green-500 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save workout'}
          </button>
        </div>
      </div>
    </div>
  )
}
