// Fetches real market data (Yahoo Finance chart API) for the AI Cake list
// and regenerates src/data/stocks.ts + src/data/ohlcHistory.ts.
//
// Run with: node scripts/fetch-real-data.mjs
//
// This is a build-time snapshot tool, not something the deployed app calls —
// the site is static (GitHub Pages, no backend), so real data has to be
// baked in. Re-run this to refresh the snapshot.

import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Sector labels aren't available from the price API, so they live in their
// own file (aiCakeSectors.ts) rather than in stocks.ts — this script
// overwrites stocks.ts, so reading sectors from there would destroy them.
function existingSectors() {
  const src = readFileSync(join(ROOT, 'src/data/aiCakeSectors.ts'), 'utf8')
  const map = {}
  for (const m of src.matchAll(/"([A-Z.]+)":\s*"([^"]+)"/g)) map[m[1]] = m[2]
  return map
}

const SECTORS = existingSectors()
const TICKERS = Object.keys(SECTORS)

// The v7 batch-quote endpoint (the only one carrying market cap and P/E)
// requires Yahoo's cookie + crumb handshake; the chart endpoint doesn't.
async function getCrumb() {
  const res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } })
  const cookie = (res.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, cookie },
  })
  return { crumb: (await crumbRes.text()).trim(), cookie }
}

const UA = 'Mozilla/5.0'

async function fetchQuotes(tickers, { crumb, cookie }) {
  const out = {}
  for (let i = 0; i < tickers.length; i += 20) {
    const batch = tickers.slice(i, i + 20)
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${batch.join(',')}&crumb=${encodeURIComponent(crumb)}`
    const res = await fetch(url, { headers: { 'User-Agent': UA, cookie } })
    if (!res.ok) { process.stderr.write(`quote batch failed: HTTP ${res.status}\n`); continue }
    const json = await res.json()
    for (const q of json.quoteResponse?.result ?? []) out[q.symbol] = q
  }
  return out
}

async function fetchTicker(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5y&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`)
  const json = await res.json()
  const r = json.chart?.result?.[0]
  if (!r) throw new Error(`${ticker}: no result`)

  const q = r.indicators.quote[0]
  const bars = []
  for (let i = 0; i < r.timestamp.length; i++) {
    if (q.close[i] == null || q.open[i] == null) continue
    bars.push({
      time: new Date(r.timestamp[i] * 1000).toISOString().slice(0, 10),
      open: round2(q.open[i]),
      high: round2(q.high[i]),
      low: round2(q.low[i]),
      close: round2(q.close[i]),
    })
  }
  return { meta: r.meta, bars }
}

const round2 = n => Math.round(n * 100) / 100
const round1 = n => Math.round(n * 10) / 10

// Percent change over the last `n` trading days of the close series.
function pctOver(closes, n) {
  const i = closes.length - 1 - n
  if (i < 0 || !closes[i]) return null
  return ((closes.at(-1) - closes[i]) / closes[i]) * 100
}

function pctYTD(bars) {
  const year = bars.at(-1).time.slice(0, 4)
  const first = bars.find(b => b.time.slice(0, 4) === year)
  if (!first) return null
  return ((bars.at(-1).close - first.close) / first.close) * 100
}

function sma(values, period) {
  if (values.length < period) return null
  let sum = 0
  for (let i = values.length - period; i < values.length; i++) sum += values[i]
  return sum / period
}

function fmtMarketCap(n) {
  if (!n) return 'n/a'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  return `$${(n / 1e6).toFixed(0)}M`
}

const results = []
const failed = []

for (const ticker of TICKERS) {
  try {
    const { meta, bars } = await fetchTicker(ticker)
    if (bars.length < 60) throw new Error(`only ${bars.length} bars`)
    results.push({ ticker, meta, bars })
    process.stderr.write(`. ${ticker}\n`)
  } catch (err) {
    failed.push(`${ticker}: ${err.message}`)
    process.stderr.write(`X ${ticker} — ${err.message}\n`)
  }
}

if (failed.length) {
  console.error(`\n${failed.length} ticker(s) failed:\n  ${failed.join('\n  ')}`)
}

const quotes = await fetchQuotes(results.map(r => r.ticker), await getCrumb())
process.stderr.write(`\nfetched ${Object.keys(quotes).length} quotes (market cap / P/E)\n`)

// ── Build stocks.ts ────────────────────────────────────────────────────
const rows = results.map(({ ticker, meta, bars }) => {
  const closes = bars.map(b => b.close)
  const quote = quotes[ticker] ?? {}
  const price = quote.regularMarketPrice ?? meta.regularMarketPrice ?? closes.at(-1)
  const high52 = meta.fiftyTwoWeekHigh ?? Math.max(...closes.slice(-252))

  const ma20 = sma(closes, 20)
  const ma50 = sma(closes, 50)
  const ma200 = sma(closes, 200)

  return {
    ticker,
    company: (meta.longName ?? meta.shortName ?? ticker).replace(/[,.]?\s+(Inc|Corp|Corporation|Company|Ltd|plc|N\.V|S\.A)\.?$/i, ''),
    sector: SECTORS[ticker] ?? 'Other',
    price: round2(price),
    marketCap: fmtMarketCap(quote.marketCap),
    pe: quote.trailingPE != null ? round2(quote.trailingPE) : null,
    pctYTD: round2(pctYTD(bars) ?? 0),
    pct1Y: round2(pctOver(closes, 252) ?? 0),
    deltaHighs: round2(((price - high52) / high52) * 100),
    ret1W: round1(pctOver(closes, 5) ?? 0),
    ret1M: round1(pctOver(closes, 21) ?? 0),
    ret3M: round1(pctOver(closes, 63) ?? 0),
    ret6M: round1(pctOver(closes, 126) ?? 0),
    sma20: ma20 && price > ma20 ? 'up' : 'down',
    sma50: ma50 && price > ma50 ? 'up' : 'down',
    sma200: ma200 && price > ma200 ? 'up' : 'down',
    spark: closes.slice(-30).map(round2),
  }
})

// RS Rank: percentile by 1Y performance within this cohort.
const byPerf = [...rows].sort((a, b) => b.pct1Y - a.pct1Y)
const n = byPerf.length - 1
for (const row of rows) {
  row.rsRank = Math.round(99 - (byPerf.findIndex(x => x.ticker === row.ticker) / n) * 65)
}

const snapshotDate = results[0]?.bars.at(-1).time ?? new Date().toISOString().slice(0, 10)

const stocksTs = `import type { Stock } from '../types/stock'

// REAL MARKET DATA — snapshot fetched ${snapshotDate} from Yahoo Finance.
// Generated by scripts/fetch-real-data.mjs; re-run that to refresh.
// Prices, market caps, P/E, returns, moving averages and sparklines are real.
// P/S isn't exposed by this API, so it's left null.
export const SNAPSHOT_DATE = '${snapshotDate}'

export const stocks: Stock[] = [
${rows.map(r => `  { ticker: ${JSON.stringify(r.ticker)}, company: ${JSON.stringify(r.company)}, sector: ${JSON.stringify(r.sector)}, price: ${r.price}, marketCap: ${JSON.stringify(r.marketCap)}, ps: null, pe: ${r.pe}, pctYTD: ${r.pctYTD}, pct1Y: ${r.pct1Y}, deltaHighs: ${r.deltaHighs}, rsRank: ${r.rsRank}, ret1W: ${r.ret1W}, ret1M: ${r.ret1M}, ret3M: ${r.ret3M}, ret6M: ${r.ret6M}, sma20: '${r.sma20}', sma50: '${r.sma50}', sma200: '${r.sma200}', sparklineData: [${r.spark.join(',')}] },`).join('\n')}
]
`
writeFileSync(join(ROOT, 'src/data/stocks.ts'), stocksTs)

// ── Build ohlcHistory.ts (real candles for the detail page) ────────────
// One shared date axis (the union of every ticker's trading days) so date
// strings aren't duplicated 50x — each ticker just records the index it
// starts at, since newer listings simply begin later on the same axis.
const allDates = [...new Set(results.flatMap(r => r.bars.map(b => b.time)))].sort()
const dateIndex = new Map(allDates.map((d, i) => [d, i]))

const packed = results.map(({ ticker, bars }) => {
  const start = dateIndex.get(bars[0].time)
  // Only emit tickers whose bars sit contiguously on the shared axis;
  // otherwise fall back to storing this ticker's own dates.
  const contiguous = bars.every((b, i) => dateIndex.get(b.time) === start + i)
  return { ticker, bars, start, contiguous }
})

const ohlcTs = `import type { OhlcBar } from '../utils/ohlc'

// REAL daily OHLC — snapshot fetched ${snapshotDate} from Yahoo Finance.
// Generated by scripts/fetch-real-data.mjs.
//
// Bars are [open, high, low, close] packed positionally, and all tickers
// share one DATES axis (each records the index it starts at) — storing a
// date string per bar per ticker roughly doubled this file.
export type PackedBar = [number, number, number, number]

const DATES: string[] = [${allDates.map(d => JSON.stringify(d)).join(',')}]

const OHLC_BY_TICKER: Record<string, { start: number; bars: PackedBar[]; dates?: string[] }> = {
${packed.map(({ ticker, bars, start, contiguous }) =>
  `  ${JSON.stringify(ticker)}: { start: ${contiguous ? start : 0}, bars: [${bars.map(b => `[${b.open},${b.high},${b.low},${b.close}]`).join(',')}]${contiguous ? '' : `, dates: [${bars.map(b => JSON.stringify(b.time)).join(',')}]`} },`
).join('\n')}
}

export function getRealBars(ticker: string): OhlcBar[] | undefined {
  const entry = OHLC_BY_TICKER[ticker]
  if (!entry) return undefined
  return entry.bars.map((b, i) => ({
    time: entry.dates ? entry.dates[i] : DATES[entry.start + i],
    open: b[0], high: b[1], low: b[2], close: b[3],
  }))
}
`
writeFileSync(join(ROOT, 'src/data/ohlcHistory.ts'), ohlcTs)

console.error(`\nWrote ${rows.length} stocks (snapshot ${snapshotDate}).`)
