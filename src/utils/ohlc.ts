import { mulberry32 } from './historical'

export interface OhlcBar {
  time: string
  open: number
  high: number
  low: number
  close: number
}

const TRADING_DAYS_PER_YEAR = 252
const HISTORY_YEARS = 5
const TRADING_DAYS = TRADING_DAYS_PER_YEAR * HISTORY_YEARS // enough for the longest range button (5Y)

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

// Generates a deterministic ~5-year daily OHLC series ending at `endPrice`
// on `endDate` (weekends skipped, like real trading days), long enough to
// back every range button up to 5Y. The mock dataset has no genuine
// historical price series, so this derives one that's calibrated to land on
// the stock's actual current price and drift at roughly its headline 1Y
// return for the most recent year — seeded by ticker + end date, so
// reloading the page (or picking the same historical date again) reproduces
// the same candles instead of a new random walk each time.
//
// Years further back are damped toward a milder rate than the raw 1Y
// return: compounding a stock's actual trailing-year return (which can be
// triple digits) across 5 years would send the 5-years-ago price to an
// absurd extreme, so older history uses a moderated version of the same
// direction instead.
export function generateOhlcHistory(ticker: string, endPrice: number, pct1Y: number, endDate: Date): OhlcBar[] {
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
  const dampedRate = Math.max(-0.6, Math.min(1.2, annualRate)) * 0.35
  const dailyDriftRecent = Math.pow(1 + annualRate, 1 / TRADING_DAYS_PER_YEAR) - 1
  const dailyDriftOlder = Math.pow(1 + dampedRate, 1 / TRADING_DAYS_PER_YEAR) - 1
  const dailyVol = 0.014 + rng() * 0.012

  // Walk backward from the known end price so the series lands exactly on
  // today's actual price, then use those closes to build O/H/L going forward.
  const closes = new Array<number>(TRADING_DAYS)
  closes[TRADING_DAYS - 1] = endPrice
  for (let i = TRADING_DAYS - 2; i >= 0; i--) {
    const inRecentYear = i + 1 >= TRADING_DAYS - TRADING_DAYS_PER_YEAR
    const drift = inRecentYear ? dailyDriftRecent : dailyDriftOlder
    const shock = (rng() - 0.5) * 2 * dailyVol
    closes[i] = Math.max(0.05, closes[i + 1] / (1 + drift + shock))
  }

  const bars: OhlcBar[] = []
  for (let i = 0; i < TRADING_DAYS; i++) {
    const close = closes[i]
    const prevClose = i === 0 ? close / (1 + dailyDriftOlder) : closes[i - 1]
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

const EARNINGS_INTERVAL = 63 // ~1 trading quarter
const EARNINGS_JITTER = 4 // days either side, so releases don't fall on the same weekday every quarter

// Deterministic quarterly earnings-release dates within the given bar range,
// seeded independently of the price walk so tweaking volatility doesn't
// reshuffle earnings dates and vice versa.
export function generateEarningsDates(ticker: string, bars: OhlcBar[]): string[] {
  if (bars.length === 0) return []
  const rng = mulberry32(tickerSeed(ticker) ^ 0x1234)
  const dates: string[] = []
  let idx = bars.length - 1 - Math.floor(rng() * 10)
  while (idx >= 0) {
    dates.push(bars[idx].time)
    idx -= EARNINGS_INTERVAL + Math.round((rng() - 0.5) * EARNINGS_JITTER * 2)
  }
  return dates.reverse()
}
