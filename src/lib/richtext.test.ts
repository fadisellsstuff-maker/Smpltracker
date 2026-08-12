import { describe, expect, it } from 'vitest'
import { linesToRich, parseRawToLines, plainOf, richToLines, serializeLines } from './richtext'
import { parseNotes } from './parser'

describe('richtext', () => {
  it('strips inline formatting to plain text', () => {
    expect(plainOf('<b>Bench</b> press')).toBe('Bench press')
    expect(plainOf('<span class="rt-lg">Push</span> <u>day</u>')).toBe('Push day')
    expect(plainOf('a &amp; b &lt;c&gt;')).toBe('a & b <c>')
  })

  it('round-trips checkbox markers through serialize', () => {
    const raw = 'Push day\n[v] Bench 3x8 40kg\n[ ] Dips 3x10'
    const lines = parseRawToLines(raw)
    expect(lines.map((l) => l.kind)).toEqual(['text', 'done', 'todo'])
    expect(serializeLines(lines)).toBe(raw)
  })

  it('serialize drops formatting but keeps text + markers for the parser', () => {
    const lines = [
      { id: 1, kind: 'text' as const, html: '<b>Push day</b>' },
      { id: 2, kind: 'done' as const, html: '<u>Bench</u> 3x8 40kg' },
    ]
    const raw = serializeLines(lines)
    expect(raw).toBe('Push day\n[v] Bench 3x8 40kg')
    // and the parser still extracts the exercise from the formatted note
    const blocks = parseNotes(raw)
    const ex = blocks.flatMap((b) => b.draft.exercises).filter((e) => e.canonicalId)
    expect(ex.some((e) => e.canonicalId === 'bench-press')).toBe(true)
  })

  it('rich JSON round-trips lines (kind + html)', () => {
    const lines = parseRawToLines('Title\n[v] done item')
    lines[0].html = '<b>Title</b>'
    const json = linesToRich(lines)
    const back = richToLines(json)!
    expect(back.map((l) => l.kind)).toEqual(['text', 'done'])
    expect(back[0].html).toBe('<b>Title</b>')
    expect(serializeLines(back)).toBe('Title\n[v] done item')
  })

  it('richToLines returns null for bad input', () => {
    expect(richToLines(undefined)).toBeNull()
    expect(richToLines('not json')).toBeNull()
    expect(richToLines('[]')).toBeNull()
  })
})
