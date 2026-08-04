// Verifies: real-checkbox editor, muscle-named exercises, and the pink persona.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://localhost:4179'
const shot = './scripts/shots'
mkdirSync(shot, { recursive: true })

const errors = []
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 })
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  // Fresh DB
  await page.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => indexedDB.deleteDatabase('smpltrack'))

  // --- Checkbox editor + muscle-named exercise ---
  await page.goto(`${BASE}/notes/new`, { waitUntil: 'networkidle2' })
  await wait(400)
  await page.type('textarea', 'Booty day')
  // toolbar checkbox -> current line becomes a checklist item; then type an exercise
  await page.keyboard.press('Enter')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Checkbox/.test(b.textContent))?.click())
  await wait(200)
  await page.keyboard.type('glute machine 3x12 40kg')
  await page.keyboard.press('Enter') // continues checklist as a new todo
  await page.keyboard.type('big booty ex 3x15')
  await wait(300)
  await page.screenshot({ path: `${shot}/30-checkbox-editor.png` })
  // tap the first checkbox to mark done
  await page.evaluate(() => document.querySelector('button[aria-label^="Mark"]')?.click())
  await wait(300)
  await page.screenshot({ path: `${shot}/31-checkbox-toggled.png` })
  const editorText = await page.evaluate(() => [...document.querySelectorAll('textarea')].map((t) => t.value).join(' | '))

  // Save
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save')?.click())
  await wait(500)
  const confirmText = await page.evaluate(() => document.body.innerText)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Save workout/.test(b.textContent))?.click())
  await wait(1200)

  // Verify muscle mapping saved (glutes primary)
  const primaries = await page.evaluate(
    () => new Promise((res) => {
      const r = indexedDB.open('smpltrack')
      r.onsuccess = () => {
        const tx = r.result.transaction('exercises', 'readonly').objectStore('exercises').getAll()
        tx.onsuccess = () => res(tx.result.map((e) => e.canonicalId))
      }
    }),
  )

  // --- Pink persona ---
  await page.goto(`${BASE}/onlyformygf/hi`, { waitUntil: 'networkidle2' })
  await wait(800)
  await page.screenshot({ path: `${shot}/32-persona-home.png` })
  const persona = await page.evaluate(() => document.documentElement.dataset.persona)
  const fabBg = await page.evaluate(() => {
    const fab = document.querySelector('nav span.rounded-full')
    return fab ? getComputedStyle(fab).backgroundColor : 'none'
  })
  await page.goto(`${BASE}/insights`, { waitUntil: 'networkidle2' })
  await wait(800)
  await page.screenshot({ path: `${shot}/33-persona-insights.png` })
  const insightsText = await page.evaluate(() => document.body.innerText)

  console.log('editor lines:', editorText)
  console.log('confirm has glute machine?:', /glute machine/i.test(confirmText))
  console.log('saved canonicalIds:', JSON.stringify(primaries))
  console.log('persona attr:', persona, '| FAB bg:', fabBg)
  console.log('insights has Booty cheeks?:', /booty cheeks/i.test(insightsText), '| Tittys?:', /tittys/i.test(insightsText))
  console.log(errors.length ? `❌ errors: ${errors.slice(0, 4).join(' | ')}` : '✅ no page errors')
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
