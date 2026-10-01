/**
 * Daily exchange rates for the currencies EarnX users think in, cached at the edge for an hour.
 * Source: open.er-api.com (free daily reference rates).
 */
const CURRENCIES = ['NGN', 'GHS', 'KES', 'XOF', 'ZAR'] as const;

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(8_000) });
    const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (data.result !== 'success' || !data.rates) throw new Error('bad response');
    const rates = Object.fromEntries(CURRENCIES.map((c) => [c, data.rates![c]]));
    return Response.json(
      { base: 'USD', rates, updated: data.time_last_update_utc, source: 'open.er-api.com' },
      { headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch {
    return Response.json({ error: 'Exchange rates unavailable' }, { status: 503 });
  }
}
