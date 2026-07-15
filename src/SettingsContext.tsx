import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadSettings, saveSettings, type Settings } from './lib/settings'

interface SettingsCtx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const Ctx = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const value = useMemo<SettingsCtx>(
    () => ({ settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })) }),
    [settings],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings must be used within SettingsProvider')
  return v
}
