import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { parseNotes } from '../lib/parser'
import { detectDate, formatDMY, toISODate } from '../lib/parser/dates'
import { resolveDuplicateDates } from '../lib/importDates'
import { getUserAliasMap, getWorkoutNote, saveWorkout, updateWorkout } from '../lib/repo'
import { displayWeight } from '../lib/settings'
import { useSettings } from '../SettingsContext'
import {
  type Line,
  isBlank,
  linesToRich,
  newLineId,
  parseRawToLines,
  richToLines,
  serializeLines,
} from '../lib/richtext'
import { caretAtStart, sanitizeHtml, setCaret, splitAtCaret, toggleBig } from '../lib/richdom'

const PLACEHOLDER = 'Push day…'

export function NoteEditor() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { settings } = useSettings()
  const append = params.get('append') === '1'

  const [lines, setLines] = useState<Line[]>(() => [{ id: newLineId(), kind: 'text', html: '' }])
  const [loaded, setLoaded] = useState(editId == null)
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [pending, setPending] = useState<{ id: number; caret: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const els = useRef(new Map<number, HTMLDivElement>())

  // Load existing note (rich if present, else plain rawText) or a shared payload.
  useEffect(() => {
    if (editId != null) {
      getWorkoutNote(editId).then(({ rawText, rich }) => {
        const loadedLines = richToLines(rich) ?? parseRawToLines(rawText)
        if (append) {
          loadedLines.push({ id: newLineId(), kind: 'text', html: '' })
          setPending({ id: loadedLines[loadedLines.length - 1].id, caret: 0 })
        }
        setLines(loadedLines)
        setLoaded(true)
      })
    } else {
      const shared = [params.get('title'), params.get('text')].filter(Boolean).join('\n')
      if (shared) setLines(parseRawToLines(shared))
    }
  }, [editId, params, append])

  const text = useMemo(() => serializeLines(lines), [lines])

  // Live parse for the counter + save confirm (rules only).
  const preview = useMemo(() => {
    const blocks = parseNotes(text)
    const exercises = blocks.flatMap((b) => b.draft.exercises).filter((e) => e.canonicalId)
    const unmatched = blocks.flatMap((b) => b.draft.unparsedLines).length
    const date = text.trim() ? detectDate(text, new Date()) : toISODate(new Date())
    return { count: exercises.length, exercises, unmatched, date, multi: blocks.length > 1 }
  }, [text])

  // Apply pending focus + caret after a structural change.
  useLayoutEffect(() => {
    if (!pending) return
    const el = els.current.get(pending.id)
    if (el) {
      el.focus()
      setCaret(el, pending.caret)
    }
    setPending(null)
  }, [pending, lines])

  const readHtml = (lineId: number, el: HTMLDivElement) =>
    setLines((ls) => ls.map((l) => (l.id === lineId ? { ...l, html: sanitizeHtml(el.innerHTML) } : l)))

  const toggleDone = (lineId: number) =>
    setLines((ls) =>
      ls.map((l) => (l.id === lineId ? { ...l, kind: l.kind === 'done' ? 'todo' : 'done' } : l)),
    )

  // Toolbar: bold / underline / big on the selection; checkbox on the focused line.
  const applyInline = (cmd: 'bold' | 'underline') => {
    const el = focusedId != null ? els.current.get(focusedId) : null
    if (!el) return
    el.focus()
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(cmd)
    readHtml(focusedId!, el)
  }
  const applyBig = () => {
    const el = focusedId != null ? els.current.get(focusedId) : null
    if (!el) return
    el.focus()
    toggleBig()
    readHtml(focusedId!, el)
  }
  const toggleCheckbox = () => {
    const target = focusedId ?? lines[lines.length - 1]?.id
    if (target == null) return
    setLines((ls) =>
      ls.map((l) => (l.id === target ? { ...l, kind: l.kind === 'text' ? 'todo' : 'text' } : l)),
    )
    setPending({ id: target, caret: 0 })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, index: number) {
    const line = lines[index]
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Empty checklist item + Enter → drop the checkbox (exit the list).
      if (line.kind !== 'text' && isBlank(line)) {
        setLines((ls) => ls.map((l, i) => (i === index ? { ...l, kind: 'text' } : l)))
        return
      }
      const { before, after } = splitAtCaret(el)
      const nid = newLineId()
      const nextKind = line.kind === 'text' ? 'text' : 'todo'
      setLines((ls) => {
        const copy = ls.map((l, i) => (i === index ? { ...l, html: sanitizeHtml(before) } : l))
        copy.splice(index + 1, 0, { id: nid, kind: nextKind, html: sanitizeHtml(after) })
        return copy
      })
      setPending({ id: nid, caret: 0 })
    } else if (e.key === 'Backspace' && caretAtStart(el)) {
      if (line.kind !== 'text') {
        e.preventDefault()
        setLines((ls) => ls.map((l, i) => (i === index ? { ...l, kind: 'text' } : l)))
      } else if (index > 0) {
        e.preventDefault()
        const prev = lines[index - 1]
        const caret = prev.html.replace(/<[^>]+>/g, '').length
        setLines((ls) => {
          const copy = ls.map((l, i) => (i === index - 1 ? { ...l, html: prev.html + line.html } : l))
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
      const rich = linesToRich(lines)
      const single = blocks.length === 1
      if (editId != null) {
        await updateWorkout(editId, blocks[0].draft, blocks[0].rawText || text, single ? rich : undefined)
        // Appending a new dated day to a note splits off extra workouts.
        for (const b of blocks.slice(1)) await saveWorkout(b.draft, b.rawText, 'note')
      } else {
        if (!single) resolveDuplicateDates(blocks)
        for (const b of blocks) await saveWorkout(b.draft, b.rawText, 'note', single ? rich : undefined)
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

      {/* Notes surface: each line is an inline-rich contentEditable; [ ]/[v] are real checkboxes. */}
      <div className="flex-1 space-y-0.5">
        {lines.map((line, i) => (
          <LineRow
            key={line.id}
            line={line}
            isTitle={i === 0}
            registerEl={(el) => {
              if (el) els.current.set(line.id, el)
              else els.current.delete(line.id)
            }}
            onFocus={() => setFocusedId(line.id)}
            onInput={(el) => readHtml(line.id, el)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onToggleDone={() => toggleDone(line.id)}
          />
        ))}
      </div>

      {/* Format bar + live status, above the tab bar. */}
      <div className="sticky bottom-24 mt-2 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/80 px-2 py-2 backdrop-blur">
        <div className="flex items-center gap-1">
          <ToolBtn label="Bold" onClick={() => applyInline('bold')}>
            <span className="font-bold">B</span>
          </ToolBtn>
          <ToolBtn label="Underline" onClick={() => applyInline('underline')}>
            <span className="underline">U</span>
          </ToolBtn>
          <ToolBtn label="Bigger" onClick={applyBig}>
            <span className="font-semibold">A+</span>
          </ToolBtn>
          <ToolBtn label="Checkbox" onClick={toggleCheckbox}>
            <span className="text-green-400">☑</span>
          </ToolBtn>
        </div>
        <span className="pr-1 text-xs text-zinc-500">
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

function ToolBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={label}
      // Keep the editor selection: prevent the button from stealing focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 w-9 items-center justify-center rounded-lg bg-zinc-800 text-sm text-zinc-200 active:bg-zinc-700"
    >
      {children}
    </button>
  )
}

function LineRow({
  line,
  isTitle,
  registerEl,
  onFocus,
  onInput,
  onKeyDown,
  onToggleDone,
}: {
  line: Line
  isTitle: boolean
  registerEl: (el: HTMLDivElement | null) => void
  onFocus: () => void
  onInput: (el: HTMLDivElement) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onToggleDone: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Only write innerHTML when it differs (avoids clobbering the caret while typing).
  useLayoutEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== line.html) el.innerHTML = line.html
  }, [line.html])

  const cls =
    isTitle && line.kind === 'text'
      ? 'text-lg font-semibold text-zinc-50'
      : line.kind === 'done'
        ? 'text-[15px] text-zinc-500 line-through'
        : 'text-[15px] text-zinc-100'

  return (
    <div className="flex items-start gap-2">
      {line.kind !== 'text' && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleDone}
          aria-label={line.kind === 'done' ? 'Mark not done' : 'Mark done'}
          className={`mt-[3px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border-2 text-[12px] leading-none text-white ${
            line.kind === 'done' ? 'border-green-500 bg-green-500' : 'border-zinc-600'
          }`}
        >
          {line.kind === 'done' ? '✓' : ''}
        </button>
      )}
      <div
        ref={(el) => {
          ref.current = el
          registerEl(el)
        }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        data-placeholder={isTitle ? PLACEHOLDER : ''}
        spellCheck={false}
        onFocus={onFocus}
        onInput={(e) => onInput(e.currentTarget)}
        onKeyDown={onKeyDown}
        className={`w-full whitespace-pre-wrap break-words leading-6 outline-none empty:before:text-zinc-600 empty:before:content-[attr(data-placeholder)] ${cls}`}
      />
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
