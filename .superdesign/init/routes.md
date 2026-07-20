# Routes — SmplTrack

Config-based routing via `react-router-dom` v7, declared inline in `src/App.tsx`
(`<Routes>`). All routes render inside the single App shell (top header + bottom
tab bar). BrowserRouter is set up in `src/main.tsx`.

| Path | Component file | In bottom nav | Summary |
|------|----------------|---------------|---------|
| `/` | `src/pages/Dashboard.tsx` | Home | Muscle heat map (front+back), 7d/30d toggle, streak/session stats, coverage card |
| `/add` | `src/pages/Ingest.tsx` | Add (FAB) | Paste / import a note → parse → review → save; bulk history import summary |
| `/share` | `src/pages/Ingest.tsx` | — | Web Share Target target (shared note text lands here) |
| `/progress` | `src/pages/Progress.tsx` | Progress | Per-exercise line chart (est 1RM / top set / volume) + PR markers + stat tiles |
| `/insights` | `src/pages/Insights.tsx` | Insights | Push/pull/legs/core balance bar, neglected-muscle chips, volume-per-muscle bars |
| `/history` | `src/pages/History.tsx` | History | Month calendar (clickable trained days, DD/MM/YYYY), streak stats, recent-session list |
| `/workout/:id` | `src/pages/WorkoutDetail.tsx` | — | One workout: heat map, exercise/set list (weight × reps), original note, delete |
| `/settings` | `src/pages/Settings.tsx` | (gear) | Units kg/lbs, Claude API key, demo data, JSON export/import, clear data |
| `*` | → redirect to `/` | — | Fallback |

### `main.tsx` (router + providers)
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

Most-important pages to design for: **`/` (Dashboard)**, **`/progress`**, **`/insights`**, **`/history`**.
