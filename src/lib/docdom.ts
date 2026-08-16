// Single-contentEditable document helpers. The whole notes file is ONE editable
// surface so the browser gives native multi-line selection / copy / paste.
// Each line is a <div class="ln"> block; checkbox lines carry a leading
// contenteditable=false <span class="cb"> toggle plus a todo/done class.
import { DATE_HEADER_LINE_RE } from './parser'
import { type Line, escapeHtml, newLineId, plainOf } from './richtext'
import { sanitizeHtml } from './richdom'

const CB = '<span class="cb" contenteditable="false"></span>'

export function isDateText(text: string): boolean {
  return DATE_HEADER_LINE_RE.test(text.trim())
}

function blockHtml(line: Line): string {
  if (line.kind === 'todo' || line.kind === 'done')
    return `<div class="ln ${line.kind}">${CB}${line.html || ''}</div>`
  const isDate = isDateText(plainOf(line.html))
  const inner = line.html && line.html.trim() ? line.html : '<br>'
  return `<div class="ln${isDate ? ' date' : ''}">${inner}</div>`
}

export function linesToHtml(lines: Line[]): string {
  return (lines.length ? lines : [{ id: 0, kind: 'text', html: '' } as Line]).map(blockHtml).join('')
}

/** One line-of-text for a block, prefixed with the [v]/[ ] marker. */
function blockToText(block: HTMLElement): string {
  const kind = block.classList.contains('done') ? 'done' : block.classList.contains('todo') ? 'todo' : 'text'
  const clone = block.cloneNode(true) as HTMLElement
  clone.querySelector('.cb')?.remove()
  const t = plainOf(clone.innerHTML)
  return kind === 'done' ? `[v] ${t}` : kind === 'todo' ? `[ ] ${t}` : t
}

/** Read the editable surface back into structured lines (for save/rebuild). */
export function readLines(root: HTMLElement): Line[] {
  const out: Line[] = []
  root.querySelectorAll(':scope > *').forEach((el) => {
    const block = el as HTMLElement
    const kind = block.classList.contains('done') ? 'done' : block.classList.contains('todo') ? 'todo' : 'text'
    const clone = block.cloneNode(true) as HTMLElement
    clone.querySelector('.cb')?.remove()
    let html = sanitizeHtml(clone.innerHTML).trim()
    if (html === '<br>') html = ''
    out.push({ id: newLineId(), kind, html })
  })
  return out.length ? out : [{ id: newLineId(), kind: 'text', html: '' }]
}

/** Keep top-level children as `.ln` divs and (re)tag date lines so dividers stay
 *  live as the user types. Only touches classes → never disturbs the caret. */
export function normalizeBlocks(root: HTMLElement): void {
  root.querySelectorAll(':scope > *').forEach((el) => {
    if (el.tagName !== 'DIV') return
    const block = el as HTMLElement
    if (!block.classList.contains('ln')) block.classList.add('ln')
    const isCb = !!block.querySelector('.cb')
    const isDate = !isCb && isDateText(block.textContent || '')
    block.classList.toggle('date', isDate)
  })
}

export function countWorkouts(root: HTMLElement): number {
  let n = 0
  root.querySelectorAll(':scope > .ln').forEach((el, i) => {
    if (i === 0 || el.classList.contains('date')) n++
  })
  return Math.max(n, 1)
}

function closestLn(node: Node | null): HTMLElement | null {
  if (!node) return null
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement)
  return el?.closest('.ln') ?? null
}

export function currentBlock(): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  return closestLn(sel.getRangeAt(0).startContainer)
}

/** Serialize a multi-line selection to marker text; null if within one line
 *  (so single-line copy stays native). */
export function serializeSelection(): string | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const r = sel.getRangeAt(0)
  const start = closestLn(r.startContainer)
  const end = closestLn(r.endContainer)
  if (!start || !end || start === end) return null
  const blocks: HTMLElement[] = []
  let n: Element | null = start
  while (n) {
    blocks.push(n as HTMLElement)
    if (n === end) break
    n = n.nextElementSibling
  }
  return blocks.map(blockToText).join('\n')
}

/** Convert pasted plain text into block HTML, detecting [v]/[ ] checkboxes. */
export function textToBlocks(text: string): string {
  return text
    .split(/\r?\n/)
    .map((raw) => {
      const m = raw.match(/^\s*(?:[-*•]\s*)?\[([ xXvV])\]\s?(.*)$/)
      if (m) {
        const done = /[xXvV]/.test(m[1])
        return `<div class="ln ${done ? 'done' : 'todo'}">${CB}${escapeHtml(m[2])}</div>`
      }
      const isDate = isDateText(raw)
      return `<div class="ln${isDate ? ' date' : ''}">${escapeHtml(raw) || '<br>'}</div>`
    })
    .join('')
}

function placeCaretEnd(block: HTMLElement): void {
  const sel = window.getSelection()
  if (!sel) return
  const r = document.createRange()
  r.selectNodeContents(block)
  r.collapse(false)
  sel.removeAllRanges()
  sel.addRange(r)
}

/** Insert pasted text as clean top-level sibling blocks at the caret (reliable,
 *  unlike execCommand which can nest blocks inside the current line). */
export function insertTextBlocks(text: string): void {
  const block = currentBlock()
  if (!block) return
  const tmp = document.createElement('div')
  tmp.innerHTML = textToBlocks(text)
  const blocks = Array.from(tmp.children) as HTMLElement[]
  if (!blocks.length) return
  const empty = !(block.textContent || '').trim() && !block.querySelector('.cb')
  let anchor = block
  if (empty) {
    block.replaceWith(blocks[0])
    anchor = blocks[0]
    for (let i = 1; i < blocks.length; i++) {
      anchor.after(blocks[i])
      anchor = blocks[i]
    }
  } else {
    for (const nb of blocks) {
      anchor.after(nb)
      anchor = nb
    }
  }
  placeCaretEnd(anchor)
}

/** Make the caret's block a checkbox line (or back to plain text). */
export function toggleCheckboxBlock(): void {
  const block = currentBlock()
  if (!block) return
  const cb = block.querySelector('.cb')
  if (cb) {
    cb.remove()
    block.classList.remove('todo', 'done')
  } else {
    block.classList.remove('date')
    block.classList.add('todo')
    block.insertAdjacentHTML('afterbegin', CB)
  }
}

/** True when the caret sits at the very start of the block's editable text. */
function caretAtBlockStart(block: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
  const r = sel.getRangeAt(0)
  const probe = document.createRange()
  probe.selectNodeContents(block)
  const cb = block.querySelector('.cb')
  if (cb) probe.setStartAfter(cb)
  probe.setEnd(r.startContainer, r.startOffset)
  return probe.toString().length === 0
}

/** Enter: split the block at the caret; continue a checklist (unchecked) or exit
 *  an empty checkbox line. Returns true if handled. */
export function handleEnter(): boolean {
  const block = currentBlock()
  if (!block) return false
  const isCb = !!block.querySelector('.cb')
  const clone = block.cloneNode(true) as HTMLElement
  clone.querySelector('.cb')?.remove()
  const empty = plainOf(clone.innerHTML).trim() === ''

  if (isCb && empty) {
    block.querySelector('.cb')?.remove()
    block.classList.remove('todo', 'done')
    return true
  }

  const sel = window.getSelection()!
  const r = sel.getRangeAt(0)
  const after = r.cloneRange()
  after.selectNodeContents(block)
  after.setStart(r.endContainer, r.endOffset)
  const frag = after.extractContents()

  const next = document.createElement('div')
  next.className = isCb ? 'ln todo' : 'ln'
  if (isCb) next.insertAdjacentHTML('afterbegin', CB)
  next.appendChild(frag)
  if (!plainOf((next.cloneNode(true) as HTMLElement).innerHTML).trim()) next.appendChild(document.createElement('br'))
  block.after(next)

  const caret = document.createRange()
  const cb = next.querySelector('.cb')
  if (cb) caret.setStartAfter(cb)
  else caret.setStart(next, 0)
  caret.collapse(true)
  sel.removeAllRanges()
  sel.addRange(caret)
  return true
}

/** Backspace at the start of a checkbox line removes the checkbox first.
 *  Returns true if handled (caller preventDefaults). */
export function handleBackspace(): boolean {
  const block = currentBlock()
  if (!block) return false
  if (block.querySelector('.cb') && caretAtBlockStart(block)) {
    block.querySelector('.cb')!.remove()
    block.classList.remove('todo', 'done')
    return true
  }
  return false
}

/** Toggle the done state of a clicked checkbox; returns true if a box was hit. */
export function handleCheckboxClick(target: EventTarget | null): boolean {
  const el = target as HTMLElement
  const cb = el?.closest?.('.cb')
  if (!cb) return false
  const ln = cb.closest('.ln')
  if (!ln) return false
  if (ln.classList.contains('done')) {
    ln.classList.remove('done')
    ln.classList.add('todo')
  } else {
    ln.classList.remove('todo')
    ln.classList.add('done')
  }
  return true
}
