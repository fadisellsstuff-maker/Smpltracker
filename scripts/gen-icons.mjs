// Generates public/icons/{icon-192,icon-512}.png and icon.svg — no image deps.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BG = [10, 10, 10] // near-black
const TILE = [34, 197, 94] // green-500
const WHITE = [244, 244, 245]

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size) {
  const px = (x, y) => {
    const m = size * 0.14 // margin
    const r = size * 0.22 // corner radius
    // rounded-rect tile
    const inTile =
      x >= m && x <= size - m && y >= m && y <= size - m &&
      !cornerOut(x, y, m, r, size)
    const cx = size / 2
    // barbell: central bar + plates
    const barH = size * 0.06
    const bar = Math.abs(y - cx) < barH / 2 && x > size * 0.28 && x < size * 0.72
    const plate = (px0, w) =>
      Math.abs(y - cx) < size * 0.16 && x > px0 && x < px0 + w
    const plates = plate(size * 0.24, size * 0.06) || plate(size * 0.7, size * 0.06)
    if (inTile && (bar || plates)) return WHITE
    if (inTile) return TILE
    return BG
  }
  const raw = Buffer.alloc((size * 4 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(x + 0.5, y + 0.5)
      raw[o++] = r
      raw[o++] = g
      raw[o++] = b
      raw[o++] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function cornerOut(x, y, m, r, size) {
  const cxs = [m + r, size - m - r]
  const cys = [m + r, size - m - r]
  for (const cx of cxs)
    for (const cy of cys) {
      const nearCornerX = (cx === m + r && x < cx) || (cx === size - m - r && x > cx)
      const nearCornerY = (cy === m + r && y < cy) || (cy === size - m - r && y > cy)
      if (nearCornerX && nearCornerY && Math.hypot(x - cx, y - cy) > r) return true
    }
  return false
}

writeFileSync(join(outDir, 'icon-192.png'), png(192))
writeFileSync(join(outDir, 'icon-512.png'), png(512))

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <rect x="72" y="72" width="368" height="368" rx="110" fill="#22c55e"/>
  <g fill="#f4f4f5">
    <rect x="143" y="240" width="226" height="32" rx="8"/>
    <rect x="123" y="215" width="31" height="82" rx="8"/>
    <rect x="358" y="215" width="31" height="82" rx="8"/>
  </g>
</svg>`
writeFileSync(join(outDir, 'icon.svg'), svg)
console.log('icons written to', outDir)
