import { useReadContract, useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { protocolAbi } from '../abi/earnx';
import { contractsFor, supportedChains, type SupportedChainId } from '../lib/chains';
import { toInvoice, type Invoice } from '../lib/invoice';

const PAGE = 200n;

/** Every invoice on one chain, read in a single call through getInvoices. */
export function useInvoices(chainId: SupportedChainId) {
  const { protocol } = contractsFor(chainId);
  const q = useReadContract({
    address: protocol,
    abi: protocolAbi,
    functionName: 'getInvoices',
    args: [1n, PAGE],
    chainId,
    query: { refetchInterval: 15_000 },
  });
  const invoices: Invoice[] = (q.data ?? []).map((raw) => toInvoice(chainId, raw as never)).reverse();
  return { invoices, isLoading: q.isLoading, error: q.error, refetch: q.refetch };
}

export function useInvoice(chainId: SupportedChainId, id: bigint) {
  const q = useReadContract({
    address: contractsFor(chainId).protocol,
    abi: protocolAbi,
    functionName: 'getInvoice',
    args: [id],
    chainId,
    query: { refetchInterval: 10_000 },
  });
  return { invoice: q.data ? toInvoice(chainId, q.data as never) : undefined, isLoading: q.isLoading, error: q.error };
}

/** Headline numbers for one chain, straight from the protocol's counters. */
export function useProtocolStats(chainId: SupportedChainId) {
  const { protocol, tokens } = contractsFor(chainId);
  const base = { address: protocol, abi: protocolAbi, chainId } as const;
  const counters = useReadContracts({
    contracts: [
      { ...base, functionName: 'invoiceCount' },
      { ...base, functionName: 'fundedCount' },
      { ...base, functionName: 'repaidCount' },
      { ...base, functionName: 'defaultedCount' },
    ],
    query: { refetchInterval: 20_000 },
  });
  const totals = useReadContracts({
    contracts: tokens.flatMap((t) => [
      { ...base, functionName: 'totalFunded', args: [t] } as const,
      { ...base, functionName: 'totalRepaid', args: [t] } as const,
      { ...base, functionName: 'reserves', args: [t] } as const,
    ]),
    query: { refetchInterval: 20_000 },
  });
  const r = (i: number) => (counters.data?.[i]?.result as bigint | undefined) ?? 0n;
  const t = (i: number) => (totals.data?.[i]?.result as bigint | undefined) ?? 0n;
  let totalFunded = 0n;
  let totalRepaid = 0n;
  let reserve = 0n;
  tokens.forEach((_, i) => {
    // All supported stablecoins use 6 decimals and track the US dollar, so they can be summed.
    totalFunded += t(i * 3);
    totalRepaid += t(i * 3 + 1);
    reserve += t(i * 3 + 2);
  });
  return {
    isLoading: counters.isLoading,
    invoiceCount: r(0),
    fundedCount: r(1),
    repaidCount: r(2),
    defaultedCount: r(3),
    totalFunded,
    totalRepaid,
    reserve,
  };
}

/** Invoices across both chains, newest first. */
export function useAllInvoices() {
  const a = useInvoices(supportedChains[0].id);
  const b = useInvoices(supportedChains[1].id);
  return {
    invoices: [...a.invoices, ...b.invoices].sort((x, y) => y.submittedAt - x.submittedAt),
    isLoading: a.isLoading || b.isLoading,
  };
}

export function usePosition(chainId: SupportedChainId, id: bigint, investor?: Address) {
  const { protocol } = contractsFor(chainId);
  const base = { address: protocol, abi: protocolAbi, chainId } as const;
  const q = useReadContracts({
    contracts: investor
      ? [
          { ...base, functionName: 'positionOf', args: [id, investor] },
          { ...base, functionName: 'claimable', args: [id, investor] },
          { ...base, functionName: 'claimedOf', args: [id, investor] },
        ]
      : [],
    query: { enabled: Boolean(investor), refetchInterval: 10_000 },
  });
  return {
    position: (q.data?.[0]?.result as bigint | undefined) ?? 0n,
    claimable: (q.data?.[1]?.result as bigint | undefined) ?? 0n,
    claimed: (q.data?.[2]?.result as bigint | undefined) ?? 0n,
  };
}
