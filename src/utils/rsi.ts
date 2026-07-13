import type { Stock } from '../types/stock'

// Synthetic RSI(14): the mock dataset has no daily OHLC series to compute a
// textbook average-gain/average-loss RSI from, so this derives a
// momentum-weighted proxy from the return fields the dashboard already has
// (short-term moves weighted most heavily, like real RSI). Pure function of
// ret1W/ret1M/ret3M, so it automatically tracks historical-date recalculation
// without needing its own stored field or seeded generator.
export function computeRSI14(s: Pick<Stock, 'ret1W' | 'ret1M' | 'ret3M'>): number {
  const momentum = s.ret1W * 2.2 + s.ret1M * 0.6 + s.ret3M * 0.15
  return Math.min(99, Math.max(1, Math.round(50 + momentum)))
}
