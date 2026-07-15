import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { parseNotes, type ParsedBlock } from '../lib/parser'
import { parseLinesWithLlm } from '../lib/parser/llm'
import { formatDMY } from '../lib/parser/dates'
import { resolveDuplicateDates } from '../lib/importDates'
import { getUserAliasMap, learnAlias, saveWorkout } from '../lib/repo'
import type { DraftWorkout, NoteSource } from '../lib/types'
import { ReviewWorkout } from '../components/ReviewWorkout'
import { Card, SectionTitle } from '../components/ui'
import { useSettings } from '../SettingsContext'

const SAMPLE = `27/1/23 Fri
Upper day
[v] bench 3x8,5,5 30,40kg
[v] incline db press 4x8 25p
[v] pull ups 3x8 26kg
[ ] lat pulldowns 3x10`

export function Ingest() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [text, setText] = useState('')
  const [source, setSource] = useState<NoteSource>('paste')
  const [single, setSingle] = useState<{ draft: DraftWorkout; rawText: string } | null>(null)
  const [multi, setMulti] = useState<ParsedBlock[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Web Share Target lands here with ?text=... (and sometimes ?title=).
  useEffect(() => {
    const shared = [params.get('title'), params.get('text')].filter(Boolean).join('\n')
    if (shared) {
      setText(shared)
      setSource('share')
    }
  }, [params])

  async function handleParse(inputText: string, src: NoteSource) {
    setError(null)
    setBusy(true)
    try {
      const aliases = await getUserAliasMap()
      const blocks = parseNotes(inputText, { userAliases: aliases })

      if (blocks.length > 1) {
        // Bulk history import — fix forgotten-date duplicates, then summary + import all.
        resolveDuplicateDates(blocks)
        setSource(src)
        setMulti(blocks)
        setSingle(null)
        return
      }

      const parsed = blocks[0].draft
      // Hybrid: send unmatched lines to the LLM when a key is configured.
      if (parsed.unparsedLines.length > 0 && settings.apiKey) {
        try {
          const llm = await parseLinesWithLlm(parsed.unparsedLines, settings.apiKey, settings.llmModel, aliases)
          parsed.exercises.push(...llm)
          parsed.unparsedLines = []
        } catch (e) {
          setError(`LLM fallback failed (rules still applied): ${(e as Error).message}`)
        }
      }
      setSource(src)
      setSingle({ draft: parsed, rawText: blocks[0].rawText })
      setMulti(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(file: File) {
    const content = await file.text()
    setText(content.slice(0, 4000)) // preview only; parse the whole thing
    await handleParse(content, 'file')
  }

  async function handleSaveSingle() {
    if (!single) return
    const draft = single.draft
    const valid = draft.exercises.filter((e) => e.canonicalId && e.sets.length > 0)
    if (valid.length === 0) {
      setError('Add at least one exercise with sets before saving.')
      return
    }
    setBusy(true)
    try {
      for (const e of valid) {
        const raw = e.rawLine.split(/\d/)[0]?.trim()
        if (raw && e.canonicalId && raw.length > 1) await learnAlias(raw, e.canonicalId)
      }
      await saveWorkout({ ...draft, exercises: valid }, single.rawText, source)
      navigate('/')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportAll() {
    if (!multi) return
    setBusy(true)
    try {
      let done = 0
      for (const { draft, rawText } of multi) {
        const valid = draft.exercises.filter((e) => e.canonicalId && e.sets.length > 0)
        if (valid.length === 0) continue
        await saveWorkout({ ...draft, exercises: valid }, rawText, source)
        done++
        if (done % 10 === 0) setProgress(`Imported ${done} / ${multi.length}…`)
      }
      navigate('/history')
    } finally {
      setBusy(false)
    }
  }

  // --- Bulk import summary ---
  if (multi) {
    const totalEx = multi.reduce((n, b) => n + b.draft.exercises.filter((e) => e.canonicalId).length, 0)
    const unmatched = multi.reduce((n, b) => n + b.draft.exercises.filter((e) => !e.canonicalId).length, 0)
    const dates = multi.map((b) => b.draft.date).sort()
    const movedCount = multi.filter((b) => b.draft.moved).length
    return (
      <div className="space-y-4">
        <SectionTitle hint={source}>Import history</SectionTitle>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Card>
          <div className="text-3xl font-bold text-zinc-50">{multi.length} workouts</div>
          <p className="mt-1 text-sm text-zinc-400">
            {formatDMY(dates[0])} → {formatDMY(dates[dates.length - 1])} · {totalEx} exercises
            {unmatched > 0 && <span className="text-zinc-500"> · {unmatched} lines unmatched</span>}
          </p>
          {movedCount > 0 && (
            <p className="mt-1 text-xs text-amber-300">
              {movedCount} workout{movedCount > 1 ? 's' : ''} had a duplicate date and were shifted a
              day (marked with a yellow dot in the calendar).
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            Only items you checked ({''}
            <span className="text-zinc-300">[v]</span>) are imported. Unchecked ({''}
            <span className="text-zinc-300">[ ]</span>) lines are skipped.
          </p>
        </Card>

        <div className="max-h-72 space-y-1.5 overflow-y-auto">
          {multi.slice(0, 60).map((b, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-zinc-900/60 px-3 py-2 text-sm">
              <span className="text-zinc-300">{b.draft.title || 'Workout'}</span>
              <span className="text-xs text-zinc-500">
                {b.draft.moved && <span className="mr-1 text-amber-400">●</span>}
                {formatDMY(b.draft.date)} · {b.draft.exercises.filter((e) => e.canonicalId).length} ex
              </span>
            </div>
          ))}
          {multi.length > 60 && (
            <p className="py-2 text-center text-xs text-zinc-600">+ {multi.length - 60} more…</p>
          )}
        </div>

        {progress && <p className="text-center text-sm text-amber-300">{progress}</p>}
        <div className="flex gap-2">
          <button onClick={() => setMulti(null)} className="flex-1 rounded-xl bg-zinc-800 py-3 font-medium text-zinc-300">
            Back
          </button>
          <button
            onClick={handleImportAll}
            disabled={busy}
            className="flex-[2] rounded-xl bg-red-500 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Importing…' : `Import all ${multi.length}`}
          </button>
        </div>
      </div>
    )
  }

  // --- Single workout review ---
  if (single) {
    return (
      <div className="space-y-4">
        <SectionTitle hint={source === 'share' ? 'from share' : source}>Review workout</SectionTitle>
        {error && <ErrorNote>{error}</ErrorNote>}
        <ReviewWorkout draft={single.draft} units={settings.units} onChange={(draft) => setSingle({ ...single, draft })} />
        <div className="flex gap-2">
          <button onClick={() => setSingle(null)} className="flex-1 rounded-xl bg-zinc-800 py-3 font-medium text-zinc-300">
            Back
          </button>
          <button
            onClick={handleSaveSingle}
            disabled={busy}
            className="flex-[2] rounded-xl bg-red-500 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save workout'}
          </button>
        </div>
      </div>
    )
  }

  // --- Input ---
  return (
    <div className="space-y-4">
      <SectionTitle>Add workout</SectionTitle>
      <p className="text-sm text-zinc-400">
        Paste a note, import a text file, or share from Samsung Notes. Checklist notes are supported —
        only items ticked <span className="text-zinc-200">[v]</span> get logged. A file with several
        dated workouts imports them all at once.
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Card>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          placeholder={SAMPLE}
          className="w-full resize-none rounded-lg bg-zinc-800 p-3 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => handleParse(text, source === 'share' ? 'share' : 'paste')}
            disabled={busy || !text.trim()}
            className="rounded-xl bg-red-500 px-5 py-2.5 font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Parsing…' : 'Parse'}
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-xl bg-zinc-800 px-4 py-2.5 font-medium text-zinc-300">
            Import .txt
          </button>
          <button onClick={() => setText(SAMPLE)} className="rounded-xl bg-zinc-800 px-4 py-2.5 font-medium text-zinc-400">
            Try sample
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,text/plain"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
        {!settings.apiKey && (
          <p className="mt-3 text-xs text-zinc-500">
            Tip: add a Claude API key in Settings to auto-parse unusual lines the rules miss.
          </p>
        )}
      </Card>
    </div>
  )
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
      {children}
    </div>
  )
}
