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

// Banks, capital markets, insurers, and payment networks.
const raw: Stock[] = [
  s('JPM',  'JPMorgan Chase',        'Banking',         278.40, '$786.4B', 18.4, 28.6,  4.2, 14.2),
  s('BAC',  'Bank of America',       'Banking',          46.40, '$362.8B',  8.4, 14.2,  3.2, 12.4),
  s('WFC',  'Wells Fargo',           'Banking',          82.40, '$272.4B', 12.4, 24.6,  3.8, 14.2),
  s('C',    'Citigroup',             'Banking',          82.40, '$158.4B', 14.2, 22.6,  1.8, 12.4),
  s('USB',  'U.S. Bancorp',          'Banking',          42.40, '$66.4B',   4.2,  8.4,  2.8, 12.4),
  s('PNC',  'PNC Financial',         'Banking',         178.40, '$73.4B',   6.4, 12.2,  3.2, 12.4),
  s('TFC',  'Truist Financial',      'Banking',          42.40, '$58.4B',   4.2,  8.4,  2.8, 12.4),
  s('COF',  'Capital One',           'Banking',         188.40, '$71.4B',  18.4, 28.6,  2.8, 14.2),
  s('GS',   'Goldman Sachs',         'Capital Markets', 578.40, '$192.4B', 28.4, 42.6,  2.8, 14.2),
  s('MS',   'Morgan Stanley',        'Capital Markets', 128.40, '$206.4B', 18.4, 28.6,  2.4, 18.4),
  s('AXP',  'American Express',      'Capital Markets', 288.40, '$200.4B', 14.2, 28.6,  2.8, 18.4),
  s('BLK',  'BlackRock',             'Capital Markets',1058.40, '$158.4B', 14.2, 22.8,  7.8, 28.4),
  s('SCHW', 'Charles Schwab',        'Capital Markets',  82.40, '$148.4B',  8.4, 14.2,  4.8, 22.4),
  s('BK',   'Bank of New York Mellon','Capital Markets',  82.40, '$35.4B',   8.4, 14.2,  4.8, 14.2),
  s('STT',  'State Street',          'Capital Markets',  88.40, '$26.4B',   4.2,  8.4,  2.8, 12.4),
  s('SPGI', 'S&P Global',            'Capital Markets', 548.40, '$172.4B', 18.4, 28.6, 12.4, 42.4),
  s('MCO',  "Moody's",               'Capital Markets', 488.40, '$92.4B',  14.2, 22.8,  9.2, 48.4),
  s('ICE',  'Intercontinental Exchange','Capital Markets',168.40,'$96.4B', 18.4, 28.6,  8.8, 28.4),
  s('CME',  'CME Group',             'Capital Markets', 248.40, '$88.4B',   8.4, 14.2, 14.2, 22.4),
  s('BX',   'Blackstone',            'Capital Markets', 178.40, '$118.4B', 18.4, 28.6,  6.8, 28.4),
  s('KKR',  'KKR',                   'Capital Markets', 128.40, '$114.4B', 22.4, 38.6,  5.8, null),
  s('V',    'Visa',                  'Payments',        378.40, '$738.4B', 14.2, 24.6, 16.2, 28.4),
  s('MA',   'Mastercard',            'Payments',        558.40, '$514.4B', 18.4, 28.6, 14.2, 32.4),
  s('PYPL', 'PayPal',                'Payments',         82.40, '$89.2B', -12.4,-18.6,  2.8, 18.4),
  s('FI',   'Fiserv',                'Payments',        218.40, '$138.4B', 18.4, 28.6,  6.8, 28.4),
  s('GPN',  'Global Payments',       'Payments',        128.40, '$34.4B', -4.2,  4.8,  2.8, 14.2),
  s('TRV',  'Travelers',             'Insurance',       248.40, '$64.4B',  12.4, 18.6,  1.8, 12.4),
  s('PGR',  'Progressive',           'Insurance',       288.40, '$168.4B', 28.4, 42.6,  2.8, 22.4),
  s('AIG',  'AIG',                   'Insurance',        78.40, '$54.4B',   8.4, 14.2,  1.8, 12.4),
  s('MET',  'MetLife',               'Insurance',        78.40, '$58.4B',   6.4, 12.2,  0.8,  8.4),
  s('PRU',  'Prudential Financial',  'Insurance',       118.40, '$44.4B',   4.2,  8.4,  0.6, 10.4),
  s('CB',   'Chubb',                 'Insurance',       288.40, '$119.4B', 14.2, 22.8,  1.8, 12.4),
]

const byPerf = [...raw].sort((a, b) => b.pct1Y - a.pct1Y)
const n = byPerf.length - 1

export const finance = raw.map(stock => {
  const rank = byPerf.findIndex(x => x.ticker === stock.ticker)
  return { ...stock, rsRank: Math.round(99 - (rank / n) * 65) }
})
