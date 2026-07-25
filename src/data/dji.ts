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

// The 30 Dow Jones Industrial Average components.
const raw: Stock[] = [
  s('AAPL', 'Apple',                'Big Tech',            228.52,  '$3.7T',    22.4,   38.7,   8.2,  34.5),
  s('MSFT', 'Microsoft',            'Big Tech',            447.30,  '$3.3T',    18.6,   31.4,  14.2,  38.1),
  s('NVDA', 'Nvidia',               'Semiconductors',      222.82,  '$5.4T',    17.4,   62.2,  24.7,  44.4),
  s('AMZN', 'Amazon',               'E-commerce',          256.52,  '$2.8T',    10.9,   24.1,   3.9,  31.8),
  s('UNH',  'UnitedHealth Group',   'Health Services',     550.40,  '$506.4B',  -8.4,  -12.6,   0.8,  18.4),
  s('JPM',  'JPMorgan Chase',       'Banking',             278.40,  '$786.4B',  18.4,   28.6,   4.2,  14.2),
  s('V',    'Visa',                 'Payments',            378.40,  '$738.4B',  14.2,   24.6,  16.2,  28.4),
  s('WMT',  'Walmart',              'Consumer Staples',    105.40,  '$844.4B',  28.4,   42.6,   0.8,  32.4),
  s('GS',   'Goldman Sachs',        'Capital Markets',     578.40,  '$192.4B',  28.4,   42.6,   2.8,  14.2),
  s('HD',   'Home Depot',           'Consumer Disc',       388.40,  '$384.4B',   8.4,   14.2,   2.8,  28.4),
  s('CAT',  'Caterpillar',          'Industrials',         388.40,  '$196.4B',  12.4,   22.8,   2.4,  18.4),
  s('AXP',  'American Express',     'Capital Markets',     288.40,  '$200.4B',  14.2,   28.6,   2.8,  18.4),
  s('MCD',  "McDonald's",           'Consumer Disc',       278.40,  '$198.4B',  -4.2,    2.4,   9.8,  24.4),
  s('CRM',  'Salesforce',           'Enterprise Software', 318.40,  '$305.4B',  -8.4,    4.2,   7.8,  42.4),
  s('DIS',  'Walt Disney',          'Comm Services',       105.40,  '$191.4B',  12.4,   18.6,   2.8,  28.4),
  s('IBM',  'IBM',                  'Enterprise Software', 228.40,  '$208.4B',  14.2,   22.8,   2.8,  22.4),
  s('AMGN', 'Amgen',                'Biotech',             312.40,  '$166.2B',   8.4,   14.2,   5.8,  22.4),
  s('BA',   'Boeing',               'Industrials',         185.40,  '$126.4B',   8.4,   12.4,   1.4,  null),
  s('HON',  'Honeywell',            'Industrials',         224.40,  '$147.2B',  14.2,   22.8,   3.4,  24.2),
  s('CVX',  'Chevron',              'Energy',              152.40,  '$278.4B',  -4.2,    2.4,   1.8,  14.2),
  s('JNJ',  'Johnson & Johnson',    'Pharma',              168.40,  '$404.2B',   8.4,   14.2,   4.2,  22.4),
  s('PG',   'Procter & Gamble',     'Consumer Staples',    175.40,  '$412.4B',   8.4,   14.2,   4.8,  28.4),
  s('MRK',  'Merck',                'Pharma',              105.40,  '$267.2B',   4.2,    8.4,   3.2,  16.4),
  s('TRV',  'Travelers',            'Insurance',           248.40,  '$64.4B',   12.4,   18.6,   1.8,  12.4),
  s('KO',   'Coca-Cola',            'Consumer Staples',     68.40,  '$294.4B',   6.4,   12.8,   5.8,  24.4),
  s('MMM',  '3M',                   'Industrials',         138.40,  '$76.4B',   18.4,   28.6,   2.4,  18.4),
  s('NKE',  'Nike',                 'Consumer Disc',        78.40,  '$117.4B', -14.2,  -18.6,   2.4,  28.4),
  s('CSCO', 'Cisco',                'Semiconductors',       62.40,  '$247.2B',   4.8,    8.4,   5.2,  20.4),
  s('VZ',   'Verizon',              'Comm Services',        42.40,  '$177.4B',   6.4,   12.8,   1.6,  10.4),
  s('SHW',  'Sherwin-Williams',     'Materials',           388.40,  '$98.4B',    8.4,   14.2,   4.8,  28.4),
]

const byPerf = [...raw].sort((a, b) => b.pct1Y - a.pct1Y)
const n = byPerf.length - 1

export const dji = raw.map(stock => {
  const rank = byPerf.findIndex(x => x.ticker === stock.ticker)
  return { ...stock, rsRank: Math.round(99 - (rank / n) * 65) }
})
