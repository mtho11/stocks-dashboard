import { mulberry32 } from './historical'

export interface OhlcBar {
  time: string
  open: number
  high: number
  low: number
  close: number
}

const TRADING_DAYS = 260 // ~1 trading year

function tickerSeed(ticker: string): number {
  return ticker.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 13), 0)
}

function dateSeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Generates a deterministic ~1-year daily OHLC series ending at `endPrice`
// on `endDate` (weekends skipped, like real trading days). The mock dataset
// has no genuine historical price series, so this derives one that's
// calibrated to land on the stock's actual current price and drift at
// roughly its headline 1Y return — seeded by ticker + end date, so reloading
// the page (or picking the same historical date again) reproduces the same
// candles instead of a new random walk each time.
export function generateYearOhlc(ticker: string, endPrice: number, pct1Y: number, endDate: Date): OhlcBar[] {
  const end = new Date(endDate)
  while (isWeekend(end)) end.setUTCDate(end.getUTCDate() - 1)

  const dates: Date[] = []
  const cursor = new Date(end)
  while (dates.length < TRADING_DAYS) {
    if (!isWeekend(cursor)) dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  dates.reverse() // oldest → newest; last entry === end

  const rng = mulberry32(tickerSeed(ticker) ^ dateSeed(end))
  const annualRate = pct1Y / 100
  const dailyDrift = Math.pow(1 + annualRate, 1 / TRADING_DAYS) - 1
  const dailyVol = 0.014 + rng() * 0.012

  // Walk backward from the known end price so the series lands exactly on
  // today's actual price, then use those closes to build O/H/L going forward.
  const closes = new Array<number>(TRADING_DAYS)
  closes[TRADING_DAYS - 1] = endPrice
  for (let i = TRADING_DAYS - 2; i >= 0; i--) {
    const shock = (rng() - 0.5) * 2 * dailyVol
    closes[i] = Math.max(0.05, closes[i + 1] / (1 + dailyDrift + shock))
  }

  const bars: OhlcBar[] = []
  for (let i = 0; i < TRADING_DAYS; i++) {
    const close = closes[i]
    const prevClose = i === 0 ? close / (1 + dailyDrift) : closes[i - 1]
    const gapPct = (rng() - 0.5) * dailyVol * 0.5
    const open = Math.max(0.05, prevClose * (1 + gapPct))
    const hi = Math.max(open, close)
    const lo = Math.min(open, close)
    const wick = (hi - lo) * 0.3 + close * dailyVol * rng() * 0.6
    const high = hi + wick * rng()
    const low = Math.max(0.02, lo - wick * rng())
    bars.push({
      time: toDateStr(dates[i]),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
    })
  }
  return bars
}
