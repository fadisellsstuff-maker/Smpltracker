export type Units = 'kg' | 'lbs'

export interface Settings {
  units: Units
  apiKey: string
  llmModel: string
  heatWindowDays: 7 | 30
}

const KEY = 'smpltrack.settings'

const DEFAULTS: Settings = {
  units: 'kg',
  apiKey: '',
  llmModel: 'claude-haiku-4-5-20251001',
  heatWindowDays: 7,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

const KG_PER_LB = 0.45359237

/** Convert a kg value to the user's display unit, rounded to 1 decimal. */
export function displayWeight(kg: number | undefined, units: Units): number | undefined {
  if (kg == null) return undefined
  const v = units === 'lbs' ? kg / KG_PER_LB : kg
  return Math.round(v * 10) / 10
}

export function unitLabel(units: Units): string {
  return units
}
