import { Link, useParams } from 'react-router';
import { isAddress, type Address } from 'viem';
import { NftPreview } from '../components/NftPreview';
import { Metric, StatusBadge } from '../components/ui';
import { Reveal, Stagger } from '../components/motion';
import { useInvoices } from '../hooks/useInvoices';
import { useTitle } from '../hooks/useTitle';
import { chainMeta, explorerUrl, isSupportedChain, tokenInfo, type SupportedChainId } from '../lib/chains';
import { date, money, shortAddress } from '../lib/format';

/** An exporter's on-chain trade record: every verified invoice and how it ended. */
export function ExporterProfile() {
  const { chainId: c, address } = useParams();
  const chainId = Number(c);
  if (!isSupportedChain(chainId) || !address || !isAddress(address)) {
    return <p className="mx-auto max-w-6xl px-6 py-20 text-muted">This exporter link is not valid.</p>;
  }
  return <Profile chainId={chainId} address={address} />;
}

function Profile({ chainId, address }: { chainId: SupportedChainId; address: Address }) {
  const { invoices, isLoading } = useInvoices(chainId);
  useTitle(`Exporter ${shortAddress(address)}`);
  const mine = invoices.filter((i) => i.supplier.toLowerCase() === address.toLowerCase());
  const verified = mine.filter((i) => !['Submitted', 'Rejected'].includes(i.status));
  const repaid = mine.filter((i) => i.status === 'Repaid');
  const defaulted = mine.filter((i) => i.status === 'Defaulted');
  const financed = mine.reduce((n, i) => n + i.funded, 0n);
  const records = verified.filter((i) => i.status !== 'Cancelled');

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Reveal>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">Exporter trade record · {chainMeta[chainId].short}</div>
        <h1 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">
          <a href={explorerUrl(chainId, 'address', address)} target="_blank" rel="noreferrer" className="hover:underline">{shortAddress(address)}</a>
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Every invoice this exporter has had verified is recorded on-chain as a non-transferable token. Repaid invoices
          build the history banks ask for, and nobody can buy, sell or fake it.
        </p>
      </Reveal>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Verified invoices" value={verified.length} />
        <Metric label="Repaid in full" value={repaid.length} />
        <Metric label="Defaults" value={defaulted.length} />
        <Metric label="Financed" value={`$${money(financed, 6, { cents: true })}`} />
      </div>

      <h2 className="mt-14 font-display text-2xl font-semibold text-ink">Trade record tokens</h2>
      {isLoading ? (
        <p className="mt-4 text-muted">Loading…</p>
      ) : records.length === 0 ? (
        <p className="mt-4 rounded-3xl border border-dashed border-line p-10 text-center text-muted">No verified invoices yet.</p>
      ) : (
        <Stagger className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((inv) => (
            <Link key={inv.id.toString()} to={`/invoice/${chainId}/${inv.id}`} className="block transition hover:-translate-y-1">
              <NftPreview chainId={chainId} id={inv.id} />
            </Link>
          ))}
        </Stagger>
      )}

      {mine.length > 0 && (
        <>
          <h2 className="mt-14 font-display text-2xl font-semibold text-ink">All invoices</h2>
          <div className="mt-4 overflow-x-auto rounded-3xl border border-line bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr><th className="px-5 py-3 font-medium">Invoice</th><th className="px-5 py-3 font-medium">Amount</th><th className="px-5 py-3 font-medium">Due</th><th className="px-5 py-3 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mine.map((inv) => {
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
        </>
      )}
    </div>
  );
}
