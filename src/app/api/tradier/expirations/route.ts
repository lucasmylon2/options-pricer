import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
const KEY = process.env.MASSIVE_API_KEY || '';

const MAX_PAGES = 40;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: string[]; ts: number }>();

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
  if (!KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

  const ticker = symbol.toUpperCase();
  const cached = cache.get(ticker);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ expirations: cached.data });
  }

  try {
    const expirations = new Set<string>();
    let url: string | null =
      `${BASE}/v3/snapshot/options/${encodeURIComponent(ticker)}?limit=250`;
    let page = 0;
    let stalePages = 0;

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

      const sizeBefore = expirations.size;
      for (const contract of results) {
        const exp = contract.details?.expiration_date;
        if (exp) expirations.add(exp);
      }

      // If no new expirations found for 3 consecutive pages, stop early
      if (expirations.size === sizeBefore) {
        stalePages++;
        if (stalePages >= 3) break;
      } else {
        stalePages = 0;
      }

      url = data?.next_url || null;
      page++;
    }

    const sorted = Array.from(expirations).sort();
    cache.set(ticker, { data: sorted, ts: Date.now() });
    return NextResponse.json({ expirations: sorted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
