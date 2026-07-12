import { useState, useMemo } from 'react'
import { stocks as aiCakeStocks } from '../data/stocks'
import { nasdaq100 } from '../data/nasdaq100'
import { sp500 } from '../data/sp500'
import type { Stock } from '../types/stock'
import { Sparkline } from './Sparkline'
import { getHistoricalStocks, REFERENCE_DATE } from '../utils/historical'

type StockListId = 'ai-cake' | 'nasdaq100' | 'sp500'

const STOCK_LISTS: Record<StockListId, { stocks: Stock[]; title: string }> = {
  'ai-cake':  { stocks: aiCakeStocks, title: "Jensen's 5-Layer AI Cake" },
  'nasdaq100':{ stocks: nasdaq100,    title: 'Nasdaq 100' },
  'sp500':    { stocks: sp500,        title: 'S&P 500' },
}

const REF_STR = REFERENCE_DATE.toISOString().slice(0, 10) // "2026-06-02"
const MIN_DATE = '2024-01-01'

function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

type SortKey = keyof Pick<Stock, 'ticker' | 'company' | 'sector' | 'price' | 'pctYTD' | 'pct1Y' | 'marketCap' | 'rsRank' | 'deltaHighs' | 'ret1W' | 'ret1M' | 'ret3M' | 'ret6M'>
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
  // AI Cake sectors
  'Semiconductors':        { bg: 'rgba(144,205,244,0.15)', fg: '#90cdf4' },
  'Semiconductor Equip':   { bg: 'rgba(118,169,250,0.15)', fg: '#76a9fa' },
  'Optical Networking':    { bg: 'rgba(167,243,208,0.15)', fg: '#6ee7b7' },
  'Cloud Computing':       { bg: 'rgba(196,181,253,0.15)', fg: '#c4b5fd' },
  'Hardware & Servers':    { bg: 'rgba(253,230,138,0.15)', fg: '#fcd34d' },
  'Data Center Infra':     { bg: 'rgba(252,165,165,0.15)', fg: '#fca5a5' },
  'Clean Energy':          { bg: 'rgba(110,231,183,0.15)', fg: '#34d399' },
  'Nuclear Energy':        { bg: 'rgba(251,191,36,0.15)',  fg: '#f59e0b' },
  'Energy Infrastructure': { bg: 'rgba(249,168,212,0.15)', fg: '#f9a8d4' },
  'Energy Storage':        { bg: 'rgba(134,239,172,0.15)', fg: '#4ade80' },
  'Crypto Mining':         { bg: 'rgba(253,186,116,0.15)', fg: '#fb923c' },
  'Enterprise Software':   { bg: 'rgba(165,180,252,0.15)', fg: '#a5b4fc' },
  'Big Tech':              { bg: 'rgba(103,232,249,0.15)', fg: '#67e8f9' },
  'EVs & Robotics':        { bg: 'rgba(240,171,252,0.15)', fg: '#e879f9' },
  // Nasdaq 100 extra sectors
  'Biotech':               { bg: 'rgba(52,211,153,0.15)',  fg: '#6ee7b7' },
  'Pharma':                { bg: 'rgba(94,234,212,0.15)',  fg: '#5eead4' },
  'MedTech':               { bg: 'rgba(167,139,250,0.15)', fg: '#a78bfa' },
  'Cybersecurity':         { bg: 'rgba(248,113,113,0.15)', fg: '#f87171' },
  'Consumer':              { bg: 'rgba(251,207,232,0.15)', fg: '#f9a8d4' },
  'Media & Gaming':        { bg: 'rgba(253,164,175,0.15)', fg: '#fb7185' },
  'Industrials':           { bg: 'rgba(203,213,225,0.15)', fg: '#94a3b8' },
  'Travel & Leisure':      { bg: 'rgba(253,224,71,0.15)',  fg: '#facc15' },
  'Fintech':               { bg: 'rgba(52,211,153,0.18)',  fg: '#34d399' },
  'E-commerce':            { bg: 'rgba(249,115,22,0.15)',  fg: '#fb923c' },
  'Ad Tech':               { bg: 'rgba(232,121,249,0.15)', fg: '#e879f9' },
  'Energy':                { bg: 'rgba(234,179,8,0.15)',   fg: '#eab308' },
  'Utilities':             { bg: 'rgba(74,222,128,0.12)',  fg: '#4ade80' },
  // S&P 500 extra sectors
  'Health Services':       { bg: 'rgba(45,212,191,0.15)',  fg: '#2dd4bf' },
  'Banking':               { bg: 'rgba(96,165,250,0.15)',  fg: '#60a5fa' },
  'Insurance':             { bg: 'rgba(129,140,248,0.15)', fg: '#818cf8' },
  'Capital Markets':       { bg: 'rgba(192,132,252,0.15)', fg: '#c084fc' },
  'Payments':              { bg: 'rgba(34,211,238,0.15)',  fg: '#22d3ee' },
  'Consumer Disc':         { bg: 'rgba(251,146,60,0.15)',  fg: '#fb923c' },
  'Consumer Staples':      { bg: 'rgba(163,230,53,0.15)',  fg: '#a3e635' },
  'Comm Services':         { bg: 'rgba(251,191,36,0.15)',  fg: '#fbbf24' },
  'Materials':             { bg: 'rgba(161,161,170,0.15)', fg: '#a1a1aa' },
  'Real Estate':           { bg: 'rgba(52,211,153,0.12)',  fg: '#34d399' },
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
  const [stockListId, setStockListId] = useState<StockListId>('ai-cake')
  const [sortKey, setSortKey] = useState<SortKey>('pctYTD')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [selectedDate, setSelectedDate] = useState(REF_STR)

  const activeList = STOCK_LISTS[stockListId]
  const sourceStocks = activeList.stocks

  const isHistorical = selectedDate < REF_STR

  const baseStocks = useMemo(() => {
    if (!isHistorical) return sourceStocks
    return getHistoricalStocks(sourceStocks, new Date(selectedDate + 'T12:00:00Z'))
  }, [selectedDate, isHistorical, sourceStocks])

  const sorted = useMemo(() => {
    let list = [...baseStocks]
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
  }, [sortKey, sortDir, search, filter, baseStocks])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const totalMktCap = useMemo(() => {
    const total = baseStocks.reduce((sum, s) => {
      const m = s.marketCap.match(/^\$([0-9.]+)([KMBT])$/)
      if (!m) return sum
      const mults: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }
      return sum + parseFloat(m[1]) * mults[m[2]]
    }, 0)
    if (total >= 1e12) return `$${(total / 1e12).toFixed(1)}T`
    return `$${(total / 1e9).toFixed(0)}B`
  }, [baseStocks])

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
          {activeList.title}
        </h1>
        <p style={{ color: '#4a5568', fontSize: 13 }}>
          by @mtho11 · {formatDisplayDate(selectedDate)}
          {isHistorical && <span style={{ marginLeft: 8, color: '#f6ad55', fontWeight: 600 }}>· historical</span>}
        </p>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16,
        flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* List selector */}
        <select
          value={stockListId}
          onChange={e => {
            setStockListId(e.target.value as StockListId)
            setSearch('')
            setFilter('all')
          }}
          style={{
            background: '#161b22',
            border: '1px solid #2d3748',
            borderRadius: 8,
            color: '#e2e8f0',
            padding: '7px 32px 7px 12px',
            fontSize: 12,
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23718096' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
        >
          <option value="ai-cake">🎂 AI Cake</option>
          <option value="nasdaq100">📊 Nasdaq 100</option>
          <option value="sp500">📈 S&amp;P 500</option>
        </select>

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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <label style={{ color: '#718096', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            Date
          </label>
          <input
            type="date"
            min={MIN_DATE}
            max={REF_STR}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              background: isHistorical ? 'rgba(246,173,85,0.1)' : '#161b22',
              border: `1px solid ${isHistorical ? '#744210' : '#2d3748'}`,
              borderRadius: 8, color: isHistorical ? '#f6ad55' : '#e2e8f0',
              padding: '7px 10px', fontSize: 12, outline: 'none', cursor: 'pointer',
            }}
          />
          {isHistorical && (
            <button
              onClick={() => setSelectedDate(REF_STR)}
              style={{
                padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1px solid #744210',
                background: 'rgba(246,173,85,0.15)', color: '#f6ad55',
                letterSpacing: '0.04em',
              }}
            >
              Reset
            </button>
          )}
        </div>
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
              <Th label="1W %" sk="ret1W" />
              <Th label="1M %" sk="ret1M" />
              <Th label="3M %" sk="ret3M" />
              <Th label="6M %" sk="ret6M" />
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

                  {/* Period returns */}
                  {(['ret1W', 'ret1M', 'ret3M', 'ret6M'] as const).map(k => (
                    <td key={k} style={{ padding: '7px 6px', textAlign: 'right', borderBottom: '1px solid #161b22' }}>
                      <span style={{
                        fontSize: 11.5, fontWeight: 600,
                        color: s[k] >= 0 ? '#68d391' : '#fc8181',
                      }}>
                        {s[k] >= 0 ? '+' : ''}{s[k].toFixed(1)}%
                      </span>
                    </td>
                  ))}

                  {/* SMA badges */}
                  {(['sma20', 'sma50', 'sma200'] as const).map(k => (
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
              <td colSpan={2} />
              <td colSpan={12} />
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
          { label: 'Stocks Listed', value: String(baseStocks.length), color: '#b794f4' },
          {
            label: 'YTD Winners',
            value: String(baseStocks.filter(s => s.pctYTD >= 0).length),
            color: '#68d391',
          },
          {
            label: 'YTD Losers',
            value: String(baseStocks.filter(s => s.pctYTD < 0).length),
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
