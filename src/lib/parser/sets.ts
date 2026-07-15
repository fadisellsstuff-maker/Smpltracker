import type { SetEntry } from '../types'

export interface SetParseResult {
  sets: SetEntry[]
  /** Weight unit detected on the line, if any. */
  unit?: 'kg' | 'lbs'
}

const LBS_PER_KG = 2.2046226218

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / LBS_PER_KG) * 10) / 10
}

function detectUnit(line: string): 'kg' | 'lbs' | undefined {
  if (/(?:lbs?|pounds?)\b/i.test(line) || /\d\s*#/.test(line)) return 'lbs'
  if (/(?:kgs?|kilos?)\b/i.test(line)) return 'kg'
  return undefined
}

/** Explicit weight: from `@`, `at/with/w`, or a number directly tagged with a unit. */
function extractWeight(line: string): { value: number; unit?: 'kg' | 'lbs' } | undefined {
  // Added weight in parentheses, e.g. "(26)" or "(19kg)" on a weighted pull-up/dip.
  const paren = line.match(/\((\d+(?:\.\d+)?)\s*(kg|kgs|lbs?|pounds?)?\)/i)
  if (paren) {
    const u = (paren[2] || '').toLowerCase()
    return { value: parseFloat(paren[1]), unit: u.startsWith('lb') || u.startsWith('pound') ? 'lbs' : u.startsWith('kg') ? 'kg' : undefined }
  }
  // "25p" — Samsung-note shorthand for a (per-dumbbell) working weight; no unit,
  // so it falls back to the default/line unit. Guarded so "20 pushups" won't match.
  const pMatch = line.match(/(\d+(?:\.\d+)?)p(?=[x×\s,)]|$)/i)
  if (pMatch) return { value: parseFloat(pMatch[1]), unit: undefined }
  const m =
    line.match(/@\s*(\d+(?:\.\d+)?)\s*(kg|kgs|lbs?|pounds?)?/i) ||
    line.match(/(?:^|\s)(?:at|w\/?|with)\s+(\d+(?:\.\d+)?)\s*(kg|kgs|lbs?|pounds?)?/i) ||
    line.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|lbs?|pounds?|#)/i)
  if (!m) return undefined
  const value = parseFloat(m[1])
  const u = (m[2] || '').toLowerCase()
  const unit =
    u.startsWith('kg') ? 'kg'
    : u.startsWith('lb') || u.startsWith('pound') || u === '#' ? 'lbs'
    : undefined
  return { value, unit }
}

function toKg(value: number, unit: 'kg' | 'lbs' | undefined): number {
  return unit === 'lbs' ? lbsToKg(value) : value
}

/**
 * Parse the set/rep/weight portion of a line into individual sets.
 * See parser.test.ts for the full list of supported formats.
 */
export function parseSets(raw: string, isBodyweight = false): SetParseResult {
  const line = raw.trim()
  const unit = detectUnit(line)
  const explicit = extractWeight(line)
  const explicitKg = explicit ? toKg(explicit.value, explicit.unit ?? unit) : undefined

  const w = () => explicitKg

  // A0) Weighted bodyweight "(N)xRxS" = S sets of R reps at added weight N
  //     (or "(N)xR" = one set). The parenthesized number is the added load.
  const parenSets = line.match(/\((\d+(?:\.\d+)?)\s*(?:kg|lbs?)?\)\s*[x×*]\s*(\d+)(?:\s*[x×*]\s*(\d+))?/i)
  if (parenSets) {
    const reps = +parenSets[2]
    const nSets = parenSets[3] ? +parenSets[3] : 1
    return { sets: Array.from({ length: nSets }, () => ({ reps, weightKg: explicitKg })), unit }
  }

  // A) "3 sets of 10"
  const setsOf = line.match(/(\d+)\s*sets?\s*(?:of|x|\*)?\s*(\d+)/i)
  if (setsOf) {
    const n = +setsOf[1]
    const reps = +setsOf[2]
    return { sets: Array.from({ length: n }, () => ({ reps, weightKg: w() })), unit }
  }

  // A number ≤ 10 leading an x-chain is a set count; a larger one is a weight.
  // (Set counts realistically top out well below the lightest logged weight.)
  const SET_MAX = 10

  // B) "N x replist" — either a weight (N>10) with per-set reps (100x5,5,5),
  //    or a set count (N≤10) whose per-set reps are the list (3x8,5,5 = 3 sets 8,5,5).
  const wxList = line.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\s*[,/]\s*\d+)+)/i)
  if (wxList) {
    const first = parseFloat(wxList[1])
    const reps = wxList[2].split(/[,/]/).map((n) => parseInt(n.trim(), 10))
    if (first > SET_MAX) {
      const weightKg = toKg(first, explicit?.unit ?? unit)
      return { sets: reps.map((r) => ({ reps: r, weightKg })), unit }
    }
    return { sets: reps.map((r) => ({ reps: r, weightKg: w() })), unit }
  }

  // C) x-separated chain.
  const chain = line.match(/\d+(?:\s*[x×*]\s*\d+)+/i)
  if (chain) {
    const nums = chain[0].split(/[x×*]/i).map((n) => parseInt(n.trim(), 10))

    if (nums.length === 2) {
      const [a, b] = nums
      // "3x8" = 3 sets of 8; "25x10" = 25kg for 10 reps (one set).
      if (a > SET_MAX && explicit === undefined) {
        return { sets: [{ reps: b, weightKg: toKg(a, unit) }], unit }
      }
      return { sets: Array.from({ length: a }, () => ({ reps: b, weightKg: w() })), unit }
    }

    // Preferred note format: weight × reps × sets (e.g. "60x8x3" = 3 sets of 8 @ 60).
    if (
      nums.length === 3 &&
      explicit === undefined &&
      !isBodyweight &&
      nums[0] > SET_MAX && // weight
      nums[1] >= 1 && nums[1] <= 30 && // reps
      nums[2] >= 1 && nums[2] <= 12 // sets
    ) {
      const [weight, reps, nSets] = nums
      const weightKg = toKg(weight, unit)
      return { sets: Array.from({ length: nSets }, () => ({ reps, weightKg })), unit }
    }

    // Weight followed by a per-set rep chain, e.g. "100x5x5x5".
    if (explicit === undefined && nums[0] > 12 && nums.slice(1).every((n) => n <= 30)) {
      const weightKg = toKg(nums[0], unit)
      return { sets: nums.slice(1).map((reps) => ({ reps, weightKg })), unit }
    }

    // otherwise every number is a per-set rep count (bodyweight chains)
    return { sets: nums.map((reps) => ({ reps, weightKg: w() })), unit }
  }

  // D) comma/slash rep list: "10,8,6" or "8/8/6"
  const list = line.match(/\b\d+(?:\s*[,/]\s*\d+)+/)
  if (list) {
    const reps = list[0].split(/[,/]/).map((n) => parseInt(n.trim(), 10))
    if (reps.every((r) => r > 0 && r <= 100)) {
      return { sets: reps.map((r) => ({ reps: r, weightKg: w() })), unit }
    }
  }

  // E) bare "x10"
  const bare = line.match(/[x×]\s*(\d+)\b/i)
  if (bare) return { sets: [{ reps: +bare[1], weightKg: w() }], unit }

  // F) time-based bodyweight hold: "60s", "2 min"
  if (isBodyweight) {
    const time = line.match(/(\d+)\s*(s|sec|secs|seconds|min|mins|minutes)\b/i)
    if (time) {
      const v = +time[1]
      return { sets: [{ reps: /min/i.test(time[2]) ? v * 60 : v }], unit }
    }
  }

  // G) lone rep count, e.g. "pushups 20"
  const lone = line.match(/\b(\d{1,3})\b(?!\s*[x×*])/)
  if (lone && explicit === undefined) {
    const v = +lone[1]
    if (v > 0 && v <= 100) return { sets: [{ reps: v, weightKg: w() }], unit }
  }

  return { sets: [], unit }
}
