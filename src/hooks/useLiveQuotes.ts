import { useEffect, useMemo, useState } from 'react'
import type { Stock } from '../types/stock'
import { fmtMarketCap } from '../utils/marketCap'

// TradingView's scanner accepts a group of symbols in one request. Keeping
// requests to 75 symbols means the dashboard's whole universe refreshes in
// only a few calls instead of firing one request per table row.
const QUOTE_ENDPOINT = 'https://scanner.tradingview.com/america/scan'
const BATCH_SIZE = 75
const REFRESH_MS = 90_000

export interface LiveQuote {
  price?: number
  pct1D?: number
  marketCap?: number
  pe?: number
  high52?: number
  ret1W?: number
  ret1M?: number
  ret3M?: number
  ret6M?: number
  pct1Y?: number
  pctYTD?: number
  rsi14?: number
  sma20?: number
  sma50?: number
  sma200?: number
  updatedAt: number
}

export type LiveQuoteMap = Record<string, LiveQuote>

interface LiveQuotesState {
  quotes: LiveQuoteMap
  updatedAt?: number
  isRefreshing: boolean
  error?: string
}

const QUOTE_COLUMNS = [
  'name', 'close', 'change', 'market_cap_basic', 'price_earnings_ttm',
  'price_52_week_high', 'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M',
  'Perf.Y', 'Perf.YTD', 'RSI', 'SMA20', 'SMA50', 'SMA200',
] as const

const quoteCache: LiveQuoteMap = {}
const fetchedAtByTicker = new Map<string, number>()

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function currentQuotes(tickers: string[]): LiveQuoteMap {
  return Object.fromEntries(tickers.flatMap(ticker => quoteCache[ticker] ? [[ticker, quoteCache[ticker]]] : []))
}

function latestTimestamp(quotes: LiveQuoteMap): number | undefined {
  const timestamps = Object.values(quotes).map(quote => quote.updatedAt)
  return timestamps.length ? Math.max(...timestamps) : undefined
}

async function fetchBatch(tickers: string[]): Promise<LiveQuoteMap> {
  const response = await fetch(QUOTE_ENDPOINT, {
    method: 'POST',
    // Deliberately omit Content-Type: a JSON string is sent as text/plain,
    // avoiding a CORS preflight while the provider still accepts the payload.
    headers: { Accept: 'application/json' },
    body: JSON.stringify({
      filter: [{ left: 'name', operation: 'in_range', right: tickers }],
      options: { lang: 'en' },
      symbols: { query: { types: [] } },
      columns: QUOTE_COLUMNS,
      range: [0, tickers.length],
    }),
  })
  if (!response.ok) throw new Error(`quote service returned ${response.status}`)

  const payload: { data?: Array<{ d?: unknown[] }> } = await response.json()
  const updatedAt = Date.now()
  const quotes: LiveQuoteMap = {}

  for (const row of payload.data ?? []) {
    const values = row.d ?? []
    const ticker = typeof values[0] === 'string' ? values[0].toUpperCase() : undefined
    if (!ticker) continue
    quotes[ticker] = {
      price: asNumber(values[1]),
      pct1D: asNumber(values[2]),
      marketCap: asNumber(values[3]),
      pe: asNumber(values[4]),
      high52: asNumber(values[5]),
      ret1W: asNumber(values[6]),
      ret1M: asNumber(values[7]),
      ret3M: asNumber(values[8]),
      ret6M: asNumber(values[9]),
      pct1Y: asNumber(values[10]),
      pctYTD: asNumber(values[11]),
      rsi14: asNumber(values[12]),
      sma20: asNumber(values[13]),
      sma50: asNumber(values[14]),
      sma200: asNumber(values[15]),
      updatedAt,
    }
  }
  return quotes
}

async function refreshQuotes(tickers: string[]): Promise<LiveQuoteMap> {
  const now = Date.now()
  const due = tickers.filter(ticker => now - (fetchedAtByTicker.get(ticker) ?? 0) >= REFRESH_MS)
  if (!due.length) return currentQuotes(tickers)

  const batches: string[][] = []
  for (let index = 0; index < due.length; index += BATCH_SIZE) batches.push(due.slice(index, index + BATCH_SIZE))

  const results = await Promise.allSettled(batches.map(fetchBatch))
  let failures = 0
  for (const result of results) {
    if (result.status === 'rejected') {
      failures++
      continue
    }
    for (const [ticker, quote] of Object.entries(result.value)) {
      quoteCache[ticker] = quote
      fetchedAtByTicker.set(ticker, quote.updatedAt)
    }
  }
  if (failures === results.length) throw new Error('live quote refresh failed')
  return currentQuotes(tickers)
}

export function useLiveQuotes(tickers: string[]): LiveQuotesState {
  const tickerKey = [...new Set(tickers.map(ticker => ticker.toUpperCase()))].sort().join(',')
  const normalizedTickers = useMemo(() => tickerKey ? tickerKey.split(',') : [], [tickerKey])
  const [state, setState] = useState<LiveQuotesState>(() => {
    const quotes = currentQuotes(normalizedTickers)
    return { quotes, updatedAt: latestTimestamp(quotes), isRefreshing: normalizedTickers.length > 0 }
  })

  useEffect(() => {
    if (!normalizedTickers.length) return
    let cancelled = false
    const refresh = () => {
      void refreshQuotes(normalizedTickers)
        .then(quotes => {
          if (!cancelled) setState({ quotes, updatedAt: latestTimestamp(quotes), isRefreshing: false })
        })
        .catch(() => {
          if (!cancelled) {
            const quotes = currentQuotes(normalizedTickers)
            setState({ quotes, updatedAt: latestTimestamp(quotes), isRefreshing: false, error: 'Live quotes temporarily unavailable' })
          }
        })
    }
    refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [normalizedTickers])

  return state
}

export function mergeLiveQuotes(stocks: Stock[], quotes: LiveQuoteMap): Stock[] {
  const merged = stocks.map(stock => {
    const quote = quotes[stock.ticker]
    if (!quote) return stock
    const price = quote.price ?? stock.price
    return {
      ...stock,
      price,
      marketCap: quote.marketCap && quote.marketCap > 0 ? fmtMarketCap(quote.marketCap) : stock.marketCap,
      pe: quote.pe ?? stock.pe,
      pctYTD: quote.pctYTD ?? stock.pctYTD,
      pct1D: quote.pct1D ?? stock.pct1D,
      pct1Y: quote.pct1Y ?? stock.pct1Y,
      deltaHighs: quote.high52 && quote.high52 > 0 ? ((price - quote.high52) / quote.high52) * 100 : stock.deltaHighs,
      ret1W: quote.ret1W ?? stock.ret1W,
      ret1M: quote.ret1M ?? stock.ret1M,
      ret3M: quote.ret3M ?? stock.ret3M,
      ret6M: quote.ret6M ?? stock.ret6M,
      rsi14: quote.rsi14 ?? stock.rsi14,
      sma20: quote.sma20 === undefined ? stock.sma20 : price > quote.sma20 ? 'up' : 'down',
      sma50: quote.sma50 === undefined ? stock.sma50 : price > quote.sma50 ? 'up' : 'down',
      sma200: quote.sma200 === undefined ? stock.sma200 : price > quote.sma200 ? 'up' : 'down',
    }
  })

  // Relative strength is a comparison within the active list, so recompute it
  // after the 1Y quote data arrives instead of leaving it on the old snapshot.
  if (merged.length < 2) return merged
  const byPerformance = [...merged].sort((a, b) => b.pct1Y - a.pct1Y)
  const divisor = byPerformance.length - 1
  return merged.map(stock => ({
    ...stock,
    rsRank: Math.round(99 - (byPerformance.findIndex(row => row.ticker === stock.ticker) / divisor) * 65),
  }))
}
