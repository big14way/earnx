import { formatUnits, type Address } from 'viem';

export function money(amount: bigint, decimals = 6, opts: { compact?: boolean; cents?: boolean } = {}) {
  const value = Number(formatUnits(amount, decimals));
  if (opts.compact && value >= 10_000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : value < 100 ? 2 : 0,
  }).format(value);
}

export function plural(n: bigint | number, word: string) {
  return `${n} ${word}${Number(n) === 1 ? '' : 's'}`;
}

export function percentFromBps(bps: number, digits?: number) {
  // 1235 -> "12.35%", 1200 -> "12.0%": two decimals only when they carry information.
  const d = digits ?? (bps % 10 === 0 ? 1 : 2);
  return `${(bps / 100).toFixed(d)}%`;
}

export function shortAddress(address?: Address | string) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function date(seconds: number) {
  return new Date(seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysFromNow(seconds: number) {
  return Math.round((seconds * 1000 - Date.now()) / 86_400_000);
}

export function relativeDays(seconds: number) {
  const d = daysFromNow(seconds);
  if (d === 0) return 'today';
  if (d > 0) return `in ${d} day${d === 1 ? '' : 's'}`;
  return `${-d} day${d === -1 ? '' : 's'} ago`;
}

export function countryFlag(country: string) {
  const codes: Record<string, string> = {
    nigeria: 'NG',
    ghana: 'GH',
    kenya: 'KE',
    "cote d'ivoire": 'CI',
    "côte d'ivoire": 'CI',
    'south africa': 'ZA',
    ethiopia: 'ET',
    tanzania: 'TZ',
    uganda: 'UG',
    rwanda: 'RW',
    senegal: 'SN',
    cameroon: 'CM',
    egypt: 'EG',
    morocco: 'MA',
    netherlands: 'NL',
    belgium: 'BE',
    zambia: 'ZM',
    malawi: 'MW',
    'burkina faso': 'BF',
    mali: 'ML',
    benin: 'BJ',
    togo: 'TG',
    vietnam: 'VN',
    japan: 'JP',
    'united arab emirates': 'AE',
    'united kingdom': 'GB',
    'united states': 'US',
    germany: 'DE',
    france: 'FR',
    china: 'CN',
    india: 'IN',
  };
  const code = codes[country.trim().toLowerCase()];
  if (!code) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
