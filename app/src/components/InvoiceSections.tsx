import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import { protocolAbi } from '../abi/earnx';
import { useActivity } from '../hooks/useActivity';
import { useNaira } from '../hooks/useFx';
import { useInvoices } from '../hooks/useInvoices';
import { contractsFor, explorerUrl, tokenInfo, type SupportedChainId } from '../lib/chains';
import { date, money, percentFromBps, relativeDays, shortAddress } from '../lib/format';
import { benchmarkFor, compareToMarket, type Trade } from '../lib/market';
import { explain } from '../lib/pricing';
import { tenorDays, type Invoice } from '../lib/invoice';
import { IPFS_GATEWAY } from './DocumentCheck';
import { Card } from './ui';

const AFRICA = /nigeria|ghana|kenya|cote d'ivoire|côte d'ivoire|south africa|ethiopia|tanzania|uganda|rwanda|senegal|cameroon|egypt|morocco|zambia|malawi|burkina faso|mali|benin|togo/i;

export function Section({ id, title, children, aside }: { id: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
          {aside}
        </div>
        <div className="mt-4">{children}</div>
      </Card>
    </section>
  );
}

/** Principal, interest and total, like a deal sheet, with naira equivalents. */
export function DealOverview({ invoice, verifiedAt }: { invoice: Invoice; verifiedAt?: number }) {
  const t = tokenInfo(invoice.token);
  const naira = useNaira();
  const funded = invoice.status === 'Funded' || invoice.status === 'Repaid' || invoice.status === 'Defaulted';
  const principal = funded ? invoice.funded : invoice.fundingTarget;
  const start = invoice.fundedAt || Math.floor(Date.now() / 1000);
  const interest = funded
    ? invoice.repaymentDue - invoice.funded
    : (principal * BigInt(invoice.aprBps) * BigInt(Math.max(0, invoice.dueDate - start))) / (10_000n * 365n * 86_400n);
  const usd = (v: bigint) => Number(v) / 10 ** t.decimals;
  const box = (label: string, v: bigint, hint?: string) => (
    <div className="rounded-2xl border border-line p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1 font-display text-2xl font-semibold text-ink">{money(v, t.decimals, { cents: usd(v) < 1000 })} {t.symbol}</div>
      <div className="mt-0.5 text-xs text-muted">{hint ?? naira(usd(v))}</div>
    </div>
  );
  const highlights = [
    AFRICA.test(invoice.origin) && AFRICA.test(invoice.destination) && 'Intra-African trade (AfCFTA)',
    tenorDays(invoice) <= 90 && `Short term: ${tenorDays(invoice)} days`,
    invoice.docsCID ? 'Documents on IPFS, hash on-chain' : 'Documents hashed on-chain',
    verifiedAt !== undefined && 'Documents checked against the hash',
    'Exporter paid automatically when funded',
  ].filter(Boolean) as string[];
  return (
    <Section id="overview" title="Overview">
      <div className="grid gap-3 sm:grid-cols-3">
        {box(funded ? 'Principal advanced' : 'Principal (when funded)', principal)}
        {box(funded ? 'Interest to investors' : 'Interest to investors (est.)', interest)}
        {box('Total repayment', principal + interest)}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {highlights.map((h) => (
          <span key={h} className="rounded-full bg-leaf-soft px-3 py-1.5 text-xs font-semibold text-leaf">{h}</span>
        ))}
      </div>
    </Section>
  );
}

export function PricingCard({ invoice, verifiedAt }: { invoice: Invoice; verifiedAt?: number }) {
  const { riskEngine, riskEngineSinceInvoice } = contractsFor(invoice.chainId);
  if (!invoice.riskScore) return null;
  const engineInvoice = Boolean(riskEngine && riskEngineSinceInvoice !== undefined && invoice.id >= riskEngineSinceInvoice);
  const breakdown = engineInvoice
    ? explain(invoice.riskScore, invoice.aprBps, invoice.advanceBps, invoice.faceValue, invoice.dueDate, verifiedAt)
    : undefined;
  return (
    <Section
      id="pricing"
      title="How this invoice was priced"
      aside={engineInvoice && riskEngine ? (
        <a className="text-xs font-semibold text-leaf underline" href={explorerUrl(invoice.chainId, 'address', riskEngine)} target="_blank" rel="noreferrer">
          Rust risk engine ↗
        </a>
      ) : undefined}
    >
      {breakdown ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <Breakdown title="Investor APR" lines={breakdown.aprLines} total={breakdown.apr} />
          <Breakdown title="Advanced to the exporter" lines={breakdown.advanceLines} total={breakdown.advance} />
          <p className="text-xs leading-relaxed text-muted sm:col-span-2">
            The verifier only sets the risk score. The APR and advance were computed on-chain by a Stylus contract written
            in Rust from this published formula; nobody, including EarnX, can override it.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Risk score {invoice.riskScore}/100, {percentFromBps(invoice.aprBps)} APR, {percentFromBps(invoice.advanceBps, 0)} advance.
          {engineInvoice ? ' Set on-chain by the Rust risk engine.' : ' This invoice was priced by the verifier before the Rust risk engine went live.'}
        </p>
      )}
    </Section>
  );
}

function Breakdown({ title, lines, total }: { title: string; lines: { label: string; bps: number }[]; total: number }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      <dl className="tabular mt-2 space-y-1.5 text-sm">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3">
            <dt className="text-ink-soft">{l.label}</dt>
            <dd className={l.bps < 0 ? 'text-clay' : 'text-ink'}>{l.bps < 0 ? '−' : '+'}{percentFromBps(Math.abs(l.bps), 2)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
          <dt>Total</dt>
          <dd className="text-leaf">{percentFromBps(total, 2)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Compares the invoice's unit price (from its document manifest) with the World Bank benchmark. */
export function MarketCheckCard({ invoice }: { invoice: Invoice }) {
  const { data: trade, isLoading } = useQuery({
    queryKey: ['manifest', invoice.docsCID],
    enabled: Boolean(invoice.docsCID),
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch(IPFS_GATEWAY + invoice.docsCID);
      const m = (await res.json()) as { trade?: Trade };
      return m.trade ?? null;
    },
  });
  const benchmark = benchmarkFor(invoice.commodity, invoice.origin);
  const verdict = trade && benchmark ? compareToMarket(trade, benchmark) : undefined;
  const tone = verdict?.level === 'in-line' ? 'bg-leaf-soft text-leaf' : verdict?.level === 'far-above' ? 'bg-clay-soft text-clay' : 'bg-gold-soft text-gold';
  return (
    <Section id="market" title="Market price check">
      {!invoice.docsCID || (!isLoading && !trade) ? (
        <p className="text-sm text-muted">This invoice's documents don't list a quantity and unit price, so there is nothing to compare.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted">Reading the document manifest from IPFS…</p>
      ) : trade && (
        <div className="space-y-4 text-sm">
          <dl className="tabular grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label="Quantity" value={`${trade.quantity.toLocaleString('en-US')} ${trade.unit === 'kg' ? 'kg' : 't'}`} />
            <Fact label="Invoice price" value={`$${trade.unitPriceUsd.toLocaleString('en-US')}/${trade.unit === 'kg' ? 'kg' : 't'}`} />
            <Fact label="Market benchmark" value={benchmark ? `$${benchmark.usdPerTonne.toLocaleString('en-US')}/t` : '—'} />
            <Fact label="Terms" value={trade.incoterms ?? '—'} />
          </dl>
          {verdict && benchmark ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}>{verdict.label}</span>
              <span className="text-xs text-muted">World Bank {benchmark.name}, {benchmark.month.replace('M', '-')} monthly average</span>
            </div>
          ) : (
            <p className="text-xs text-muted">No public benchmark for {invoice.commodity.toLowerCase()} yet; the verifier relies on the documents.</p>
          )}
        </div>
      )}
    </Section>
  );
}

export function RepaymentTerms({ invoice, grace }: { invoice: Invoice; grace?: number }) {
  return (
    <Section id="repayment" title="Repayment terms">
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <Fact label="Structure" value="One repayment by the buyer" />
        <Fact label="Funding window closes" value={invoice.fundingDeadline ? date(invoice.fundingDeadline) : '—'} />
        <Fact label="Exporter paid" value={invoice.fundedAt ? date(invoice.fundedAt) : 'When fully funded'} />
        <Fact label="Buyer pays by" value={`${date(invoice.dueDate)} (${relativeDays(invoice.dueDate)})`} />
        <Fact label="Grace period" value={grace !== undefined ? `${Math.round(grace / 86_400)} days` : '—'} />
        <Fact label="Partial repayments" value="Accepted, claimable as they arrive" />
      </dl>
    </Section>
  );
}

export function RiskCard({ invoice }: { invoice: Invoice }) {
  const t = tokenInfo(invoice.token);
  const { data: reserve } = useReadContract({
    address: contractsFor(invoice.chainId).protocol,
    abi: protocolAbi,
    functionName: 'reserves',
    args: [invoice.token],
    chainId: invoice.chainId,
  });
  const principal = invoice.funded > 0n ? invoice.funded : invoice.fundingTarget;
  const coverage = reserve !== undefined && principal > 0n ? Math.min(100, (Number(reserve) / Number(principal)) * 100) : undefined;
  return (
    <Section id="risk" title="Risk and protections">
      <ul className="space-y-4 text-sm">
        <Item title="First-loss reserve">
          {reserve === undefined
            ? 'Loading…'
            : coverage !== undefined && coverage >= 1
              ? `${money(reserve, t.decimals, { cents: true })} ${t.symbol} today, enough to cover ${coverage.toFixed(0)}% of this invoice's principal.`
              : `The reserve is new: it holds ${money(reserve, t.decimals, { cents: true })} ${t.symbol} today, so on this testnet it would not yet cover a meaningful share of this invoice.`}{' '}
          It grows by 1% of every advance, partners can add first-loss capital, and it can only be used to repay investors after a default.
        </Item>
        <Item title="If the buyer doesn't pay">
          After the due date plus the grace period, anyone can mark the invoice as defaulted. The reserve covers principal
          first; money recovered later goes to investors, then refills the reserve.
        </Item>
        <Item title="What is not covered yet">
          On this testnet there is no legal assignment of the receivable and no buyer acknowledgement. In production those,
          plus credit insurance on larger invoices, sit behind the on-chain verification.
        </Item>
      </ul>
    </Section>
  );
}

export function ExporterCard({ invoice }: { invoice: Invoice }) {
  const { invoices } = useInvoices(invoice.chainId);
  const mine = invoices.filter((i) => i.supplier.toLowerCase() === invoice.supplier.toLowerCase());
  const repaid = mine.filter((i) => i.status === 'Repaid').length;
  const verified = mine.filter((i) => !['Submitted', 'Rejected'].includes(i.status)).length;
  return (
    <Section id="parties" title="Exporter and buyer">
      <dl className="space-y-3 text-sm">
        <Row label="Exporter">
          <Link className="font-mono text-leaf underline" to={`/exporter/${invoice.chainId}/${invoice.supplier}`}>{shortAddress(invoice.supplier)}</Link>
        </Row>
        <Row label="Trade record">{verified} verified · {repaid} repaid</Row>
        <Row label="Buyer">{invoice.buyer}</Row>
        <Row label="Settlement">{tokenInfo(invoice.token).name}</Row>
      </dl>
    </Section>
  );
}

export function ActivityCard({ invoice }: { invoice: Invoice }) {
  const { invoices } = useInvoices(invoice.chainId);
  const { data, isLoading } = useActivity(invoice.chainId, (id) => invoices.find((i) => i.id === id)?.token);
  const items = (data ?? []).filter((a) => a.invoiceId === invoice.id).sort((a, b) => b.when - a.when);
  return (
    <Section id="activity" title="On-chain activity">
      {isLoading ? <p className="text-sm text-muted">Loading events…</p> : <ActivityList chainId={invoice.chainId} items={items} />}
    </Section>
  );
}

export function ActivityList({ chainId, items, limit = 12 }: { chainId: SupportedChainId; items: { id: string; when: number; title: string; detail: string; tx: string; tone: string }[]; limit?: number }) {
  if (items.length === 0) return <p className="text-sm text-muted">No events yet.</p>;
  return (
    <ol className="space-y-3">
      {items.slice(0, limit).map((a) => (
        <li key={a.id} className="flex items-start gap-3 text-sm">
          <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${a.tone === 'good' ? 'bg-leaf' : a.tone === 'bad' ? 'bg-clay' : 'bg-muted'}`} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-ink">{a.title}</div>
            <div className="truncate text-xs text-muted">{a.detail}</div>
          </div>
          <a className="whitespace-nowrap text-xs text-leaf underline" href={explorerUrl(chainId, 'tx', a.tx)} target="_blank" rel="noreferrer">
            {relativeDays(a.when)}
          </a>
        </li>
      ))}
    </ol>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Item({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <div className="font-semibold text-ink">{title}</div>
      <p className="mt-1 leading-relaxed text-muted">{children}</p>
    </li>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}
