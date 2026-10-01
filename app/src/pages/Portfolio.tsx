import { useTitle } from '../hooks/useTitle';
import { Link } from 'react-router';
import { useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { protocolAbi } from '../abi/earnx';
import { Button, Card, Metric, StatusBadge, TxStatus } from '../components/ui';
import { useAccountSession } from '../hooks/useAccountSession';
import { protocolCall, useEarnXWrite } from '../hooks/useEarnXWrite';
import { useInvoices } from '../hooks/useInvoices';
import { chainMeta, contractsFor, supportedChains, tokenInfo, type SupportedChainId } from '../lib/chains';
import { money, percentFromBps } from '../lib/format';
import type { Invoice } from '../lib/invoice';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Portfolio() {
  useTitle('Your portfolio');
  const { address } = useAccountSession();
  if (!address) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-semibold">Your portfolio</h1>
        <p className="mt-3 text-muted">Connect a wallet or sign in with a passkey to see the invoices you funded.</p>
        <div className="mt-6 flex justify-center"><ConnectButton /></div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-semibold">Your portfolio</h1>
      <p className="mt-2 text-muted">Positions across both networks, read from the contracts.</p>
      {supportedChains.map((c) => <ChainPositions key={c.id} chainId={c.id} investor={address} />)}
    </div>
  );
}

function ChainPositions({ chainId, investor }: { chainId: SupportedChainId; investor: Address }) {
  const { invoices } = useInvoices(chainId);
  const { protocol } = contractsFor(chainId);
  const base = { address: protocol, abi: protocolAbi, chainId } as const;
  const { data } = useReadContracts({
    contracts: invoices.flatMap((inv) => [
      { ...base, functionName: 'positionOf', args: [inv.id, investor] } as const,
      { ...base, functionName: 'claimable', args: [inv.id, investor] } as const,
      { ...base, functionName: 'claimedOf', args: [inv.id, investor] } as const,
    ]),
    query: { enabled: invoices.length > 0, refetchInterval: 15_000 },
  });
  const rows = invoices
    .map((inv, i) => ({
      inv,
      position: (data?.[i * 3]?.result as bigint | undefined) ?? 0n,
      claimable: (data?.[i * 3 + 1]?.result as bigint | undefined) ?? 0n,
      claimed: (data?.[i * 3 + 2]?.result as bigint | undefined) ?? 0n,
    }))
    .filter((r) => r.position > 0n);

  const invested = rows.reduce((n, r) => n + r.position, 0n);
  const claimable = rows.reduce((n, r) => n + r.claimable, 0n);
  const claimed = rows.reduce((n, r) => n + r.claimed, 0n);

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold">{chainMeta[chainId].short}</h2>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Invested" value={`$${money(invested, 6, { cents: true })}`} />
        <Metric label="Ready to claim" value={`$${money(claimable, 6, { cents: true })}`} />
        <Metric label="Claimed" value={`$${money(claimed, 6, { cents: true })}`} />
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-3xl border border-dashed border-line p-8 text-center text-muted">
          No positions here yet. <Link to="/invest" className="font-semibold text-leaf underline">Browse invoices</Link>
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => <PositionRow key={r.inv.id.toString()} {...r} />)}
        </div>
      )}
    </section>
  );
}

function PositionRow({ inv, position, claimable }: { inv: Invoice; position: bigint; claimable: bigint }) {
  const token = tokenInfo(inv.token);
  const tx = useEarnXWrite();
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <Link to={`/invoice/${inv.chainId}/${inv.id}`} className="font-semibold hover:underline">
          #{inv.id.toString()} {inv.commodity}
        </Link>
        <div className="mt-1 text-sm text-muted">
          {inv.origin} → {inv.destination} · {percentFromBps(inv.aprBps)} APR
        </div>
      </div>
      <StatusBadge status={inv.status} />
      <div className="tabular text-right text-sm">
        <div>{money(position, token.decimals, { cents: true })} {token.symbol} invested</div>
        <div className="font-semibold text-leaf">{money(claimable, token.decimals, { cents: true })} {token.symbol} to claim</div>
      </div>
      {claimable > 0n && (
        <div>
          <Button variant="secondary" disabled={tx.state.status === 'pending'}
            onClick={() => tx.run(inv.chainId, [protocolCall(inv.chainId, 'claim', [inv.id])], 'Claiming').catch(() => {})}>
            Claim
          </Button>
          <TxStatus state={tx.state} chainId={inv.chainId} />
        </div>
      )}
    </Card>
  );
}
