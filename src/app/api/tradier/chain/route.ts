import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const KEY = process.env.MASSIVE_API_KEY || '';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  const expiration = req.nextUrl.searchParams.get('expiration');
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  if (!KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  try {
    let url = `${BASE}/v3/snapshot/options/${encodeURIComponent(symbol.toUpperCase())}?limit=250`;
    if (expiration) url += `&expiration_date=${expiration}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Massive error ${res.status}: ${err}` }, { status: res.status });
    }
    const data = await res.json();
    const results = data?.results || [];

    const contracts = results.map((c: Record<string, unknown>) => {
      const details = c.details as Record<string, unknown> | undefined;
      const greeks = c.greeks as Record<string, number> | undefined;
      const lastQuote = c.last_quote as Record<string, number> | undefined;
      const day = c.day as Record<string, number> | undefined;

      return {
        strike: details?.strike_price ?? 0,
        option_type: details?.contract_type ?? 'call',
        expiration_date: details?.expiration_date ?? '',
        bid: lastQuote?.bid ?? 0,
        ask: lastQuote?.ask ?? 0,
        midpoint: lastQuote?.midpoint ?? 0,
        volume: day?.volume ?? 0,
        open_interest: (c.open_interest as number) ?? 0,
        implied_volatility: (c.implied_volatility as number) ?? 0,
        greeks: {
          delta: greeks?.delta ?? 0,
          gamma: greeks?.gamma ?? 0,
          theta: greeks?.theta ?? 0,
          vega: greeks?.vega ?? 0,
        },
        break_even_price: (c.break_even_price as number) ?? 0,
      };
    });

    return NextResponse.json({ contracts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
