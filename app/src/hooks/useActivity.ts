import { useQuery } from '@tanstack/react-query';
import { chainById, contractsFor, tokenInfo, type SupportedChainId } from '../lib/chains';
import { money, shortAddress } from '../lib/format';

type Param = { name: string; value: string };
type Log = {
  block_timestamp: string;
  transaction_hash: string;
  decoded?: { method_call: string; parameters: Param[] };
};

export type ActivityItem = { id: string; when: number; title: string; detail: string; tx: string; invoiceId?: bigint; tone: 'good' | 'neutral' | 'bad' };

/** Protocol events from the chain's Blockscout explorer (the contracts are verified, so logs come decoded). */
async function fetchLogs(chainId: SupportedChainId): Promise<Log[]> {
  const base = chainById(chainId)!.blockExplorers.default.url;
  const { protocol } = contractsFor(chainId);
  const logs: Log[] = [];
  let params = '';
  for (let page = 0; page < 6; page++) {
    const res = await fetch(`${base}/api/v2/addresses/${protocol}/logs${params}`);
    if (!res.ok) break;
    const data = (await res.json()) as { items: Log[]; next_page_params?: Record<string, string> | null };
    logs.push(...data.items);
    if (!data.next_page_params) break;
    params = '?' + new URLSearchParams(data.next_page_params).toString();
  }
  return logs;
}

function describe(log: Log, token: (id: bigint) => { symbol: string; decimals: number }): Omit<ActivityItem, 'id' | 'when' | 'tx'> | undefined {
  if (!log.decoded) return undefined;
  const name = log.decoded.method_call.split('(')[0];
  const p = Object.fromEntries(log.decoded.parameters.map((x) => [x.name, x.value]));
  const id = p.id !== undefined ? BigInt(p.id) : undefined;
  const t = id !== undefined ? token(id) : { symbol: 'USDG', decimals: 6 };
  const amt = (v?: string) => (v ? `${money(BigInt(v), t.decimals, { cents: true })} ${t.symbol}` : '');
  switch (name) {
    case 'InvoiceSubmitted': return { invoiceId: id, tone: 'neutral', title: `Invoice #${id} submitted`, detail: `by ${shortAddress(p.supplier)} · ${amt(p.faceValue)}` };
    case 'InvoiceVerified': return { invoiceId: id, tone: 'good', title: `Invoice #${id} verified`, detail: `risk ${p.riskScore}/100 · ${(Number(p.aprBps) / 100).toFixed(2)}% APR` };
    case 'InvoiceRejected': return { invoiceId: id, tone: 'bad', title: `Invoice #${id} rejected`, detail: p.reason };
    case 'InvoiceCancelled': return { invoiceId: id, tone: 'neutral', title: `Invoice #${id} withdrawn`, detail: `by ${shortAddress(p.by)}` };
    case 'Invested': return { invoiceId: id, tone: 'good', title: `${amt(p.amount)} invested in #${id}`, detail: `by ${shortAddress(p.investor)}` };
    case 'InvoiceFunded': return { invoiceId: id, tone: 'good', title: `Exporter paid ${amt(p.disbursed)}`, detail: `invoice #${id} fully funded · ${amt(p.fee)} to the reserve` };
    case 'RepaymentMade': return { invoiceId: id, tone: 'good', title: `${amt(p.amount)} repaid on #${id}`, detail: `by ${shortAddress(p.payer)}` };
    case 'InvoiceRepaid': return { invoiceId: id, tone: 'good', title: `Invoice #${id} repaid in full`, detail: 'investors can claim' };
    case 'InvoiceDefaulted': return { invoiceId: id, tone: 'bad', title: `Invoice #${id} defaulted`, detail: `reserve covered ${amt(p.reserveCover)}` };
    case 'Claimed': return { invoiceId: id, tone: 'good', title: `${amt(p.amount)} claimed from #${id}`, detail: `by ${shortAddress(p.investor)}` };
    case 'ReserveFunded': return { tone: 'good', title: 'First-loss reserve topped up', detail: `by ${shortAddress(p.from)}` };
    default: return undefined;
  }
}

export function useActivity(chainId: SupportedChainId, tokenOf: (id: bigint) => string | undefined) {
  return useQuery({
    queryKey: ['activity', chainId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const logs = await fetchLogs(chainId);
      const token = (id: bigint) => {
        const addr = tokenOf(id);
        return addr ? tokenInfo(addr as `0x${string}`) : { symbol: 'USDG', decimals: 6 };
      };
      return logs
        .map((log, i) => {
          const d = describe(log, token);
          return d && { ...d, id: `${log.transaction_hash}-${i}`, when: Date.parse(log.block_timestamp) / 1000, tx: log.transaction_hash };
        })
        .filter((x): x is ActivityItem => Boolean(x));
    },
  });
}
