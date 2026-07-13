import { mulberry32 } from '../utils/historical'

// One shared, seeded random-walk generator for all mock data files.
// Module-level RNG: call order within a module is stable, so every page
// load produces identical sparklines without threading seeds per ticker.
const rng = mulberry32(0xcafe)

export function rand(): number {
  return rng()
}

export function spark(base: number, vol: number, trend: number, pts = 30): number[] {
  const d: number[] = [base]
  for (let i = 1; i < pts; i++) {
    const p = d[i - 1]
    d.push(Math.max(0.01, p + p * (trend / pts + (rng() - 0.48) * vol)))
  }
  return d
}
