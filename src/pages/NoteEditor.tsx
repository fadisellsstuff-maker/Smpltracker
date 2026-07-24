import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { parseNotes } from '../lib/parser'
import { detectDate, formatDMY, toISODate } from '../lib/parser/dates'
import { resolveDuplicateDates } from '../lib/importDates'
import { getUserAliasMap, getWorkoutText, saveWorkout, updateWorkout } from '../lib/repo'
import { displayWeight } from '../lib/settings'
import { useSettings } from '../SettingsContext'

const PLACEHOLDER = `Push day

[v] bench press 3x8 60kg
[v] incline db press 4x8 25p
[v] lateral raises 4x15
[ ] tricep pushdowns 3x12`

export function NoteEditor() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { settings } = useSettings()

  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(editId == null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Load existing note text, or prefill from a Web Share.
  useEffect(() => {
    if (editId != null) {
      getWorkoutText(editId).then((t) => {
        setText(t)
        setLoaded(true)
      })
    } else {
      const shared = [params.get('title'), params.get('text')].filter(Boolean).join('\n')
      if (shared) setText(shared)
    }
  }, [editId, params])

  // Live parse for the counter + save confirm (rules only, no async aliases).
  const preview = useMemo(() => {
    const blocks = parseNotes(text)
    const exercises = blocks.flatMap((b) => b.draft.exercises).filter((e) => e.canonicalId)
    const unmatched = blocks.flatMap((b) => b.draft.unparsedLines).length
    const date = text.trim() ? detectDate(text, new Date()) : toISODate(new Date())
    return { count: exercises.length, exercises, unmatched, date, multi: blocks.length > 1 }
  }, [text])

  function toggleCheckbox() {
    const ta = taRef.current
    if (!ta) return
    const pos = ta.selectionStart
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1
    const nl = text.indexOf('\n', lineStart)
    const lineEnd = nl === -1 ? text.length : nl
    const line = text.slice(lineStart, lineEnd)
    const m = line.match(/^(\s*(?:[-*•]\s*)?)\[([ xXvV])\]\s?(.*)$/)
    const newLine = m
      ? `${m[1]}[${/[xXvV]/.test(m[2]) ? ' ' : 'v'}] ${m[3]}` // toggle done
      : `[ ] ${line}` // add a checkbox
    const next = text.slice(0, lineStart) + newLine + text.slice(lineEnd)
    setText(next)
    const delta = newLine.length - line.length
    requestAnimationFrame(() => {
      ta.focus()
      const c = Math.max(lineStart, pos + delta)
      ta.setSelectionRange(c, c)
    })
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
      <div className="mb-2 flex items-center justify-between">
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

      {/* Frictionless writing surface: first line is the title, just type. */}
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        placeholder={PLACEHOLDER}
        spellCheck={false}
        className="min-h-[55vh] flex-1 resize-none bg-transparent text-[15px] leading-7 text-zinc-100 outline-none placeholder:text-zinc-600"
      />

      {/* Format bar + live status, pinned above the tab bar. */}
      <div className="sticky bottom-24 mt-2 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 backdrop-blur">
        <button
          onClick={toggleCheckbox}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200"
          aria-label="Toggle checkbox on this line"
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
