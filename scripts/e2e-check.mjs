// Drives the real app in Chrome: loads it, seeds demo data, walks every tab,
// and screenshots each, failing on any console/page error.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:4173'
const shot = process.env.SHOT_DIR || './scripts/shots'
mkdirSync(shot, { recursive: true })

const errors = []
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 })
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

async function go(path, name) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 600))
  await page.screenshot({ path: `${shot}/${name}.png` })
}

try {
  // 1. Fresh load — empty state
  await go('/', '01-empty')

  // 2. Seed demo data via Settings button
  await go('/settings', '02-settings')
  const seeded = await page.evaluate(async () => {
    const btns = [...document.querySelectorAll('button')]
    const seed = btns.find((b) => b.textContent?.includes('Load demo data'))
    if (!seed) return 'no-seed-button'
    seed.click()
    // wait for it to finish
    await new Promise((r) => setTimeout(r, 2500))
    return 'clicked'
  })
  console.log('seed:', seeded)
  await new Promise((r) => setTimeout(r, 1500))

  // 3. Dashboard with heatmap populated
  await go('/', '03-dashboard')
  const dash = await page.evaluate(() => document.body.innerText)

  // 4. Other tabs
  await go('/progress', '04-progress')
  await go('/insights', '05-insights')
  await go('/history', '06-history')

  // 5. Ingest a fresh note via the Add flow (paste + parse + save)
  await page.goto(`${BASE}/add`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => {
    const ta = document.querySelector('textarea')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, 'Arm day\nbicep curls 4x12 @15\nskull crushers 3x10 @30\nhammer curls 3x12')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 300))
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Parse')?.click()
  })
  await new Promise((r) => setTimeout(r, 1200))
  await page.screenshot({ path: `${shot}/07-review.png` })
  const reviewText = await page.evaluate(() => document.body.innerText)

  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Save workout'))?.click()
  })
  await new Promise((r) => setTimeout(r, 1200))
  await page.screenshot({ path: `${shot}/08-after-save.png` })

  console.log('\n--- Dashboard text (seeded) ---')
  console.log(dash.split('\n').slice(0, 12).join('\n'))
  console.log('\n--- Review parsed arm day? ---')
  console.log(
    ['Bicep Curl', 'Skull Crusher', 'Hammer Curl'].map(
      (n) => `${n}: ${reviewText.includes(n) ? 'OK' : 'MISSING'}`,
    ).join('  '),
  )

  if (errors.length) {
    console.log('\n❌ PAGE ERRORS:')
    for (const e of errors) console.log('  ', e)
    process.exitCode = 1
  } else {
    console.log('\n✅ No console/page errors across all routes.')
  }
} catch (e) {
  console.error('E2E failed:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
