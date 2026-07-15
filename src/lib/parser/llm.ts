import { getExercise } from '../catalog/exercises'
import type { DraftExercise } from '../types'
import { matchExercise } from './matcher'
import { parseSets } from './sets'

interface LlmSet {
  reps: number
  weightKg?: number | null
}
interface LlmExercise {
  name: string
  sets: LlmSet[]
}

/**
 * Ask Claude to structure lines the rule parser couldn't handle. Returns one
 * DraftExercise per recognized exercise, matched back into the catalog when
 * possible. Throws on network/auth errors so the caller can surface them.
 */
export async function parseLinesWithLlm(
  lines: string[],
  apiKey: string,
  model: string,
  userAliases?: Map<string, string>,
): Promise<DraftExercise[]> {
  if (!lines.length) return []

  const prompt = `You extract structured strength-training data from messy workout notes.
For each line below that describes an exercise, output the exercise and its sets.
Rules:
- Return ONLY a JSON array, no prose.
- Each item: {"name": string, "sets": [{"reps": number, "weightKg": number|null}]}
- Convert pounds to kilograms (1 lb = 0.4536 kg), round to 1 decimal.
- Bodyweight movements use weightKg: null.
- "3x8" means 3 sets of 8 reps. "100x5,5,5" means weight 100kg for reps 5,5,5.
- Skip lines that are not exercises (headers, dates, notes).

Lines:
${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 200)}`)
  }

  const json = (await res.json()) as { content?: { text?: string }[] }
  const text = json.content?.map((c) => c.text ?? '').join('') ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []

  let parsed: LlmExercise[]
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return []
  }

  return parsed
    .filter((e) => e?.name && Array.isArray(e.sets) && e.sets.length)
    .map((e) => {
      const canonicalId = matchExercise(e.name, userAliases)
      return {
        name: canonicalId ? getExercise(canonicalId)!.name : e.name,
        canonicalId,
        sets: e.sets.map((s) => ({
          reps: Math.round(s.reps),
          weightKg: s.weightKg == null ? undefined : s.weightKg,
        })),
        rawLine: e.name,
        parsedBy: 'llm' as const,
      }
    })
    .filter((e) => e.sets.every((s) => s.reps > 0))
}

/** Re-run the rule parser on a single line (used when editing in review). */
export function reparseLine(line: string, userAliases?: Map<string, string>): DraftExercise | null {
  const canonicalId = matchExercise(line, userAliases)
  const bodyweight = canonicalId ? !!getExercise(canonicalId)?.bodyweight : false
  const { sets } = parseSets(line, bodyweight)
  if (!canonicalId && sets.length === 0) return null
  return {
    name: canonicalId ? getExercise(canonicalId)!.name : line,
    canonicalId,
    sets,
    rawLine: line,
    parsedBy: canonicalId && sets.length ? 'rules' : 'unparsed',
  }
}
