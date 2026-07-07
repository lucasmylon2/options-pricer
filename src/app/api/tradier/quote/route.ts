import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const KEY = process.env.MASSIVE_API_KEY || '';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  if (!KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const ticker = symbol.toUpperCase();

  try {
    // Use options snapshot to get underlying price (stock snapshot requires stocks entitlement)
    const res = await fetch(
      `${BASE}/v3/snapshot/options/${encodeURIComponent(ticker)}?limit=1`,
      { headers: { Authorization: `Bearer ${KEY}` } },
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Massive error ${res.status}: ${err}` }, { status: res.status });
    }
    const data = await res.json();
    const contract = data?.results?.[0];
    if (!contract) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });

    const underlyingPrice =
      (contract.underlying_asset as Record<string, number> | undefined)?.price ?? 0;

    return NextResponse.json({
      ticker,
      name: ticker,
      last: underlyingPrice,
      underlying_price: underlyingPrice,
      bid: 0,
      ask: 0,
      change: 0,
      change_percent: 0,
      volume: 0,
      prev_close: 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
