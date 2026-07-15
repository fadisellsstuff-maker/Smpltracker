import { describe, expect, it } from 'vitest'
import { resolveDuplicateDates } from './importDates'
import type { ParsedBlock } from './parser'

function block(date: string): ParsedBlock {
  return { rawText: '', draft: { date, exercises: [], unparsedLines: [] } }
}

describe('resolveDuplicateDates', () => {
  it('re-dates a duplicate to the day before the next distinct date (A,B,A,C)', () => {
    // dates in file order: A B A C -> the second A moves to C-1
    const blocks = [
      block('2023-02-13'), // A
      block('2023-02-14'), // B
      block('2023-02-13'), // A (duplicate — forgot to change)
      block('2023-02-16'), // C
    ]
    resolveDuplicateDates(blocks)
    expect(blocks.map((b) => b.draft.date)).toEqual([
      '2023-02-13',
      '2023-02-14',
      '2023-02-15', // C - 1
      '2023-02-16',
    ])
    expect(blocks[2].draft.moved).toBe(true)
    expect(blocks[0].draft.moved).toBeFalsy()
  })

  it('moves a trailing duplicate to previous + 1 when no later date exists', () => {
    const blocks = [block('2023-03-01'), block('2023-03-02'), block('2023-03-02')]
    resolveDuplicateDates(blocks)
    expect(blocks[2].draft.date).toBe('2023-03-03')
    expect(blocks[2].draft.moved).toBe(true)
  })

  it('bumps forward on collision, keeping dates distinct and ascending', () => {
    const blocks = [
      block('2023-01-01'),
      block('2023-01-01'),
      block('2023-01-01'),
      block('2023-01-05'),
    ]
    resolveDuplicateDates(blocks)
    const dates = blocks.map((b) => b.draft.date)
    expect(new Set(dates).size).toBe(4) // all distinct
    expect(dates[0]).toBe('2023-01-01')
    expect([...dates]).toEqual([...dates].sort()) // ascending order preserved
  })
})
