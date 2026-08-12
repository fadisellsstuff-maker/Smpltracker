// Drives the rich note editor: type a title + a bold checkbox exercise, save,
// reopen and confirm formatting + checkbox + parsed exercise persist. Then
// checks Feed/Grid, the add-note bar, the import sheet, and pink persona.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://localhost:4180'
const shot = './scripts/shots'
mkdirSync(shot, { recursive: true })

const errors = []
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 })
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
p.on('pageerror', (e) => errors.push(e.message))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await p.goto(`${BASE}/add`, { waitUntil: 'networkidle2' })
  await p.evaluate(() => indexedDB.deleteDatabase('smpltrack'))

  // --- Create a formatted note ---
  await p.goto(`${BASE}/notes/new`, { waitUntil: 'networkidle2' })
  await wait(400)
  const first = await p.$('[contenteditable]')
  await first.click()
  await p.keyboard.type('Push day')
  await p.keyboard.press('Enter')
  // toolbar checkbox
  await p.evaluate(() => [...document.querySelectorAll('button[aria-label="Checkbox"]')][0].click())
  await wait(150)
  // type into the (now checkbox) line
  await p.evaluate(() => {
    const eds = [...document.querySelectorAll('[contenteditable]')]
    eds[eds.length - 1].focus()
  })
  await p.keyboard.type('Bench press 3x8 40kg')
  // select all in this line and bold it
  await p.keyboard.down('Control')
  await p.keyboard.press('a')
  await p.keyboard.up('Control')
  await p.evaluate(() => document.querySelector('button[aria-label="Bold"]').click())
  await wait(150)
  await p.screenshot({ path: `${shot}/20-editor.png` })

  // save
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save').click())
  await wait(400)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Save workout/.test(x.textContent)).click())
  await wait(1200)

  // --- Verify persistence in IndexedDB ---
  const dbInfo = await p.evaluate(
    () =>
      new Promise((res) => {
        const req = indexedDB.open('smpltrack')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['notes', 'exercises'], 'readonly')
          const notes = tx.objectStore('notes').getAll()
          const ex = tx.objectStore('exercises').getAll()
          notes.onsuccess = () => {
            ex.onsuccess = () => {
              const n = notes.result.at(-1) || {}
              res({
                richHasBold: !!n.rich && /<b>|<strong>/.test(n.rich),
                rawText: n.rawText,
                exercises: ex.result.map((e) => e.canonicalId),
              })
            }
          }
        }
      }),
  )
  console.log('note.rich has bold:', dbInfo.richHasBold)
  console.log('rawText:', JSON.stringify(dbInfo.rawText))
  console.log('exercises:', dbInfo.exercises)

  // --- Feed view + reopen shows bold ---
  await p.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await wait(600)
  const feedBold = await p.evaluate(() => !!document.querySelector('.space-y-3 b, .space-y-3 strong'))
  await p.screenshot({ path: `${shot}/21-feed.png` })
  console.log('feed shows bold:', feedBold)

  // Grid toggle
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Grid').click())
  await wait(400)
  await p.screenshot({ path: `${shot}/22-grid.png` })

  // add-new-note bar → append to newest
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Add new note/.test(x.textContent)).click())
  await wait(700)
  const appended = await p.evaluate(() => location.search.includes('append=1'))
  console.log('add-note bar appended to newest:', appended)

  // Import sheet
  await p.goto(`${BASE}/import`, { waitUntil: 'networkidle2' })
  await wait(400)
  const importOpts = await p.evaluate(() => document.body.innerText)
  console.log('import has options:', /Upload \.txt/.test(importOpts) && /Paste text/.test(importOpts))
  await p.screenshot({ path: `${shot}/23-import.png` })

  // Persona pink still works
  await p.goto(`${BASE}/onlyformygf`, { waitUntil: 'networkidle2' })
  await wait(600)
  const persona = await p.evaluate(() => document.documentElement.dataset.persona)
  console.log('persona at /onlyformygf:', persona)

  console.log(errors.length ? `\n❌ errors: ${errors.slice(0, 5).join(' | ')}` : '\n✅ no page errors')
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await b.close()
}
