import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toISODate, formatDMY } from '../lib/parser/dates'
import { isDateLine, loadDocLines, rebuildFromLines, saveMaster } from '../lib/notesdoc'
import { type Line, newLineId, parseRawToLines, plainOf } from '../lib/richtext'
import { caretAtStart, sanitizeHtml, setCaret, splitAtCaret, toggleBig } from '../lib/richdom'

const PLACEHOLDER = 'Start typing your workout…'
const SECTION_CHUNK = 30 // date-sections rendered per "load earlier" step

/** Indices where a new dated section begins (index 0 + every date line). */
function sectionStarts(lines: Line[]): number[] {
  const starts: number[] = []
  lines.forEach((l, i) => {
    if (i === 0 || isDateLine(l)) starts.push(i)
  })
  return starts.length ? starts : [0]
}

export function NotesDoc() {
  const [params] = useSearchParams()

  const [lines, setLines] = useState<Line[]>([{ id: newLineId(), kind: 'text', html: '' }])
  const [loaded, setLoaded] = useState(false)
  const [visibleSections, setVisibleSections] = useState(SECTION_CHUNK)
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [pending, setPending] = useState<{ id: number; caret: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const els = useRef(new Map<number, HTMLDivElement>())
  const linesRef = useRef(lines)
  linesRef.current = lines
  const dirty = useRef(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // Load the document (cached master or built from the DB), then handle share/append.
  useEffect(() => {
    loadDocLines().then((loadedLines) => {
      const shared = [params.get('title'), params.get('text')].filter(Boolean).join('\n')
      let next = loadedLines
      if (shared) {
        next = [...loadedLines, ...parseRawToLines(shared)]
        dirty.current = true
      } else if (params.get('append') === '1') {
        next = [...loadedLines, { id: newLineId(), kind: 'text', html: '' }]
      }
      setLines(next)
      setLoaded(true)
      if (shared || params.get('append') === '1') {
        const last = next[next.length - 1]
        setVisibleSections(9999)
        setPending({ id: last.id, caret: 0 })
      }
    })
  }, [params])

  // Persist the formatted draft (cheap) shortly after edits stop.
  useEffect(() => {
    if (!loaded || !dirty.current) return
    const t = setTimeout(() => saveMaster(linesRef.current), 600)
    return () => clearTimeout(t)
  }, [lines, loaded])

  // Rebuild the derived workout tables when leaving, if edited.
  useEffect(() => {
    return () => {
      if (dirty.current) void rebuildFromLines(linesRef.current)
    }
  }, [])

  // Scroll to the newest (bottom) on first load.
  useEffect(() => {
    if (loaded) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [loaded])

  // Apply pending focus + caret after a structural change.
  useLayoutEffect(() => {
    if (!pending) return
    const el = els.current.get(pending.id)
    if (el) {
      el.focus()
      setCaret(el, pending.caret)
      el.scrollIntoView({ block: 'nearest' })
    }
    setPending(null)
  }, [pending, lines])

  const markDirty = () => {
    dirty.current = true
    setSaved(false)
  }

  const idIndex = (id: number) => linesRef.current.findIndex((l) => l.id === id)

  const register = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) els.current.set(id, el)
    else els.current.delete(id)
  }, [])
  const onFocus = useCallback((id: number) => setFocusedId(id), [])
  const onInput = useCallback((id: number, el: HTMLDivElement) => {
    markDirty()
    const html = sanitizeHtml(el.innerHTML)
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, html } : l)))
  }, [])
  const onToggleDone = useCallback((id: number) => {
    markDirty()
    setLines((ls) =>
      ls.map((l) => (l.id === id ? { ...l, kind: l.kind === 'done' ? 'todo' : 'done' } : l)),
    )
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, id: number) => {
    const index = idIndex(id)
    const line = linesRef.current[index]
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      markDirty()
      if (line.kind !== 'text' && plainOf(line.html).trim() === '') {
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
        markDirty()
        setLines((ls) => ls.map((l, i) => (i === index ? { ...l, kind: 'text' } : l)))
      } else if (index > 0) {
        e.preventDefault()
        markDirty()
        const prev = linesRef.current[index - 1]
        const caret = plainOf(prev.html).length
        setLines((ls) => {
          const copy = ls.map((l, i) => (i === index - 1 ? { ...l, html: prev.html + line.html } : l))
          copy.splice(index, 1)
          return copy
        })
        setPending({ id: prev.id, caret })
      }
    }
  }, [])

  // Toolbar actions on the focused line.
  const withFocused = (fn: (el: HTMLDivElement, id: number) => void) => {
    if (focusedId == null) return
    const el = els.current.get(focusedId)
    if (!el) return
    el.focus()
    fn(el, focusedId)
    markDirty()
  }
  const applyInline = (cmd: 'bold' | 'underline') =>
    withFocused((el, id) => {
      document.execCommand('styleWithCSS', false, 'false')
      document.execCommand(cmd)
      setLines((ls) => ls.map((l) => (l.id === id ? { ...l, html: sanitizeHtml(el.innerHTML) } : l)))
    })
  const applyBig = () =>
    withFocused((el, id) => {
      toggleBig()
      setLines((ls) => ls.map((l) => (l.id === id ? { ...l, html: sanitizeHtml(el.innerHTML) } : l)))
    })
  const toggleCheckbox = () => {
    const target = focusedId ?? lines[lines.length - 1]?.id
    if (target == null) return
    markDirty()
    setLines((ls) =>
      ls.map((l) => (l.id === target ? { ...l, kind: l.kind === 'text' ? 'todo' : 'text' } : l)),
    )
    setPending({ id: target, caret: 0 })
  }

  const addWorkout = () => {
    markDirty()
    const dateLine: Line = { id: newLineId(), kind: 'text', html: formatDMY(toISODate(new Date())) }
    const blank: Line = { id: newLineId(), kind: 'text', html: '' }
    setVisibleSections(9999)
    setLines((ls) => [...ls, dateLine, blank])
    setPending({ id: blank.id, caret: 0 })
  }

  async function save() {
    setSaving(true)
    dirty.current = false // prevent the unmount handler from double-rebuilding
    try {
      await rebuildFromLines(linesRef.current)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return <div className="py-16 text-center text-zinc-500">Loading…</div>

  const starts = sectionStarts(lines)
  const renderStart = starts.length > visibleSections ? starts[starts.length - visibleSections] : 0
  const workoutCount = starts.length

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{workoutCount} workouts</span>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {renderStart > 0 && (
        <button
          onClick={() => setVisibleSections((v) => v + SECTION_CHUNK)}
          className="mb-2 rounded-lg border border-zinc-800 py-2 text-xs font-medium text-zinc-400"
        >
          ↑ Load earlier workouts
        </button>
      )}

      {/* The one continuous document. */}
      <div className="flex-1">
        {lines.slice(renderStart).map((line, i) => {
          const globalIndex = renderStart + i
          const date = isDateLine(line)
          return (
            <div key={line.id}>
              {date && globalIndex > 0 && (
                <div className="my-3 border-t border-dashed border-zinc-700" />
              )}
              <LineRow
                line={line}
                variant={date ? 'date' : 'normal'}
                showPlaceholder={lines.length <= 2 && globalIndex === 0}
                register={register}
                onFocus={onFocus}
                onInput={onInput}
                onKeyDown={onKeyDown}
                onToggleDone={onToggleDone}
              />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Add a new workout at the bottom. */}
      <button
        onClick={addWorkout}
        className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-400"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
          +
        </span>
        New workout
      </button>

      {/* Format bar above the tab bar. */}
      <div className="sticky bottom-24 mt-3 flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/85 px-2 py-2 backdrop-blur">
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
        <span className="ml-auto pr-1 text-[11px] text-zinc-600">tap ✓ boxes to toggle</span>
      </div>
    </div>
  )
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 w-9 items-center justify-center rounded-lg bg-zinc-800 text-sm text-zinc-200 active:bg-zinc-700"
    >
      {children}
    </button>
  )
}

interface RowProps {
  line: Line
  variant: 'date' | 'normal'
  showPlaceholder: boolean
  register: (id: number, el: HTMLDivElement | null) => void
  onFocus: (id: number) => void
  onInput: (id: number, el: HTMLDivElement) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, id: number) => void
  onToggleDone: (id: number) => void
}

const LineRow = memo(function LineRow({
  line,
  variant,
  showPlaceholder,
  register,
  onFocus,
  onInput,
  onKeyDown,
  onToggleDone,
}: RowProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== line.html) el.innerHTML = line.html
  }, [line.html])

  const cls =
    variant === 'date'
      ? 'text-xs font-semibold uppercase tracking-wide text-zinc-500'
      : line.kind === 'done'
        ? 'text-[15px] text-zinc-500 line-through'
        : 'text-[15px] text-zinc-100'

  return (
    <div className="flex items-start gap-2">
      {line.kind !== 'text' && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggleDone(line.id)}
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
          register(line.id, el)
        }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        data-placeholder={showPlaceholder ? PLACEHOLDER : ''}
        spellCheck={false}
        onFocus={() => onFocus(line.id)}
        onInput={(e) => onInput(line.id, e.currentTarget)}
        onKeyDown={(e) => onKeyDown(e, line.id)}
        className={`w-full whitespace-pre-wrap break-words leading-6 outline-none empty:before:text-zinc-600 empty:before:content-[attr(data-placeholder)] ${cls}`}
      />
    </div>
  )
})
