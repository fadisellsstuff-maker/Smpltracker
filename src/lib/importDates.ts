import { addDaysISO } from './parser/dates'
import type { ParsedBlock } from './parser'

/**
 * Fix "forgot to change the date" duplicates in a bulk import. Processing blocks
 * in file order, a workout whose date repeats an earlier one is re-dated to the
 * day before the next distinct later date (or the previous date + 1 if none),
 * and flagged `moved` so the calendar can mark it. Mutates the drafts in place.
 */
export function resolveDuplicateDates(blocks: ParsedBlock[]): ParsedBlock[] {
  const originals = blocks.map((b) => b.draft.date)
  const used = new Set<string>()

  blocks.forEach((block, i) => {
    let date = block.draft.date
    if (used.has(date)) {
      const nextLater = originals.slice(i + 1).find((d) => d > date)
      const prev = i > 0 ? blocks[i - 1].draft.date : date
      let candidate = nextLater ? addDaysISO(nextLater, -1) : addDaysISO(prev, 1)
      if (candidate <= prev) candidate = addDaysISO(prev, 1)
      while (used.has(candidate)) candidate = addDaysISO(candidate, 1)
      block.draft.date = candidate
      block.draft.moved = true
      date = candidate
    }
    used.add(date)
  })
  return blocks
}
