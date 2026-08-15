// Verify per-workout Copy + multi-line paste in the continuous document.
import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://localhost:4186'

const errors = []
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const ctx = b.defaultBrowserContext()
await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write'])
const p = await b.newPage()
await p.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 })
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
p.on('pageerror', (e) => errors.push(e.message))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await p.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await p.evaluate(() => { indexedDB.deleteDatabase('smpltrack'); localStorage.removeItem('smpltrack.notesdoc') })
  await p.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await wait(500)

  // Build a workout: date line, then two exercise lines
  const first = await p.$('[contenteditable]')
  await first.click()
  await p.keyboard.type('12/8/2026')
  await p.keyboard.press('Enter')
  await p.keyboard.type('Bench press 3x8 40kg')
  await p.keyboard.press('Enter')
  await p.keyboard.type('OHP 3x8 20kg')
  await wait(300)

  // Copy the workout via its Copy button
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Copy/.test(x.textContent))?.click())
  await wait(400)
  const clip = await p.evaluate(() => navigator.clipboard.readText())
  console.log('clipboard after Copy:', JSON.stringify(clip))
  console.log('copy has full workout:', /12\/8\/2026/.test(clip) && /Bench press 3x8 40kg/.test(clip) && /OHP 3x8 20kg/.test(clip))

  // Add a new workout at bottom, then paste a multi-line workout into it
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /New workout/.test(x.textContent)).click())
  await wait(300)
  const before = await p.evaluate(() => document.querySelectorAll('[contenteditable]').length)
  await p.evaluate(() => {
    const eds = [...document.querySelectorAll('[contenteditable]')]
    const el = eds[eds.length - 1]
    el.focus()
    const dt = new DataTransfer()
    dt.setData('text/plain', 'Leg day\n[v] Squat 5x5 100kg\n[ ] RDL 3x10 80kg')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  await wait(500)
  const after = await p.evaluate(() => document.querySelectorAll('[contenteditable]').length)
  const bodyText = await p.evaluate(() => document.body.innerText)
  console.log('editable rows before/after paste:', before, '→', after)
  console.log('pasted content present:', /Squat 5x5 100kg/.test(bodyText) && /RDL 3x10 80kg/.test(bodyText))
  const pastedCheckboxes = await p.evaluate(
    () => [...document.querySelectorAll('button[aria-label^="Mark"]')].length,
  )
  console.log('checkbox widgets after paste:', pastedCheckboxes)

  console.log(errors.length ? `\n❌ errors: ${errors.slice(0, 5).join(' | ')}` : '\n✅ no page errors')
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await b.close()
}
