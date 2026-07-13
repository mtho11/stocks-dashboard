import { describe, it, expect } from 'vitest'
import { parseMarketCap, fmtMarketCap } from '../marketCap'

describe('parseMarketCap', () => {
  it('parses each magnitude suffix', () => {
    expect(parseMarketCap('$500K')).toBe(500e3)
    expect(parseMarketCap('$533M')).toBe(533e6)
    expect(parseMarketCap('$254.2B')).toBeCloseTo(254.2e9)
    expect(parseMarketCap('$1.2T')).toBeCloseTo(1.2e12)
  })

  it('orders values numerically, not lexicographically', () => {
    // The original sort bug: "$850.4B" > "$5.4T" as strings.
    expect(parseMarketCap('$850.4B')).toBeLessThan(parseMarketCap('$5.4T'))
  })

  it('returns 0 for malformed input', () => {
    expect(parseMarketCap('')).toBe(0)
    expect(parseMarketCap('n/a')).toBe(0)
    expect(parseMarketCap('254.2B')).toBe(0)
    expect(parseMarketCap('$254.2')).toBe(0)
  })
})

describe('fmtMarketCap', () => {
  it('formats each magnitude', () => {
    expect(fmtMarketCap(1.23e12)).toBe('$1.2T')
    expect(fmtMarketCap(254.24e9)).toBe('$254.2B')
    expect(fmtMarketCap(533e6)).toBe('$533M')
    expect(fmtMarketCap(500e3)).toBe('$500K')
  })

  it('round-trips through parse', () => {
    for (const s of ['$1.2T', '$254.2B', '$533M', '$500K']) {
      expect(fmtMarketCap(parseMarketCap(s))).toBe(s)
    }
  })
})
