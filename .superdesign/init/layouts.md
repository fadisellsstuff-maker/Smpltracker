# Layouts — SmplTrack

There is one app-shell layout: `src/App.tsx`. It renders a **sticky top header**,
a routed `<main>`, and a **fixed bottom tab bar** (5 tabs, center "Add" is a raised
red FAB). The whole app is a centered `max-w-md` phone column on a `#0a0a0a` page.
Icons are inline SVGs (no icon library). Full source below.

## `src/App.tsx`
```tsx
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Ingest } from './pages/Ingest'
import { Progress } from './pages/Progress'
import { Insights } from './pages/Insights'
import { History } from './pages/History'
import { WorkoutDetail } from './pages/WorkoutDetail'
import { Settings } from './pages/Settings'

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/progress', label: 'Progress', icon: ChartIcon },
  { to: '/add', label: 'Add', icon: PlusIcon, primary: true },
  { to: '/insights', label: 'Insights', icon: BalanceIcon },
  { to: '/history', label: 'History', icon: CalendarIcon },
]

export function App() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <header className="safe-top sticky top-0 z-10 flex items-center justify-between border-b border-zinc-900 bg-[#0a0a0a]/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-zinc-50">Smpl</span>
          <span className="text-lg font-bold tracking-tight text-red-500">Track</span>
        </div>
        <NavLink to="/settings" className="text-zinc-400 hover:text-zinc-100" aria-label="Settings">
          <GearIcon />
        </NavLink>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<Ingest />} />
          <Route path="/share" element={<Ingest />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/history" element={<History />} />
          <Route path="/workout/:id" element={<WorkoutDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md items-stretch justify-around border-t border-zinc-900 bg-[#0a0a0a]/95 px-2 pt-2 pb-2 backdrop-blur">
        {NAV.map(({ to, label, icon: Icon, end, primary }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-medium ${
                primary
                  ? 'text-zinc-900'
                  : isActive
                    ? 'text-red-500'
                    : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            {primary ? (
              <span className="flex h-11 w-11 -translate-y-3 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/30">
                <Icon />
              </span>
            ) : (
              <Icon />
            )}
            {!primary && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/* ---- inline icons (no external deps): HomeIcon, ChartIcon, BalanceIcon,
   CalendarIcon, PlusIcon (white stroke), GearIcon — each a 24x24 stroke svg. ---- */
```

### Layout notes for faithful reproduction
- Header: 2-word wordmark "**Smpl**" (zinc-50) + "**Track**" (red-500), gear icon at right linking to Settings.
- Content: `px-4 pt-4 pb-28` (bottom padding clears the fixed nav).
- Bottom nav: 5 equal columns; the middle "Add" is a **red circular FAB raised with `-translate-y-3`**, white "+" icon, no text label; the other 4 show icon + tiny label, active tab in red-500.
