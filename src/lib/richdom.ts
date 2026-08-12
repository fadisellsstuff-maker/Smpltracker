// Browser-only DOM helpers for the contentEditable note editor.
const ALLOWED = new Set(['B', 'STRONG', 'U', 'EM', 'I', 'SPAN', 'BR'])

/** Keep only inline formatting tags; unwrap everything else, drop all attrs
 *  except class="rt-lg" on spans. Guards against pasted/exec-command markup. */
export function sanitizeHtml(html: string): string {
  const root = document.createElement('div')
  root.innerHTML = html
  const clean = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        clean(el)
        if (ALLOWED.has(el.tagName)) {
          const big = el.tagName === 'SPAN' && el.classList.contains('rt-lg')
          for (const a of Array.from(el.attributes)) el.removeAttribute(a.name)
          if (big) el.className = 'rt-lg'
          else if (el.tagName === 'SPAN') {
            // a plain span carries no meaning — unwrap it
            while (el.firstChild) node.insertBefore(el.firstChild, el)
            node.removeChild(el)
          }
        } else {
          while (el.firstChild) node.insertBefore(el.firstChild, el)
          node.removeChild(el)
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child)
      }
    }
  }
  clean(root)
  return root.innerHTML
}

/** Split a single-line contentEditable at the caret; returns {before, after} HTML.
 *  Mutates el to hold only `before`. */
export function splitAtCaret(el: HTMLElement): { before: string; after: string } {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return { before: el.innerHTML, after: '' }
  const range = sel.getRangeAt(0)
  const after = range.cloneRange()
  after.selectNodeContents(el)
  after.setStart(range.endContainer, range.endOffset)
  const frag = after.extractContents()
  const tmp = document.createElement('div')
  tmp.appendChild(frag)
  return { before: el.innerHTML, after: tmp.innerHTML }
}

/** True when the caret sits at offset 0 of the element (collapsed). */
export function caretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false
  const r = sel.getRangeAt(0)
  const probe = document.createRange()
  probe.selectNodeContents(el)
  probe.setEnd(r.startContainer, r.startOffset)
  return probe.toString().length === 0
}

/** Place the caret at a character offset within a rich element. */
export function setCaret(el: HTMLElement, offset: number): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  let remaining = offset
  let placed = false
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent!.length
      if (remaining <= len) {
        range.setStart(node, remaining)
        return true
      }
      remaining -= len
      return false
    }
    for (const c of Array.from(node.childNodes)) if (walk(c)) return true
    return false
  }
  placed = walk(el)
  if (!placed) {
    range.selectNodeContents(el)
    range.collapse(false)
  } else {
    range.collapse(true)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Wrap the current selection in <span class="rt-lg"> (or unwrap if already big). */
export function toggleBig(): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  // If the selection is fully inside an rt-lg span, unwrap it.
  const container = range.commonAncestorContainer
  const parentBig =
    (container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement)?.closest(
      'span.rt-lg',
    )
  if (parentBig) {
    while (parentBig.firstChild) parentBig.parentNode!.insertBefore(parentBig.firstChild, parentBig)
    parentBig.parentNode!.removeChild(parentBig)
    return
  }
  const span = document.createElement('span')
  span.className = 'rt-lg'
  try {
    span.appendChild(range.extractContents())
    range.insertNode(span)
    sel.removeAllRanges()
    const r = document.createRange()
    r.selectNodeContents(span)
    sel.addRange(r)
  } catch {
    /* selection spanned multiple blocks — ignore */
  }
}
