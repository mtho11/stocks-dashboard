import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { ALL_STOCKS_BY_TICKER } from '../data/allStocks'
import { generateYearOhlc } from '../utils/ohlc'
import { sma, bollingerBands, rsi } from '../utils/indicators'
import { THEMES, THEME_KEY, getInitialTheme, type ThemeMode } from '../utils/theme'
import { navigateTo } from '../utils/nav'

const BASE_PATH = import.meta.env.BASE_URL

const BOLL_PERIOD = 10
const BOLL_STDDEV = 1.8
const RSI_PERIOD = 10

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${fmt(n)}%`
}

export function StockDetailPage({ ticker }: { ticker: string }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme)
  const isDark = mode === 'dark'
  const t = THEMES[mode]

  const stock = ALL_STOCKS_BY_TICKER[ticker.toUpperCase()]

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, mode)
    document.body.style.background = THEMES[mode].pageBg
    document.documentElement.style.colorScheme = mode
  }, [mode])

  useEffect(() => {
    document.title = stock ? `${stock.ticker} — ${stock.company}` : 'Stock not found'
  }, [stock])

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!stock || !chartContainerRef.current) return

    const bars = generateYearOhlc(stock.ticker, stock.price, stock.pct1Y, new Date())
    const closes = bars.map(b => b.close)
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
    candleSeries.setData(bars)

    function lineOn(values: (number | undefined)[], color: string, lineWidth: 1 | 2 | 3, dashed = false) {
      const series = chart.addSeries(LineSeries, {
        color, lineWidth,
        lineStyle: dashed ? 2 : 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }, 0)
      series.setData(
        bars
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
      bars
        .map((b, i) => ({ time: b.time, value: rsi10[i] }))
        .filter((d): d is { time: string; value: number } => d.value !== undefined)
    )
    rsiSeries.createPriceLine({ price: 70, color: '#e53e3e', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'overbought' })
    rsiSeries.createPriceLine({ price: 30, color: '#48bb78', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'oversold' })

    const panes = chart.panes()
    if (panes[1]) panes[1].setHeight(140)

    chart.timeScale().fitContent()

    return () => {
      chart.remove()
      chartRef.current = null
      void ma50Series; void ma200Series; void bollUpperSeries; void bollBasisSeries; void bollLowerSeries
    }
  }, [stock, isDark, t])

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
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '2px 8px',
              borderRadius: 4, background: 'rgba(160,174,192,0.15)', color: t.textSecondary,
            }}>
              {stock.sector}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: t.textPrimary }}>${fmt(stock.price)}</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, marginTop: 2 }}>
                <span style={{ color: stock.pctYTD >= 0 ? '#38a169' : '#e53e3e', fontWeight: 700 }}>
                  YTD {fmtPct(stock.pctYTD)}
                </span>
                <span style={{ color: stock.pct1Y >= 0 ? '#38a169' : '#e53e3e', fontWeight: 700 }}>
                  1Y {fmtPct(stock.pct1Y)}
                </span>
              </div>
            </div>
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

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 10, fontSize: 11.5, color: t.textSecondary }}>
          <LegendItem color="#4299e1" label="50-Day MA" />
          <LegendItem color="#ed8936" label="200-Day MA" />
          <LegendItem color="#a78bfa" label={`Bollinger (${BOLL_PERIOD}d, ${BOLL_STDDEV}σ)`} />
          <LegendItem color="#f6ad55" label={`RSI(${RSI_PERIOD})`} />
        </div>

        {/* Chart */}
        <div style={{
          background: t.panelBg, border: `1px solid ${t.borderOuter}`, borderRadius: 12,
          padding: 8, height: 560,
        }}>
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        <p style={{ color: t.textMuted, fontSize: 11, marginTop: 10, textAlign: 'center' }}>
          Chart data is synthetic — calibrated to this app's mock price and 1Y return, not real market history.
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
