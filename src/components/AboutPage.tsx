import { useEffect, useState } from 'react'
import { THEMES, getInitialTheme } from '../utils/theme'
import { navigateTo } from '../utils/nav'

const BASE_PATH = import.meta.env.BASE_URL

interface Step {
  title: string
  image: string
  body: string
}

const STEPS: Step[] = [
  {
    title: '1. Pick a stock group',
    image: '01-overview.png',
    body: "The dropdown in the top-left switches between four built-in groups — Jensen's AI Cake (50 hand-picked AI/deep-tech names), Nasdaq 100, S&P 500, and the Dow 30 — plus any custom lists you've created. Every column, chart, and stat updates instantly for whichever group is active.",
  },
  {
    title: '2. Sort any column',
    image: '02-sorting.png',
    body: 'Click any column header — Company, Price, % YTD, RS Rank, RSI(14), the period returns, anything with a sort arrow — to reorder the table. Click again to reverse direction. Here the table is sorted alphabetically by Company instead of the default % YTD ranking.',
  },
  {
    title: '3. Search by ticker or name',
    image: '03-search.png',
    body: 'Type into the search box to instantly narrow the table to matching tickers or company names — here, "micron" isolates MU.',
  },
  {
    title: '4. Quick Winners / Losers filter',
    image: '04-losers-filter.png',
    body: 'The All / Winners / Losers buttons filter to stocks that are up or down year-to-date with one click.',
  },
  {
    title: '5. Build a custom filter',
    image: '05-custom-filters.png',
    body: 'The ⚙ Filters button opens a panel covering every relevant column at once: sector (multi-select), min/max ranges on price, market cap, every return window, RS Rank, RSI(14), and an Up/Down/Any toggle for each moving average.',
  },
  {
    title: '',
    image: '06-custom-filters-applied.png',
    body: 'Filters combine — sector chips AND range filters AND the Winners/Losers toggle all apply together. The button badge shows how many filters are active, and "Clear all" resets them in one click. Here, filtering to % YTD ≥ 300 narrows 51 stocks down to 6.',
  },
  {
    title: '6. Star your favorites',
    image: '07-favorites.png',
    body: 'Click the star on any row to favorite it, then click the ★ column header to pin favorites to the top. Favorites are remembered separately for each stock group, so starring AAPL in the S&P 500 view won’t affect the Nasdaq 100 view.',
  },
  {
    title: '7. Travel back in time',
    image: '08-historical.png',
    body: "The date picker recalculates every price, return, chart, and rank for any past date back to 2024-01-01 — the whole table becomes a snapshot of that day, with an \"· historical\" badge and a Reset button to jump back to today.",
  },
  {
    title: '8. Build your own list',
    image: '09-custom-lists.png',
    body: 'Open 📁 My Lists to create a named list and add any ticker from any of the four built-in groups — mix and match freely, e.g. an "AI Infrastructure" list pulling NVDA from one group and ALAB from another. Custom lists get their own RS Rank recalculated just for that cohort, and are saved to your browser so they’re there next time you visit.',
  },
  {
    title: '9. Light or dark, your call',
    image: '10-light-mode.png',
    body: 'The sun/moon button in the top-right switches themes instantly; your choice is remembered for next time.',
  },
  {
    title: '10. Read the summary row',
    image: '11-summary-cards.png',
    body: 'The footer totals market cap for whatever’s currently visible, and the cards below break down total market cap, stock count, YTD winners/losers, and what share of the group is trading above vs. below its 200-day moving average.',
  },
]

export function AboutPage() {
  const [mode] = useState(getInitialTheme)
  const t = THEMES[mode]

  useEffect(() => {
    document.title = 'About — Mike\'s Market Monitor'
    document.body.style.background = t.pageBg
    document.documentElement.style.colorScheme = mode
  }, [mode, t.pageBg])

  const shot = (file: string) => `${BASE_PATH}screenshots/${file}`

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative' }}>
          <button
            onClick={() => navigateTo(BASE_PATH)}
            style={{
              position: 'absolute', top: 0, left: 0,
              padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              border: `1px solid ${t.borderControl}`, background: t.inputBg, color: t.textSecondary,
              cursor: 'pointer',
            }}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{
            fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em',
            backgroundImage: t.gradient, WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent', color: 'transparent', marginBottom: 8,
          }}>
            About Mike's Market Monitor
          </h1>
          <p style={{ color: t.textMuted, fontSize: 14 }}>by @mtho11</p>
        </div>

        {/* Overview */}
        <section style={{
          background: t.panelBg, border: `1px solid ${t.borderOuter}`, borderRadius: 12,
          padding: '20px 24px', marginBottom: 24,
        }}>
          <h2 style={{ color: t.textPrimary, fontSize: 18, fontWeight: 700, marginBottom: 10 }}>What this is</h2>
          <p style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
            Mike's Market Monitor is a stock-screening dashboard for exploring four groups of
            stocks — an AI/deep-tech watchlist, the Nasdaq 100, the S&amp;P 500, and the Dow 30 — plus
            any custom lists you build yourself. Every row carries price, market cap, valuation
            ratios, three return windows of sparkline charts, momentum indicators (RSI, RS Rank),
            moving-average direction, and period returns from 1 week out to 6 months.
          </p>
          <p style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
            You can sort by any column, search, apply quick or advanced filters, star favorites,
            build your own custom lists from any combination of tickers, and even rewind the whole
            table to any date back to 2024 to see what it would have looked like then. Your theme,
            favorites, and custom lists are all remembered between visits, and the current view
            (stock group + date) lives in the URL so you can bookmark or share it.
          </p>
          <div style={{
            background: 'rgba(246,173,85,0.1)', border: '1px solid #744210', borderRadius: 8,
            padding: '10px 14px', color: '#dd6b20', fontSize: 13, lineHeight: 1.6,
          }}>
            ⚠️ <strong>All data here is mock/generated.</strong> Prices, returns, and charts come from
            seeded pseudo-random generators, not a real market feed. Nothing on this site is real
            financial data or investment advice.
          </div>
        </section>

        {/* Tutorial */}
        <h2 style={{ color: t.textPrimary, fontSize: 20, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
          Tutorial
        </h2>
        {STEPS.map((step, i) => (
          <section key={i} style={{
            background: t.panelBg, border: `1px solid ${t.borderOuter}`, borderRadius: 12,
            padding: '20px 24px', marginBottom: 20,
          }}>
            {step.title && (
              <h3 style={{ color: t.textPrimary, fontSize: 15.5, fontWeight: 700, marginBottom: 8 }}>
                {step.title}
              </h3>
            )}
            <p style={{ color: t.textSecondary, fontSize: 13.5, lineHeight: 1.7, marginBottom: 14 }}>
              {step.body}
            </p>
            <img
              src={shot(step.image)}
              alt={step.title || 'Screenshot'}
              style={{ width: '100%', borderRadius: 8, border: `1px solid ${t.borderOuter}`, display: 'block' }}
            />
          </section>
        ))}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button
            onClick={() => navigateTo(BASE_PATH)}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 700,
              border: 'none', cursor: 'pointer', background: '#2f855a', color: '#e2e8f0',
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
