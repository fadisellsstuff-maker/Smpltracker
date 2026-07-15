# SmplTrack

A workout **insight** tracker, not a workout logger. You keep writing free-form
notes in your notes app (Samsung Notes first); SmplTrack ingests them and turns
them into a muscle heat map, progress charts, training-balance insights, and a
history calendar. It never prescribes routines — it only reflects what you did.

## Getting a note into the app

Samsung Notes has no public API, so intake is friction-light rather than automatic:

1. **Share sheet (installed PWA)** — install SmplTrack to your home screen, then in
   Samsung Notes tap **Share → SmplTrack**. The note text lands on the review
   screen. (Requires HTTPS hosting + install; this is the closest thing to a
   "connection".)
2. **Paste** — paste or type a note on the **Add** tab.
3. **Import .txt** — bulk-import notes exported from your notes app.

## Parsing (hybrid)

Notes are parsed locally by a **rule engine** (`src/lib/parser/`) that knows ~70
exercises with aliases/abbreviations and many set formats (`3x8 @60kg`,
`100x5,5,5`, `10,8,6 @ 22.5`, `bw x12,10,8`, `3 sets of 10`, lbs↔kg, typos). Lines
the rules can't handle are optionally sent to the **Claude API** as a fallback
(add a key in Settings) — the app is fully functional rules-only. Everything is
shown on an editable review screen before saving, and name corrections are
remembered as user aliases.

## Data & privacy

All data lives locally in IndexedDB (via Dexie). No account, no backend. Export/
import JSON from Settings for backup or device migration.

## Stack

React + TypeScript + Vite · Tailwind v4 · Dexie · Recharts · vite-plugin-pwa
(installable, offline, Web Share Target).

## Develop

This machine has a portable Node at `~/tools/nodejs`; put it on PATH first
(POSIX form — `C:\…` breaks bash's `:`-separated PATH):

```bash
export PATH="/c/Users/techy/tools/nodejs:$PATH"

npm install
npm run dev          # dev server
npm test             # parser + insights unit tests (27)
npm run build        # typecheck + production build (emits manifest + service worker)
npm run preview      # serve the build

node scripts/gen-icons.mjs   # regenerate PWA icons
node scripts/e2e-check.mjs   # headless-Chrome walk of every screen (needs preview running)
```

## Roadmap (post-MVP)

- Capacitor Android wrap with a native share intent (the mobile transition)
- OneNote/Graph sync-bridge experiment for closer Samsung Notes integration
- Deload/volume-landmark hints, bodyweight-progression tracking
