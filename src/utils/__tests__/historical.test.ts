import { describe, it, expect } from 'vitest'
import { getHistoricalStocks, REFERENCE_DATE, mulberry32 } from '../historical'
import type { Stock } from '../../types/stock'

function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    ticker: 'TEST',
    company: 'Test Corp',
    sector: 'Semiconductors',
    price: 100,
    marketCap: '$10.0B',
    ps: 5,
    pe: 20,
    pctYTD: 40,
    pct1Y: 80,
    deltaHighs: -5,
    rsRank: 90,
    ret1W: 1,
    ret1M: 4,
    ret3M: 12,
    ret6M: 25,
    sma20: 'up',
    sma50: 'up',
    sma200: 'up',
    sparklineData: [90, 95, 100],
    ...overrides,
  }
}

const cohort = [
  makeStock({ ticker: 'AAA', pct1Y: 300 }),
  makeStock({ ticker: 'BBB', pct1Y: 80 }),
  makeStock({ ticker: 'CCC', pct1Y: -20 }),
]

const pastDate = new Date('2025-06-02T12:00:00Z')

describe('mulberry32', () => {
  it('is deterministic for a given seed and produces values in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('getHistoricalStocks', () => {
  it('is deterministic: same inputs produce deeply identical output', () => {
    const run1 = getHistoricalStocks(cohort, pastDate)
    const run2 = getHistoricalStocks(cohort, pastDate)
    expect(run1).toEqual(run2)
  })

  it('returns the input unchanged for the reference date or later', () => {
    expect(getHistoricalStocks(cohort, REFERENCE_DATE)).toBe(cohort)
    expect(getHistoricalStocks(cohort, new Date('2027-01-01'))).toBe(cohort)
  })

  it('produces positive prices and valid sparklines', () => {
    for (const s of getHistoricalStocks(cohort, pastDate)) {
      expect(s.price).toBeGreaterThan(0)
      expect(s.sparklineData).toHaveLength(30)
      expect(s.sparklineData.every(v => v > 0)).toBe(true)
    }
  })

  it('recomputes RS rank within 74-99, best performer ranked highest', () => {
    const result = getHistoricalStocks(cohort, pastDate)
    const ranks = new Map(result.map(s => [s.ticker, s.rsRank]))
    for (const r of ranks.values()) {
      expect(r).toBeGreaterThanOrEqual(74)
      expect(r).toBeLessThanOrEqual(99)
    }
    const byPerf = [...result].sort((a, b) => b.pct1Y - a.pct1Y)
    expect(ranks.get(byPerf[0].ticker)).toBe(99)
    expect(ranks.get(byPerf[byPerf.length - 1].ticker)).toBe(74)
  })

  it('varies output by date', () => {
    const other = getHistoricalStocks(cohort, new Date('2025-01-15T12:00:00Z'))
    const base = getHistoricalStocks(cohort, pastDate)
    expect(base[0].price).not.toBe(other[0].price)
  })
})
