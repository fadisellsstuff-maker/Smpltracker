import { EXERCISE_CATALOG } from '../catalog/exercises'
import { levenshtein, normalize } from './normalize'

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
  return contain?.id
}
