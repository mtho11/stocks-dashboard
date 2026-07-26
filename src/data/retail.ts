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

// Discount/grocery, home improvement, off-price & apparel, e-commerce, and
// specialty retailers.
const raw: Stock[] = [
  s('WMT',  'Walmart',                'Discount & Grocery',  105.40, '$844.4B',  28.4,  42.6,  0.8, 32.4),
  s('COST', 'Costco Wholesale',       'Discount & Grocery',  962.40, '$427.1B',  24.1,  44.8,  1.6, 55.2),
  s('TGT',  'Target',                 'Discount & Grocery',  132.40, '$61.4B',   -8.4, -14.2,  0.4, 12.4),
  s('DG',   'Dollar General',        'Discount & Grocery',   88.40, '$20.4B',  -22.4, -32.6,  0.6, 14.2),
  s('DLTR', 'Dollar Tree',           'Discount & Grocery',   68.40, '$14.6B',  -38.6, -48.4,  0.6, 16.4),
  s('KR',   'Kroger',                'Discount & Grocery',   62.40, '$32.4B',    8.4,  14.2,  0.3, 14.2),
  s('HD',   'Home Depot',            'Home Improvement',    388.40, '$384.4B',   8.4,  14.2,  2.8, 28.4),
  s('LOW',  "Lowe's",                'Home Improvement',    258.40, '$154.4B',   8.4,  14.2,  1.8, 22.4),
  s('TJX',  'TJX Companies',         'Off-Price & Apparel',  118.40, '$136.4B',  18.4,  28.6,  2.8, 28.4),
  s('ROST', 'Ross Stores',           'Off-Price & Apparel',  158.40, '$52.4B',   12.4,  18.6,  2.2, 24.6),
  s('BURL', 'Burlington Stores',     'Off-Price & Apparel',  218.40, '$16.4B',    8.4,  14.2,  1.2, 24.4),
  s('GPS',  'Gap Inc',               'Off-Price & Apparel',   22.40, '$8.2B',    18.4,  28.6,  0.6, 12.4),
  s('ANF',  'Abercrombie & Fitch',   'Off-Price & Apparel',   88.40, '$4.6B',   -12.4, -18.6,  0.8,  8.4),
  s('LULU', 'Lululemon',             'Off-Price & Apparel',  242.40, '$30.2B',  -24.6, -38.4,  3.8, 28.4),
  s('URBN', 'Urban Outfitters',      'Off-Price & Apparel',   58.40, '$5.2B',    22.4,  38.6,  1.2, 14.2),
  s('AMZN', 'Amazon',                'E-commerce',           256.52, '$2.8T',    10.9,  24.1,  3.9, 31.8),
  s('EBAY', 'eBay',                  'E-commerce',            62.40, '$27.4B',   -8.4,   4.2,  3.8, 18.4),
  s('ETSY', 'Etsy',                  'E-commerce',            58.40, '$7.2B',   -18.4, -28.6,  4.8, 22.4),
  s('CHWY', 'Chewy',                 'E-commerce',            28.40, '$11.4B',   12.4,  22.8,  1.2, 28.4),
  s('W',    'Wayfair',               'E-commerce',            48.40, '$4.8B',    -8.4, -14.2,  0.6, null),
  s('ULTA', 'Ulta Beauty',           'Specialty Retail',     388.40, '$18.4B',  -18.4, -28.6,  2.8, 18.4),
  s('BBY',  'Best Buy',              'Specialty Retail',      82.40, '$17.4B',   -8.4,  -4.2,  0.4, 14.2),
  s('AZO',  'AutoZone',              'Specialty Retail',    3488.40, '$58.4B',   12.4,  18.6,  2.8, 24.4),
  s('ORLY', "O'Reilly Automotive",   'Specialty Retail',    1182.40, '$73.2B',   18.4,  28.6,  4.8, 32.4),
  s('TSCO', 'Tractor Supply',        'Specialty Retail',     278.40, '$28.4B',    8.4,  14.2,  2.8, 28.4),
  s('DKS',  "Dick's Sporting Goods", 'Specialty Retail',     218.40, '$17.4B',   18.4,  28.6,  1.2, 18.4),
  s('FIVE', 'Five Below',            'Specialty Retail',     118.40, '$6.2B',    28.4,  42.6,  1.8, 24.4),
  s('M',    "Macy's",                'Specialty Retail',      16.40, '$4.4B',   -12.4, -18.6,  0.2,  8.4),
  s('KSS',  "Kohl's",                'Specialty Retail',      14.40, '$2.6B',   -18.4, -28.6,  0.1, null),
]

const byPerf = [...raw].sort((a, b) => b.pct1Y - a.pct1Y)
const n = byPerf.length - 1

export const retail = raw.map(stock => {
  const rank = byPerf.findIndex(x => x.ticker === stock.ticker)
  return { ...stock, rsRank: Math.round(99 - (rank / n) * 65) }
})
