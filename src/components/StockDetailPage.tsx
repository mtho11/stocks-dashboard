import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { ALL_STOCKS_BY_TICKER } from '../data/allStocks'
import { generateOhlcHistory, generateEarningsDates, estimateNextEarningsDate, type OhlcBar } from '../utils/ohlc'
import { sma, bollingerBands, rsi } from '../utils/indicators'
import { THEMES, THEME_KEY, getInitialTheme, type ThemeMode } from '../utils/theme'
import { navigateTo } from '../utils/nav'
import { downloadIcsEvent } from '../utils/ics'
import { mergeLiveQuotes, useLiveQuotes } from '../hooks/useLiveQuotes'

const BASE_PATH = import.meta.env.BASE_URL

const BOLL_PERIOD = 10
const BOLL_STDDEV = 1.8
const RSI_PERIOD = 10

const TRADING_DAYS_PER_YEAR = 252
const RANGE_OPTIONS = [
  { label: '1M', days: 21 },
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
  { label: '1Y', days: TRADING_DAYS_PER_YEAR },
  { label: '2Y', days: TRADING_DAYS_PER_YEAR * 2 },
  { label: '3Y', days: TRADING_DAYS_PER_YEAR * 3 },
  { label: '5Y', days: TRADING_DAYS_PER_YEAR * 5 },
] as const
type RangeLabel = (typeof RANGE_OPTIONS)[number]['label']
const DEFAULT_RANGE: RangeLabel = '1Y'

function isRangeLabel(v: string | null): v is RangeLabel {
  return !!v && (RANGE_OPTIONS as readonly { label: string }[]).some(o => o.label === v)
}

// The chart's date range lives in `?range=` so a view like
// /stock/AAPL?range=5Y is bookmarkable/shareable on its own.
function parseRangeFromUrl(): RangeLabel {
  if (typeof window === 'undefined') return DEFAULT_RANGE
  const param = new URLSearchParams(window.location.search).get('range')
  return isRangeLabel(param) ? param : DEFAULT_RANGE
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${fmt(n)}%`
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

export function StockDetailPage({ ticker }: { ticker: string }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme)
  const isDark = mode === 'dark'
  const t = THEMES[mode]

  const snapshotStock = ALL_STOCKS_BY_TICKER[ticker.toUpperCase()]
  const { quotes: liveQuotes, updatedAt: quoteUpdatedAt, isRefreshing: quotesRefreshing, refresh: refreshLiveQuotes } = useLiveQuotes(snapshotStock ? [snapshotStock.ticker] : [])
  const stock = useMemo(
    () => snapshotStock ? mergeLiveQuotes([snapshotStock], liveQuotes)[0] : undefined,
    [snapshotStock, liveQuotes]
  )

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, mode)
    document.body.style.background = THEMES[mode].pageBg
    document.documentElement.style.colorScheme = mode
  }, [mode])

  useEffect(() => {
    document.title = stock ? `${stock.ticker} — ${stock.company}` : 'Stock not found'
  }, [stock])

  // Real daily OHLC lives in a generated module, so it is loaded on demand
  // rather than bundled into the initial payload. A few unavailable symbols
  // fall back to the seeded synthetic generator.
  const [barsState, setBarsState] = useState<{ ticker: string; bars: OhlcBar[]; real: boolean } | undefined>()

  useEffect(() => {
    if (!stock) return
    let cancelled = false
    const synthetic = () => generateOhlcHistory(stock.ticker, stock.price, stock.pct1Y, new Date())
    import('../data/ohlcHistory')
      .then(m => m.getRealBars(stock.ticker))
      .then(real => {
        if (cancelled) return
        setBarsState({ ticker: stock.ticker, bars: real ?? synthetic(), real: !!real })
      })
      .catch(() => {
        if (!cancelled) setBarsState({ ticker: stock.ticker, bars: synthetic(), real: false })
      })
    return () => { cancelled = true }
  }, [stock])

  const EMPTY_BARS: OhlcBar[] = useMemo(() => [], [])
  const bars = stock && barsState?.ticker === stock.ticker ? barsState.bars : EMPTY_BARS
  const isRealData = stock && barsState?.ticker === stock.ticker ? barsState.real : false
  const chartBars = useMemo(() => {
    if (!stock || !quoteUpdatedAt || bars.length === 0) return bars
    const quote = liveQuotes[stock.ticker]
    if (quote?.open === undefined || quote.high === undefined || quote.low === undefined || quote.price === undefined) return bars

    const currentTime = new Date(quoteUpdatedAt).toISOString().slice(0, 10)
    const currentBar: OhlcBar = {
      time: currentTime,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.price,
    }
    const last = bars[bars.length - 1]
    return last.time === currentTime ? [...bars.slice(0, -1), currentBar] : [...bars, currentBar]
  }, [bars, liveQuotes, quoteUpdatedAt, stock])
  const earningsDates = useMemo(
    () => stock ? generateEarningsDates(stock.ticker, chartBars) : [],
    [stock, chartBars]
  )
  const nextEarningsDate = useMemo(
    () => stock ? estimateNextEarningsDate(stock.ticker, earningsDates) : undefined,
    [stock, earningsDates]
  )
  // Day/week/month/2Y are derived from the bar series (not in the Stock
  // type); YTD/1Y reuse the stock's own fields so they match the number
  // already shown elsewhere on this page and in the dashboard table.
  const priceChanges = useMemo(() => {
    if (!stock || chartBars.length === 0) return undefined
    const closes = chartBars.map(b => b.close)
    const last = closes[closes.length - 1]
    const changeOverTradingDays = (n: number): number | undefined => {
      const i = closes.length - 1 - n
      if (i < 0 || closes[i] <= 0) return undefined
      return ((last - closes[i]) / closes[i]) * 100
    }
    return {
      d: changeOverTradingDays(1),
      w: changeOverTradingDays(5),
      m: changeOverTradingDays(21),
      ytd: stock.pctYTD,
      y: stock.pct1Y,
      y2: changeOverTradingDays(TRADING_DAYS_PER_YEAR * 2),
    }
  }, [stock, chartBars])

  const [range, setRange] = useState<RangeLabel>(parseRangeFromUrl)
  // Mirrors `range` for the chart-mount effect below (which only wants the
  // latest value when it rebuilds the chart, not a reason to re-run itself
  // on every button click — that would recreate every series each time).
  const rangeRef = useRef(range)
  useEffect(() => { rangeRef.current = range }, [range])

  // Keeps ?range= in the URL in sync (replaceState, like the dashboard's
  // list+date sync) so the current view is bookmarkable/shareable.
  useEffect(() => {
    if (!stock) return
    const url = new URL(window.location.href)
    url.searchParams.set('range', range)
    window.history.replaceState(null, '', url.pathname + url.search)
  }, [stock, range])

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const barCountRef = useRef(0)

  function applyRange(label: RangeLabel) {
    setRange(label)
    const chart = chartRef.current
    const total = barCountRef.current
    if (!chart || !total) return
    const opt = RANGE_OPTIONS.find(o => o.label === label)!
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, total - opt.days),
      to: total - 1 + 2,
    })
  }

  useEffect(() => {
    if (!stock || !chartContainerRef.current || chartBars.length === 0) return

    barCountRef.current = chartBars.length
    const closes = chartBars.map(b => b.close)
    const ma50 = sma(closes, 50)
    const ma200 = sma(closes, 200)
    const boll = bollingerBands(closes, BOLL_PERIOD, BOLL_STDDEV)
    const rsi10 = rsi(closes, RSI_PERIOD)

    const gridColor = isDark ? 'rgba(45,55,72,0.4)' : 'rgba(213,217,224,0.6)'

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: t.textSecondary,
        panes: { separatorColor: t.borderControl },
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: { borderColor: t.borderControl },
      timeScale: { borderColor: t.borderControl },
      crosshair: { mode: 0 },
    })
    chartRef.current = chart

    // ── Pane 0: candlesticks + moving averages + Bollinger Bands ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#48bb78', downColor: '#e53e3e',
      borderUpColor: '#48bb78', borderDownColor: '#e53e3e',
      wickUpColor: '#48bb78', wickDownColor: '#e53e3e',
    }, 0)
    candleSeries.setData(chartBars)

    createSeriesMarkers(candleSeries, earningsDates.map(time => ({
      time,
      position: 'aboveBar',
      shape: 'arrowDown',
      color: '#ecc94b',
      text: 'E',
    })))

    function lineOn(values: (number | undefined)[], color: string, lineWidth: 1 | 2 | 3, dashed = false) {
      const series = chart.addSeries(LineSeries, {
        color, lineWidth,
        lineStyle: dashed ? 2 : 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }, 0)
      series.setData(
        chartBars
          .map((b, i) => ({ time: b.time, value: values[i] }))
          .filter((d): d is { time: string; value: number } => d.value !== undefined)
      )
      return series
    }

    const ma50Series = lineOn(ma50, '#4299e1', 2)
    const ma200Series = lineOn(ma200, '#ed8936', 2)
    const bollUpperSeries = lineOn(boll.upper, '#a78bfa', 1, true)
    const bollBasisSeries = lineOn(boll.basis, '#a78bfa', 1)
    const bollLowerSeries = lineOn(boll.lower, '#a78bfa', 1, true)

    // ── Pane 1: RSI(10) ──
    const rsiSeries: ISeriesApi<'Line'> = chart.addSeries(LineSeries, {
      color: '#f6ad55', lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    }, 1)
    rsiSeries.setData(
        chartBars
        .map((b, i) => ({ time: b.time, value: rsi10[i] }))
        .filter((d): d is { time: string; value: number } => d.value !== undefined)
    )
    rsiSeries.createPriceLine({ price: 70, color: '#e53e3e', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'overbought' })
    rsiSeries.createPriceLine({ price: 30, color: '#48bb78', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'oversold' })

    const panes = chart.panes()
    if (panes[1]) panes[1].setHeight(140)

    // View on (re)mount/rebuild — whatever range is currently selected
    // (from the URL on first mount, or preserved across a theme-triggered
    // rebuild). Range-button clicks afterward adjust the same chart
    // instance directly via applyRange() rather than re-running this effect.
    const currentOpt = RANGE_OPTIONS.find(o => o.label === rangeRef.current) ?? RANGE_OPTIONS[3]
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, chartBars.length - currentOpt.days),
      to: chartBars.length - 1 + 2,
    })

    return () => {
      chart.remove()
      chartRef.current = null
      void ma50Series; void ma200Series; void bollUpperSeries; void bollBasisSeries; void bollLowerSeries
    }
  }, [stock, isDark, t, chartBars, earningsDates])

  if (!stock) {
    return (
      <div style={{ minHeight: '100vh', background: t.pageBg, padding: 24, textAlign: 'center' }}>
        <p style={{ color: t.textPrimary, fontSize: 16, marginBottom: 16 }}>
          "{ticker}" isn't in any known stock list.
        </p>
        <button
          onClick={() => navigateTo(BASE_PATH)}
          style={{
            padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.borderControl}`,
            background: t.inputBg, color: t.textSecondary, cursor: 'pointer', fontSize: 13,
          }}
        >
          ← Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, padding: '24px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <button
              onClick={() => (window.history.length > 1 ? window.history.back() : navigateTo(BASE_PATH))}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
                padding: '6px 12px', borderRadius: 8, border: `1px solid ${t.borderControl}`,
                background: t.inputBg, color: t.textSecondary, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: t.textPrimary, marginBottom: 2 }}>
              {stock.ticker} <span style={{ fontWeight: 500, fontSize: 16, color: t.textMuted }}>{stock.company}</span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '2px 8px',
                borderRadius: 4, background: 'rgba(160,174,192,0.15)', color: t.textSecondary,
              }}>
                {stock.sector}
              </span>
              {nextEarningsDate && (
                <span style={{ fontSize: 12, color: t.textSecondary }}>
                  Next earnings (est.): <strong style={{ color: t.textPrimary }}>{formatDisplayDate(nextEarningsDate)}</strong>
                </span>
              )}
              {nextEarningsDate && (
                <button
                  onClick={() => downloadIcsEvent(
                    `${stock.ticker}-earnings-${nextEarningsDate}.ics`,
                    `${stock.ticker} earnings release (est.)`,
                    nextEarningsDate,
                    `Estimated earnings release date for ${stock.company} (${stock.ticker}).`
                  )}
                  style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${t.borderControl}`, background: t.inputBg,
                    color: t.textSecondary, cursor: 'pointer',
                  }}
                >
                  + Add to calendar
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: t.textPrimary }}>${fmt(stock.price)}</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                P/E {stock.pe !== null ? fmt(stock.pe) : 'n/a'}
              </div>
            </div>
            <button
              onClick={refreshLiveQuotes}
              disabled={quotesRefreshing}
              aria-label="Refresh live quote"
              style={{
                padding: '6px 10px', borderRadius: 8, border: `1px solid ${t.borderControl}`,
                background: t.inputBg, color: t.textSecondary,
                cursor: quotesRefreshing ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
                opacity: quotesRefreshing ? 0.65 : 1,
              }}
            >
              ↻ {quotesRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle light/dark theme"
              style={{
                width: 36, height: 36, borderRadius: 10,
                border: `1px solid ${t.borderControl}`, background: t.inputBg, color: t.textSecondary,
                cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Performance */}
        {priceChanges && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10,
            marginBottom: 20,
          }}>
            {([
              ['1D', priceChanges.d],
              ['1W', priceChanges.w],
              ['1M', priceChanges.m],
              ['YTD', priceChanges.ytd],
              ['1Y', priceChanges.y],
              ['2Y', priceChanges.y2],
            ] as const).map(([label, value]) => (
              <div key={label} style={{
                background: t.panelBg, border: `1px solid ${t.borderOuter}`, borderRadius: 10,
                padding: '10px 12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 800,
                  color: value === undefined ? t.textMuted : value >= 0 ? '#38a169' : '#e53e3e',
                }}>
                  {value === undefined ? 'n/a' : fmtPct(value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Range buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => applyRange(opt.label)}
              style={{
                padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', border: 'none',
                background: range === opt.label ? t.borderControl : t.inputBg,
                color: range === opt.label ? t.textPrimary : t.textSecondary,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 10, fontSize: 11.5, color: t.textSecondary }}>
          <LegendItem color="#4299e1" label="50-Day MA" />
          <LegendItem color="#ed8936" label="200-Day MA" />
          <LegendItem color="#a78bfa" label={`Bollinger (${BOLL_PERIOD}d, ${BOLL_STDDEV}σ)`} />
          <LegendItem color="#f6ad55" label={`RSI(${RSI_PERIOD})`} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#ecc94b', fontSize: 13, lineHeight: 1 }}>▼</span>
            Earnings release
          </span>
        </div>

        {/* Chart */}
        <div style={{
          background: t.panelBg, border: `1px solid ${t.borderOuter}`, borderRadius: 12,
          padding: 8, height: 560,
        }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        <p style={{ color: t.textMuted, fontSize: 11, marginTop: 10, textAlign: 'center' }}>
          {isRealData
            ? `Live quote${quoteUpdatedAt ? ' displayed above' : ' loading'}; daily chart history is a build-time market-data snapshot.`
            : "Live quote loading; chart history is synthetic for this ticker because real history is unavailable."}
        </p>
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 12, height: 2, background: color, borderRadius: 1, display: 'inline-block' }} />
      {label}
    </span>
  )
}
