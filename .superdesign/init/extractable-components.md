# Extractable Components — SmplTrack

Reusable UI patterns that can be extracted as Superdesign DraftComponents.
Full source for layout/primitives lives in `layouts.md` and `components.md`.

## Layout Components (appear on most pages)

## AppShell
- Source: `src/App.tsx`
- Category: layout
- Description: Centered max-w-md phone column with sticky header + fixed bottom tab bar
- Extractable props: none (structural)
- Hardcoded: wordmark, page bg `#0a0a0a`, padding

## Header
- Source: `src/App.tsx` (`<header>`)
- Category: layout
- Description: Sticky top bar — "SmplTrack" wordmark (Smpl=zinc-50, Track=red-500) + gear→Settings
- Extractable props: none
- Hardcoded: wordmark text, gear icon SVG, link target `/settings`

## BottomNav
- Source: `src/App.tsx` (`<nav>` + `NAV` array)
- Category: layout
- Description: 5-tab bottom bar; center "Add" is a raised red circular FAB, others icon+label; active tab red-500
- Extractable props: activeItem (string, one of home/progress/add/insights/history)
- Hardcoded: tab labels, inline icon SVGs, FAB `-translate-y-3`, colors

## Basic Components (used across pages)

## Card
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Rounded surface `rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4`
- Extractable props: className (string)
- Hardcoded: radius, border, bg, padding

## SectionTitle
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Uppercase zinc-300 section heading with optional right-aligned hint
- Extractable props: hint (string, optional)
- Hardcoded: `text-sm font-semibold uppercase tracking-wide`

## Stat
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Stat tile — big tabular-nums value + label + optional sub-label, on `bg-zinc-800/50`
- Extractable props: label (string), value (node), sub (string, optional)
- Hardcoded: sizes, colors, radius

## Pill
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Rounded-full toggle chip; active = zinc-100 on dark text, idle = zinc-800
- Extractable props: active (boolean, default false)
- Hardcoded: radius, colors, padding

## Empty
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Dashed-border empty state with title + helper text
- Extractable props: title (string)
- Hardcoded: dashed border, padding, centered layout

## MuscleHeatmap
- Source: `src/components/MuscleHeatmap/Heatmap.tsx`
- Category: basic
- Description: Front+back anatomical SVG body maps colored red/amber/gray by muscle heat level, with legend
- Extractable props: none for design (driven by `data: HeatmapData`); visually a two-figure SVG + 3-item legend
- Hardcoded: polygon coords (bodyData.ts), HEAT_COLORS, legend labels Primary/Secondary/Untrained
