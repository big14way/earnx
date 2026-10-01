import { Link } from 'react-router';
import { chainMeta, tokenInfo } from '../lib/chains';
import { countryFlag, money, percentFromBps, relativeDays } from '../lib/format';
import { isSample, progress, tenorDays, type Invoice } from '../lib/invoice';
import { ProgressBar, StatusBadge } from './ui';

export function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const token = tokenInfo(invoice.token);
  const pct = progress(invoice);
  return (
    <Link
      to={`/invoice/${invoice.chainId}/${invoice.id}`}
      className="group flex flex-col rounded-3xl border border-line bg-card p-5 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_12px_30px_-18px_rgba(16,35,26,0.5)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted">
            #{invoice.id.toString()} · {chainMeta[invoice.chainId].short}
            {isSample(invoice) && <span className="ml-1.5 rounded bg-line px-1.5 py-0.5 text-[10px] uppercase">sample</span>}
          </div>
          <h3 className="mt-1 font-display text-xl font-semibold leading-snug text-ink">{invoice.commodity}</h3>
          <div className="mt-0.5 text-sm text-muted">
            {countryFlag(invoice.origin)} {invoice.origin} → {countryFlag(invoice.destination)} {invoice.destination}
          </div>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <dl className="tabular mt-5 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Invoice</dt>
          <dd className="font-semibold">
            {money(invoice.faceValue, token.decimals, { compact: true })} {token.symbol}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Yield (APR)</dt>
          <dd className="font-semibold text-leaf">{invoice.aprBps ? percentFromBps(invoice.aprBps) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Term</dt>
          <dd className="font-semibold">{tenorDays(invoice)} days</dd>
        </div>
      </dl>

      {(invoice.status === 'Funding' || invoice.status === 'Funded') && (
        <div className="mt-5">
          <ProgressBar value={pct} />
          <div className="tabular mt-2 flex justify-between text-xs text-muted">
            <span>
              {money(invoice.funded, token.decimals)} / {money(invoice.fundingTarget, token.decimals)} {token.symbol}
            </span>
            <span>
              {invoice.status === 'Funding' ? `closes ${relativeDays(invoice.fundingDeadline)}` : `due ${relativeDays(invoice.dueDate)}`}
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}
