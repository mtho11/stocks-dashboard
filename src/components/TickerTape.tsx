import type { Stock } from '../types/stock'
import { navigateTo } from '../utils/nav'
import type { Theme } from '../utils/theme'

const BASE_PATH = import.meta.env.BASE_URL
const MOVE_THRESHOLD = 4

// Sparkline data is the closest thing each Stock carries to a real daily
// series, so day-over-day change of its last two points stands in for
// "today's move" — there's no dedicated daily-change field in the model.
function dailyChangePct(s: Stock): number {
  const n = s.sparklineData.length
  if (n < 2) return 0
  const prev = s.sparklineData[n - 2]
  const last = s.sparklineData[n - 1]
  return prev > 0 ? ((last - prev) / prev) * 100 : 0
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function TickerTape({ stocks, t }: { stocks: Stock[]; t: Theme }) {
  const movers = stocks
    .map(s => ({ stock: s, change: dailyChangePct(s) }))
    .filter(m => Math.abs(m.change) >= MOVE_THRESHOLD)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  if (movers.length === 0) {
    return (
      <div style={{
        background: t.panelBg, borderBottom: `1px solid ${t.borderOuter}`,
        padding: '8px 16px', textAlign: 'center', fontSize: 11.5, color: t.textMuted,
      }}>
        No Nasdaq 100 stocks moving ±{MOVE_THRESHOLD}% today
      </div>
    )
  }

  // Duplicated once so the CSS animation can loop seamlessly (scrolls
  // exactly one copy's width, then resets with no visible seam).
  const items = [...movers, ...movers]
  const durationSec = Math.max(20, movers.length * 4)

  return (
    <div style={{
      background: t.panelBg, borderBottom: `1px solid ${t.borderOuter}`,
      overflow: 'hidden', whiteSpace: 'nowrap', padding: '8px 0',
    }}>
      <style>{`
        @keyframes ticker-tape-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div style={{
        display: 'inline-flex',
        animation: `ticker-tape-scroll ${durationSec}s linear infinite`,
      }}>
        {items.map((m, i) => {
          const up = m.change >= 0
          return (
            <button
              key={i}
              onClick={() => navigateTo(`${BASE_PATH}stock/${m.stock.ticker}`)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 18px', fontSize: 12.5, whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontWeight: 700, color: t.textPrimary }}>{m.stock.ticker}</span>
              <span style={{ color: t.textSecondary }}>${fmt(m.stock.price)}</span>
              <span style={{ color: up ? '#48bb78' : '#e53e3e', fontWeight: 700 }}>
                {up ? '▲' : '▼'} {up ? '+' : ''}{fmt(m.change)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
