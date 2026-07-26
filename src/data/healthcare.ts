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

// Pharma, MedTech, health insurers/services — the broad healthcare sector.
// (For pure-play biotech drug developers, see the separate Biotech list.)
const raw: Stock[] = [
  s('LLY',   'Eli Lilly',              'Pharma',         898.40, '$852.4B', 42.4, 68.4, 22.4, 85.4),
  s('JNJ',   'Johnson & Johnson',      'Pharma',         168.40, '$404.2B',  8.4, 14.2,  4.2, 22.4),
  s('ABBV',  'AbbVie',                 'Pharma',         195.40, '$344.2B', 18.4, 28.6,  4.8, 22.4),
  s('MRK',   'Merck',                  'Pharma',         105.40, '$267.2B',  4.2,  8.4,  3.2, 16.4),
  s('PFE',   'Pfizer',                 'Pharma',          26.40, '$147.2B',-24.4,-36.2,  2.2,  8.4),
  s('BMY',   'Bristol-Myers Squibb',   'Pharma',          48.40, '$92.4B', -12.4,-18.6,  2.4, 12.4),
  s('ZTS',   'Zoetis',                 'Pharma',         178.40, '$81.4B',  -8.4, -4.2,  8.2, 28.4),
  s('VTRS',  'Viatris',                'Pharma',          12.40, '$17.2B', -12.4,-18.6,  0.8,  8.4),
  s('UNH',   'UnitedHealth Group',     'Health Services',550.40, '$506.4B',-8.4,-12.6,  0.8, 18.4),
  s('CI',    'Cigna',                  'Health Services',342.40, '$111.4B',-12.4,-18.6,  0.6, 14.2),
  s('CVS',   'CVS Health',             'Health Services', 58.40, '$72.4B', -18.4,-26.2,  0.2, 12.4),
  s('HUM',   'Humana',                 'Health Services',312.40, '$36.8B', -28.4,-38.6,  0.4, 18.4),
  s('MCK',   'McKesson',               'Health Services',686.40, '$68.4B',  12.4, 22.8,  0.2, 18.4),
  s('ELV',   'Elevance Health',        'Health Services',438.40, '$108.4B',-18.4,-24.6,  0.6, 14.2),
  s('HCA',   'HCA Healthcare',         'Health Services',312.40, '$78.4B',   4.2, 12.4,  0.8, 14.2),
  s('LH',    'Labcorp',                'Health Services',248.40, '$25.2B',   4.2,  8.4,  2.4, 18.4),
  s('DGX',   'Quest Diagnostics',      'Health Services',148.40, '$14.8B',   6.4, 12.8,  2.8, 22.4),
  s('IQV',   'IQVIA Holdings',         'Health Services',188.40, '$34.8B', -12.4,-18.6,  2.8, 22.4),
  s('ABT',   'Abbott Laboratories',    'MedTech',        118.40, '$204.8B', 12.4, 22.8,  3.6, 32.4),
  s('DHR',   'Danaher',                'MedTech',        248.40, '$178.4B',  8.4, 14.2,  5.8, 34.4),
  s('TMO',   'Thermo Fisher Scientific','MedTech',        578.40, '$222.4B',  6.4, 12.8,  4.2, 28.4),
  s('ISRG',  'Intuitive Surgical',     'MedTech',        527.40, '$186.2B', 24.6, 38.4, 16.8, 74.2),
  s('BSX',   'Boston Scientific',      'MedTech',         92.40, '$132.4B', 22.4, 38.6,  4.8, 38.4),
  s('SYK',   'Stryker',                'MedTech',        388.40, '$146.4B', 14.2, 22.8,  5.4, 28.4),
  s('MDT',   'Medtronic',              'MedTech',         88.40, '$117.8B',  4.2,  8.4,  2.8, 18.4),
  s('ZBH',   'Zimmer Biomet',          'MedTech',        118.40, '$24.8B',  -4.2,  2.4,  3.4, 18.4),
  s('EW',    'Edwards Lifesciences',   'MedTech',         78.40, '$48.2B', -18.4,-24.6,  6.2, 24.4),
  s('BDX',   'Becton Dickinson',       'MedTech',        218.40, '$62.4B',  -8.4, -4.2,  2.8, 18.4),
  s('RMD',   'ResMed',                 'MedTech',        228.40, '$33.4B',  12.4, 22.8,  5.8, 32.4),
  s('DXCM',  'DexCom',                 'MedTech',         72.40, '$29.2B', -18.4,-28.6,  8.4, 48.4),
  s('IDXX',  'IDEXX Laboratories',     'MedTech',        484.20, '$39.2B',  -4.2,  4.8, 10.4, 48.6),
  s('GEHC',  'GE Healthcare',          'MedTech',         88.40, '$38.2B',  -8.4, -4.6,  2.4, 22.4),
]

const byPerf = [...raw].sort((a, b) => b.pct1Y - a.pct1Y)
const n = byPerf.length - 1

export const healthcare = raw.map(stock => {
  const rank = byPerf.findIndex(x => x.ticker === stock.ticker)
  return { ...stock, rsRank: Math.round(99 - (rank / n) * 65) }
})
