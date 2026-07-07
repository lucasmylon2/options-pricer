import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const KEY = process.env.MASSIVE_API_KEY || '';

const MAX_PAGES = 12;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  if (!KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  try {
    const expirations = new Set<string>();
    let url: string | null =
      `${BASE}/v3/snapshot/options/${encodeURIComponent(symbol.toUpperCase())}?limit=250`;
    let page = 0;

    while (url && page < MAX_PAGES) {
      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${KEY}` },
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json(
          { error: `Massive error ${res.status}: ${err}` },
          { status: res.status },
        );
      }
      const data = await res.json();
      const results = data?.results || [];

      for (const contract of results) {
        const exp = contract.details?.expiration_date;
        if (exp) expirations.add(exp);
      }

      url = data?.next_url || null;
      page++;
    }

    const sorted = Array.from(expirations).sort();
    return NextResponse.json({ expirations: sorted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
