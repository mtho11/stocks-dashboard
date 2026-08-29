// Fetches real market data (Yahoo Finance chart API) for every built-in
// stock list and regenerates src/data/*.ts + src/data/ohlcHistory.ts.
//
// Run with: node scripts/fetch-real-data.mjs
//
// This is a build-time snapshot tool, not something the deployed app calls —
// the site is static (GitHub Pages, no backend), so real data has to be
// baked in. Re-run this to refresh the snapshot.
//
// Tickers that fail to fetch (e.g. SPCX/SpaceX, which isn't publicly
// traded) fall back to their previous hand-authored mock row rather than
// being dropped, except in stocks.ts/AI Cake where there's no mock row to
// fall back to (those simply keep whatever they already had).

import { writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as esbuild from 'esbuild'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UA = 'Mozilla/5.0'

// ── Load the current (mock or previously-real) content of every list ──────
// so we have tickers to fetch and a fallback row per ticker if a fetch fails.
const LIST_FILES = ['nasdaq100', 'dji', 'finance', 'oil', 'healthcare', 'biotech', 'retail', 'ia12']

async function loadOriginalRows(name) {
  const entry = join(ROOT, `src/data/${name}.ts`)
  const result = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node',
  })
  const tmp = join(ROOT, `scripts/.tmp-${name}.mjs`)
  writeFileSync(tmp, result.outputFiles[0].text)
  try {
    const mod = await import(`${tmp}?t=${Date.now()}`)
    return mod[name]
  } finally {
    rmSync(tmp)
  }
}

function existingSectors() {
  const src = readFileSync(join(ROOT, 'src/data/aiCakeSectors.ts'), 'utf8')
  const map = {}
  for (const m of src.matchAll(/"([A-Z.]+)":\s*"([^"]+)"/g)) map[m[1]] = m[2]
  return map
}

const AI_CAKE_SECTORS = existingSectors()
const AI_CAKE_TICKERS = Object.keys(AI_CAKE_SECTORS)

const originalRowsByList = {}
for (const name of LIST_FILES) {
  originalRowsByList[name] = await loadOriginalRows(name)
}

// ── Union of every ticker we need real data for ───────────────────────────
const ALL_TICKERS = [...new Set([
  ...AI_CAKE_TICKERS,
  ...LIST_FILES.flatMap(name => originalRowsByList[name].map(r => r.ticker)),
])].sort()

process.stderr.write(`Fetching ${ALL_TICKERS.length} unique tickers...\n`)

// ── Yahoo Finance fetch helpers ────────────────────────────────────────────
async function getCrumb() {
  const res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } })
  const cookie = (res.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, cookie },
  })
  return { crumb: (await crumbRes.text()).trim(), cookie }
}

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
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
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
      open: round2(q.open[i]), high: round2(q.high[i]), low: round2(q.low[i]), close: round2(q.close[i]),
    })
  }
  return { meta: r.meta, bars }
}

const round2 = n => Math.round(n * 100) / 100
const round1 = n => Math.round(n * 10) / 10

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

// ── Fetch everything, with modest concurrency ──────────────────────────────
const chartResults = new Map()
const CONCURRENCY = 10
let cursor = 0
async function worker() {
  while (cursor < ALL_TICKERS.length) {
    const ticker = ALL_TICKERS[cursor++]
    try {
      const { meta, bars } = await fetchTicker(ticker)
      if (bars.length < 60) throw new Error(`only ${bars.length} bars`)
      chartResults.set(ticker, { meta, bars })
      process.stderr.write(`. ${ticker}\n`)
    } catch (err) {
      process.stderr.write(`X ${ticker} — ${err.message}\n`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const quotes = await fetchQuotes([...chartResults.keys()], await getCrumb())
process.stderr.write(`\nfetched ${chartResults.size}/${ALL_TICKERS.length} charts, ${Object.keys(quotes).length} quotes\n`)

const snapshotDate = [...chartResults.values()][0]?.bars.at(-1).time ?? new Date().toISOString().slice(0, 10)

// ── Build a real Stock row from fetched data ───────────────────────────────
function buildRealRow(ticker, sector) {
  const chart = chartResults.get(ticker)
  if (!chart) return null
  const { meta, bars } = chart
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
    sector,
    price: round2(price),
    marketCap: fmtMarketCap(quote.marketCap),
    ps: null,
    pe: quote.trailingPE != null ? round2(quote.trailingPE) : null,
    pctYTD: round2(pctYTD(bars) ?? 0),
    pct1D: round2(pctOver(closes, 1) ?? 0),
    pct1Y: round2(pctOver(closes, 252) ?? 0),
    deltaHighs: round2(((price - high52) / high52) * 100),
    ret1W: round1(pctOver(closes, 5) ?? 0),
    ret1M: round1(pctOver(closes, 21) ?? 0),
    ret3M: round1(pctOver(closes, 63) ?? 0),
    ret6M: round1(pctOver(closes, 126) ?? 0),
    sma20: ma20 && price > ma20 ? 'up' : 'down',
    sma50: ma50 && price > ma50 ? 'up' : 'down',
    sma200: ma200 && price > ma200 ? 'up' : 'down',
    sparklineData: closes.slice(-30).map(round2),
  }
}

function withRsRank(rows) {
  const byPerf = [...rows].sort((a, b) => b.pct1Y - a.pct1Y)
  const n = byPerf.length - 1
  return rows.map(row => ({
    ...row,
    rsRank: n <= 0 ? 99 : Math.round(99 - (byPerf.findIndex(x => x.ticker === row.ticker) / n) * 65),
  }))
}

// Fallback (mock) rows predate the % 1D column, so approximate a daily
// figure from the weekly one rather than leaving it at zero.
function withPct1D(row) {
  return row.pct1D !== undefined ? row : { ...row, pct1D: round1(row.ret1W / 5) }
}

function stockRowLiteral(r) {
  return `  { ticker: ${JSON.stringify(r.ticker)}, company: ${JSON.stringify(r.company)}, sector: ${JSON.stringify(r.sector)}, price: ${r.price}, marketCap: ${JSON.stringify(r.marketCap)}, ps: ${r.ps === null ? 'null' : r.ps}, pe: ${r.pe === null ? 'null' : r.pe}, pctYTD: ${r.pctYTD}, pct1D: ${r.pct1D}, pct1Y: ${r.pct1Y}, deltaHighs: ${r.deltaHighs}, rsRank: ${r.rsRank}, ret1W: ${r.ret1W}, ret1M: ${r.ret1M}, ret3M: ${r.ret3M}, ret6M: ${r.ret6M}, sma20: '${r.sma20}', sma50: '${r.sma50}', sma200: '${r.sma200}', sparklineData: [${r.sparklineData.join(',')}] },`
}

// ── stocks.ts (AI Cake) ─────────────────────────────────────────────────
const aiCakeRows = withRsRank(
  AI_CAKE_TICKERS.map(t => buildRealRow(t, AI_CAKE_SECTORS[t] ?? 'Other')).filter(Boolean)
)
const failedAiCake = AI_CAKE_TICKERS.filter(t => !chartResults.has(t))
if (failedAiCake.length) console.error(`AI Cake: dropped (no real data): ${failedAiCake.join(', ')}`)

writeFileSync(join(ROOT, 'src/data/stocks.ts'), `import type { Stock } from '../types/stock'

// REAL MARKET DATA — snapshot fetched ${snapshotDate} from Yahoo Finance.
// Generated by scripts/fetch-real-data.mjs; re-run that to refresh.
// Prices, market caps, P/E, returns, moving averages and sparklines are real.
// P/S isn't exposed by this API, so it's left null.
export const SNAPSHOT_DATE = '${snapshotDate}'

export const stocks: Stock[] = [
${aiCakeRows.map(stockRowLiteral).join('\n')}
]
`)

// ── The 8 remaining lists ───────────────────────────────────────────────
const LIST_META = {
  nasdaq100: { export: 'nasdaq100', label: 'Nasdaq 100' },
  dji: { export: 'dji', label: 'Dow 30' },
  finance: { export: 'finance', label: 'Finance' },
  oil: { export: 'oil', label: 'Oil & Energy' },
  healthcare: { export: 'healthcare', label: 'Healthcare' },
  biotech: { export: 'biotech', label: 'Biotech' },
  retail: { export: 'retail', label: 'Retail' },
  ia12: { export: 'ia12', label: 'IA12' },
}

for (const name of LIST_FILES) {
  const original = originalRowsByList[name]
  const fallbackTickers = []
  const rows = withRsRank(original.map(orig => {
    const real = buildRealRow(orig.ticker, orig.sector)
    if (real) return real
    fallbackTickers.push(orig.ticker)
    return withPct1D(orig)
  }))

  const fallbackNote = fallbackTickers.length
    ? `\n// Fell back to a mock estimate for: ${fallbackTickers.join(', ')} (real data unavailable — e.g. not publicly traded).`
    : ''

  writeFileSync(join(ROOT, `src/data/${name}.ts`), `import type { Stock } from '../types/stock'

// REAL MARKET DATA — snapshot fetched ${snapshotDate} from Yahoo Finance.
// Generated by scripts/fetch-real-data.mjs; re-run that to refresh.${fallbackNote}
export const ${LIST_META[name].export}: Stock[] = [
${rows.map(stockRowLiteral).join('\n')}
]
`)
  if (fallbackTickers.length) process.stderr.write(`${name}: fell back for ${fallbackTickers.join(', ')}\n`)
}

// ── ohlcHistory/ (real candles, sharded so a detail page only loads the ────
// chunk its own ticker lives in, not all ~250 tickers' history at once)
const allDates = [...new Set([...chartResults.values()].flatMap(({ bars }) => bars.map(b => b.time)))].sort()
const dateIndex = new Map(allDates.map((d, i) => [d, i]))

const packed = [...chartResults.entries()].map(([ticker, { bars }]) => {
  const start = dateIndex.get(bars[0].time)
  const contiguous = bars.every((b, i) => dateIndex.get(b.time) === start + i)
  return { ticker, bars, start, contiguous }
})

const CHUNK_COUNT = 10
const tickers = packed.map(p => p.ticker).sort()
const chunkOf = Object.fromEntries(tickers.map((t, i) => [t, i % CHUNK_COUNT]))

const ohlcDir = join(ROOT, 'src/data/ohlcHistory')
rmSync(ohlcDir, { recursive: true, force: true })
mkdirSync(ohlcDir)

writeFileSync(join(ohlcDir, 'manifest.ts'), `// REAL daily OHLC — snapshot fetched ${snapshotDate} from Yahoo Finance.
// Generated by scripts/fetch-real-data.mjs.
export const DATES: string[] = [${allDates.map(d => JSON.stringify(d)).join(',')}]
export const CHUNK_OF: Record<string, number> = ${JSON.stringify(chunkOf)}
`)

for (let c = 0; c < CHUNK_COUNT; c++) {
  const entries = packed.filter(p => chunkOf[p.ticker] === c)
  writeFileSync(join(ohlcDir, `chunk${c}.ts`), `import type { PackedBar } from './types'

// Chunk ${c}/${CHUNK_COUNT} of the sharded real OHLC data — see manifest.ts.
export const OHLC: Record<string, { start: number; bars: PackedBar[]; dates?: string[] }> = {
${entries.map(({ ticker, bars, start, contiguous }) =>
  `  ${JSON.stringify(ticker)}: { start: ${contiguous ? start : 0}, bars: [${bars.map(b => `[${b.open},${b.high},${b.low},${b.close}]`).join(',')}]${contiguous ? '' : `, dates: [${bars.map(b => JSON.stringify(b.time)).join(',')}]`} },`
).join('\n')}
}
`)
}

writeFileSync(join(ohlcDir, 'types.ts'), `export type PackedBar = [number, number, number, number]\n`)

const chunkImports = Array.from({ length: CHUNK_COUNT }, (_, c) => `  ${c}: () => import('./chunk${c}'),`).join('\n')
writeFileSync(join(ohlcDir, 'index.ts'), `import type { OhlcBar } from '../../utils/ohlc'
import { DATES, CHUNK_OF } from './manifest'
import type { PackedBar } from './types'

// Real OHLC data is sharded across ${CHUNK_COUNT} chunk files (see manifest.ts
// for which ticker lives in which chunk) so a detail page's dynamic import
// only pulls in the ~1/${CHUNK_COUNT} of tickers it might actually need.
const loaders: Record<number, () => Promise<{ OHLC: Record<string, { start: number; bars: PackedBar[]; dates?: string[] }> }>> = {
${chunkImports}
}

export async function getRealBars(ticker: string): Promise<OhlcBar[] | undefined> {
  const chunkId = CHUNK_OF[ticker]
  if (chunkId === undefined) return undefined
  const { OHLC } = await loaders[chunkId]()
  const entry = OHLC[ticker]
  if (!entry) return undefined
  return entry.bars.map((b, i) => ({
    time: entry.dates ? entry.dates[i] : DATES[entry.start + i],
    open: b[0], high: b[1], low: b[2], close: b[3],
  }))
}
`)

console.error(`\nDone. Snapshot date ${snapshotDate}. ${chartResults.size}/${ALL_TICKERS.length} tickers have real charts.`)
