# Stocks Dashboard

A dark/light-themed stock dashboard inspired by "Jensen's 5-Layer AI Cake" — built with React 18, TypeScript, Vite, and D3.

**Live:** https://mtho11.github.io/stocks-dashboard/

> **All data is mock/generated.** Prices, returns, and sparklines are produced by seeded pseudo-random generators — nothing here is real market data or investment advice.

## Features

- **Three stock lists**, switchable via dropdown: Jensen's 5-Layer AI Cake (50 AI/deep-tech names), Nasdaq 100 (~97), and S&P 500 (~418 across all GICS sectors)
- **Sortable columns** (ticker, company, sector, price, market cap, % returns, RS rank, …), search, and winners/losers filters
- **Historical date picker** — defaults to today; pick any past date back to 2024-01-01 and every metric, sparkline, and RS rank is recalculated for that date. Data is generated with a Mulberry32 PRNG seeded by `date × ticker`, so any stock+date pair always produces the same values
- **1M and 1Y sparkline charts** rendered with D3 (Catmull-Rom curves, gradient fills)
- **Light/dark theme toggle**, persisted to `localStorage`, defaulting to the system preference
- **URL-addressable state** — the stock list and date live in the path, e.g. `/nasdaq100/2026-07-13`. Editing the URL and reloading changes the app; picking a list/date updates the URL (via `history.replaceState`, so it doesn't spam browser history)

## Development

```sh
npm install
npm run dev       # Vite dev server
npm run lint      # ESLint
npm test          # Vitest unit tests
npm run build     # tsc + production build
```

## Project layout

```
src/
  components/StockDashboard.tsx   # main UI: table, controls, theming
  components/Sparkline.tsx        # memoized D3 sparkline
  data/                           # mock stock lists + shared seeded spark() generator
  utils/historical.ts             # seeded historical-data engine
  utils/marketCap.ts              # "$254.2B" <-> number helpers
  utils/urlState.ts               # path <-> {listId, date} parsing/building
```

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`): lint → test → build → deploy to GitHub Pages.

`npm run build` copies `dist/index.html` to `dist/404.html` so GitHub Pages' static hosting serves the app (rather than a real 404) for deep links like `/nasdaq100/2026-07-13` on direct load or refresh — the client-side router then reads the actual path from `window.location`.
