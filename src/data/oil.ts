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

// Oil & gas majors, E&P, refiners, oilfield services, and midstream pipelines.
const raw: Stock[] = [
  s('XOM',  'ExxonMobil',           'Energy', 112.40, '$448.4B',  8.4, 12.4, 1.8, 14.2),
  s('CVX',  'Chevron',              'Energy', 152.40, '$278.4B', -4.2,  2.4, 1.8, 14.2),
  s('COP',  'ConocoPhillips',       'Energy',  98.40, '$128.4B', -4.2,  2.4, 2.8, 14.2),
  s('EOG',  'EOG Resources',        'Energy', 118.40, '$69.4B',  -4.2,  2.4, 2.8, 12.4),
  s('OXY',  'Occidental Petroleum', 'Energy',  52.40, '$47.4B', -14.2,-22.4, 1.8, 14.2),
  s('SLB',  'SLB (Schlumberger)',   'Energy',  42.40, '$59.4B', -12.4,-18.6, 2.8, 18.4),
  s('HAL',  'Halliburton',          'Energy',  28.40, '$24.4B', -18.4,-28.6, 1.4, 14.2),
  s('BKR',  'Baker Hughes',         'Energy',  42.40, '$41.4B',  -4.2,  4.2, 2.4, 22.4),
  s('DVN',  'Devon Energy',         'Energy',  38.40, '$24.4B', -22.4,-32.6, 1.8,  8.4),
  s('FANG', 'Diamondback Energy',   'Energy', 188.40, '$34.2B',  -8.4, -4.2, 3.4, 14.4),
  s('MPC',  'Marathon Petroleum',   'Energy', 168.40, '$52.4B',  -4.2,  4.2, 0.4, 12.4),
  s('VLO',  'Valero Energy',        'Energy', 148.40, '$52.4B',  -8.4, -4.2, 0.4, 12.4),
  s('PSX',  'Phillips 66',          'Energy', 138.40, '$54.4B',  -8.4, -4.2, 0.4, 12.4),
  s('HES',  'Hess Corp',            'Energy', 128.40, '$39.4B',  -8.4, -4.2, 2.8, 22.4),
  s('APA',  'APA Corp',             'Energy',  22.40, '$7.4B',  -28.4,-42.6, 1.4,  8.4),
  s('CTRA', 'Coterra Energy',       'Energy',  28.40, '$11.4B', -22.4,-32.6, 2.8,  8.4),
  s('EQT',  'EQT Corp',             'Energy',  42.40, '$14.4B', -12.4,-18.6, 2.8, 18.4),
  s('OKE',  'ONEOK',                'Energy',  88.40, '$55.4B',   8.4, 14.2, 3.8, 18.4),
  s('KMI',  'Kinder Morgan',        'Energy',  26.40, '$60.4B',   8.4, 12.4, 3.8, 18.4),
  s('WMB',  'Williams Companies',   'Energy',  48.40, '$59.4B',  12.4, 18.6, 4.8, 22.4),
  s('LNG',  'Cheniere Energy',      'Energy', 178.40, '$44.4B',   4.2,  8.4, 3.8, 18.4),
  s('TRGP', 'Targa Resources',      'Energy', 188.40, '$44.4B',  12.4, 18.6, 3.8, 18.4),
]

const byPerf = [...raw].sort((a, b) => b.pct1Y - a.pct1Y)
const n = byPerf.length - 1

export const oil = raw.map(stock => {
  const rank = byPerf.findIndex(x => x.ticker === stock.ticker)
  return { ...stock, rsRank: Math.round(99 - (rank / n) * 65) }
})
