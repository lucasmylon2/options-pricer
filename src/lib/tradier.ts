export interface Quote {
  ticker: string;
  name: string;
  last: number;
  bid: number;
  ask: number;
  change: number;
  change_percent: number;
  volume: number;
  prev_close: number;
}

export interface OptionContract {
  strike: number;
  option_type: 'call' | 'put';
  expiration_date: string;
  bid: number;
  ask: number;
  midpoint: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  break_even_price: number;
}

export async function fetchQuote(symbol: string): Promise<Quote | null> {
  const res = await fetch(`/api/tradier/quote?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  return data;
}

export async function fetchExpirations(symbol: string): Promise<string[]> {
  const res = await fetch(`/api/tradier/expirations?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.expirations || [];
}

export async function fetchChain(symbol: string, expiration: string): Promise<OptionContract[]> {
  const res = await fetch(`/api/tradier/chain?symbol=${encodeURIComponent(symbol)}&expiration=${expiration}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.contracts || [];
}
