import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const KEY = process.env.MASSIVE_API_KEY || '';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  if (!KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const ticker = symbol.toUpperCase();

  try {
    const res = await fetch(`${BASE}/v3/snapshot?ticker=${encodeURIComponent(ticker)}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Massive error ${res.status}: ${err}` }, { status: res.status });
    }
    const data = await res.json();
    const snap = data?.results?.[0];
    if (!snap) return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });

    return NextResponse.json({
      ticker: snap.ticker,
      name: snap.name || ticker,
      last: snap.last_trade?.price ?? snap.last_quote?.midpoint ?? 0,
      bid: snap.last_quote?.bid ?? 0,
      ask: snap.last_quote?.ask ?? 0,
      change: snap.session?.change ?? 0,
      change_percent: snap.session?.change_percent ?? 0,
      volume: snap.session?.volume ?? snap.day?.volume ?? 0,
      prev_close: snap.session?.previous_close ?? snap.prev_day?.close ?? 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
