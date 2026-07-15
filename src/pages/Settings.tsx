import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { clearAll, exportAll, importAll, type ExportBundle } from '../lib/repo'
import { seedDemoData } from '../lib/seed'
import { Card, Pill, SectionTitle } from '../components/ui'
import { useSettings } from '../SettingsContext'

export function Settings() {
  const { settings, update } = useSettings()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const workoutCount = useLiveQuery(() => db.workouts.count(), [])

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function handleExport() {
    const bundle = await exportAll()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `smpltrack-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(file: File) {
    const bundle = JSON.parse(await file.text()) as ExportBundle
    await importAll(bundle)
    setMsg('Data imported.')
  }

  return (
    <div className="space-y-5">
      <SectionTitle>Settings</SectionTitle>

      <Card>
        <div className="mb-2 text-sm font-medium text-zinc-200">Units</div>
        <div className="flex gap-2">
          <Pill active={settings.units === 'kg'} onClick={() => update({ units: 'kg' })}>
            Kilograms
          </Pill>
          <Pill active={settings.units === 'lbs'} onClick={() => update({ units: 'lbs' })}>
            Pounds
          </Pill>
        </div>
      </Card>

      <Card>
        <div className="text-sm font-medium text-zinc-200">Claude API key (optional)</div>
        <p className="mt-1 text-xs text-zinc-500">
          Used only to parse unusual note lines the built-in rules can't handle. Stored on this
          device, sent directly to Anthropic. The app works fully without it.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={(e) => update({ apiKey: e.target.value.trim() })}
            placeholder="sk-ant-…"
            className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            className="rounded-lg bg-zinc-800 px-3 text-xs text-zinc-400"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <label className="mt-2 block text-xs text-zinc-500">
          Model
          <input
            type="text"
            value={settings.llmModel}
            onChange={(e) => update({ llmModel: e.target.value.trim() })}
            className="mt-1 w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </Card>

      <Card>
        <div className="text-sm font-medium text-zinc-200">Data</div>
        <p className="mt-1 text-xs text-zinc-500">
          {workoutCount ?? 0} workouts stored locally on this device.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => run('seed', async () => void (await seedDemoData()))}
            disabled={busy !== null}
            className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 disabled:opacity-50"
          >
            {busy === 'seed' ? 'Loading…' : 'Load demo data'}
          </button>
          <button
            onClick={handleExport}
            className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200"
          >
            Export JSON
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200"
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && run('import', () => handleImport(e.target.files![0]))}
          />
          <button
            onClick={() =>
              confirm('Delete ALL workouts and notes on this device?') &&
              run('clear', async () => {
                await clearAll()
                setMsg('All data cleared.')
              })
            }
            className="rounded-xl border border-red-900/50 px-4 py-2.5 text-sm font-medium text-red-400"
          >
            Clear all
          </button>
        </div>
        {msg && <p className="mt-3 text-xs text-amber-300">{msg}</p>}
      </Card>

      <p className="px-2 text-center text-xs text-zinc-600">
        SmplTrack keeps your training data on your device. It reflects what you did — it never tells
        you what to do.
      </p>
    </div>
  )
}
