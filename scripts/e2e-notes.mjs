// Drives the Notes flow: import to populate, view the notes list, write a new
// note (live counter), save via the confirm sheet, verify it lands on the list.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://localhost:4178'
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
  // Fresh DB, then bulk-import to populate the notes list.
  await page.goto(`${BASE}/import`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => indexedDB.deleteDatabase('smpltrack'))
  await page.goto(`${BASE}/import`, { waitUntil: 'networkidle2' })
  await (await page.$('input[type=file]')).uploadFile(FILE)
  await wait(3500)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Import all/.test(b.textContent))?.click())
  await wait(6000)

  // Notes list
  await page.goto(`${BASE}/notes`, { waitUntil: 'networkidle2' })
  await wait(1000)
  await page.screenshot({ path: `${shot}/20-notes-list.png` })
  const listText = await page.evaluate(() => document.body.innerText.slice(0, 200))

  // New note
  await page.goto(`${BASE}/notes/new`, { waitUntil: 'networkidle2' })
  await wait(500)
  await page.type('textarea', 'Leg day 24/7/26\n[v] squats 3x8 100kg\n[v] rdl 3x10 60kg\n[ ] leg press 3x12')
  await wait(500)
  await page.screenshot({ path: `${shot}/21-note-editor.png` })
  const counter = await page.evaluate(() => document.body.innerText.match(/\d+ exercises? ·[^\n]*/)?.[0] || 'none')

  // Save -> confirm sheet
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save')?.click())
  await wait(600)
  await page.screenshot({ path: `${shot}/22-confirm-sheet.png` })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Save workout/.test(b.textContent))?.click())
  await wait(1500)
  await page.screenshot({ path: `${shot}/23-notes-after-save.png` })
  const afterTop = await page.evaluate(() => document.querySelector('.grid button')?.innerText || '')

  console.log('list sample:', listText.replace(/\n/g, ' | '))
  console.log('live counter:', counter)
  console.log('top card after save:', afterTop.replace(/\n/g, ' | '))
  const dbCount = await page.evaluate(
    () => new Promise((res) => {
      const r = indexedDB.open('smpltrack')
      r.onsuccess = () => { const t = r.result.transaction('workouts','readonly').objectStore('workouts').count(); t.onsuccess = () => res(t.result) }
    }),
  )
  console.log('workouts in db:', dbCount)
  console.log(errors.length ? `❌ errors: ${errors.slice(0,4).join(' | ')}` : '✅ no page errors')
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
