/**
 * The Rust risk engine's formula (contracts/stylus/risk-engine/src/lib.rs), mirrored so the app can
 * show how each engine-priced invoice's terms were computed. The contract is the source of truth;
 * `explain` only returns a breakdown when it reproduces the stored terms exactly.
 */
const BASE_APR = 800;
const RISK_PER_POINT = 15;
const TERM_FREE_DAYS = 30;
const TERM_DAYS_PER_BPS = 3;
const MIN_APR = 500;
const MAX_APR = 5_000;
const MAX_ADVANCE = 9_000;
const MIN_ADVANCE = 7_000;
const RISK_FREE_POINTS = 30;
const ADVANCE_PER_POINT = 25;
const LONG_TENOR = 120;
const LONG_HAIRCUT = 500;
const MEDIUM = 50_000_000_000n;
const LARGE = 100_000_000_000n;

export type Line = { label: string; bps: number };

export function engineQuote(risk: number, tenorDays: number, faceValue: bigint) {
  const r = Math.min(risk, 100);
  const term = Math.floor(Math.max(0, tenorDays - TERM_FREE_DAYS) / TERM_DAYS_PER_BPS);
  const size = faceValue > LARGE ? 50 : faceValue > MEDIUM ? 25 : 0;
  const apr = Math.min(MAX_APR, Math.max(MIN_APR, BASE_APR + r * RISK_PER_POINT + term + size));
  const riskCut = Math.max(0, r - RISK_FREE_POINTS) * ADVANCE_PER_POINT;
  const tenorCut = tenorDays > LONG_TENOR ? LONG_HAIRCUT : 0;
  const advance = Math.min(MAX_ADVANCE, Math.max(MIN_ADVANCE, MAX_ADVANCE - riskCut - tenorCut));
  const aprLines: Line[] = [
    { label: 'Base rate', bps: BASE_APR },
    { label: `Risk score ${r} × 0.15%`, bps: r * RISK_PER_POINT },
    ...(term ? [{ label: `Term: ${tenorDays} days (beyond 30)`, bps: term }] : []),
    ...(size ? [{ label: 'Invoice size', bps: size }] : []),
  ];
  const advanceLines: Line[] = [
    { label: 'Standard advance', bps: MAX_ADVANCE },
    ...(riskCut ? [{ label: `Risk above 30 (${r - RISK_FREE_POINTS} × 0.25%)`, bps: -riskCut }] : []),
    ...(tenorCut ? [{ label: 'Term over 120 days', bps: -tenorCut }] : []),
  ];
  return { apr, advance, aprLines, advanceLines };
}

/** Reconstructs the breakdown for a stored invoice, trying the tenors the verification time allows. */
export function explain(risk: number, aprBps: number, advanceBps: number, faceValue: bigint, dueDate: number, verifiedAt?: number) {
  const candidates = verifiedAt !== undefined ? [Math.floor((dueDate - verifiedAt) / 86_400)] : [];
  for (let d = 0; d <= 365 && candidates.length < 400; d++) candidates.push(d);
  for (const tenor of candidates) {
    const q = engineQuote(risk, tenor, faceValue);
    if (q.apr === aprBps && q.advance === advanceBps) return { ...q, tenorDays: tenor };
  }
  return undefined;
}
