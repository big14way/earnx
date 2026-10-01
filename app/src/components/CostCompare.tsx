import { useState } from 'react';
import { motion } from 'motion/react';
import { Reveal } from './motion';

/**
 * What the same money costs from a Nigerian bank vs EarnX, for a term the visitor picks.
 * Bank figures are sourced below; EarnX uses the published pricing (APR for the term + 1% reserve fee).
 */
const BANK_RATES = [
  { label: 'Prime rate', rate: 17.86, note: 'Aug 2026 average prime lending rate (CBN)' },
  { label: 'Typical SME rate', rate: 29.2, note: 'Aug 2026 average maximum lending rate (CBN)' },
  { label: 'High end for SMEs', rate: 42, note: 'top of the 28–46% SMEs reported paying in 2026' },
];
const BANK_FEES = 2; // CBN Guide to Charges: management + commitment fees capped at 2% of the loan in total
const EARNX_FEE = 1; // 1% of the advance goes into the first-loss reserve
const EARNX_APR = 12.35; // typical quote from the risk engine (risk 28, 75 days)

/** All-in cost as a % of the money actually received, and the same thing per year. */
function cost(ratePct: number, feePct: number, days: number) {
  const forTerm = ((ratePct / 100) * (days / 365) + feePct / 100) / (1 - feePct / 100);
  return { forTerm: forTerm * 100, perYear: forTerm * (365 / days) * 100 };
}

export function CostCompare() {
  const [days, setDays] = useState(60);
  const [bankIdx, setBankIdx] = useState(1);
  const bank = cost(BANK_RATES[bankIdx].rate, BANK_FEES, days);
  const earnx = cost(EARNX_APR, EARNX_FEE, days);
  const max = Math.max(bank.forTerm, earnx.forTerm);
  const per1m = (pct: number) => `₦${Math.round(pct * 10_000).toLocaleString('en-US')}`;

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <Reveal>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">What it costs</div>
        <h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          A bank loan vs EarnX, for the same harvest.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Pick how long until your buyer pays. Costs include every fee, measured against the money you actually receive.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal className="rounded-3xl border border-line bg-card p-6 sm:p-8">
          <label className="block">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-ink">Buyer pays in</span>
              <span className="tabular font-display text-3xl font-semibold text-ink">{days} days</span>
            </div>
            <input
              type="range"
              min={30}
              max={180}
              step={15}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-3 w-full accent-[#1f6b47]"
            />
          </label>

          <div className="mt-6 flex flex-wrap gap-2">
            {BANK_RATES.map((b, i) => (
              <button
                key={b.label}
                onClick={() => setBankIdx(i)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  i === bankIdx ? 'bg-ink text-paper' : 'border border-line text-ink-soft hover:border-ink'
                }`}
              >
                Bank: {b.label} {b.rate}%
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{BANK_RATES[bankIdx].note}, plus fees of up to {BANK_FEES}%.</p>

          <div className="mt-8 space-y-5">
            {[
              { name: 'Nigerian bank loan', c: bank, color: 'bg-clay' },
              { name: 'EarnX', c: earnx, color: 'bg-leaf' },
            ].map((row) => (
              <div key={row.name}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-ink">{row.name}</span>
                  <span className="tabular text-muted">
                    <b className="text-ink">{row.c.forTerm.toFixed(1)}%</b> for {days} days · {row.c.perYear.toFixed(0)}% a year
                  </span>
                </div>
                <div className="mt-2 h-4 overflow-hidden rounded-full bg-line/70">
                  <motion.div
                    className={`h-full rounded-full ${row.color}`}
                    initial={false}
                    animate={{ width: `${(row.c.forTerm / max) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
                <div className="tabular mt-1 text-xs text-muted">{per1m(row.c.forTerm)} on every ₦1,000,000 received</div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-leaf-soft p-4 text-sm text-ink">
            For a {days}-day invoice, EarnX costs about{' '}
            <b>{(bank.forTerm / earnx.forTerm).toFixed(1)}× less</b> than a typical bank loan, before collateral, legal fees
            and weeks of waiting.
          </div>
        </Reveal>

        <Reveal delay={0.1} className="rounded-3xl border border-line bg-card p-6 sm:p-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="pb-3 font-medium"></th>
                <th className="pb-3 font-medium">Bank</th>
                <th className="pb-3 font-medium text-leaf">EarnX</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {[
                ['Collateral', 'Often about 2× the loan', 'None beyond the verified invoice'],
                ['Fees', 'Up to 2%, plus uncapped legal and collateral costs, insurance and late penalties', '1%, paid into the reserve that protects investors'],
                ['Time to money', 'Weeks (20–30 working days at NEXIM after full documents)', 'Same transaction the invoice is fully funded'],
                ['Small firms rejected', '23% of applications', 'Risk sets the price, by a published formula'],
              ].map(([k, b, e]) => (
                <tr key={k}>
                  <td className="py-3 pr-3 font-semibold text-ink">{k}</td>
                  <td className="py-3 pr-3 text-muted">{b}</td>
                  <td className="py-3 text-ink">{e}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 text-xs leading-relaxed text-muted">
            Naira loans are priced against naira inflation (15.4% in August 2026). EarnX advances dollars against dollar
            invoices, so an exporter paid in dollars carries no currency risk on either side. Figures are illustrative.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Sources:{' '}
            <a className="underline" href="https://www.thisdaylive.com/2026/09/21/relief-as-banking-sector-lending-rate-to-businesses-drop-to-29-19/" target="_blank" rel="noreferrer">CBN lending rates (ThisDay)</a>,{' '}
            <a className="underline" href="https://nairametrics.com/2026/07/21/falling-inflation-shrinking-credit-why-nigerian-businesses-still-cant-borrow/" target="_blank" rel="noreferrer">SME rates (Nairametrics)</a>,{' '}
            <a className="underline" href="https://www.cbn.gov.ng/Out/2022/CCD/Guide%20to%20Charges%20by%20Banks%20Other%20Financial%20and%20Non-Financial%20Institutions%20eff%20Jan%201%202020.pdf" target="_blank" rel="noreferrer">CBN Guide to Charges</a>,{' '}
            <a className="underline" href="https://businessday.ng/business-economy/article/smes-face-credit-squeeze-over-weak-records/" target="_blank" rel="noreferrer">rejections (World Bank, via BusinessDay)</a>,{' '}
            <a className="underline" href="https://www.enterprisesurveys.org/content/dam/enterprisesurveys/documents/country-profiles/Nigeria-2014.pdf" target="_blank" rel="noreferrer">collateral (World Bank, 2014)</a>,{' '}
            <a className="underline" href="https://tribuneonlineng.com/nexim-bank-export-stimulation-fund-sme-guide/" target="_blank" rel="noreferrer">NEXIM timelines</a>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
