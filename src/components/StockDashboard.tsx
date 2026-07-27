import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { stocks as aiCakeStocks } from '../data/stocks'
import { nasdaq100 } from '../data/nasdaq100'
import { sp500 } from '../data/sp500'
import { dji } from '../data/dji'
import { finance } from '../data/finance'
import { oil } from '../data/oil'
import { healthcare } from '../data/healthcare'
import { biotech } from '../data/biotech'
import { retail } from '../data/retail'
import { ia12 } from '../data/ia12'
import { ALL_STOCKS_BY_TICKER, ALL_TICKERS } from '../data/allStocks'
import type { Stock } from '../types/stock'
import { Sparkline } from './Sparkline'
import { TickerTape } from './TickerTape'
import { getHistoricalStocks, REFERENCE_DATE } from '../utils/historical'
import { parseMarketCap } from '../utils/marketCap'
import { computeRSI14 } from '../utils/rsi'
import { parseUrlState, buildUrlPath } from '../utils/urlState'
import { navigateTo } from '../utils/nav'
import { THEMES, THEME_KEY, getInitialTheme, darken, type ThemeMode, type Theme } from '../utils/theme'

type StockListId = 'ai-cake' | 'nasdaq100' | 'sp500' | 'dji' | 'finance' | 'oil' | 'healthcare' | 'biotech' | 'retail' | 'ia12'
const STOCK_LIST_IDS: StockListId[] = ['ai-cake', 'nasdaq100', 'sp500', 'dji', 'finance', 'oil', 'healthcare', 'biotech', 'retail', 'ia12']
function isStockListId(v: string | undefined): v is StockListId {
  return !!v && (STOCK_LIST_IDS as string[]).includes(v)
}

const STOCK_LISTS: Record<StockListId, { stocks: Stock[]; title: string }> = {
  'ai-cake':   { stocks: aiCakeStocks, title: "Mike's Market Monitor" },
  'nasdaq100': { stocks: nasdaq100,    title: 'Nasdaq 100' },
  'sp500':     { stocks: sp500,        title: 'S&P 500' },
  'dji':       { stocks: dji,          title: 'Dow Jones Industrial Average' },
  'finance':   { stocks: finance,      title: 'Finance' },
  'oil':       { stocks: oil,          title: 'Oil & Energy' },
  'healthcare':{ stocks: healthcare,   title: 'Healthcare' },
  'biotech':   { stocks: biotech,      title: 'Biotech' },
  'retail':    { stocks: retail,       title: 'Retail' },
  'ia12':      { stocks: ia12,         title: 'IA12' },
}

const REF_STR = REFERENCE_DATE.toISOString().slice(0, 10) // "2026-06-02"
const MIN_DATE = '2024-01-01'
const TODAY_STR = new Date().toISOString().slice(0, 10)
// The date input's ceiling: real "today" once it passes the mock timeline's
// reference date (the normal case), otherwise the reference date itself.
const MAX_DATE = TODAY_STR > REF_STR ? TODAY_STR : REF_STR
const FAVORITES_KEY = 'stocks-dashboard-favorites'
const CUSTOM_LISTS_KEY = 'stocks-dashboard-custom-lists'
const BASE_PATH = import.meta.env.BASE_URL

// Favorites are stored per stock list ({ [listId]: ticker[] }) so marking
// AAPL a favorite in Nasdaq 100 doesn't bleed into the S&P 500 view.
function loadFavorites(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

interface CustomList {
  id: string
  name: string
  tickers: string[]
}

function loadCustomLists(): CustomList[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_LISTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function makeListId(): string {
  return `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// Resolves either a built-in StockListId or a custom list's id to its
// stock array + display title. Falls back to the AI Cake list if the id
// matches neither (e.g. a stale/edited URL, or a deleted custom list).
function resolveActiveList(id: string, customLists: CustomList[]): { stocks: Stock[]; title: string } {
  if (isStockListId(id)) return STOCK_LISTS[id]
  const cl = customLists.find(l => l.id === id)
  if (!cl) return STOCK_LISTS['ai-cake']
  const stocks = cl.tickers.map(t => ALL_STOCKS_BY_TICKER[t]).filter((s): s is Stock => !!s)
  if (stocks.length < 2) return { stocks, title: cl.name || 'Custom List' }
  // Recompute RS rank relative to this custom cohort rather than leaving
  // whatever rank each stock happened to have in its source list.
  const byPerf = [...stocks].sort((a, b) => b.pct1Y - a.pct1Y)
  const n = byPerf.length - 1
  const ranked = stocks.map(s => {
    const rank = byPerf.findIndex(x => x.ticker === s.ticker)
    return { ...s, rsRank: Math.round(99 - (rank / n) * 65) }
  })
  return { stocks: ranked, title: cl.name || 'Custom List' }
}

function readUrlState(): { listId: string; date: string } {
  if (typeof window === 'undefined') return { listId: 'ai-cake', date: TODAY_STR }
  const { listId, date } = parseUrlState(window.location.pathname, BASE_PATH)
  const customLists = loadCustomLists()
  const validListId = listId && (isStockListId(listId) || customLists.some(l => l.id === listId)) ? listId : 'ai-cake'
  return {
    listId: validListId,
    date: date && date >= MIN_DATE && date <= MAX_DATE ? date : TODAY_STR,
  }
}

function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

type StockSortKey = keyof Pick<Stock, 'ticker' | 'company' | 'sector' | 'price' | 'pctYTD' | 'pct1Y' | 'marketCap' | 'rsRank' | 'deltaHighs' | 'ret1W' | 'ret1M' | 'ret3M' | 'ret6M'>
type SortKey = StockSortKey | 'favorite'
type SortDir = 'asc' | 'desc'

function getSortValue(s: Stock, key: SortKey, favorites: Set<string>): number | string {
  if (key === 'favorite') return favorites.has(s.ticker) ? 1 : 0
  if (key === 'marketCap') return parseMarketCap(s.marketCap)
  return s[key]
}

// ── Custom column filters ────────────────────────────────────────────────
type RangeFilterKey = 'price' | 'marketCap' | 'pctYTD' | 'pct1Y' | 'deltaHighs' | 'rsRank' | 'rsi' | 'ret1W' | 'ret1M' | 'ret3M' | 'ret6M'
type RangeValue = { min: string; max: string }
type SmaFilterValue = 'any' | 'up' | 'down'

interface RangeFilterDef {
  key: RangeFilterKey
  label: string
  getValue: (s: Stock) => number
}

const RANGE_FILTER_DEFS: RangeFilterDef[] = [
  { key: 'price', label: 'Price ($)', getValue: s => s.price },
  { key: 'marketCap', label: 'Mkt Cap ($B)', getValue: s => parseMarketCap(s.marketCap) / 1e9 },
  { key: 'pctYTD', label: '% YTD', getValue: s => s.pctYTD },
  { key: 'pct1Y', label: '% 1Y', getValue: s => s.pct1Y },
  { key: 'deltaHighs', label: 'Δ Highs (%)', getValue: s => s.deltaHighs },
  { key: 'rsRank', label: 'RS Rank', getValue: s => s.rsRank },
  { key: 'rsi', label: 'RSI(14)', getValue: s => computeRSI14(s) },
  { key: 'ret1W', label: '1W %', getValue: s => s.ret1W },
  { key: 'ret1M', label: '1M %', getValue: s => s.ret1M },
  { key: 'ret3M', label: '3M %', getValue: s => s.ret3M },
  { key: 'ret6M', label: '6M %', getValue: s => s.ret6M },
]

interface AdvancedFilters {
  sectors: string[]
  ranges: Record<RangeFilterKey, RangeValue>
  sma20: SmaFilterValue
  sma50: SmaFilterValue
  sma200: SmaFilterValue
}

function createEmptyFilters(): AdvancedFilters {
  return {
    sectors: [],
    ranges: Object.fromEntries(RANGE_FILTER_DEFS.map(d => [d.key, { min: '', max: '' }])) as Record<RangeFilterKey, RangeValue>,
    sma20: 'any',
    sma50: 'any',
    sma200: 'any',
  }
}

function countActiveFilters(f: AdvancedFilters): number {
  const rangeCount = RANGE_FILTER_DEFS.filter(d => f.ranges[d.key].min !== '' || f.ranges[d.key].max !== '').length
  const smaCount = [f.sma20, f.sma50, f.sma200].filter(v => v !== 'any').length
  return f.sectors.length + rangeCount + smaCount
}

function passesFilters(s: Stock, f: AdvancedFilters): boolean {
  if (f.sectors.length && !f.sectors.includes(s.sector)) return false
  for (const def of RANGE_FILTER_DEFS) {
    const { min, max } = f.ranges[def.key]
    const v = def.getValue(s)
    if (min !== '' && v < parseFloat(min)) return false
    if (max !== '' && v > parseFloat(max)) return false
  }
  if (f.sma20 !== 'any' && s.sma20 !== f.sma20) return false
  if (f.sma50 !== 'any' && s.sma50 !== f.sma50) return false
  if (f.sma200 !== 'any' && s.sma200 !== f.sma200) return false
  return true
}

const TOOLTIP_DELAY_MS = 750

// Top-level so its component identity is stable across renders — defining
// it inside StockDashboard remounted every header cell on each render.
function Th({ label, sk, right, tip, sortKey, sortDir, onSort, t, ink }: {
  label: string
  sk?: SortKey
  right?: boolean
  tip?: string
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  t: Theme
  ink: (hex: string) => string
}) {
  const active = sk && sortKey === sk
  const [showTip, setShowTip] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function onEnter() {
    if (!tip) return
    timerRef.current = setTimeout(() => setShowTip(true), TOOLTIP_DELAY_MS)
  }
  function onLeave() {
    clearTimeout(timerRef.current)
    setShowTip(false)
  }

  return (
    <th
      onClick={sk ? () => onSort(sk) : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        padding: '10px 8px',
        textAlign: right ? 'right' : 'center',
        whiteSpace: 'nowrap',
        cursor: sk ? 'pointer' : 'default',
        color: active ? ink('#90cdf4') : t.textSecondary,
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        userSelect: 'none',
        borderBottom: `1px solid ${t.borderControl}`,
        background: t.panelBg,
        position: 'sticky', top: 0, zIndex: 2,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, position: 'relative' }}>
        {label}
        {sk && <span style={{ opacity: active ? 1 : 0.3, fontSize: 9 }}>{active && sortDir === 'asc' ? '▲' : '▼'}</span>}
        {tip && showTip && (
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: 8, zIndex: 10,
            background: t.panelBg, border: `1px solid ${t.borderOuter}`,
            borderRadius: 8, padding: '8px 10px',
            fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal',
            color: t.textPrimary, whiteSpace: 'normal', textAlign: 'left',
            width: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', pointerEvents: 'none',
          }}>
            {tip}
          </span>
        )}
      </span>
    </th>
  )
}

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

function RangeRow({ def, value, onChange, t }: {
  def: RangeFilterDef
  value: RangeValue
  onChange: (v: RangeValue) => void
  t: Theme
}) {
  const inputStyle = {
    width: 56, background: t.inputBg, border: `1px solid ${t.borderControl}`,
    borderRadius: 5, color: t.textPrimary, fontSize: 11, padding: '3px 5px', outline: 'none',
  }
  return (
    <div>
      <div style={{ fontSize: 10, color: t.textSecondary, marginBottom: 3 }}>{def.label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <input type="number" placeholder="Min" value={value.min}
          onChange={e => onChange({ ...value, min: e.target.value })} style={inputStyle} />
        <span style={{ color: t.textMuted, fontSize: 10 }}>–</span>
        <input type="number" placeholder="Max" value={value.max}
          onChange={e => onChange({ ...value, max: e.target.value })} style={inputStyle} />
      </div>
    </div>
  )
}

function SmaFilterRow({ label, value, onChange, t }: {
  label: string
  value: SmaFilterValue
  onChange: (v: SmaFilterValue) => void
  t: Theme
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 11, color: t.textSecondary }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['any', 'up', 'down'] as const).map(opt => (
          <button key={opt} onClick={() => onChange(opt)} style={{
            padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 600,
            border: 'none', cursor: 'pointer', textTransform: 'capitalize',
            background: value === opt ? t.borderControl : t.inputBg,
            color: value === opt ? t.textPrimary : t.textMuted,
          }}>{opt}</button>
        ))}
      </div>
    </div>
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
  // Retail extra sectors
  'Discount & Grocery':    { bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
  'Home Improvement':      { bg: 'rgba(251,146,60,0.15)',  fg: '#fb923c' },
  'Off-Price & Apparel':   { bg: 'rgba(244,114,182,0.15)', fg: '#f472b6' },
  'Specialty Retail':      { bg: 'rgba(129,140,248,0.15)', fg: '#818cf8' },
  // IA12
  'Aerospace':             { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
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

function pctBg(pct: number, isDark: boolean): string {
  const a = isDark ? 1 : 1.6
  if (pct >= 200) return `rgba(72,187,120,${0.25 * a})`
  if (pct >= 100) return `rgba(72,187,120,${0.18 * a})`
  if (pct >= 50) return `rgba(72,187,120,${0.12 * a})`
  if (pct >= 20) return `rgba(72,187,120,${0.07 * a})`
  if (pct >= 0) return 'transparent'
  if (pct >= -20) return `rgba(252,129,129,${0.10 * a})`
  return `rgba(252,129,129,${0.20 * a})`
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
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme)
  const [initialUrlState] = useState(readUrlState)
  const [stockListId, setStockListId] = useState<string>(initialUrlState.listId)
  const [sortKey, setSortKey] = useState<SortKey>('pctYTD')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [selectedDate, setSelectedDate] = useState(initialUrlState.date)
  const [favoritesByList, setFavoritesByList] = useState<Record<string, string[]>>(loadFavorites)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(createEmptyFilters)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [customLists, setCustomLists] = useState<CustomList[]>(loadCustomLists)
  const [listsPanelOpen, setListsPanelOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [tickerInput, setTickerInput] = useState('')
  const [tickerError, setTickerError] = useState('')

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesByList))
  }, [favoritesByList])

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_LISTS_KEY, JSON.stringify(customLists))
  }, [customLists])

  function createCustomList() {
    const name = newListName.trim()
    if (!name) return
    const id = makeListId()
    setCustomLists(prev => [...prev, { id, name, tickers: [] }])
    setNewListName('')
    switchList(id)
  }

  function renameCustomList(id: string, name: string) {
    setCustomLists(prev => prev.map(l => l.id === id ? { ...l, name } : l))
  }

  function deleteCustomList(id: string) {
    if (!window.confirm('Delete this list? This cannot be undone.')) return
    setCustomLists(prev => prev.filter(l => l.id !== id))
    if (stockListId === id) switchList('ai-cake')
  }

  function addTickerToList(id: string, rawTicker: string) {
    const ticker = rawTicker.trim().toUpperCase()
    if (!ticker) return
    if (!ALL_STOCKS_BY_TICKER[ticker]) {
      // Previously a silent no-op — indistinguishable from the button not
      // working at all. Tell the user why instead.
      setTickerError(`"${ticker}" isn't in AI Cake, Nasdaq 100, S&P 500, Dow 30, Finance, Oil & Energy, Healthcare, Biotech, Retail, or IA12, so it can't be added.`)
      return
    }
    setCustomLists(prev => prev.map(l =>
      l.id === id && !l.tickers.includes(ticker) ? { ...l, tickers: [...l.tickers, ticker] } : l
    ))
    setTickerInput('')
    setTickerError('')
  }

  function removeTickerFromList(id: string, ticker: string) {
    setCustomLists(prev => prev.map(l =>
      l.id === id ? { ...l, tickers: l.tickers.filter(t => t !== ticker) } : l
    ))
  }

  // Keep the URL in sync with list + date so the app state is bookmarkable
  // and shareable, e.g. /stocks-dashboard/nasdaq100/2026-07-13. Uses
  // replaceState (not pushState) so picking dates/lists doesn't spam
  // browser history — editing the URL bar directly still works since that's
  // a real navigation, which re-reads it via readUrlState() on load.
  useEffect(() => {
    const path = buildUrlPath(BASE_PATH, stockListId, selectedDate)
    if (window.location.pathname !== path) {
      window.history.replaceState(null, '', path + window.location.search)
    }
  }, [stockListId, selectedDate])

  // Switches the active list and clears any stale ticker-add state from
  // whichever custom list's editor was previously open.
  function switchList(id: string) {
    setStockListId(id)
    setTickerInput('')
    setTickerError('')
  }

  const isDark = mode === 'dark'
  const t = THEMES[mode]

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, mode)
    // Sync the page chrome: index.css hardcodes a dark body, which
    // otherwise shows through as dark overscroll/scrollbars in light mode.
    document.body.style.background = THEMES[mode].pageBg
    document.documentElement.style.colorScheme = mode
  }, [mode])

  // Darkens light/pastel accent colors so they stay legible on a light page.
  const ink = useCallback((hex: string) => (isDark ? hex : darken(hex)), [isDark])

  const activeList = useMemo(() => resolveActiveList(stockListId, customLists), [stockListId, customLists])
  const sourceStocks = activeList.stocks
  const activeCustomList = customLists.find(l => l.id === stockListId)

  useEffect(() => {
    document.title = activeList.title
  }, [activeList.title])

  const favorites = useMemo(
    () => new Set(favoritesByList[stockListId] ?? []),
    [favoritesByList, stockListId]
  )

  function toggleFavorite(ticker: string) {
    setFavoritesByList(prev => {
      const current = new Set(prev[stockListId] ?? [])
      if (current.has(ticker)) current.delete(ticker)
      else current.add(ticker)
      return { ...prev, [stockListId]: [...current] }
    })
  }

  const isHistorical = selectedDate < REF_STR
  const isToday = selectedDate === TODAY_STR

  const baseStocks = useMemo(() => {
    if (!isHistorical) return sourceStocks
    return getHistoricalStocks(sourceStocks, new Date(selectedDate + 'T12:00:00Z'))
  }, [selectedDate, isHistorical, sourceStocks])

  const availableSectors = useMemo(
    () => [...new Set(sourceStocks.map(s => s.sector))].sort(),
    [sourceStocks]
  )
  const activeFilterCount = countActiveFilters(advancedFilters)

  function updateRange(key: RangeFilterKey, value: RangeValue) {
    setAdvancedFilters(prev => ({ ...prev, ranges: { ...prev.ranges, [key]: value } }))
  }

  function toggleSector(sector: string) {
    setAdvancedFilters(prev => ({
      ...prev,
      sectors: prev.sectors.includes(sector)
        ? prev.sectors.filter(s => s !== sector)
        : [...prev.sectors, sector],
    }))
  }

  const sorted = useMemo(() => {
    let list = [...baseStocks]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.company.toLowerCase().includes(q))
    }
    if (filter === 'positive') list = list.filter(s => s.pctYTD >= 0)
    if (filter === 'negative') list = list.filter(s => s.pctYTD < 0)
    if (activeFilterCount > 0) list = list.filter(s => passesFilters(s, advancedFilters))

    list.sort((a, b) => {
      // Market cap is a display string ("$254.2B") — compare numerically,
      // otherwise it sorts alphabetically ($850.4B above $5.4T). Favorite
      // is synthetic (not a Stock field) — getSortValue maps it to 1/0.
      const av = getSortValue(a, sortKey, favorites)
      const bv = getSortValue(b, sortKey, favorites)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [sortKey, sortDir, search, filter, baseStocks, favorites, activeFilterCount, advancedFilters])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const totalMktCap = useMemo(() => {
    const total = baseStocks.reduce((sum, s) => sum + parseMarketCap(s.marketCap), 0)
    if (total >= 1e12) return `$${(total / 1e12).toFixed(1)}T`
    return `$${(total / 1e9).toFixed(0)}B`
  }, [baseStocks])

  const thProps = { sortKey, sortDir, onSort: toggleSort, t, ink }

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, padding: '24px 16px', transition: 'background 0.2s' }}>
      {/* Ticker tape — bleeds to the full page width despite the padding above */}
      <div style={{ margin: '-24px -16px 20px' }}>
        <TickerTape stocks={nasdaq100} t={t} />
      </div>

      {/* Header */}
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 28 }}>
        <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigateTo(`${BASE_PATH}about`)}
            aria-label="About this app"
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid ${t.borderControl}`,
              background: t.inputBg,
              color: t.textSecondary,
              cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ℹ️
          </button>
          <button
            onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle light/dark theme"
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid ${t.borderControl}`,
              background: t.inputBg,
              color: t.textSecondary,
              cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
        <h1 style={{
          fontSize: 'clamp(22px, 4vw, 38px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          backgroundImage: t.gradient,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
          marginBottom: 8,
        }}>
          {activeList.title}
        </h1>
        <p style={{ color: t.textMuted, fontSize: 13 }}>
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
            switchList(e.target.value)
            setSearch('')
            setFilter('all')
            setAdvancedFilters(createEmptyFilters())
          }}
          style={{
            backgroundColor: t.inputBg,
            border: `1px solid ${t.borderControl}`,
            borderRadius: 8,
            color: t.textPrimary,
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
          <optgroup label="Indices">
            <option value="ai-cake">🎂 AI Cake</option>
            <option value="nasdaq100">📊 Nasdaq 100</option>
            <option value="sp500">📈 S&amp;P 500</option>
            <option value="dji">🏛 Dow 30</option>
            <option value="finance">🏦 Finance</option>
            <option value="oil">🛢️ Oil &amp; Energy</option>
            <option value="healthcare">⚕️ Healthcare</option>
            <option value="biotech">🧬 Biotech</option>
            <option value="retail">🛍️ Retail</option>
            <option value="ia12">🚀 IA12</option>
          </optgroup>
          {customLists.length > 0 && (
            <optgroup label="My Lists">
              {customLists.map(cl => (
                <option key={cl.id} value={cl.id}>📁 {cl.name} ({cl.tickers.length})</option>
              ))}
            </optgroup>
          )}
        </select>

        {/* Custom list manager */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setListsPanelOpen(o => !o)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.04em',
              border: `1px solid ${t.borderControl}`,
              background: t.inputBg, color: t.textSecondary,
            }}
          >
            📁 My Lists
          </button>

          {listsPanelOpen && (
            <>
              <div
                onClick={() => setListsPanelOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 19 }}
              />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 20,
                width: 320, maxHeight: 460, overflowY: 'auto',
                background: t.panelBg, border: `1px solid ${t.borderOuter}`,
                borderRadius: 12, padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                textAlign: 'left',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>Custom Lists</span>
                  <button
                    onClick={() => setListsPanelOpen(false)}
                    aria-label="Close my lists"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 14, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Create new list */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  <input
                    type="text"
                    placeholder="New list name…"
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createCustomList()}
                    style={{
                      flex: 1, background: t.inputBg, border: `1px solid ${t.borderControl}`,
                      borderRadius: 6, color: t.textPrimary, fontSize: 12, padding: '6px 8px', outline: 'none',
                    }}
                  />
                  <button
                    onClick={createCustomList}
                    disabled={!newListName.trim()}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
                      border: 'none', cursor: newListName.trim() ? 'pointer' : 'default',
                      background: newListName.trim() ? '#2f855a' : t.borderControl,
                      color: newListName.trim() ? '#e2e8f0' : t.textMuted,
                    }}
                  >
                    + Create
                  </button>
                </div>

                {customLists.length === 0 && (
                  <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 4 }}>
                    No custom lists yet — create one above, then add any ticker to it.
                  </div>
                )}

                {customLists.map(cl => {
                  const isActive = cl.id === stockListId
                  return (
                    <div key={cl.id} style={{
                      border: `1px solid ${isActive ? '#2f855a' : t.borderOuter}`,
                      borderRadius: 8, padding: 10, marginBottom: 8,
                      background: isActive ? 'rgba(72,187,120,0.06)' : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isActive ? 8 : 0 }}>
                        {isActive ? (
                          <input
                            type="text"
                            value={cl.name}
                            onChange={e => renameCustomList(cl.id, e.target.value)}
                            style={{
                              flex: 1, background: 'transparent', border: 'none',
                              color: t.textPrimary, fontSize: 12.5, fontWeight: 600, outline: 'none', padding: '2px 0',
                            }}
                          />
                        ) : (
                          // Not an <input> here — clicking to rename a list you
                          // aren't viewing looked identical to clicking to switch
                          // to it, and only silently placed a cursor. Make the
                          // whole name clickable to switch instead.
                          <button
                            onClick={() => switchList(cl.id)}
                            style={{
                              flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                              color: t.textPrimary, fontSize: 12.5, fontWeight: 600, padding: '2px 0',
                            }}
                          >
                            {cl.name}
                          </button>
                        )}
                        <span style={{ fontSize: 10.5, color: t.textMuted, whiteSpace: 'nowrap' }}>{cl.tickers.length} tickers</span>
                        <button
                          onClick={() => deleteCustomList(cl.id)}
                          aria-label={`Delete ${cl.name}`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: 13, lineHeight: 1, padding: 2 }}
                        >
                          🗑
                        </button>
                      </div>

                      {isActive && (
                        <>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                            {cl.tickers.map(ticker => (
                              <span key={ticker} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                background: t.inputBg, border: `1px solid ${t.borderControl}`,
                                borderRadius: 5, padding: '2px 4px 2px 8px', fontSize: 10.5, color: t.textPrimary,
                              }}>
                                {ticker}
                                <button
                                  onClick={() => removeTickerFromList(cl.id, ticker)}
                                  aria-label={`Remove ${ticker}`}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 12, lineHeight: 1, padding: '0 2px' }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            {cl.tickers.length === 0 && (
                              <span style={{ fontSize: 10.5, color: t.textMuted }}>No tickers yet</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              list="all-tickers-datalist"
                              placeholder="Add ticker (e.g. AAPL)…"
                              value={tickerInput}
                              onChange={e => { setTickerInput(e.target.value); setTickerError('') }}
                              onKeyDown={e => e.key === 'Enter' && addTickerToList(cl.id, tickerInput)}
                              style={{
                                flex: 1, background: t.inputBg,
                                border: `1px solid ${tickerError ? '#e53e3e' : t.borderControl}`,
                                borderRadius: 6, color: t.textPrimary, fontSize: 11.5, padding: '5px 7px', outline: 'none',
                              }}
                            />
                            <button
                              onClick={() => addTickerToList(cl.id, tickerInput)}
                              style={{
                                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                border: 'none', cursor: 'pointer', background: t.borderControl, color: t.textPrimary,
                              }}
                            >
                              Add
                            </button>
                          </div>
                          {tickerError && (
                            <div style={{ color: '#e53e3e', fontSize: 10.5, marginTop: 5 }}>
                              {tickerError}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <datalist id="all-tickers-datalist">
          {ALL_TICKERS.map(ticker => (
            <option key={ticker} value={ticker}>
              {ticker} — {ALL_STOCKS_BY_TICKER[ticker].company}
            </option>
          ))}
        </datalist>

        <input
          type="text"
          placeholder="Search ticker or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: t.inputBg, border: `1px solid ${t.borderControl}`, borderRadius: 8,
            color: t.textPrimary, padding: '8px 14px', fontSize: 13, width: 220,
            outline: 'none',
          }}
        />
        {(['all', 'positive', 'negative'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: 'none', letterSpacing: '0.04em',
            background: filter === f
              ? (f === 'positive' ? '#276749' : f === 'negative' ? '#742a2a' : t.borderControl)
              : t.inputBg,
            color: filter === f ? '#e2e8f0' : t.textSecondary,
            transition: 'all 0.15s',
          }}>
            {f === 'all' ? 'All' : f === 'positive' ? '▲ Winners' : '▼ Losers'}
          </button>
        ))}

        {/* Custom column filters */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setFilterPanelOpen(o => !o)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.04em',
              border: `1px solid ${activeFilterCount > 0 ? '#2b6cb0' : t.borderControl}`,
              background: activeFilterCount > 0 ? 'rgba(66,153,225,0.15)' : t.inputBg,
              color: activeFilterCount > 0 ? '#4299e1' : t.textSecondary,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            ⚙ Filters
            {activeFilterCount > 0 && (
              <span style={{
                background: '#4299e1', color: '#0a0a0f', borderRadius: 10,
                fontSize: 10, fontWeight: 800, minWidth: 16, height: 16,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {filterPanelOpen && (
            <>
              <div
                onClick={() => setFilterPanelOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 19 }}
              />
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 20,
                width: 360, maxHeight: 480, overflowY: 'auto',
                background: t.panelBg, border: `1px solid ${t.borderOuter}`,
                borderRadius: 12, padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                textAlign: 'left',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>Custom Filters</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => setAdvancedFilters(createEmptyFilters())}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: 11, fontWeight: 600 }}
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={() => setFilterPanelOpen(false)}
                      aria-label="Close filters"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 14, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Sector */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: t.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sector
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {availableSectors.map(sector => {
                      const active = advancedFilters.sectors.includes(sector)
                      return (
                        <button key={sector} onClick={() => toggleSector(sector)} style={{
                          padding: '3px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 500,
                          border: 'none', cursor: 'pointer',
                          background: active ? SECTOR_PALETTE[sector]?.bg ?? 'rgba(160,174,192,0.2)' : t.inputBg,
                          color: active ? ink(SECTOR_PALETTE[sector]?.fg ?? '#a0aec0') : t.textMuted,
                        }}>
                          {sector}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Numeric ranges */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14,
                }}>
                  {RANGE_FILTER_DEFS.map(def => (
                    <RangeRow
                      key={def.key}
                      def={def}
                      value={advancedFilters.ranges[def.key]}
                      onChange={v => updateRange(def.key, v)}
                      t={t}
                    />
                  ))}
                </div>

                {/* SMA direction */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Moving Averages
                  </div>
                  <SmaFilterRow label="20-Day SMA" value={advancedFilters.sma20} onChange={v => setAdvancedFilters(prev => ({ ...prev, sma20: v }))} t={t} />
                  <SmaFilterRow label="50-Day SMA" value={advancedFilters.sma50} onChange={v => setAdvancedFilters(prev => ({ ...prev, sma50: v }))} t={t} />
                  <SmaFilterRow label="200-Day SMA" value={advancedFilters.sma200} onChange={v => setAdvancedFilters(prev => ({ ...prev, sma200: v }))} t={t} />
                </div>
              </div>
            </>
          )}
        </div>

        <span style={{ color: t.textMuted, fontSize: 12, marginLeft: 4 }}>
          {sorted.length} stocks
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <label style={{ color: t.textSecondary, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            Date
          </label>
          <input
            type="date"
            min={MIN_DATE}
            max={MAX_DATE}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              background: isHistorical ? 'rgba(246,173,85,0.1)' : t.inputBg,
              border: `1px solid ${isHistorical ? '#744210' : t.borderControl}`,
              borderRadius: 8, color: isHistorical ? '#dd6b20' : t.textPrimary,
              padding: '7px 10px', fontSize: 12, outline: 'none', cursor: 'pointer',
            }}
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(TODAY_STR)}
              style={{
                padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1px solid #744210',
                background: 'rgba(246,173,85,0.15)', color: '#dd6b20',
                letterSpacing: '0.04em',
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {activeCustomList && activeCustomList.tickers.length === 0 && (
        <div style={{
          textAlign: 'center', color: t.textMuted, fontSize: 13,
          background: t.panelBg, border: `1px solid ${t.borderOuter}`,
          borderRadius: 10, padding: '18px 16px', marginBottom: 16,
        }}>
          "{activeCustomList.name}" has no stocks yet. Open <strong>📁 My Lists</strong> above and add a ticker to get started.
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${t.borderOuter}` }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: 12.5, minWidth: 1070,
        }}>
          <thead>
            <tr>
              <Th label="★" sk="favorite" tip="Mark this stock as a favorite for quick reference." {...thProps} />
              <Th label="#" tip="Rank within this list, based on the current sort." {...thProps} />
              <Th label="Ticker" sk="ticker" tip="Stock ticker symbol — click it to open a detailed price chart." {...thProps} />
              <Th label="Company" sk="company" tip="Company name." {...thProps} />
              <Th label="Sector" sk="sector" tip="Industry sector classification." {...thProps} />
              <Th label="Price" sk="price" right tip="Latest share price." {...thProps} />
              <Th label="Mkt Cap" sk="marketCap" right tip="Total market capitalization — share price × shares outstanding." {...thProps} />
              <Th label="P/S" right tip="Price-to-sales ratio — share price divided by revenue per share." {...thProps} />
              <Th label="P/E" right tip="Price-to-earnings ratio — share price divided by earnings per share." {...thProps} />
              <Th label="% YTD" sk="pctYTD" tip="Percent price change since the start of the calendar year." {...thProps} />
              <Th label="% 1Y" sk="pct1Y" tip="Percent price change over the trailing 12 months." {...thProps} />
              <Th label="Chart 1W" tip="7-day price sparkline." {...thProps} />
              <Th label="Chart 1M" tip="30-day price sparkline." {...thProps} />
              <Th label="Chart 1Y" tip="1-year price sparkline." {...thProps} />
              <Th label="Δ Highs" sk="deltaHighs" tip="Percent below the stock's 52-week high." {...thProps} />
              <Th label="RS" sk="rsRank" tip="Relative Strength Rank — percentile performance vs. the rest of this list. Higher is stronger." {...thProps} />
              <Th label="RSI(14)" tip="14-period Relative Strength Index — a momentum gauge. Above 70 is overbought, below 30 is oversold." {...thProps} />
              <Th label="1W %" sk="ret1W" tip="Price return over the trailing 1 week." {...thProps} />
              <Th label="1M %" sk="ret1M" tip="Price return over the trailing 1 month." {...thProps} />
              <Th label="3M %" sk="ret3M" tip="Price return over the trailing 3 months." {...thProps} />
              <Th label="6M %" sk="ret6M" tip="Price return over the trailing 6 months." {...thProps} />
              <Th label="20SMA" tip="Whether price is trending above (▲) or below (▼) its 20-day simple moving average." {...thProps} />
              <Th label="50SMA" tip="Whether price is trending above (▲) or below (▼) its 50-day simple moving average." {...thProps} />
              <Th label="200SMA" tip="Whether price is trending above (▲) or below (▼) its 200-day simple moving average." {...thProps} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              // 6 points (not fewer) so the curve keeps real texture — at
              // 4 points a short window is almost always monotonic, and the
              // y-scale's proportional padding then pins the first/last
              // point to nearly the same pixel position for every stock,
              // making every row's chart look like the same flat diagonal.
              const spark1W = s.sparklineData.slice(-6)
              const spark1M = s.sparklineData.slice(-8)
              // Color each chart by its own plotted trend (first vs last
              // point), not an unrelated return field — sparklineData is an
              // independent random walk, so e.g. ret1M's sign can disagree
              // with what a given window of it actually shows.
              const isPos1W = spark1W[spark1W.length - 1] >= spark1W[0]
              const isPos1M = spark1M[spark1M.length - 1] >= spark1M[0]
              const isPos1Y = s.sparklineData[s.sparklineData.length - 1] >= s.sparklineData[0]
              const rowBg = i % 2 === 0 ? t.panelBg : t.panelBg2
              const cellBorder = `1px solid ${t.borderInner}`
              const isFavorite = favorites.has(s.ticker)
              return (
                <tr key={s.ticker} style={{
                  background: rowBg,
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.hoverBg)}
                  onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                >
                  {/* Favorite */}
                  <td style={{ padding: '7px 4px', textAlign: 'center', borderBottom: cellBorder }}>
                    <button
                      onClick={() => toggleFavorite(s.ticker)}
                      aria-label={isFavorite ? `Remove ${s.ticker} from favorites` : `Add ${s.ticker} to favorites`}
                      aria-pressed={isFavorite}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 2, fontSize: 15, lineHeight: 1,
                        color: isFavorite ? '#f6ad55' : t.borderControl,
                      }}
                    >
                      {isFavorite ? '★' : '☆'}
                    </button>
                  </td>

                  {/* Rank */}
                  <td style={{ padding: '7px 8px', textAlign: 'center', borderBottom: cellBorder }}>
                    <span style={{
                      fontWeight: i < 3 ? 700 : 500,
                      fontSize: 11.5,
                      fontVariantNumeric: 'tabular-nums',
                      color: i === 0 ? '#dd6b20' : i === 1 ? t.textSecondary : i === 2 ? '#c05621' : t.textMuted,
                    }}>{i + 1}</span>
                  </td>

                  {/* Ticker */}
                  <td style={{ padding: '7px 8px', textAlign: 'center', borderBottom: cellBorder }}>
                    <button
                      onClick={() => navigateTo(`${BASE_PATH}stock/${s.ticker}`)}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        fontWeight: 700, fontSize: 11.5,
                        color: ink('#90cdf4'), letterSpacing: '0.03em',
                        textDecoration: 'underline', textDecorationColor: 'transparent',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'currentcolor')}
                      onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                    >
                      {s.ticker}
                    </button>
                  </td>

                  {/* Company */}
                  <td style={{ padding: '7px 8px', borderBottom: cellBorder, whiteSpace: 'nowrap' }}>
                    <span style={{ color: t.textSecondary, fontSize: 12 }}>{s.company}</span>
                  </td>

                  {/* Sector */}
                  <td style={{ padding: '7px 8px', borderBottom: cellBorder, whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: SECTOR_PALETTE[s.sector]?.bg ?? 'rgba(160,174,192,0.12)',
                      color: ink(SECTOR_PALETTE[s.sector]?.fg ?? '#a0aec0'),
                    }}>{s.sector}</span>
                  </td>

                  {/* Price */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: cellBorder }}>
                    <span style={{ fontWeight: 600, color: t.textPrimary }}>
                      ${fmt(s.price)}
                    </span>
                  </td>

                  {/* Market Cap */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: cellBorder }}>
                    <span style={{ color: t.textSecondary }}>{s.marketCap}</span>
                  </td>

                  {/* P/S */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: cellBorder }}>
                    <span style={{
                      color: s.ps !== null && s.ps > 100 ? '#dd6b20' : t.textSecondary,
                      fontWeight: s.ps !== null && s.ps > 100 ? 700 : 400,
                    }}>
                      {s.ps !== null ? fmt(s.ps) : <span style={{ color: t.textMuted }}>n/a</span>}
                    </span>
                  </td>

                  {/* P/E */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: cellBorder }}>
                    <span style={{ color: t.textSecondary }}>
                      {s.pe !== null ? fmt(s.pe) : <span style={{ color: t.textMuted }}>n/a</span>}
                    </span>
                  </td>

                  {/* % YTD */}
                  <td style={{ padding: '7px 6px', borderBottom: cellBorder }}>
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

                  {/* % 1Y */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: cellBorder }}>
                    <span style={{
                      color: ink(pctColor(s.pct1Y)),
                      background: pctBg(s.pct1Y, isDark),
                      padding: '2px 6px', borderRadius: 4,
                      fontWeight: 600,
                    }}>
                      {fmtPct(s.pct1Y)}
                    </span>
                  </td>

                  {/* Sparkline 1W — shortest recent tail of the series */}
                  <td style={{ padding: '4px 6px', borderBottom: cellBorder }}>
                    <Sparkline data={spark1W} width={48} height={26} positive={isPos1W} />
                  </td>

                  {/* Sparkline 1M — recent tail of the series */}
                  <td style={{ padding: '4px 6px', borderBottom: cellBorder }}>
                    <Sparkline data={spark1M} width={56} height={26} positive={isPos1M} />
                  </td>

                  {/* Sparkline 1Y */}
                  <td style={{ padding: '4px 6px', borderBottom: cellBorder }}>
                    <Sparkline data={s.sparklineData} width={80} height={26} positive={isPos1Y} />
                  </td>

                  {/* Delta Highs */}
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderBottom: cellBorder }}>
                    <span style={{ color: s.deltaHighs >= -5 ? '#38a169' : s.deltaHighs >= -15 ? '#dd6b20' : '#e53e3e', fontWeight: 600 }}>
                      {fmt(s.deltaHighs)}%
                    </span>
                  </td>

                  {/* RS Rank */}
                  <td style={{ padding: '7px 8px', textAlign: 'center', borderBottom: cellBorder }}>
                    <span style={{
                      display: 'inline-block',
                      background: s.rsRank >= 90 ? 'rgba(72,187,120,0.2)' : s.rsRank >= 70 ? 'rgba(246,173,85,0.15)' : 'rgba(252,129,129,0.15)',
                      color: s.rsRank >= 90 ? '#2f855a' : s.rsRank >= 70 ? '#c05621' : '#c53030',
                      fontWeight: 700, fontSize: 11.5,
                      borderRadius: 4, padding: '2px 7px',
                    }}>
                      {s.rsRank}
                    </span>
                  </td>

                  {/* RSI(14) */}
                  <td style={{ padding: '7px 8px', textAlign: 'center', borderBottom: cellBorder }}>
                    {(() => {
                      const rsi = computeRSI14(s)
                      const overbought = rsi >= 70
                      const oversold = rsi <= 30
                      return (
                        <span style={{
                          display: 'inline-block',
                          background: overbought ? 'rgba(246,173,85,0.15)' : oversold ? 'rgba(99,179,237,0.15)' : 'transparent',
                          color: overbought ? '#c05621' : oversold ? '#2b6cb0' : t.textSecondary,
                          fontWeight: overbought || oversold ? 700 : 500,
                          fontSize: 11.5,
                          borderRadius: 4, padding: '2px 7px',
                        }}>
                          {rsi}
                        </span>
                      )
                    })()}
                  </td>

                  {/* Period returns */}
                  {(['ret1W', 'ret1M', 'ret3M', 'ret6M'] as const).map(k => (
                    <td key={k} style={{ padding: '7px 6px', textAlign: 'right', borderBottom: cellBorder }}>
                      <span style={{
                        fontSize: 11.5, fontWeight: 600,
                        color: s[k] >= 0 ? '#38a169' : '#e53e3e',
                      }}>
                        {s[k] >= 0 ? '+' : ''}{s[k].toFixed(1)}%
                      </span>
                    </td>
                  ))}

                  {/* SMA badges */}
                  {(['sma20', 'sma50', 'sma200'] as const).map(k => (
                    <td key={k} style={{ padding: '7px 6px', textAlign: 'center', borderBottom: cellBorder }}>
                      <SMABadge dir={s[k]} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: t.panelBg, borderTop: `2px solid ${t.borderControl}` }}>
              <td colSpan={6} style={{ padding: '10px 8px', color: t.textMuted, fontSize: 11 }}>
                Sum / Avg
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'right', color: t.textSecondary, fontWeight: 700, fontSize: 12 }}>
                {totalMktCap}
              </td>
              <td colSpan={2} />
              <td colSpan={15} />
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
          { label: 'Total Market Cap', value: totalMktCap, color: ink('#90cdf4') },
          { label: 'Stocks Listed', value: String(baseStocks.length), color: ink('#b794f4') },
          {
            label: 'YTD Winners',
            value: String(baseStocks.filter(s => s.pctYTD >= 0).length),
            color: '#38a169',
          },
          {
            label: 'YTD Losers',
            value: String(baseStocks.filter(s => s.pctYTD < 0).length),
            color: '#e53e3e',
          },
          {
            label: '% Above 200D MA',
            value: baseStocks.length
              ? `${((baseStocks.filter(s => s.sma200 === 'up').length / baseStocks.length) * 100).toFixed(0)}%`
              : '0%',
            color: '#38a169',
          },
          {
            label: '% Below 200D MA',
            value: baseStocks.length
              ? `${((baseStocks.filter(s => s.sma200 === 'down').length / baseStocks.length) * 100).toFixed(0)}%`
              : '0%',
            color: '#e53e3e',
          },
        ].map(c => (
          <div key={c.label} style={{
            background: t.panelBg, border: `1px solid ${t.borderOuter}`,
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ color: t.textMuted, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
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
