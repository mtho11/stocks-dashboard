import type { OhlcBar } from '../../utils/ohlc'
import { DATES, CHUNK_OF } from './manifest'
import type { PackedBar } from './types'

// Real OHLC data is sharded across 10 chunk files (see manifest.ts
// for which ticker lives in which chunk) so a detail page's dynamic import
// only pulls in the ~1/10 of tickers it might actually need.
const loaders: Record<number, () => Promise<{ OHLC: Record<string, { start: number; bars: PackedBar[]; dates?: string[] }> }>> = {
  0: () => import('./chunk0'),
  1: () => import('./chunk1'),
  2: () => import('./chunk2'),
  3: () => import('./chunk3'),
  4: () => import('./chunk4'),
  5: () => import('./chunk5'),
  6: () => import('./chunk6'),
  7: () => import('./chunk7'),
  8: () => import('./chunk8'),
  9: () => import('./chunk9'),
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
