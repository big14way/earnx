import { useQuery } from '@tanstack/react-query';

type Fx = { rates: Record<string, number>; updated?: string };

async function loadFx(): Promise<Fx> {
  // Our cached endpoint in production; the public source directly in local dev (no serverless runtime).
  for (const url of ['/api/prices', 'https://open.er-api.com/v6/latest/USD']) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.rates?.NGN) return { rates: data.rates, updated: data.updated ?? data.time_last_update_utc };
    } catch {
      // try the next source
    }
  }
  throw new Error('Exchange rates unavailable');
}

export function useFx() {
  return useQuery({ queryKey: ['fx'], queryFn: loadFx, staleTime: 60 * 60_000, retry: 1 });
}

/** "≈ ₦5.6M" for a dollar amount, or nothing while rates are unavailable. */
export function useNaira() {
  const { data } = useFx();
  const rate = data?.rates.NGN;
  return (usd: number) => {
    if (!rate) return '';
    const ngn = usd * rate;
    const s =
      ngn >= 1e9 ? `${(ngn / 1e9).toFixed(2)}B` : ngn >= 1e6 ? `${(ngn / 1e6).toFixed(1)}M` : ngn >= 1e3 ? `${(ngn / 1e3).toFixed(0)}K` : ngn.toFixed(0);
    return `≈ ₦${s}`;
  };
}
