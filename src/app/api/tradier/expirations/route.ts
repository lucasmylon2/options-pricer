import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const KEY = process.env.MASSIVE_API_KEY || '';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  if (!KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  try {
    const res = await fetch(
      `${BASE}/v3/snapshot/options/${encodeURIComponent(symbol.toUpperCase())}?limit=250`,
      { headers: { Authorization: `Bearer ${KEY}` } },
    );
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Massive error ${res.status}: ${err}` }, { status: res.status });
    }
    const data = await res.json();
    const results = data?.results || [];

    const expirations = new Set<string>();
    for (const contract of results) {
      const exp = contract.details?.expiration_date;
      if (exp) expirations.add(exp);
    }

    const sorted = Array.from(expirations).sort();
    return NextResponse.json({ expirations: sorted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
