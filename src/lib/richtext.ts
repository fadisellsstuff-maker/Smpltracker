// Rich-text helpers for the note editor. Pure/DOM-free so they're unit-testable;
// the DOM-dependent caret/split logic lives in NoteEditor.
export type LineKind = 'text' | 'todo' | 'done'
export interface Line {
  id: number
  kind: LineKind
  /** Inline HTML: only <b>/<strong>/<u>/<em>/<i>/<span class="rt-lg"> + text. */
  html: string
}

const CHECKBOX_RE = /^\s*(?:[-*•]\s*)?\[([ xXvV])\]\s?(.*)$/

let idSeq = 1
export const newLineId = () => idSeq++

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Strip inline formatting tags to plain text (works without a DOM). */
export function plainOf(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function isBlank(line: Line): boolean {
  return plainOf(line.html).trim() === ''
}

/** Plain raw text (imported/legacy notes) → lines, escaping text into html. */
export function parseRawToLines(raw: string): Line[] {
  const rows = raw.split(/\r?\n/)
  const lines = rows.map((r): Line => {
    const m = r.match(CHECKBOX_RE)
    if (m) return { id: newLineId(), kind: /[xXvV]/.test(m[1]) ? 'done' : 'todo', html: escapeHtml(m[2]) }
    return { id: newLineId(), kind: 'text', html: escapeHtml(r) }
  })
  return lines.length ? lines : [{ id: newLineId(), kind: 'text', html: '' }]
}

/** Lines → plain rawText with the [v]/[ ] markers the parser expects. */
export function serializeLines(lines: Line[]): string {
  return lines
    .map((l) => {
      const t = plainOf(l.html)
      return l.kind === 'done' ? `[v] ${t}` : l.kind === 'todo' ? `[ ] ${t}` : t
    })
    .join('\n')
}

/** Serialize lines (kind + html) for faithful reload. */
export function linesToRich(lines: Line[]): string {
  return JSON.stringify(lines.map(({ kind, html }) => ({ kind, html })))
}

export function richToLines(json: string | undefined | null): Line[] | null {
  if (!json) return null
  try {
    const arr = JSON.parse(json) as { kind: LineKind; html: string }[]
    if (!Array.isArray(arr) || arr.length === 0) return null
    return arr.map((l) => ({ id: newLineId(), kind: l.kind === 'done' || l.kind === 'todo' ? l.kind : 'text', html: typeof l.html === 'string' ? l.html : '' }))
  } catch {
    return null
  }
}
