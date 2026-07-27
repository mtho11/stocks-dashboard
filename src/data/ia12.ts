import type { Stock } from '../types/stock'
import { spark, rand } from './spark'

function s(
  ticker: string, company: string, sector: string,
  price: number, mcap: string,
  ytd: number, y1: number,
  ps: number | null, pe: number | null
): Stock {
  const ann = y1 / 100
  const r1w = ((Math.pow(1 + ann, 7 / 365) - 1) + (rand() - 0.48) * 0.025) * 100
  const r1m = ((Math.pow(1 + ann, 30 / 365) - 1) + (rand() - 0.48) * 0.04) * 100
  const r3m = ((Math.pow(1 + ann, 91 / 365) - 1) + (rand() - 0.48) * 0.07) * 100
  const r6m = ((Math.pow(1 + ann, 182 / 365) - 1) + (rand() - 0.48) * 0.10) * 100
  const dh = ytd >= 0 ? -(rand() * 14) : -(15 + rand() * 25)
  const vol2 = Math.abs(ytd) > 30 ? 0.09 : 0.06
  return {
    ticker, company, sector, price, marketCap: mcap, ps, pe,
    pctYTD: ytd, pct1Y: y1,
    deltaHighs: +dh.toFixed(2),
    rsRank: 50,
    ret1W: +r1w.toFixed(1), ret1M: +r1m.toFixed(1),
    ret3M: +r3m.toFixed(1), ret6M: +r6m.toFixed(1),
    sma20: r1m > 0 ? 'up' : 'down',
    sma50: r3m > 0 ? 'up' : 'down',
    sma200: r6m > 0 ? 'up' : 'down',
    sparklineData: spark(price * (0.65 + rand() * 0.15), vol2, ytd >= 0 ? 0.4 : -0.3),
  }
}

// Mike's own 12-stock AI/compute watchlist. Figures for tickers that also
// appear in other built-in lists (Nvidia, Broadcom, AMD, etc.) are kept
// numerically consistent with stocks.ts. SPCX (SpaceX) isn't publicly
// traded — its figures are a plausible mock estimate, same as the
// not-yet-public names in the Biotech list.
const raw: Stock[] = [
  s('NVDA', 'Nvidia',       'Semiconductors',      222.82,  '$5.4T',    17.4,   62.2,  24.7,  44.4),
  s('ALAB', 'Astera Labs',  'Semiconductors',       184.20,  '$31.4B',  410.4,  892.1,  38.6,  null),
  s('AVGO', 'Broadcom',     'Semiconductors',       481.57,  '$2.3T',    36.5,   93.6,  28.8,  80.8),
  s('MRVL', 'Marvell',      'Semiconductors',       290.79,  '$254.4B', 235.2,  373.1,  20.4,  64.0),
  s('AMD',  'AMD',          'Semiconductors',       521.54,  '$850.4B', 138.3,  355.0,  19.6, 153.4),
  s('MU',   'Micron',       'Semiconductors',      1064.10,  '$1.2T',   260.6,  983.8,  14.8,  35.7),
  s('TSLA', 'Tesla',        'EVs & Robotics',       423.74,  '$1.35T',   -7.4,   23.7,  16.0, 406.0),
  s('GOOGL','Alphabet',     'Big Tech',             361.85,  '$4.4T',    14.2,  114.1,  11.1,  29.3),
  s('SPCX', 'SpaceX',       'Aerospace',            180.00,  '$400.0B',  28.4,   48.6,  12.4,  null),
  s('PLTR', 'Palantir',     'Enterprise Software',  152.17,  '$364.8B', -16.1,   15.3,  62.9, 154.2),
  s('ASML', 'ASML',         'Semiconductor Equip', 1705.37,  '$660.6B',  50.4,  128.4,  16.0,  54.4),
  s('TSM',  'TSMC',         'Semiconductor Equip',  446.69,  '$2.0T',    43.2,  129.3,  13.8,  33.8),
]

const byPerf = [...raw].sort((a, b) => b.pct1Y - a.pct1Y)
const n = byPerf.length - 1

export const ia12 = raw.map(stock => {
  const rank = byPerf.findIndex(x => x.ticker === stock.ticker)
  return { ...stock, rsRank: Math.round(99 - (rank / n) * 65) }
})
