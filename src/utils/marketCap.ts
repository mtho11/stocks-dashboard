export function parseMarketCap(s: string): number {
  const m = s.match(/^\$([0-9.]+)([KMBT])$/)
  if (!m) return 0
  const mults: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }
  return parseFloat(m[1]) * mults[m[2]]
}

export function fmtMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${(v / 1e3).toFixed(0)}K`
}
