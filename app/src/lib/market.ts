import { benchmarks, benchmarkSource } from '../data/benchmarks.js';

export { benchmarkSource };

export type Trade = {
  quantity: number;
  unit: 't' | 'kg';
  unitPriceUsd: number; // per `unit`
  incoterms?: string;
};

export type Benchmark = { key: string; name: string; usdPerTonne: number; month: string };

/** Matches a commodity description to a World Bank benchmark series, if one exists. */
export function benchmarkFor(commodity: string, origin = ''): Benchmark | undefined {
  const c = commodity.toLowerCase();
  const pick = (key: keyof typeof benchmarks): Benchmark => ({ key, ...benchmarks[key] });
  if (/cocoa|cacao/.test(c)) return pick('cocoa');
  if (/coffee/.test(c)) return /robusta/.test(c) ? pick('coffee_robusta') : pick('coffee_arabica');
  if (/\btea\b/.test(c)) return /kenya|uganda|rwanda|tanzania/i.test(origin) ? pick('tea_mombasa') : pick('tea');
  if (/palm oil/.test(c)) return pick('palm_oil');
  if (/groundnut|peanut/.test(c)) return pick('groundnuts');
  if (/maize|corn/.test(c)) return pick('maize');
  if (/\brice\b/.test(c)) return pick('rice');
  if (/soy/.test(c)) return pick('soybeans');
  if (/sugar/.test(c)) return pick('sugar');
  if (/cotton/.test(c)) return pick('cotton');
  if (/banana/.test(c)) return pick('banana');
  if (/orange/.test(c)) return pick('orange');
  return undefined;
}

export function pricePerTonne(trade: Trade) {
  return trade.unit === 'kg' ? trade.unitPriceUsd * 1000 : trade.unitPriceUsd;
}

export type MarketVerdict = {
  deviation: number; // e.g. 0.12 = 12% above the benchmark
  level: 'in-line' | 'above' | 'far-above' | 'below';
  label: string;
};

/** How the invoice's unit price compares with the benchmark. Over-pricing is the classic invoice fraud. */
export function compareToMarket(trade: Trade, benchmark: Benchmark): MarketVerdict {
  const deviation = pricePerTonne(trade) / benchmark.usdPerTonne - 1;
  const pct = `${Math.abs(deviation * 100).toFixed(0)}%`;
  if (deviation > 0.5) return { deviation, level: 'far-above', label: `${pct} above market: possible over-invoicing` };
  if (deviation > 0.25) return { deviation, level: 'above', label: `${pct} above market` };
  if (deviation < -0.4) return { deviation, level: 'below', label: `${pct} below market: check grade and terms` };
  return { deviation, level: 'in-line', label: `In line with market (${deviation >= 0 ? '+' : '−'}${pct})` };
}
