// Simple moving average. Entries before the window fills are `undefined`
// (not 0) so chart series can skip them instead of plotting a false ramp.
export function sma(values: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export interface Bollinger {
  basis: (number | undefined)[]
  upper: (number | undefined)[]
  lower: (number | undefined)[]
}

// Bollinger Bands: basis = SMA(period), bands = basis ± stdDevMult * population stddev.
export function bollingerBands(values: number[], period: number, stdDevMult: number): Bollinger {
  const basis = sma(values, period)
  const upper: (number | undefined)[] = new Array(values.length).fill(undefined)
  const lower: (number | undefined)[] = new Array(values.length).fill(undefined)
  for (let i = 0; i < values.length; i++) {
    const b = basis[i]
    if (b === undefined) continue
    let sumSq = 0
    for (let j = i - period + 1; j <= i; j++) sumSq += (values[j] - b) ** 2
    const stdDev = Math.sqrt(sumSq / period)
    upper[i] = b + stdDev * stdDevMult
    lower[i] = b - stdDev * stdDevMult
  }
  return { basis, upper, lower }
}

// Wilder's RSI — the standard smoothing (average gain/loss carried forward
// with a 1/period weight), not a simple rolling average.
export function rsi(values: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined)
  if (values.length < period + 1) return out

  let gainSum = 0
  let lossSum = 0
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gainSum += diff
    else lossSum -= diff
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}
