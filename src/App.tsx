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
          <span className="text-lg font-bold tracking-tight text-green-500">Track</span>
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
                    ? 'text-green-500'
                    : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            {primary ? (
              <span className="flex h-11 w-11 -translate-y-3 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30">
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

/* ---- inline icons (no external deps) ---- */
function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16l3-4 3 2 4-6" />
    </svg>
  )
}
function BalanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="4" height="9" rx="1" />
      <rect x="10" y="6" width="4" height="14" rx="1" />
      <rect x="16" y="14" width="4" height="6" rx="1" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 3.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.22.65.22 1z" />
    </svg>
  )
}
