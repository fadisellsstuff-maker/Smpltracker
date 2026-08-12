import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseNotes, type ParsedBlock } from '../lib/parser'
import { formatDMY } from '../lib/parser/dates'
import { resolveDuplicateDates } from '../lib/importDates'
import { getUserAliasMap, saveWorkout } from '../lib/repo'
import { Card, SectionTitle } from '../components/ui'

const SAMPLE = `27/1/23 Fri
Upper day
[v] bench 3x8,5,5 30,40kg
[v] incline db press 4x8 25p
[v] pull ups 3x8 26kg
[ ] lat pulldowns 3x10`

const isIOS =
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const NOTES_APP = isIOS ? 'Apple Notes' : 'Samsung Notes'

export function Import() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [blocks, setBlocks] = useState<ParsedBlock[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [open, setOpen] = useState<'share' | 'paste' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function parse(content: string) {
    setBusy(true)
    try {
      const aliases = await getUserAliasMap()
      const parsed = parseNotes(content, { userAliases: aliases })
      resolveDuplicateDates(parsed)
      setBlocks(parsed)
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(file: File) {
    const content = await file.text()
    setText(content.slice(0, 4000))
    await parse(content)
  }

  async function importAll() {
    if (!blocks) return
    setBusy(true)
    try {
      let done = 0
      for (const { draft, rawText } of blocks) {
        const valid = draft.exercises.filter((e) => e.canonicalId && e.sets.length > 0)
        if (valid.length === 0 && draft.exercises.length === 0) continue
        await saveWorkout({ ...draft, exercises: valid }, rawText, 'file')
        done++
        if (done % 10 === 0) setProgress(`Imported ${done} / ${blocks.length}…`)
      }
      navigate('/notes')
    } finally {
      setBusy(false)
    }
  }

  // ---- Preview + confirm (after parsing) ----
  if (blocks) {
    const totalEx = blocks.reduce((n, b) => n + b.draft.exercises.filter((e) => e.canonicalId).length, 0)
    const unmatched = blocks.reduce((n, b) => n + b.draft.exercises.filter((e) => !e.canonicalId).length, 0)
    const moved = blocks.filter((b) => b.draft.moved).length
    const dates = blocks.map((b) => b.draft.date).sort()
    return (
      <div className="space-y-4">
        <SectionTitle>Import</SectionTitle>
        <Card>
          <div className="text-3xl font-bold text-zinc-50">
            {blocks.length} note{blocks.length > 1 ? 's' : ''}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {formatDMY(dates[0])} → {formatDMY(dates[dates.length - 1])} · {totalEx} exercises
            {unmatched > 0 && <span className="text-zinc-500"> · {unmatched} lines unmatched</span>}
          </p>
          {moved > 0 && (
            <p className="mt-1 text-xs text-amber-300">
              {moved} note{moved > 1 ? 's' : ''} had a duplicate date and were shifted a day (yellow
              dot in the calendar).
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Only items you checked (<span className="text-zinc-300">[v]</span>) are imported.
          </p>
        </Card>

        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {blocks.slice(0, 60).map((b, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-900/60 px-3 py-2 text-sm">
              <span className="text-zinc-300">{b.draft.title || 'Workout'}</span>
              <span className="text-xs text-zinc-500">
                {b.draft.moved && <span className="mr-1 text-amber-400">●</span>}
                {formatDMY(b.draft.date)} · {b.draft.exercises.filter((e) => e.canonicalId).length} ex
              </span>
            </div>
          ))}
          {blocks.length > 60 && (
            <p className="py-2 text-center text-xs text-zinc-600">+ {blocks.length - 60} more…</p>
          )}
        </div>

        {progress && <p className="text-center text-sm text-amber-300">{progress}</p>}
        <div className="flex gap-2">
          <button onClick={() => setBlocks(null)} className="flex-1 rounded-xl bg-zinc-800 py-3 font-medium text-zinc-300">
            Back
          </button>
          <button
            onClick={importAll}
            disabled={busy}
            className="flex-[2] rounded-xl bg-green-500 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Importing…' : `Import all ${blocks.length}`}
          </button>
        </div>
      </div>
    )
  }

  // ---- Choice sheet: how do you want to bring notes in? ----
  return (
    <div className="space-y-4">
      <SectionTitle>Import</SectionTitle>
      <p className="text-sm text-zinc-400">
        Bring in workouts from your notes app. Each dated workout becomes its own note; only{' '}
        <span className="text-zinc-200">[v]</span> items are logged.
      </p>

      {/* Share from the phone's notes app */}
      <Card>
        <button
          onClick={() => setOpen(open === 'share' ? null : 'share')}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-zinc-100">📝 From {NOTES_APP}</span>
          <span className="text-zinc-500">{open === 'share' ? '▲' : '▾'}</span>
        </button>
        {open === 'share' && (
          <div className="mt-3 space-y-2 text-sm text-zinc-400">
            {isIOS ? (
              <>
                <p>
                  iOS doesn't let web apps read Apple Notes directly. Fastest way:
                </p>
                <ol className="ml-4 list-decimal space-y-1 text-zinc-400">
                  <li>Open your workout note in Apple Notes</li>
                  <li>Select all → Copy</li>
                  <li>Come back here and use <span className="text-zinc-200">Paste text</span> below</li>
                </ol>
              </>
            ) : (
              <>
                <p>Send a note straight into SmplTrack from Samsung Notes:</p>
                <ol className="ml-4 list-decimal space-y-1 text-zinc-400">
                  <li>Install SmplTrack to your home screen (Add to Home screen)</li>
                  <li>In Samsung Notes open the note → <span className="text-zinc-200">Share</span></li>
                  <li>Pick <span className="text-zinc-200">SmplTrack</span> — the note opens here ready to save</li>
                </ol>
                <p className="text-xs text-zinc-500">
                  Or export the note to a .txt and use Upload below.
                </p>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Upload a .txt export */}
      <Card>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-zinc-100">📄 Upload .txt file</span>
          <span className="text-xs text-zinc-500">choose file ›</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/plain"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </Card>

      {/* Paste */}
      <Card>
        <button
          onClick={() => setOpen(open === 'paste' ? null : 'paste')}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-zinc-100">📋 Paste text</span>
          <span className="text-zinc-500">{open === 'paste' ? '▲' : '▾'}</span>
        </button>
        {open === 'paste' && (
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              placeholder={SAMPLE}
              className="w-full resize-none rounded-lg bg-zinc-800 p-3 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            <button
              onClick={() => parse(text)}
              disabled={busy || !text.trim()}
              className="mt-3 rounded-xl bg-green-500 px-5 py-2.5 font-semibold text-white disabled:opacity-40"
            >
              {busy ? 'Reading…' : 'Preview import'}
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
