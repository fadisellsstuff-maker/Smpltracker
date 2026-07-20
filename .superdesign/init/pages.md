# Page Dependency Trees — SmplTrack

Local-import trees per page (node_modules like react/recharts/dexie omitted).
Every listed file must be passed as `--context-file` when designing that page,
plus `src/index.css` (global theme) and `src/components/ui.tsx`.

## / (Dashboard) — `src/pages/Dashboard.tsx`
Dependencies:
- src/components/MuscleHeatmap/Heatmap.tsx
  - src/components/MuscleHeatmap/bodyData.ts   (large — polygon coords; line-range to the arrays if trimming)
  - src/lib/muscles.ts
  - src/lib/insights/heatmap.ts
- src/components/ui.tsx        (Card, Empty, Pill, SectionTitle, Stat)
- src/lib/insights/heatmap.ts  (computeHeatmap, HEAT_COLORS)
- src/lib/insights/streaks.ts  (computeStreaks)
- src/lib/insights/volume.ts   (muscleSetLoad)
- src/lib/muscles.ts
- src/lib/db.ts
- src/lib/repo.ts              (daysAgoISO)
- src/SettingsContext.tsx

## /progress (Progress) — `src/pages/Progress.tsx`
Dependencies:
- src/components/ui.tsx        (Card, Empty, Pill, SectionTitle, Stat)
- src/lib/insights/progress.ts (buildProgressSeries, ProgressPoint)
- src/lib/catalog/exercises.ts (getExercise)
- src/lib/settings.ts          (displayWeight)
- src/lib/db.ts
- src/SettingsContext.tsx
- (Recharts: LineChart/Line/XAxis/YAxis/Tooltip/CartesianGrid/Dot)

## /insights (Insights) — `src/pages/Insights.tsx`
Dependencies:
- src/components/ui.tsx        (Card, Empty, SectionTitle)
- src/lib/insights/balance.ts  (computeBalance, findNeglected)
- src/lib/catalog/exercises.ts (getExercise)
- src/lib/muscles.ts           (Muscle, SplitGroup)
- src/lib/parser/dates.ts      (toISODate)
- src/lib/repo.ts              (daysAgoISO)
- src/lib/db.ts

## /history (History) — `src/pages/History.tsx`
Dependencies:
- src/components/ui.tsx        (Card, Empty, SectionTitle, Stat)
- src/lib/insights/streaks.ts  (computeStreaks)
- src/lib/parser/dates.ts      (formatDMY, toISODate)
- src/lib/db.ts

## /workout/:id (WorkoutDetail) — `src/pages/WorkoutDetail.tsx`
Dependencies:
- src/components/MuscleHeatmap/Heatmap.tsx (+ bodyData.ts, muscles.ts, insights/heatmap.ts)
- src/components/ui.tsx        (Card)
- src/lib/catalog/exercises.ts (getExercise)
- src/lib/insights/heatmap.ts  (computeHeatmap)
- src/lib/parser/dates.ts      (formatDMY)
- src/lib/settings.ts          (displayWeight)
- src/lib/repo.ts, src/lib/db.ts
- src/SettingsContext.tsx

## /add (Ingest) — `src/pages/Ingest.tsx`
Dependencies:
- src/components/ReviewWorkout.tsx
  - src/components/ui.tsx
  - src/lib/catalog/exercises.ts
  - src/lib/muscles.ts
  - src/lib/settings.ts
- src/components/ui.tsx        (Card, SectionTitle)
- src/lib/parser/index.ts, src/lib/parser/llm.ts, src/lib/parser/dates.ts
- src/lib/importDates.ts, src/lib/repo.ts
- src/SettingsContext.tsx

## /settings (Settings) — `src/pages/Settings.tsx`
Dependencies:
- src/components/ui.tsx        (Card, Pill, SectionTitle)
- src/lib/repo.ts (exportAll/importAll/clearAll), src/lib/seed.ts, src/lib/db.ts
- src/SettingsContext.tsx
