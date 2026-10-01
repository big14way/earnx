import { useState } from 'react';
import { ChainSwitcher } from '../components/ChainSwitcher';
import { InvoiceCard } from '../components/InvoiceCard';
import { Metric, Skeleton } from '../components/ui';
import { useAccountSession } from '../hooks/useAccountSession';
import { useInvoices, useProtocolStats } from '../hooks/useInvoices';
import { chainMeta, tokensFor } from '../lib/chains';
import { money, plural } from '../lib/format';
import type { StatusName } from '../lib/invoice';

const FILTERS: { label: string; match: (s: StatusName) => boolean }[] = [
  { label: 'Open for funding', match: (s) => s === 'Funding' },
  { label: 'Funded', match: (s) => s === 'Funded' },
  { label: 'Repaid', match: (s) => s === 'Repaid' },
  { label: 'All', match: () => true },
];

export function Invest() {
  const { chainId } = useAccountSession();
  const { invoices, isLoading, error } = useInvoices(chainId);
  const stats = useProtocolStats(chainId);
  const [filter, setFilter] = useState(0);
  const shown = invoices.filter((i) => FILTERS[filter].match(i.status));
  const defaultRate =
    stats.fundedCount > 0n ? `${((Number(stats.defaultedCount) / Number(stats.fundedCount)) * 100).toFixed(1)}%` : '0%';

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink sm:text-5xl">Fund real trade</h1>
          <p className="mt-3 max-w-xl text-ink-soft">
            Each invoice is one shipment from an African exporter. You earn the APR when the buyer pays. No wallet needed
            to browse.
          </p>
        </div>
        <ChainSwitcher />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Funded" value={`$${money(stats.totalFunded)}`} hint={plural(stats.fundedCount, 'invoice')} />
        <Metric label="Repaid" value={`$${money(stats.totalRepaid)}`} hint={`${stats.repaidCount} in full`} />
        <Metric label="Default rate" value={defaultRate} hint={plural(stats.defaultedCount, 'default')} />
        <Metric label="Reserve" value={`$${money(stats.reserve, 6, { cents: true })}`} hint="first-loss cover" />
      </div>

      <div className="mt-10 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setFilter(i)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === i ? 'bg-ink text-paper' : 'border border-line bg-card text-ink-soft hover:border-ink'
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-60">{invoices.filter((x) => f.match(x.status)).length}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-56" />)}
        {!isLoading && shown.map((inv) => <InvoiceCard key={inv.id.toString()} invoice={inv} />)}
      </div>
      {!isLoading && shown.length === 0 && (
        <p className="mt-6 rounded-3xl border border-dashed border-line p-10 text-center text-muted">
          {error ? 'Could not reach the network. Try again in a moment.' : 'No invoices in this view yet.'}
        </p>
      )}

      <aside className="mt-12 rounded-3xl border border-line bg-card p-6">
        <div className="font-semibold text-ink">Need test tokens to try it?</div>
        <p className="mt-1 text-sm text-muted">
          You need a little testnet ETH for gas on {chainMeta[chainId].short} (or sign in with a passkey, gas is
          sponsored) and a test stablecoin to invest.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
          <a className="rounded-full border border-line px-4 py-2 hover:border-ink" href={chainMeta[chainId].faucet} target="_blank" rel="noreferrer">
            Testnet ETH faucet ↗
          </a>
          {tokensFor(chainId).map((t) => (
            <a key={t.address} className="rounded-full border border-line px-4 py-2 hover:border-ink" href={t.faucet} target="_blank" rel="noreferrer">
              {t.symbol} faucet ↗
            </a>
          ))}
        </div>
      </aside>
    </div>
  );
}
