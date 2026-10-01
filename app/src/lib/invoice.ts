import type { Address, Hex } from 'viem';
import type { SupportedChainId } from './chains';

export const STATUS = ['Submitted', 'Funding', 'Funded', 'Repaid', 'Defaulted', 'Rejected', 'Cancelled'] as const;
export type StatusName = (typeof STATUS)[number];

export type Invoice = {
  chainId: SupportedChainId;
  id: bigint;
  status: StatusName;
  riskScore: number;
  aprBps: number;
  advanceBps: number;
  submittedAt: number;
  dueDate: number;
  fundingDeadline: number;
  fundedAt: number;
  supplier: Address;
  token: Address;
  faceValue: bigint;
  fundingTarget: bigint;
  funded: bigint;
  repaymentDue: bigint;
  repaid: bigint;
  reserveCover: bigint;
  docsHash: Hex;
  docsCID: string;
  buyer: string;
  commodity: string;
  origin: string;
  destination: string;
};

type RawInvoice = {
  id: bigint;
  status: number;
  riskScore: number;
  aprBps: number;
  advanceBps: number;
  submittedAt: number;
  dueDate: number;
  fundingDeadline: number;
  fundedAt: number;
  supplier: Address;
  token: Address;
  faceValue: bigint;
  fundingTarget: bigint;
  funded: bigint;
  repaymentDue: bigint;
  repaid: bigint;
  reserveCover: bigint;
  docsHash: Hex;
  docsCID: string;
  buyer: string;
  commodity: string;
  origin: string;
  destination: string;
};

export function toInvoice(chainId: SupportedChainId, raw: RawInvoice): Invoice {
  return { ...raw, chainId, status: STATUS[raw.status] ?? 'Submitted' };
}

export const statusStyle: Record<StatusName, { label: string; className: string }> = {
  Submitted: { label: 'In review', className: 'bg-gold-soft text-gold' },
  Funding: { label: 'Open for funding', className: 'bg-leaf-soft text-leaf' },
  Funded: { label: 'Funded · awaiting repayment', className: 'bg-ink text-paper' },
  Repaid: { label: 'Repaid', className: 'bg-lime text-ink' },
  Defaulted: { label: 'Defaulted', className: 'bg-clay-soft text-clay' },
  Rejected: { label: 'Rejected', className: 'bg-clay-soft text-clay' },
  Cancelled: { label: 'Cancelled', className: 'bg-line text-muted' },
};

/** Share of the funding target raised so far, 0-100. */
export function progress(inv: Invoice) {
  if (inv.fundingTarget === 0n) return 0;
  return Number((inv.funded * 10_000n) / inv.fundingTarget) / 100;
}

export function tenorDays(inv: Invoice) {
  const start = inv.fundedAt || Math.floor(Date.now() / 1000);
  return Math.max(0, Math.round((inv.dueDate - start) / 86_400));
}

/** What `amount` invested now would return at the due date, at the invoice APR. */
export function expectedReturn(inv: Invoice, amount: bigint) {
  const seconds = BigInt(Math.max(0, inv.dueDate - Math.floor(Date.now() / 1000)));
  return amount + (amount * BigInt(inv.aprBps) * seconds) / (10_000n * 365n * 86_400n);
}

/** Demo invoices seeded from contracts/demo are labelled "Sample buyer: …" on-chain. */
export function isSample(inv: Invoice) {
  return inv.buyer.startsWith('Sample buyer');
}

export function key(inv: Pick<Invoice, 'chainId' | 'id'>) {
  return `${inv.chainId}-${inv.id}`;
}
