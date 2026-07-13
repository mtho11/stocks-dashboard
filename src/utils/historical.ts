import type { Stock } from '../types/stock'
import { parseMarketCap, fmtMarketCap } from './marketCap'

export const REFERENCE_DATE = new Date('2026-06-02')

// Mulberry32 seeded PRNG — deterministic for a given date+ticker pair
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dateToInt(d: Date) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function tickerInt(ticker: string) {
  return ticker.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 7), 0)
}

export function getHistoricalStocks(stocks: Stock[], targetDate: Date): Stock[] {
  const daysDiff = (REFERENCE_DATE.getTime() - targetDate.getTime()) / 86400000
  if (daysDiff <= 0) return stocks

  const yearsFrac = daysDiff / 365

  const historical = stocks.map((stock): Stock => {
    const seed = (dateToInt(targetDate) * 9973) ^ tickerInt(stock.ticker)
    const rng = mulberry32(seed)

    const annualRate = stock.pct1Y / 100

    // Price: work backwards from reference using annualised 1Y rate + small noise
    const priceNoise = 1 + (rng() - 0.5) * 0.06
    const price = Math.max(0.01, stock.price / Math.pow(1 + annualRate, yearsFrac) * priceNoise)

    // Market cap scales with price
    const mcapRaw = parseMarketCap(stock.marketCap)
    const marketCap = mcapRaw > 0 ? fmtMarketCap(mcapRaw * (price / stock.price)) : stock.marketCap

    // YTD: Jan 1 of target year → targetDate
    const jan1 = new Date(Date.UTC(targetDate.getUTCFullYear(), 0, 1))
    const daysJan1ToRef = (REFERENCE_DATE.getTime() - jan1.getTime()) / 86400000
    const jan1Noise = 1 + (rng() - 0.5) * 0.03
    const jan1Price = Math.max(0.01, stock.price / Math.pow(1 + annualRate, daysJan1ToRef / 365) * jan1Noise)
    const pctYTD = (price / jan1Price - 1) * 100

    // 1Y return from target-date perspective
    const oneYrAgoNoise = 1 + (rng() - 0.5) * 0.05
    const oneYrAgoPrice = Math.max(0.01, stock.price / Math.pow(1 + annualRate, (daysDiff + 365) / 365) * oneYrAgoNoise)
    const pct1Y = (price / oneYrAgoPrice - 1) * 100

    // Period returns derived from annualised rate + noise
    const ret1W = ((Math.pow(1 + annualRate, 7 / 365) - 1) + (rng() - 0.5) * 0.025) * 100
    const ret1M = ((Math.pow(1 + annualRate, 30 / 365) - 1) + (rng() - 0.5) * 0.04) * 100
    const ret3M = ((Math.pow(1 + annualRate, 91 / 365) - 1) + (rng() - 0.5) * 0.07) * 100
    const ret6M = ((Math.pow(1 + annualRate, 182 / 365) - 1) + (rng() - 0.5) * 0.10) * 100

    // Δ Highs — further back = smaller drawdown from the then-high
    const highsNoise = (rng() - 0.5) * 0.12
    const deltaHighs = Math.min(-0.1, stock.deltaHighs * (0.5 + yearsFrac * 0.5 + highsNoise))

    // Sparkline for the 30-day window ending at targetDate
    const sparkSeed = (dateToInt(targetDate) * 1337) ^ tickerInt(stock.ticker)
    const srng = mulberry32(sparkSeed)
    const sparkData: number[] = [price * (0.72 + srng() * 0.1)]
    for (let i = 1; i < 30; i++) {
      const prev = sparkData[i - 1]
      const trend = annualRate / 52
      sparkData.push(Math.max(0.01, prev + prev * (trend + (srng() - 0.48) * 0.08)))
    }

    // SMA direction derived from trend
    const sma20: 'up' | 'down' = ret1M > 0 ? 'up' : 'down'
    const sma50: 'up' | 'down' = ret3M > 0 ? 'up' : 'down'
    const sma200: 'up' | 'down' = ret6M > 0 ? 'up' : 'down'

    return {
      ...stock,
      price: +price.toFixed(2),
      marketCap,
      pctYTD: +pctYTD.toFixed(2),
      pct1Y: +pct1Y.toFixed(2),
      ret1W: +ret1W.toFixed(1),
      ret1M: +ret1M.toFixed(1),
      ret3M: +ret3M.toFixed(1),
      ret6M: +ret6M.toFixed(1),
      deltaHighs: +deltaHighs.toFixed(2),
      sma20, sma50, sma200,
      sparklineData: sparkData,
    }
  })

  // Recompute RS Rank: rank by pct1Y among the historical cohort (74–99 range)
  const byPerf = [...historical].sort((a, b) => b.pct1Y - a.pct1Y)
  const n = byPerf.length - 1
  return historical.map(stock => {
    const rank = byPerf.findIndex(s => s.ticker === stock.ticker)
    return { ...stock, rsRank: Math.round(99 - (rank / n) * 25) }
  })
}
