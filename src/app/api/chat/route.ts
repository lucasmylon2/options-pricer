import Anthropic from '@anthropic-ai/sdk';

function getEnv(key: string, fallback = '') {
  return process.env[key] || fallback;
}

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') });
  return _client;
}

const SYSTEM = `You are an options trading AI assistant embedded in an interactive Black-Scholes pricer. You help traders analyze options strategies, understand greeks, and find opportunities.

You have tools to fetch live market data. When the user asks about a specific ticker or strategy, use your tools to get real data and give concrete analysis.

When you want the user to see a specific strategy in the pricer, return a load_strategy action with the exact parameters. The frontend will load it automatically.

Key capabilities:
- Fetch live stock quotes and options chains
- Analyze IV skew, term structure, and greeks
- Show interactive vol analysis (IV skew and term structure charts) for any ticker
- Suggest optimal strategies based on market view
- Compare strategies side-by-side
- Explain risk/reward and greeks in context

When the user asks to see vol analysis, IV skew, term structure, or volatility surface for a ticker, use the show_vol_analysis tool. This switches the pricer to the Vol Analysis tab and fetches live data. You can specify view: "skew" for IV smile, "term" for term structure.

Be concise and direct. Use actual numbers from the data. Format currency values and percentages clearly. When suggesting strategies, always explain the tradeoff.

Today's date is ${new Date().toISOString().split('T')[0]}.`;

interface MassiveContract {
  details?: { strike_price?: number; contract_type?: string; expiration_date?: string };
  last_quote?: { bid?: number; ask?: number; midpoint?: number };
  day?: { volume?: number };
  open_interest?: number;
  implied_volatility?: number;
  greeks?: { delta?: number; gamma?: number; theta?: number; vega?: number };
  underlying_asset?: { price?: number };
  break_even_price?: number;
}

async function massiveFetch(path: string) {
  const base = getEnv('MASSIVE_BASE_URL', 'https://api.massive.com');
  const key = getEnv('MASSIVE_API_KEY');
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Massive ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getQuote(symbol: string) {
  const data = await massiveFetch(`/v3/snapshot/options/${encodeURIComponent(symbol)}?limit=1`);
  const c = data?.results?.[0] as MassiveContract | undefined;
  if (!c) return { error: 'Ticker not found' };
  const price = c.underlying_asset?.price ?? 0;
  return { symbol: symbol.toUpperCase(), price };
}

async function getExpirations(symbol: string) {
  const expirations = new Set<string>();
  let url: string | null = `/v3/snapshot/options/${encodeURIComponent(symbol)}?limit=250`;
  let page = 0;
  while (url && page < 10) {
    const data = await massiveFetch(url);
    for (const c of data?.results || []) {
      const exp = (c as MassiveContract).details?.expiration_date;
      if (exp) expirations.add(exp);
    }
    url = data?.next_url?.replace(getEnv('MASSIVE_BASE_URL', 'https://api.massive.com'), '') || null;
    page++;
  }
  return { symbol: symbol.toUpperCase(), expirations: Array.from(expirations).sort() };
}

async function getChain(symbol: string, expiration: string) {
  let url: string | null = `/v3/snapshot/options/${encodeURIComponent(symbol)}?limit=250&expiration_date=${expiration}`;
  const all: MassiveContract[] = [];
  let page = 0;
  while (url && page < 3) {
    const data = await massiveFetch(url);
    all.push(...(data?.results || []));
    url = data?.next_url?.replace(getEnv('MASSIVE_BASE_URL', 'https://api.massive.com'), '') || null;
    page++;
  }
  const spot = all[0]?.underlying_asset?.price ?? 0;
  const contracts = all.map((c: MassiveContract) => ({
    strike: c.details?.strike_price ?? 0,
    type: c.details?.contract_type ?? 'call',
    expiration: c.details?.expiration_date ?? '',
    bid: c.last_quote?.bid ?? 0,
    ask: c.last_quote?.ask ?? 0,
    mid: c.last_quote?.midpoint ?? 0,
    iv: c.implied_volatility ?? 0,
    volume: c.day?.volume ?? 0,
    oi: c.open_interest ?? 0,
    delta: c.greeks?.delta ?? 0,
    gamma: c.greeks?.gamma ?? 0,
    theta: c.greeks?.theta ?? 0,
    vega: c.greeks?.vega ?? 0,
  }));
  return { symbol: symbol.toUpperCase(), expiration, spot, contracts };
}

const tools: Anthropic.Messages.Tool[] = [
  {
    name: 'get_quote',
    description: 'Get current stock price for a ticker symbol',
    input_schema: {
      type: 'object' as const,
      properties: { symbol: { type: 'string', description: 'Ticker symbol e.g. AAPL' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_expirations',
    description: 'Get available option expiration dates for a ticker',
    input_schema: {
      type: 'object' as const,
      properties: { symbol: { type: 'string', description: 'Ticker symbol' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_chain',
    description: 'Get options chain data (strikes, IVs, greeks, bid/ask) for a ticker and expiration date. Returns all available contracts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol' },
        expiration: { type: 'string', description: 'Expiration date in YYYY-MM-DD format' },
      },
      required: ['symbol', 'expiration'],
    },
  },
  {
    name: 'show_vol_analysis',
    description: 'Show the Vol Analysis tab with IV skew and term structure charts for a ticker. Use when the user asks about vol surface, IV skew, term structure, or volatility analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol e.g. TSLA' },
        view: { type: 'string', enum: ['skew', 'term'], description: 'Which view to show: "skew" for IV smile/skew, "term" for term structure. Defaults to skew.' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'load_strategy',
    description: 'Load a strategy into the pricer for the user to visualize. Use this when suggesting a trade so the user can see the payoff diagram, greeks, and scenario analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol' },
        legs: {
          type: 'array',
          description: 'Array of option legs',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['call', 'put'] },
              direction: { type: 'string', enum: ['long', 'short'] },
              strike: { type: 'number' },
              iv: { type: 'number', description: 'Implied volatility as decimal (e.g. 0.25 for 25%)' },
              dte: { type: 'number', description: 'Days to expiration' },
              qty: { type: 'number', description: 'Number of contracts (default 1)' },
            },
            required: ['type', 'direction', 'strike'],
          },
        },
        spot: { type: 'number', description: 'Current spot price' },
      },
      required: ['symbol', 'legs'],
    },
  },
];

async function handleToolCall(name: string, input: Record<string, unknown>) {
  switch (name) {
    case 'get_quote':
      return await getQuote(input.symbol as string);
    case 'get_expirations':
      return await getExpirations(input.symbol as string);
    case 'get_chain':
      return await getChain(input.symbol as string, input.expiration as string);
    case 'show_vol_analysis':
      return { action: 'show_vol_analysis', ...input };
    case 'load_strategy':
      return { action: 'load_strategy', ...input };
    default:
      return { error: 'Unknown tool' };
  }
}

export async function POST(req: Request) {
  if (!getEnv('ANTHROPIC_API_KEY')) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured — add it to .env.local and restart the server' }, { status: 500 });
  }

  const body = await req.json();
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    return Response.json({ error: 'Invalid messages' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...messages];
        let iterations = 0;
        const MAX_ITERATIONS = 5;

        while (iterations < MAX_ITERATIONS) {
          iterations++;
          const response = await getClient().messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: SYSTEM,
            tools,
            messages: currentMessages,
          });

          // Check for tool use
          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
          );
          const textBlocks = response.content.filter(
            (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
          );

          // Send any text
          for (const block of textBlocks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`));
          }

          if (toolUseBlocks.length === 0 || response.stop_reason !== 'tool_use') {
            break;
          }

          // Execute tools
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const toolBlock of toolUseBlocks) {
            const result = await handleToolCall(toolBlock.name, toolBlock.input as Record<string, unknown>);

            if (toolBlock.name === 'show_vol_analysis' || toolBlock.name === 'load_strategy') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'action', action: result })}\n\n`));
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: JSON.stringify(result),
            });
          }

          // Continue conversation with tool results
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ];
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
