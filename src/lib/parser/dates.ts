/** Format a Date as local YYYY-MM-DD. */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Format a YYYY-MM-DD string as DD/MM/YYYY for display. */
export function formatDMY(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Add (or subtract) days to a YYYY-MM-DD string, returning YYYY-MM-DD. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/**
 * Try to find a date inside note text (usually the header line).
 * Handles: 2026-07-12, 12/07/2026, 12/07, 7 Jul, Jul 7, 23 Jul @ 6:55 PM.
 * `fallback` (e.g. the share timestamp) is used when nothing is found.
 */
export function detectDate(text: string, fallback: Date): string {
  const head = text.slice(0, 200)

  const iso = head.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (iso) {
    return toISODate(new Date(+iso[1], +iso[2] - 1, +iso[3]))
  }

  // DD/MM or DD/MM/YYYY (day-first; note apps in most regions).
  const slash = head.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/)
  if (slash) {
    let day = +slash[1]
    let month = +slash[2]
    // If the first number can't be a day but the second can, swap (US M/D).
    if (day > 12 && month <= 12) {
      // already day-first, fine
    } else if (month > 12 && day <= 12) {
      ;[day, month] = [month, day]
    }
    let year = slash[3] ? +slash[3] : fallback.getFullYear()
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toISODate(new Date(year, month - 1, day))
    }
  }

  // "23 Jul" or "Jul 23"
  const dm = head.match(/\b(\d{1,2})\s+([a-z]{3,})\b/i)
  const md = head.match(/\b([a-z]{3,})\s+(\d{1,2})\b/i)
  if (dm && MONTHS[dm[2].slice(0, 3).toLowerCase()] !== undefined) {
    return toISODate(new Date(fallback.getFullYear(), MONTHS[dm[2].slice(0, 3).toLowerCase()], +dm[1]))
  }
  if (md && MONTHS[md[1].slice(0, 3).toLowerCase()] !== undefined) {
    return toISODate(new Date(fallback.getFullYear(), MONTHS[md[1].slice(0, 3).toLowerCase()], +md[2]))
  }

  return toISODate(fallback)
}
