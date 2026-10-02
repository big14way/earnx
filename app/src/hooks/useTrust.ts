import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { protocolAbi } from '../abi/earnx';
import { contractsFor, type SupportedChainId } from '../lib/chains';
import { VERIFIED_EXPORTER_ROLE, type BuyerConfirmation } from '../lib/trust';

/** Whether the exporter's business is in the on-chain registry (VERIFIED_EXPORTER_ROLE on the protocol). */
export function useExporterVerified(chainId: SupportedChainId, address?: Address) {
  const q = useReadContract({
    address: contractsFor(chainId).protocol,
    abi: protocolAbi,
    functionName: 'hasRole',
    args: address ? [VERIFIED_EXPORTER_ROLE, address] : undefined,
    chainId,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });
  return { verified: q.data === true, isLoading: q.isLoading };
}

/** The statement a buyer signs for one invoice, and their confirmation once it exists. */
export function useBuyerConfirmation(chainId: SupportedChainId, id: bigint) {
  return useQuery({
    queryKey: ['buyer-confirmation', chainId, id.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/confirm?chainId=${chainId}&invoiceId=${id}`);
      if (!res.ok) throw new Error('Could not load the buyer confirmation.');
      return (await res.json()) as { statement: string; status: number; confirmation: BuyerConfirmation | null };
    },
    refetchInterval: 20_000,
  });
}

/** Every buyer confirmation on a chain, keyed by invoice id. */
export function useConfirmations(chainId: SupportedChainId) {
  const q = useQuery({
    queryKey: ['buyer-confirmations', chainId],
    queryFn: async () => {
      const res = await fetch(`/api/confirm?chainId=${chainId}`);
      if (!res.ok) return {};
      return ((await res.json()) as { confirmations: Record<string, BuyerConfirmation> }).confirmations;
    },
    staleTime: 20_000,
  });
  return q.data ?? {};
}

/** Whether this exporter has a business verification request on file. */
export function useVerificationRequest(address?: Address) {
  return useQuery({
    queryKey: ['kyb-request', address],
    enabled: Boolean(address),
    queryFn: async () => {
      const res = await fetch(`/api/kyb?address=${address}`);
      if (!res.ok) return { requested: false, requestedAt: null };
      return (await res.json()) as { requested: boolean; requestedAt: string | null };
    },
  });
}

export function confirmLink(chainId: number, id: bigint) {
  return `${window.location.origin}/confirm/${chainId}/${id}`;
}
