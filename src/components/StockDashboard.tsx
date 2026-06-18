import { useState, useMemo } from 'react'
import { stocks as allStocks } from '../data/stocks'
import type { Stock } from '../types/stock'
import { Sparkline } from './Sparkline'

type SortKey = keyof Pick<Stock, 'ticker' | 'company' | 'sector' | 'price' | 'pctYTD' | 'pct1Y' | 'marketCap' | 'rsRank' | 'deltaHighs'>
type SortDir = 'asc' | 'desc'

function SMABadge({ dir }: { dir: 'up' | 'down' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18,
      borderRadius: 3,
      background: dir === 'up' ? 'rgba(72,187,120,0.15)' : 'rgba(252,129,129,0.15)',
    }}>
      <span style={{
        display: 'inline-block', width: 0, height: 0,
        borderLeft: '3.5px solid transparent',
        borderRight: '3.5px solid transparent',
        ...(dir === 'up'
          ? { borderBottom: '6px solid #48bb78' }
          : { borderTop: '6px solid #fc8181' })
      }} />
    </span>
  )
}

const SECTOR_PALETTE: Record<string, { bg: string; fg: string }> = {
  'Semiconductors':       { bg: 'rgba(144,205,244,0.15)', fg: '#90cdf4' },
  'Semiconductor Equip':  { bg: 'rgba(118,169,250,0.15)', fg: '#76a9fa' },
  'Optical Networking':   { bg: 'rgba(167,243,208,0.15)', fg: '#6ee7b7' },
  'Cloud Computing':      { bg: 'rgba(196,181,253,0.15)', fg: '#c4b5fd' },
  'Hardware & Servers':   { bg: 'rgba(253,230,138,0.15)', fg: '#fcd34d' },
  'Data Center Infra':    { bg: 'rgba(252,165,165,0.15)', fg: '#fca5a5' },
  'Clean Energy':         { bg: 'rgba(110,231,183,0.15)', fg: '#34d399' },
  'Nuclear Energy':       { bg: 'rgba(251,191,36,0.15)',  fg: '#f59e0b' },
  'Energy Infrastructure':{ bg: 'rgba(249,168,212,0.15)', fg: '#f9a8d4' },
  'Energy Storage':       { bg: 'rgba(134,239,172,0.15)', fg: '#4ade80' },
  'Crypto Mining':        { bg: 'rgba(253,186,116,0.15)', fg: '#fb923c' },
  'Enterprise Software':  { bg: 'rgba(165,180,252,0.15)', fg: '#a5b4fc' },
  'Big Tech':             { bg: 'rgba(103,232,249,0.15)', fg: '#67e8f9' },
  'EVs & Robotics':       { bg: 'rgba(240,171,252,0.15)', fg: '#e879f9' },
}

function sectorBg(sector: string): string {
  return SECTOR_PALETTE[sector]?.bg ?? 'rgba(160,174,192,0.12)'
}
function sectorColor(sector: string): string {
  return SECTOR_PALETTE[sector]?.fg ?? '#a0aec0'
}

function pctColor(pct: number): string {
  if (pct >= 100) return '#68d391'
  if (pct >= 50) return '#48bb78'
  if (pct >= 20) return '#9ae6b4'
  if (pct >= 0) return '#c6f6d5'
  if (pct >= -10) return '#fed7d7'
  if (pct >= -20) return '#fc8181'
  return '#e53e3e'
}

function pctBg(pct: number): string {
  if (pct >= 200) return 'rgba(72,187,120,0.25)'
  if (pct >= 100) return 'rgba(72,187,120,0.18)'
  if (pct >= 50) return 'rgba(72,187,120,0.12)'
  if (pct >= 20) return 'rgba(72,187,120,0.07)'
  if (pct >= 0) return 'transparent'
  if (pct >= -20) return 'rgba(252,129,129,0.10)'
  return 'rgba(252,129,129,0.20)'
}

function ytdBg(pct: number): string {
  if (pct >= 200) return '#276749'
  if (pct >= 100) return '#2f855a'
  if (pct >= 50) return '#276749'
  if (pct >= 20) return '#22543d'
  if (pct >= 0) return '#1c4532'
  if (pct >= -15) return '#742a2a'
  return '#9b2c2c'
}

function fmt(n: number | null, decimals = 2): string {
  if (n === null) return 'n/a'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${fmt(n)}%`
}

export function StockDashboard() {
  const [sortKey, setSortKey] = useState<SortKey>('pctYTD')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all')

  const sorted = useMemo(() => {
    let list = [...allStocks]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.company.toLowerCase().includes(q))
    }
    if (filter === 'positive') list = list.filter(s => s.pctYTD >= 0)
    if (filter === 'negative') list = list.filter(s => s.pctYTD < 0)

    list.sort((a, b) => {
      const av = a[sortKey] as number | string
      const bv = b[sortKey] as number | string
      if (av === null) return 1
      if (bv === null) return -1
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [sortKey, sortDir, search, filter])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const totalMktCap = '$25.7T'
  const avgPS = '29.26'
  const avgPE = '112.92'

  function Th({ label, sk, right }: { label: string; sk?: SortKey; right?: boolean }) {
    const active = sk && sortKey === sk
    return (
      <th
        onClick={sk ? () => toggleSort(sk) : undefined}
        style={{
          padding: '10px 8px',
          textAlign: right ? 'right' : 'center',
          whiteSpace: 'nowrap',
          cursor: sk ? 'pointer' : 'default',
          color: active ? '#90cdf4' : '#718096',
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          userSelect: 'none',
          borderBottom: '1px solid #2d3748',
          background: '#0d1117',
          position: 'sticky', top: 0, zIndex: 2,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {label}
          {sk && <span style={{ opacity: active ? 1 : 0.3, fontSize: 9 }}>{active && sortDir === 'asc' ? '▲' : '▼'}</span>}
        </span>
      </th>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{
          fontSize: 'clamp(22px, 4vw, 38px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #90cdf4 0%, #68d391 50%, #f6ad55 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 8,
        }}>
          Jensen's 5-Layer AI Cake
        </h1>
        <p style={{ color: '#4a5568', fontSize: 13 }}>by @mtho11 · June 2, 2026</p>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16,
        flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
      }}>
        <input
          type="text"
          placeholder="Search ticker or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: '#161b22', border: '1px solid #2d3748', borderRadius: 8,
            color: '#e2e8f0', padding: '8px 14px', fontSize: 13, width: 220,
            outline: 'none',
          }}
        />
        {(['all', 'positive', 'negative'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: 'none', letterSpacing: '0.04em',
            background: filter === f
              ? (f === 'positive' ? '#276749' : f === 'negative' ? '#742a2a' : '#2d3748')
              : '#161b22',
            color: filter === f ? '#e2e8f0' : '#718096',
            transition: 'all 0.15s',
          }}>
            {f === 'all' ? 'All' : f === 'positive' ? '▲ Winners' : '▼ Losers'}
          </button>
        ))}
        <span style={{ color: '#4a5568', fontSize: 12, marginLeft: 4 }}>
          {sorted.length} stocks
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #1a202c' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: 12.5, minWidth: 900,
        }}>
          <thead>
            <tr>
              <Th label="Ticker" sk="ticker" />
              <Th label="Company" sk="company" />
              <Th label="Sector" sk="sector" />
              <Th label="Price" sk="price" right />
              <Th label="Mkt Cap" sk="marketCap" right />
              <Th label="P/S" right />
              <Th label="P/E" right />
              <Th label="% YTD" sk="pctYTD" />
              <Th label="Chart 1Y" />
              <Th label="% 1Y" sk="pct1Y" />
              <Th label="Δ Highs" sk="deltaHighs" />
              <Th label="RS" sk="rsRank" />
              <Th label="1M" />
              <Th label="20SMA" />
              <Th label="50SMA" />
              <Th label="200SMA" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const isPos = s.pctYTD >= 0
              const rowBg = i % 2 === 0 ? '#0d1117' : '#0f1419'
              return (
                <tr key={s.ticker} style={{
                  background: rowBg,
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1a202c')}
                  onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                >
                  {/* Ticker */}
                  <td style={{ padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #161b22' }}>
                    <span style={{
                      fontWeight: 700, fontSize: 11.5,
                      color: '#90cdf4', letterSpacing: '0.03em',
                    }}>{s.ticker}</span>
                  </td>

                  {/* Company */}
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #161b22', whiteSpace: 'nowrap' }}>
                    <span style={{ color: '#a0aec0', fontSize: 12 }}>{s.company}</span>
                  </td>

                  {/* Sector */}
                  <td style={{ padding: '7px 8px', borderBottom: '1px solid #161b22', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: sectorBg(s.sector),
                      color: sectorColor(s.sector),
                    }}>{s.sector}</span>
                  </td>

                  {/* Price */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #161b22' }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>
                      ${fmt(s.price)}
                    </span>
                  </td>

                  {/* Market Cap */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #161b22' }}>
                    <span style={{ color: '#718096' }}>{s.marketCap}</span>
                  </td>

                  {/* P/S */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #161b22' }}>
                    <span style={{
                      color: s.ps !== null && s.ps > 100 ? '#f6ad55' : '#a0aec0',
                      fontWeight: s.ps !== null && s.ps > 100 ? 700 : 400,
                    }}>
                      {s.ps !== null ? fmt(s.ps) : <span style={{ color: '#4a5568' }}>n/a</span>}
                    </span>
                  </td>

                  {/* P/E */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #161b22' }}>
                    <span style={{ color: '#a0aec0' }}>
                      {s.pe !== null ? fmt(s.pe) : <span style={{ color: '#4a5568' }}>n/a</span>}
                    </span>
                  </td>

                  {/* % YTD */}
                  <td style={{ padding: '7px 6px', borderBottom: '1px solid #161b22' }}>
                    <div style={{
                      display: 'inline-block',
                      background: ytdBg(s.pctYTD),
                      borderRadius: 5, padding: '3px 8px',
                      fontWeight: 700, fontSize: 12,
                      color: s.pctYTD >= 0 ? '#9ae6b4' : '#fc8181',
                      letterSpacing: '0.01em',
                      minWidth: 80, textAlign: 'center',
                    }}>
                      {fmtPct(s.pctYTD)}
                    </div>
                  </td>

                  {/* Sparkline */}
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #161b22' }}>
                    <Sparkline data={s.sparklineData} width={80} height={26} positive={isPos} />
                  </td>

                  {/* % 1Y */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #161b22' }}>
                    <span style={{
                      color: pctColor(s.pct1Y),
                      background: pctBg(s.pct1Y),
                      padding: '2px 6px', borderRadius: 4,
                      fontWeight: 600,
                    }}>
                      {fmtPct(s.pct1Y)}
                    </span>
                  </td>

                  {/* Delta Highs */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: '1px solid #161b22' }}>
                    <span style={{ color: s.deltaHighs >= -5 ? '#68d391' : s.deltaHighs >= -15 ? '#f6ad55' : '#fc8181', fontWeight: 600 }}>
                      {fmt(s.deltaHighs)}%
                    </span>
                  </td>

                  {/* RS Rank */}
                  <td style={{ padding: '7px 8px', textAlign: 'center', borderBottom: '1px solid #161b22' }}>
                    <span style={{
                      display: 'inline-block',
                      background: s.rsRank >= 90 ? 'rgba(72,187,120,0.2)' : s.rsRank >= 70 ? 'rgba(246,173,85,0.15)' : 'rgba(252,129,129,0.15)',
                      color: s.rsRank >= 90 ? '#68d391' : s.rsRank >= 70 ? '#f6ad55' : '#fc8181',
                      fontWeight: 700, fontSize: 11.5,
                      borderRadius: 4, padding: '2px 7px',
                    }}>
                      {s.rsRank}
                    </span>
                  </td>

                  {/* SMA badges */}
                  {(['sma1M', 'sma20', 'sma50', 'sma200'] as const).map(k => (
                    <td key={k} style={{ padding: '7px 6px', textAlign: 'center', borderBottom: '1px solid #161b22' }}>
                      <SMABadge dir={s[k]} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#0d1117', borderTop: '2px solid #2d3748' }}>
              <td colSpan={4} style={{ padding: '10px 8px', color: '#4a5568', fontSize: 11 }}>
                Sum / Avg
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#718096', fontWeight: 700, fontSize: 12 }}>
                {totalMktCap}
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#718096', fontWeight: 700, fontSize: 12 }}>
                {avgPS}
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: '#718096', fontWeight: 700, fontSize: 12 }}>
                {avgPE}
              </td>
              <td colSpan={9} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12, marginTop: 20,
      }}>
        {[
          { label: 'Total Market Cap', value: totalMktCap, color: '#90cdf4' },
          { label: 'Avg P/S', value: avgPS, color: '#68d391' },
          { label: 'Avg P/E', value: avgPE, color: '#f6ad55' },
          { label: 'Stocks Listed', value: String(allStocks.length), color: '#b794f4' },
          {
            label: 'YTD Winners',
            value: String(allStocks.filter(s => s.pctYTD >= 0).length),
            color: '#68d391',
          },
          {
            label: 'YTD Losers',
            value: String(allStocks.filter(s => s.pctYTD < 0).length),
            color: '#fc8181',
          },
        ].map(c => (
          <div key={c.label} style={{
            background: '#0d1117', border: '1px solid #1a202c',
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ color: '#4a5568', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              {c.label}
            </div>
            <div style={{ color: c.color, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
