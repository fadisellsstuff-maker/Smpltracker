// Single-surface notes document: native multi-line select+copy+paste, checkbox
// toggle, date dividers, save round-trip (idempotent) on the real 335-workout file.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://localhost:4192'
const shot = './scripts/shots'
mkdirSync(shot, { recursive: true })
const FILE = resolve('./context/WORKOUTlogidea.txt')

const errors = []
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
await b.defaultBrowserContext().overridePermissions(BASE, ['clipboard-read', 'clipboard-write'])
const p = await b.newPage()
await p.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 })
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
p.on('pageerror', (e) => errors.push(e.message))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const countWorkouts = () =>
  p.evaluate(
    () =>
      new Promise((res) => {
        const req = indexedDB.open('smpltrack')
        req.onsuccess = () => {
          const tx = req.result.transaction('workouts', 'readonly').objectStore('workouts').count()
          tx.onsuccess = () => res(tx.result)
        }
      }),
  )

try {
  // Import the real file
  await p.goto(`${BASE}/import`, { waitUntil: 'networkidle2' })
  await p.evaluate(() => { indexedDB.deleteDatabase('smpltrack'); localStorage.removeItem('smpltrack.notesdoc') })
  await p.goto(`${BASE}/import`, { waitUntil: 'networkidle2' })
  await wait(300)
  ;(await p.$('input[type=file]')).uploadFile(FILE)
  await wait(3500)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Import all/.test(x.textContent))?.click())
  await wait(6000)

  // Open the document
  const t0 = Date.now()
  await p.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await p.waitForFunction(() => document.querySelector('.ln-doc .ln'), { timeout: 15000 })
  const mountMs = Date.now() - t0
  await wait(800)
  const layout = await p.evaluate(() => ({
    lines: document.querySelectorAll('.ln-doc > .ln').length,
    dateDividers: document.querySelectorAll('.ln-doc > .ln.date').length,
    checkboxes: document.querySelectorAll('.ln-doc .cb').length,
    workoutsLabel: (document.body.innerText.match(/(\d+) workouts/) || [])[1],
  }))
  console.log('mount ms:', mountMs, '| ', JSON.stringify(layout))
  await p.screenshot({ path: `${shot}/30-single-doc.png` })

  // MULTI-LINE SELECT across two adjacent content lines, then Ctrl+C
  const selected = await p.evaluate(() => {
    const lns = [...document.querySelectorAll('.ln-doc > .ln')]
    let i = lns.findIndex((l, idx) => idx > 0 && !l.classList.contains('date') && l.textContent.trim())
    const a = lns[i]
    const b = lns[i + 1] && lns[i + 1].textContent.trim() ? lns[i + 1] : lns[i]
    const r = document.createRange()
    r.setStart(a, 0)
    r.setEnd(b, b.childNodes.length)
    const s = getSelection()
    s.removeAllRanges()
    s.addRange(r)
    return { a: a.textContent, b: b.textContent, multi: a !== b }
  })
  await p.keyboard.down('Control')
  await p.keyboard.press('c')
  await p.keyboard.up('Control')
  await wait(300)
  const clip = await p.evaluate(() => navigator.clipboard.readText())
  console.log('selected 2 lines:', selected.multi, '| clip lines:', JSON.stringify(clip).slice(0, 90))
  console.log('multi-line copy has 2+ lines:', /\r?\n/.test(clip))

  // PASTE a multi-line workout at the bottom
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /New workout/.test(x.textContent)).click())
  await wait(300)
  const beforeLines = await p.evaluate(() => document.querySelectorAll('.ln-doc > .ln').length)
  await p.evaluate(() => {
    const el = document.querySelector('.ln-doc')
    el.focus()
    const dt = new DataTransfer()
    dt.setData('text/plain', 'Leg day\n[v] Squat 5x5 100kg\n[ ] RDL 3x10 80kg')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await wait(400)
  const afterState = await p.evaluate(() => ({
    lines: document.querySelectorAll('.ln-doc > .ln').length,
    hasSquat: /Squat 5x5 100kg/.test(document.body.innerText),
    newCheckboxes: [...document.querySelectorAll('.ln-doc .ln.done, .ln-doc .ln.todo')].some((l) =>
      /Squat|RDL/.test(l.textContent),
    ),
  }))
  console.log('paste added lines:', beforeLines, '→', afterState.lines, '| Squat present:', afterState.hasSquat, '| pasted checkboxes:', afterState.newCheckboxes)

  // CHECKBOX toggle: click a checkbox, confirm class flip
  const toggled = await p.evaluate(() => {
    const cb = document.querySelector('.ln-doc .ln.todo .cb, .ln-doc .ln.done .cb')
    if (!cb) return 'no-cb'
    const ln = cb.closest('.ln')
    const was = ln.classList.contains('done')
    cb.click()
    return `${was ? 'done' : 'todo'} -> ${ln.classList.contains('done') ? 'done' : 'todo'}`
  })
  console.log('checkbox toggle:', toggled)

  // SAVE (rebuild) and idempotency
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save').click())
  await wait(2500)
  const c1 = await countWorkouts()
  await p.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await p.waitForFunction(() => document.querySelector('.ln-doc .ln'), { timeout: 15000 })
  await wait(600)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save').click())
  await wait(2500)
  const c2 = await countWorkouts()
  console.log('workouts after 1st/2nd save:', c1, '/', c2, '(idempotent:', c1 === c2, ')')

  await p.goto(`${BASE}/onlyformygf`, { waitUntil: 'networkidle2' })
  await wait(500)
  console.log('persona:', await p.evaluate(() => document.documentElement.dataset.persona))

  console.log(errors.length ? `\n❌ errors: ${errors.slice(0, 6).join(' | ')}` : '\n✅ no page errors')
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await b.close()
}
