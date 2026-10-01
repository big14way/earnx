import { useTitle } from '../hooks/useTitle';
import { useState } from 'react';
import { Link } from 'react-router';
import { ChainSwitcher } from '../components/ChainSwitcher';
import { InvoiceCard } from '../components/InvoiceCard';
import { ActivityList } from '../components/InvoiceSections';
import { Metric, Skeleton, StatusBadge } from '../components/ui';
import { useAccountSession } from '../hooks/useAccountSession';
import { useActivity } from '../hooks/useActivity';
import { useInvoices, useProtocolStats } from '../hooks/useInvoices';
import { chainMeta, tokenInfo, tokensFor } from '../lib/chains';
import { date, money, plural } from '../lib/format';
import { tenorDays, type Invoice, type StatusName } from '../lib/invoice';

const FILTERS: { label: string; match: (s: StatusName) => boolean }[] = [
  { label: 'Open for funding', match: (s) => s === 'Funding' },
  { label: 'Funded', match: (s) => s === 'Funded' },
  { label: 'Repaid', match: (s) => s === 'Repaid' },
  { label: 'All', match: () => true },
];

const SORTS: { label: string; by: (a: Invoice, b: Invoice) => number }[] = [
  { label: 'Newest', by: (a, b) => b.submittedAt - a.submittedAt },
  { label: 'Highest APR', by: (a, b) => b.aprBps - a.aprBps },
  { label: 'Shortest term', by: (a, b) => tenorDays(a) - tenorDays(b) },
  { label: 'Largest', by: (a, b) => Number(b.faceValue - a.faceValue) },
];

const OUTCOME: Partial<Record<StatusName, true>> = { Repaid: true, Defaulted: true, Cancelled: true, Rejected: true };

export function Invest() {
  useTitle('Fund real trade');
  const { chainId } = useAccountSession();
  const { invoices, isLoading, error } = useInvoices(chainId);
  const stats = useProtocolStats(chainId);
  const activity = useActivity(chainId, (id) => invoices.find((i) => i.id === id)?.token);
  const [filter, setFilter] = useState(0);
  const [sort, setSort] = useState(0);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const shown = invoices.filter((i) => FILTERS[filter].match(i.status)).sort(SORTS[sort].by);
  const outcomes = invoices.filter((i) => i.status === 'Repaid' || i.status === 'Defaulted');
  const withdrawn = invoices.filter((i) => OUTCOME[i.status] && i.status !== 'Repaid' && i.status !== 'Defaulted');
  const closed = showWithdrawn ? [...outcomes, ...withdrawn] : outcomes;
  const defaultRate =
    stats.fundedCount > 0n ? `${((Number(stats.defaultedCount) / Number(stats.fundedCount)) * 100).toFixed(1)}%` : '0%';

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink sm:text-5xl">Fund real trade</h1>
          <p className="mt-3 max-w-xl text-ink-soft">
            Each invoice is one shipment from an African exporter. You earn the APR when the buyer pays. Invest from
            1 USDG; no wallet needed to browse.
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

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
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
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select value={sort} onChange={(e) => setSort(Number(e.target.value))} className="rounded-full border border-line bg-card px-3 py-2 font-semibold text-ink">
            {SORTS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          </select>
        </label>
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

      <div className="mt-14 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section>
          <h2 className="font-display text-2xl font-semibold text-ink">Track record</h2>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <p>Every invoice that ran to repayment or default on {chainMeta[chainId].short}.</p>
            {withdrawn.length > 0 && (
              <button onClick={() => setShowWithdrawn(!showWithdrawn)} className="font-semibold text-leaf underline">
                {showWithdrawn ? 'Hide' : 'Show'} withdrawn and rejected ({withdrawn.length})
              </button>
            )}
          </div>
          <div className="mt-4 overflow-x-auto rounded-3xl border border-line bg-card">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr><th className="px-5 py-3 font-medium">Invoice</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Due</th><th className="px-5 py-3 font-medium">Outcome</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {closed.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-muted">Nothing has closed yet.</td></tr>}
                {closed.map((inv) => {
                  const t = tokenInfo(inv.token);
                  return (
                    <tr key={inv.id.toString()}>
                      <td className="px-5 py-3"><Link className="font-semibold text-ink hover:underline" to={`/invoice/${chainId}/${inv.id}`}>#{inv.id.toString()} {inv.commodity}</Link></td>
                      <td className="tabular px-5 py-3">{money(inv.faceValue, t.decimals)} {t.symbol}</td>
                      <td className="px-5 py-3">{date(inv.dueDate)}</td>
                      <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl font-semibold text-ink">Live activity</h2>
          <p className="mt-1 text-sm text-muted">Straight from the contract's events.</p>
          <div className="mt-4 rounded-3xl border border-line bg-card p-5">
            {activity.isLoading ? <p className="text-sm text-muted">Loading events…</p> : (
              <ActivityList chainId={chainId} items={[...(activity.data ?? [])].sort((a, b) => b.when - a.when)} limit={10} />
            )}
          </div>
        </section>
      </div>

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
