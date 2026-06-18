export interface Stock {
  ticker: string
  company: string
  sector: string
  price: number
  marketCap: string
  ps: number | null
  pe: number | null
  pctYTD: number
  pct1Y: number
  deltaHighs: number
  rsRank: number
  ret1W: number
  ret1M: number
  ret3M: number
  ret6M: number
  sma20: 'up' | 'down'
  sma50: 'up' | 'down'
  sma200: 'up' | 'down'
  sparklineData: number[]
  color?: string
}
