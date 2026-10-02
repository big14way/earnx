import { formatUnits, keccak256, toBytes, type Address, type Hex } from 'viem';

/**
 * The checks that decide how far an invoice can go without a human: who the exporter is, whether the
 * buyer has confirmed the debt, and whether the same trade was already financed. Shared by the
 * pre-screen (api/verify), the buyer confirmation endpoint (api/confirm) and the app.
 */

/** Granted on the protocol contract by the admin after a business check. The contract never reads it; the pre-screen does. */
export const VERIFIED_EXPORTER_ROLE = keccak256(toBytes('VERIFIED_EXPORTER_ROLE'));

/** The most the automated pre-screen approves on its own, in 6-decimal stablecoin units. */
export const AUTO_LIMIT_UNVERIFIED = 1_000n * 1_000_000n;
export const AUTO_LIMIT_VERIFIED = 250_000n * 1_000_000n;

/** Above this face value the buyer must confirm the invoice before it can open for funding. */
export const BUYER_CONFIRMATION_ABOVE = 1_000n * 1_000_000n;

export type StatementFacts = {
  chainId: number;
  chainName: string;
  protocol: Address;
  invoiceId: bigint;
  buyer: string;
  supplier: Address;
  commodity: string;
  origin: string;
  destination: string;
  faceValue: bigint;
  decimals: number;
  symbol: string;
  dueDate: number;
  docsHash: Hex;
};

/**
 * What the buyer signs. Built only from on-chain facts, so the server can rebuild it exactly and
 * nobody can get a signature on different terms.
 */
export function buyerStatement(f: StatementFacts) {
  const due = new Date(f.dueDate * 1000).toISOString().slice(0, 10);
  return [
    'EarnX buyer confirmation',
    '',
    `Invoice #${f.invoiceId} on ${f.chainName} (chain ${f.chainId})`,
    `Buyer: ${f.buyer}`,
    `Exporter account: ${f.supplier}`,
    `Goods: ${f.commodity}, ${f.origin} to ${f.destination}`,
    `Amount: ${formatUnits(f.faceValue, f.decimals)} ${f.symbol}`,
    `Due: ${due}`,
    `Documents: ${f.docsHash}`,
    '',
    'We confirm that we ordered these goods, that this invoice is genuine, and that we will pay it by the due date.',
    `What EarnX's investors are owed will be paid to the EarnX contract ${f.protocol} on ${f.chainName}.`,
  ].join('\n');
}

export type BuyerConfirmation = {
  chainId: number;
  invoiceId: string;
  buyerName: string;
  signer: Address;
  confirmedAt: string;
  cid: string;
};

/** "Bakery Supplier, Accra" and "bakery supplier accra" are the same buyer. */
export function normalizeParty(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function invoiceKey(chainId: number, invoiceId: bigint | string) {
  return `${chainId}:${invoiceId}`;
}
