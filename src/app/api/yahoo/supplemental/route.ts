import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });

  const ticker = symbol.toUpperCase();
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

  try {
    // Two parallel fetches: short range for price change, long range for dividends
    const [priceRes, divRes] = await Promise.all([
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`,
        { headers: { 'User-Agent': ua } },
      ),
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=3mo&events=div`,
        { headers: { 'User-Agent': ua } },
      ),
    ]);

    if (!priceRes.ok) {
      return NextResponse.json({ error: `Yahoo error ${priceRes.status}` }, { status: priceRes.status });
    }

    const priceData = await priceRes.json();
    const priceMeta = priceData?.chart?.result?.[0]?.meta;
    if (!priceMeta) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
    }

    const prevClose = priceMeta.chartPreviousClose ?? priceMeta.previousClose ?? 0;
    const currentPrice = priceMeta.regularMarketPrice ?? 0;
    const change = prevClose ? currentPrice - prevClose : 0;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    const volume = priceMeta.regularMarketVolume ?? 0;

    // Extract dividend yield from 1-year data
    let dividendYield = 0;
    if (divRes.ok) {
      const divData = await divRes.json();
      const divResult = divData?.chart?.result?.[0];
      const divMeta = divResult?.meta;
      if (divMeta?.dividendYield != null) {
        dividendYield = divMeta.dividendYield;
      } else if (divResult?.events?.dividends) {
        const divs = Object.values(divResult.events.dividends) as Array<{ amount: number }>;
        if (divs.length > 0 && currentPrice > 0) {
          const totalAnnual = divs.reduce((sum: number, d) => sum + d.amount, 0);
          dividendYield = totalAnnual / currentPrice;
        }
      }
    }

    return NextResponse.json({
      ticker,
      dividend_yield: dividendYield,
      change: +change.toFixed(2),
      change_percent: +changePct.toFixed(2),
      volume,
      prev_close: prevClose,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
