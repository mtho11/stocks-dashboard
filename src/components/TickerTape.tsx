import { useMemo } from 'react'
import type { Stock } from '../types/stock'
import { navigateTo } from '../utils/nav'
import type { Theme } from '../utils/theme'

const BASE_PATH = import.meta.env.BASE_URL

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function TickerTape({ stocks, t }: { stocks: Stock[]; t: Theme }) {
  // `pct1D` is refreshed in batches with the table quote data, so the tape
  // and the % 1D dashboard column always agree.
  const movers = useMemo(() => {
    return stocks
      .map(stock => ({ stock, change: stock.pct1D }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  }, [stocks])

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
