import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toISODate, formatDMY } from '../lib/parser/dates'
import { loadDocLines, rebuildFromLines, saveMaster } from '../lib/notesdoc'
import { toggleBig } from '../lib/richdom'
import {
  countWorkouts,
  currentBlock,
  handleBackspace,
  handleCheckboxClick,
  handleEnter,
  insertTextBlocks,
  isDateText,
  linesToHtml,
  normalizeBlocks,
  readLines,
  serializeSelection,
  textToBlocks,
  toggleCheckboxBlock,
} from '../lib/docdom'

export function NotesDoc() {
  const [params] = useSearchParams()
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [count, setCount] = useState(0)

  const ref = useRef<HTMLDivElement | null>(null)
  const dirty = useRef(false)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Build the document once (uncontrolled — the browser owns editing after this).
  useEffect(() => {
    loadDocLines().then((lines) => {
      const el = ref.current
      if (!el) return
      el.innerHTML = linesToHtml(lines)
      const shared = [params.get('title'), params.get('text')].filter(Boolean).join('\n')
      if (shared) {
        el.insertAdjacentHTML('beforeend', textToBlocks(shared))
        dirty.current = true
      } else if (params.get('append') === '1') {
        el.insertAdjacentHTML('beforeend', '<div class="ln"><br></div>')
      }
      normalizeBlocks(el)
      setCount(countWorkouts(el))
      setLoaded(true)
      // Show the newest (bottom) first.
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'end' })
        if (shared || params.get('append') === '1') focusLast(el)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild the derived tables when leaving, if edited.
  useEffect(() => {
    const el = ref.current
    return () => {
      if (dirty.current && el) void rebuildFromLines(readLines(el))
    }
  }, [])

  const markDirty = () => {
    dirty.current = true
    setSaved(false)
    const el = ref.current
    if (!el) return
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      saveMaster(readLines(el))
      setCount(countWorkouts(el))
    }, 700)
  }

  const onInput = () => {
    const block = currentBlock()
    if (block) {
      if (!block.classList.contains('ln')) block.classList.add('ln')
      if (!block.querySelector('.cb')) block.classList.toggle('date', isDateText(block.textContent || ''))
    }
    markDirty()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (handleEnter()) {
        e.preventDefault()
        const el = ref.current
        if (el) normalizeBlocks(el)
        markDirty()
      }
    } else if (e.key === 'Backspace') {
      if (handleBackspace()) {
        e.preventDefault()
        markDirty()
      }
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    if (/\r?\n/.test(text)) insertTextBlocks(text)
    else document.execCommand('insertText', false, text)
    const el = ref.current
    if (el) normalizeBlocks(el)
    markDirty()
  }

  const onCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const s = serializeSelection()
    if (s != null) {
      e.clipboardData.setData('text/plain', s)
      e.preventDefault()
    }
  }

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (handleCheckboxClick(e.target)) markDirty()
  }

  // Toolbar
  const focusEditor = () => ref.current?.focus()
  const inline = (cmd: 'bold' | 'underline') => {
    focusEditor()
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(cmd)
    markDirty()
  }
  const big = () => {
    focusEditor()
    toggleBig()
    markDirty()
  }
  const checkbox = () => {
    focusEditor()
    toggleCheckboxBlock()
    const el = ref.current
    if (el) normalizeBlocks(el)
    markDirty()
  }

  const addWorkout = () => {
    const el = ref.current
    if (!el) return
    el.insertAdjacentHTML(
      'beforeend',
      textToBlocks(`${formatDMY(toISODate(new Date()))}\n`),
    )
    normalizeBlocks(el)
    focusLast(el)
    el.querySelector(':scope > .ln:last-child')?.scrollIntoView({ block: 'center' })
    markDirty()
  }

  async function save() {
    const el = ref.current
    if (!el) return
    setSaving(true)
    dirty.current = false
    try {
      await rebuildFromLines(readLines(el))
      setSaved(true)
      setCount(countWorkouts(el))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{loaded ? `${count} workouts` : 'Loading…'}</span>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      <p className="mb-2 text-[11px] text-zinc-600">
        One notes file — select across lines to copy, tap ✓ boxes, paste workouts to reuse.
      </p>

      {/* The whole document is ONE editable surface → native multi-line select/copy/paste. */}
      <div
        ref={ref}
        className="ln-doc min-h-[45vh] flex-1 whitespace-pre-wrap break-words text-[15px] leading-6 text-zinc-100 outline-none"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        spellCheck={false}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCopy={onCopy}
        onClick={onClick}
      />

      <button
        onClick={addWorkout}
        className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-400"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">+</span>
        New workout
      </button>

      <div className="sticky bottom-24 mt-3 flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/85 px-2 py-2 backdrop-blur">
        <ToolBtn label="Bold" onClick={() => inline('bold')}>
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn label="Underline" onClick={() => inline('underline')}>
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn label="Bigger" onClick={big}>
          <span className="font-semibold">A+</span>
        </ToolBtn>
        <ToolBtn label="Checkbox" onClick={checkbox}>
          <span className="text-green-400">☑</span>
        </ToolBtn>
        <span className="ml-auto pr-1 text-[11px] text-zinc-600">select · copy · paste</span>
      </div>
    </div>
  )
}

function focusLast(el: HTMLElement): void {
  const last = el.querySelector(':scope > .ln:last-child') as HTMLElement | null
  if (!last) return
  const sel = window.getSelection()
  const r = document.createRange()
  const cb = last.querySelector('.cb')
  if (cb) r.setStartAfter(cb)
  else r.selectNodeContents(last)
  r.collapse(true)
  sel?.removeAllRanges()
  sel?.addRange(r)
  last.scrollIntoView({ block: 'center' })
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
