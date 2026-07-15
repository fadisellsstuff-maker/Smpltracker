// Imports the real WORKOUTlogidea.txt through the app's file picker and
// screenshots the resulting dashboard/history to verify the full pipeline.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:4173'
const shot = './scripts/shots'
mkdirSync(shot, { recursive: true })
const FILE = resolve('./context/WORKOUTlogidea.txt')

const errors = []
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 })
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle2' })
  // Clear any prior data first.
  await page.evaluate(() => indexedDB.deleteDatabase('smpltrack'))
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle2' })

  const input = await page.$('input[type=file]')
  await input.uploadFile(FILE)
  await wait(3500) // parse the whole file
  await page.screenshot({ path: `${shot}/10-import-summary.png` })

  const summary = await page.evaluate(() => document.body.innerText)
  const m = summary.match(/(\d+)\s+workouts/)
  console.log('summary workouts:', m ? m[1] : '?')

  // Click "Import all"
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => /Import all/.test(b.textContent))?.click()
  })
  await wait(6000)
  await page.screenshot({ path: `${shot}/11-history-after-import.png` })

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await wait(1200)
  await page.screenshot({ path: `${shot}/12-dashboard-after-import.png` })

  await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle2' })
  await wait(1200)
  await page.screenshot({ path: `${shot}/13-progress-after-import.png` })

  // Open a workout detail to check the weight-first set display.
  await page.goto(`${BASE}/history`, { waitUntil: 'networkidle2' })
  await wait(1000)
  await page.evaluate(() => document.querySelector('a[href^="/workout/"]')?.click())
  await wait(1000)
  await page.screenshot({ path: `${shot}/14-workout-detail.png` })

  const dbCount = await page.evaluate(
    () =>
      new Promise((res) => {
        const req = indexedDB.open('smpltrack')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('workouts', 'readonly').objectStore('workouts').count()
          tx.onsuccess = () => res(tx.result)
        }
      }),
  )
  console.log('workouts saved in IndexedDB:', dbCount)
  console.log(errors.length ? `❌ errors: ${errors.slice(0, 5).join(' | ')}` : '✅ no page errors')
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
