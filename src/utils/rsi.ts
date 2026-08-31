import type { Stock } from '../types/stock'

// Live quotes provide a standard RSI(14) when available. The saved data has
// no full daily series for every symbol, so the fallback derives a
// momentum-weighted proxy from the return fields already in each row.
export function computeRSI14(s: Pick<Stock, 'ret1W' | 'ret1M' | 'ret3M' | 'rsi14'>): number {
  if (s.rsi14 !== undefined) return Math.round(s.rsi14)
  const momentum = s.ret1W * 2.2 + s.ret1M * 0.6 + s.ret3M * 0.15
  return Math.min(99, Math.max(1, Math.round(50 + momentum)))
}
