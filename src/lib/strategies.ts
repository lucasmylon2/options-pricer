import { type Leg } from './bs';

type LegTemplate = Omit<Leg, 'id'>;
type StrategyFactory = (S: number) => LegTemplate[];

export const STRATEGIES: Record<string, { name: string; factory: StrategyFactory }> = {
  bull_call: {
    name: 'Bull Call Spread',
    factory: S => [
      { type: 'call', dir: 'long', K: Math.round(S * 0.95), IV: 25, T: 30, qty: 1 },
      { type: 'call', dir: 'short', K: Math.round(S * 1.05), IV: 25, T: 30, qty: 1 },
    ],
  },
  bear_put: {
    name: 'Bear Put Spread',
    factory: S => [
      { type: 'put', dir: 'long', K: Math.round(S * 1.05), IV: 25, T: 30, qty: 1 },
      { type: 'put', dir: 'short', K: Math.round(S * 0.95), IV: 25, T: 30, qty: 1 },
    ],
  },
  bull_put: {
    name: 'Bull Put Spread',
    factory: S => [
      { type: 'put', dir: 'short', K: Math.round(S * 0.95), IV: 25, T: 30, qty: 1 },
      { type: 'put', dir: 'long', K: Math.round(S * 0.90), IV: 25, T: 30, qty: 1 },
    ],
  },
  bear_call: {
    name: 'Bear Call Spread',
    factory: S => [
      { type: 'call', dir: 'short', K: Math.round(S * 1.05), IV: 25, T: 30, qty: 1 },
      { type: 'call', dir: 'long', K: Math.round(S * 1.10), IV: 25, T: 30, qty: 1 },
    ],
  },
  straddle: {
    name: 'Straddle',
    factory: S => [
      { type: 'call', dir: 'long', K: Math.round(S), IV: 25, T: 30, qty: 1 },
      { type: 'put', dir: 'long', K: Math.round(S), IV: 25, T: 30, qty: 1 },
    ],
  },
  strangle: {
    name: 'Strangle',
    factory: S => [
      { type: 'call', dir: 'long', K: Math.round(S * 1.05), IV: 25, T: 30, qty: 1 },
      { type: 'put', dir: 'long', K: Math.round(S * 0.95), IV: 25, T: 30, qty: 1 },
    ],
  },
  butterfly: {
    name: 'Butterfly',
    factory: S => [
      { type: 'call', dir: 'long', K: Math.round(S * 0.90), IV: 25, T: 30, qty: 1 },
      { type: 'call', dir: 'short', K: Math.round(S), IV: 25, T: 30, qty: 2 },
      { type: 'call', dir: 'long', K: Math.round(S * 1.10), IV: 25, T: 30, qty: 1 },
    ],
  },
  iron_condor: {
    name: 'Iron Condor',
    factory: S => [
      { type: 'put', dir: 'long', K: Math.round(S * 0.85), IV: 25, T: 30, qty: 1 },
      { type: 'put', dir: 'short', K: Math.round(S * 0.95), IV: 25, T: 30, qty: 1 },
      { type: 'call', dir: 'short', K: Math.round(S * 1.05), IV: 25, T: 30, qty: 1 },
      { type: 'call', dir: 'long', K: Math.round(S * 1.15), IV: 25, T: 30, qty: 1 },
    ],
  },
  collar: {
    name: 'Collar',
    factory: S => [
      { type: 'stock', dir: 'long', K: Math.round(S), IV: 25, T: 30, qty: 1 },
      { type: 'put', dir: 'long', K: Math.round(S * 0.95), IV: 25, T: 30, qty: 1 },
      { type: 'call', dir: 'short', K: Math.round(S * 1.05), IV: 25, T: 30, qty: 1 },
    ],
  },
  risk_reversal: {
    name: 'Risk Reversal',
    factory: S => [
      { type: 'put', dir: 'short', K: Math.round(S * 0.95), IV: 27, T: 30, qty: 1 },
      { type: 'call', dir: 'long', K: Math.round(S * 1.05), IV: 23, T: 30, qty: 1 },
    ],
  },
  ratio_spread: {
    name: 'Ratio Spread',
    factory: S => [
      { type: 'call', dir: 'long', K: Math.round(S), IV: 25, T: 30, qty: 1 },
      { type: 'call', dir: 'short', K: Math.round(S * 1.05), IV: 25, T: 30, qty: 2 },
    ],
  },
  calendar: {
    name: 'Calendar Spread',
    factory: S => [
      { type: 'call', dir: 'short', K: Math.round(S), IV: 25, T: 30, qty: 1 },
      { type: 'call', dir: 'long', K: Math.round(S), IV: 25, T: 60, qty: 1 },
    ],
  },
};
