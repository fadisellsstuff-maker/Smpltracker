import { EXERCISE_CATALOG } from '../catalog/exercises'
import type { Muscle } from '../muscles'
import { levenshtein, normalize } from './normalize'

/**
 * When a name isn't a known exercise but mentions a muscle ("calf machine",
 * "glute ex", "big booty ex", "titty exercise"), we log it against that muscle
 * as the primary mover. Longer keywords are checked first so "hamstring" wins
 * over a stray "ham". Returned as a synthetic `m:<muscle>` id (see getExercise).
 */
const MUSCLE_KEYWORDS: [string, Muscle][] = [
  ['hamstrings', 'hamstrings'], ['hamstring', 'hamstrings'], ['hammy', 'hamstrings'],
  ['glutes', 'glutes'], ['glute', 'glutes'], ['booty', 'glutes'], ['butt', 'glutes'],
  ['calves', 'calves'], ['calfs', 'calves'], ['calf', 'calves'],
  ['pecs', 'chest'], ['pec', 'chest'], ['chest', 'chest'],
  ['titties', 'chest'], ['titty', 'chest'], ['tittie', 'chest'], ['tits', 'chest'],
  ['quads', 'quads'], ['quad', 'quads'],
  ['biceps', 'biceps'], ['bicep', 'biceps'],
  ['triceps', 'triceps'], ['tricep', 'triceps'],
  ['shoulders', 'side-delts'], ['shoulder', 'side-delts'], ['delts', 'side-delts'], ['delt', 'side-delts'],
  ['forearms', 'forearms'], ['forearm', 'forearms'],
  ['traps', 'traps'], ['trap', 'traps'],
  ['lats', 'lats'], ['lat', 'lats'],
  ['abs', 'abs'], ['core', 'abs'], ['ab', 'abs'],
]

/** Synthetic muscle id if the name mentions a muscle as a whole word, else undefined. */
function matchMuscleName(normalized: string): string | undefined {
  const padded = ` ${normalized} `
  for (const [kw, muscle] of MUSCLE_KEYWORDS) {
    if (padded.includes(` ${kw} `) || padded.includes(` ${kw}s `)) return `m:${muscle}`
  }
  return undefined
}

/** Filler words that carry no meaning for exercise identification. */
const FILLER = new Set([
  'some', 'heavy', 'light', 'easy', 'hard', 'quick', 'few', 'then', 'and',
  'did', 'also', 'more', 'the', 'a', 'of', 'with', 'warmup', 'warm', 'up',
  'working', 'sets', 'set', 'top', 'paused',
])

interface AliasEntry {
  alias: string
  canonicalId: string
}

const aliasIndex: AliasEntry[] = EXERCISE_CATALOG.flatMap((ex) =>
  [ex.name, ...ex.aliases].map((a) => ({ alias: normalize(a), canonicalId: ex.id })),
)

const exactMap = new Map(aliasIndex.map((e) => [e.alias, e.canonicalId]))

function stripFiller(s: string): string {
  return s
    .split(' ')
    .filter((t) => !FILLER.has(t))
    .join(' ')
}

/** Whole-token abbreviations the user writes in their notes. */
const ABBREVIATIONS: Record<string, string> = {
  bb: 'barbell',
  db: 'dumbbell',
  ez: 'ez bar',
}

/** Expand standalone bb/db/ez tokens so aliases like "barbell row" match. */
function expandAbbreviations(name: string): string {
  return name
    .split(' ')
    .map((t) => ABBREVIATIONS[t] ?? t)
    .join(' ')
}

/**
 * Match a free-text exercise name to a catalog id.
 * Order: user aliases -> exact alias -> filler-stripped exact -> fuzzy
 * (Levenshtein) -> whole-word containment of the longest alias.
 */
export function matchExercise(
  rawName: string,
  userAliases?: Map<string, string>,
): string | undefined {
  const name = expandAbbreviations(normalize(rawName))
  if (!name) return undefined

  if (userAliases?.has(name)) return userAliases.get(name)
  if (exactMap.has(name)) return exactMap.get(name)

  const stripped = stripFiller(name)
  if (stripped && exactMap.has(stripped)) return exactMap.get(stripped)
  if (stripped && userAliases?.has(stripped)) return userAliases.get(stripped)

  const target = stripped || name

  // Fuzzy: small edit distance against every alias (handles typos).
  let best: { id: string; dist: number; len: number } | undefined
  for (const { alias, canonicalId } of aliasIndex) {
    const maxDist = alias.length > 5 ? 2 : 1
    if (Math.abs(alias.length - target.length) > maxDist) continue
    const d = levenshtein(target, alias)
    if (d <= maxDist && (!best || d < best.dist)) {
      best = { id: canonicalId, dist: d, len: alias.length }
    }
  }
  if (best) return best.id

  // Containment: the longest alias that appears as whole words inside the name.
  let contain: { id: string; len: number } | undefined
  for (const { alias, canonicalId } of aliasIndex) {
    if (alias.length < 4) continue
    if (` ${target} `.includes(` ${alias} `) && (!contain || alias.length > contain.len)) {
      contain = { id: canonicalId, len: alias.length }
    }
  }
  if (contain) return contain.id

  // Final fallback: exercise named only by a muscle -> that muscle is primary.
  return matchMuscleName(target)
}
