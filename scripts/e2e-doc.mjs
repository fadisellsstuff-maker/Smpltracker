// Import the real 333-workout file, open the continuous document, measure its
// mount, verify dividers, edit + save-rebuild, and check pink persona.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://localhost:4181'
const shot = './scripts/shots'
mkdirSync(shot, { recursive: true })
const FILE = resolve('./context/WORKOUTlogidea.txt')

const errors = []
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 })
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
p.on('pageerror', (e) => errors.push(e.message))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await p.goto(`${BASE}/import`, { waitUntil: 'networkidle2' })
  await p.evaluate(() => indexedDB.deleteDatabase('smpltrack'))
  await p.evaluate(() => localStorage.removeItem('smpltrack.notesdoc'))
  await p.goto(`${BASE}/import`, { waitUntil: 'networkidle2' })
  await wait(300)

  // Upload the real file → preview → Import all
  const input = await p.$('input[type=file]')
  await input.uploadFile(FILE)
  await wait(3500)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Import all/.test(x.textContent))?.click())
  await wait(6000)

  // Open the continuous document (feed), measure mount time
  const t0 = Date.now()
  await p.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await p.waitForFunction(() => /\d+ workouts/.test(document.body.innerText), { timeout: 15000 })
  const mountMs = Date.now() - t0
  await wait(600)

  const info = await p.evaluate(() => ({
    workoutsLabel: (document.body.innerText.match(/(\d+) workouts/) || [])[1],
    dividers: document.querySelectorAll('.border-dashed.border-zinc-700').length,
    loadEarlier: /Load earlier/.test(document.body.innerText),
    editables: document.querySelectorAll('[contenteditable]').length,
  }))
  console.log('mount ms:', mountMs)
  console.log('workouts label:', info.workoutsLabel, '| dividers:', info.dividers, '| loadEarlier:', info.loadEarlier, '| editable rows:', info.editables)
  await p.screenshot({ path: `${shot}/24-doc.png` })

  // Add a new workout at the bottom + type, then Save (rebuild)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /New workout/.test(x.textContent)).click())
  await wait(400)
  await p.keyboard.type('Bench press 3x8 60kg')
  await wait(200)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save').click())
  await wait(2500)
  await p.screenshot({ path: `${shot}/25-doc-after-save.png` })

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
  const dbCount = await countWorkouts()
  console.log('workouts in DB after 1st save:', dbCount)

  // Idempotency: reload the document from cache and save again — count must hold.
  await p.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await p.waitForFunction(() => /\d+ workouts/.test(document.body.innerText), { timeout: 15000 })
  await wait(500)
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save').click())
  await wait(2500)
  console.log('workouts in DB after 2nd save (idempotent?):', await countWorkouts())

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
