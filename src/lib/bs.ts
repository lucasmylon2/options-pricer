export interface BSResult {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  vanna: number;
  d1: number;
  d2: number;
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const r = 1 - p * Math.exp(-x * x);
  return x >= 0 ? r : -r;
}

export function normCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function bs(S: number, K: number, T: number, r: number, q: number, sigma: number, type: 'call' | 'put'): BSResult {
  if (T <= 0 || sigma <= 0) {
    const iv = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price: iv, delta: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, vega: 0, theta: 0, rho: 0, vanna: 0, d1: 0, d2: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const eqT = Math.exp(-q * T), erT = Math.exp(-r * T);

  let price: number, delta: number, rho: number;
  if (type === 'call') {
    price = S * eqT * normCDF(d1) - K * erT * normCDF(d2);
    delta = eqT * normCDF(d1);
    rho = K * T * erT * normCDF(d2) / 100;
  } else {
    price = K * erT * normCDF(-d2) - S * eqT * normCDF(-d1);
    delta = -eqT * normCDF(-d1);
    rho = -K * T * erT * normCDF(-d2) / 100;
  }

  const gamma = eqT * normPDF(d1) / (S * sigma * sqrtT);
  const vega = S * eqT * normPDF(d1) * sqrtT / 100;
  const callT = (-S * eqT * normPDF(d1) * sigma / (2 * sqrtT) - r * K * erT * normCDF(d2) + q * S * eqT * normCDF(d1)) / 365;
  const putT = (-S * eqT * normPDF(d1) * sigma / (2 * sqrtT) + r * K * erT * normCDF(-d2) - q * S * eqT * normCDF(-d1)) / 365;
  const theta = type === 'call' ? callT : putT;
  const vanna = (vega * 100 / S) * (1 - d1 / (sigma * sqrtT));

  return { price, delta, gamma, vega, theta, rho, vanna, d1, d2 };
}

export type LegType = 'call' | 'put' | 'stock';
export type LegDir = 'long' | 'short';

export interface Leg {
  id: number;
  type: LegType;
  dir: LegDir;
  K: number;
  IV: number;
  T: number;
  qty: number;
}

export interface NetGreeks {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  vanna: number;
}

export function computeNetGreeks(legs: Leg[], S: number, r: number, q: number): NetGreeks {
  const net: NetGreeks = { price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0, vanna: 0 };
  for (const leg of legs) {
    const sign = leg.dir === 'long' ? 1 : -1;
    if (leg.type === 'stock') {
      net.price += sign * leg.qty * S;
      net.delta += sign * leg.qty;
      continue;
    }
    const res = bs(S, leg.K, leg.T / 365, r, q, leg.IV / 100, leg.type);
    net.price += sign * leg.qty * res.price;
    net.delta += sign * leg.qty * res.delta;
    net.gamma += sign * leg.qty * res.gamma;
    net.vega += sign * leg.qty * res.vega;
    net.theta += sign * leg.qty * res.theta;
    net.rho += sign * leg.qty * res.rho;
    net.vanna += sign * leg.qty * res.vanna;
  }
  return net;
}

export function multiPayoff(spot: number, legs: Leg[], S: number, r: number, q: number): number {
  let total = 0;
  for (const leg of legs) {
    const sign = leg.dir === 'long' ? 1 : -1;
    if (leg.type === 'stock') { total += sign * leg.qty * (spot - S); continue; }
    const T = leg.T / 365;
    const entry = bs(S, leg.K, T, r, q, leg.IV / 100, leg.type).price;
    const payoff = leg.type === 'call' ? Math.max(spot - leg.K, 0) : Math.max(leg.K - spot, 0);
    total += sign * leg.qty * (payoff - entry);
  }
  return total;
}

export function spotRange(S: number, steps: number): number[] {
  const lo = Math.max(S * 0.5, 0.01), hi = S * 1.5;
  const sz = (hi - lo) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => +(lo + i * sz).toFixed(2));
}
