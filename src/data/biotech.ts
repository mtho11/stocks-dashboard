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

// Pure-play biotech drug developers — mostly clinical/commercial-stage
// names with no or minimal earnings, hence a lot of null P/E here.
const raw: Stock[] = [
  s('AMGN', 'Amgen',                'Biotech', 312.40, '$166.2B',  8.4, 14.2,  5.8, 22.4),
  s('GILD', 'Gilead Sciences',      'Biotech',  92.40, '$115.2B', 12.4, 24.6,  4.2, 18.4),
  s('REGN', 'Regeneron',            'Biotech', 768.40, '$82.4B',  14.2, 22.4,  8.4, 28.4),
  s('VRTX', 'Vertex Pharmaceuticals','Biotech', 478.40, '$122.4B', 18.4, 28.6, 12.4, 32.4),
  s('BIIB', 'Biogen',               'Biotech', 142.40, '$20.8B', -28.4,-38.6,  2.4, 14.2),
  s('MRNA', 'Moderna',              'Biotech', 112.40, '$42.8B', -28.4,-42.6,  8.4, null),
  s('ILMN', 'Illumina',             'Biotech', 112.40, '$17.8B', -24.6,-36.4,  4.2, null),
  s('ALNY', 'Alnylam Pharmaceuticals','Biotech',268.40, '$30.4B', 22.4, 38.6, 14.2, null),
  s('BMRN', 'BioMarin Pharmaceutical','Biotech', 78.40, '$14.8B',-12.4,-18.6,  4.8, 42.4),
  s('INCY', 'Incyte',               'Biotech',  68.40, '$13.4B',  4.2,  8.4,  4.2, 18.4),
  s('NBIX', 'Neurocrine Biosciences','Biotech', 128.40, '$12.8B',  8.4, 14.2,  5.8, 28.4),
  s('CRSP', 'CRISPR Therapeutics',  'Biotech',  58.40, '$7.4B',  -18.4,-28.6, 12.4, null),
  s('NTLA', 'Intellia Therapeutics','Biotech',  22.40, '$2.6B',  -32.4,-48.6,  8.4, null),
  s('BEAM', 'Beam Therapeutics',    'Biotech',  32.40, '$3.4B',  -22.4,-34.6, 10.4, null),
  s('SRPT', 'Sarepta Therapeutics', 'Biotech', 118.40, '$11.4B', -28.4,-42.6,  4.2, null),
  s('RARE', 'Ultragenyx Pharmaceutical','Biotech',42.40,'$3.8B', -18.4,-28.6,  8.4, null),
  s('IONS', 'Ionis Pharmaceuticals','Biotech',  48.40, '$10.4B', 12.4, 22.8,  4.8, null),
  s('ARGX', 'argenx',               'Biotech', 528.40, '$28.4B', 28.4, 42.6, 12.4, 68.4),
  s('UTHR', 'United Therapeutics',  'Biotech', 328.40, '$14.8B', 18.4, 28.6,  6.8, 18.4),
  s('BGNE', 'BeiGene',              'Biotech', 258.40, '$28.4B', 32.4, 48.6,  8.4, null),
  s('VKTX', 'Viking Therapeutics',  'Biotech',  68.40, '$8.4B',  42.4, 78.6, 22.4, null),
]

const byPerf = [...raw].sort((a, b) => b.pct1Y - a.pct1Y)
const n = byPerf.length - 1

export const biotech = raw.map(stock => {
  const rank = byPerf.findIndex(x => x.ticker === stock.ticker)
  return { ...stock, rsRank: Math.round(99 - (rank / n) * 65) }
})
