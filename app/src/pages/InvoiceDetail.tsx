import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useReadContract } from 'wagmi';
import { erc20Abi, parseUnits } from 'viem';
import { protocolAbi } from '../abi/earnx';
import { DocumentCheck } from '../components/DocumentCheck';
import { NftPreview } from '../components/NftPreview';
import { Button, Card, ProgressBar, Skeleton, StatusBadge, TxStatus } from '../components/ui';
import { useAccountSession } from '../hooks/useAccountSession';
import { protocolCall, useEarnXWrite } from '../hooks/useEarnXWrite';
import { useInvoice, usePosition } from '../hooks/useInvoices';
import { chainMeta, contractsFor, explorerUrl, isSupportedChain, tokenInfo, type SupportedChainId } from '../lib/chains';
import { countryFlag, date, money, percentFromBps, relativeDays, shortAddress } from '../lib/format';
import { expectedReturn, isSample, progress, tenorDays, type Invoice } from '../lib/invoice';

export function InvoiceDetail() {
  const params = useParams();
  const chainId = Number(params.chainId);
  if (!isSupportedChain(chainId) || !/^\d+$/.test(params.id ?? '')) {
    return <p className="mx-auto max-w-6xl px-6 py-20 text-muted">This invoice link is not valid.</p>;
  }
  return <InvoiceView chainId={chainId} id={BigInt(params.id!)} />;
}

function InvoiceView({ chainId, id }: { chainId: SupportedChainId; id: bigint }) {
  const { invoice, isLoading } = useInvoice(chainId, id);
  if (isLoading) return <div className="mx-auto max-w-6xl px-6 py-12"><Skeleton className="h-96" /></div>;
  if (!invoice) return <p className="mx-auto max-w-6xl px-6 py-20 text-muted">Invoice #{id.toString()} was not found.</p>;
  const token = tokenInfo(invoice.token);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link to="/invest" className="text-sm font-semibold text-muted hover:text-ink">← All invoices</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted">
            Invoice #{id.toString()} on {chainMeta[chainId].short}
            {isSample(invoice) && <span className="ml-2 rounded bg-line px-1.5 py-0.5 text-[10px] font-semibold uppercase">sample data</span>}
          </div>
          <h1 className="mt-1 font-display text-4xl font-semibold text-ink sm:text-5xl">{invoice.commodity}</h1>
          <div className="mt-2 text-lg text-ink-soft">
            {countryFlag(invoice.origin)} {invoice.origin} → {countryFlag(invoice.destination)} {invoice.destination}
          </div>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <dl className="tabular grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Term label="Invoice value" value={`${money(invoice.faceValue, token.decimals)} ${token.symbol}`} />
              <Term label="Investors earn" value={invoice.aprBps ? `${percentFromBps(invoice.aprBps)} APR` : 'After review'} accent />
              <Term label="Term" value={`${tenorDays(invoice)} days`} />
              <Term label="Advanced to exporter" value={invoice.advanceBps ? percentFromBps(invoice.advanceBps, 0) : '—'} />
              <Term label="Funding target" value={invoice.fundingTarget ? `${money(invoice.fundingTarget, token.decimals)} ${token.symbol}` : '—'} />
              <Term label="Buyer pays by" value={date(invoice.dueDate)} />
            </dl>
            {invoice.status !== 'Submitted' && invoice.status !== 'Rejected' && (
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-semibold">{progress(invoice).toFixed(0)}% funded</span>
                  <span className="tabular text-muted">
                    {money(invoice.funded, token.decimals, { cents: true })} of {money(invoice.fundingTarget, token.decimals)} {token.symbol}
                  </span>
                </div>
                <ProgressBar value={progress(invoice)} />
              </div>
            )}
            {invoice.riskScore > 0 && <RiskBar score={invoice.riskScore} />}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-ink">Timeline</h2>
            <Timeline invoice={invoice} />
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-ink">Documents</h2>
            <p className="mt-1 text-sm text-muted">
              The verifier reviewed the documents with this fingerprint. Anyone can check the file still matches it.
            </p>
            <div className="mt-4">
              <DocumentCheck docsHash={invoice.docsHash} docsCID={invoice.docsCID} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-ink">Parties and contracts</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Exporter"><AddressLink chainId={chainId} address={invoice.supplier} /></Row>
              <Row label="Buyer">{invoice.buyer}</Row>
              <Row label="Settlement">{token.name} ({token.symbol})</Row>
              <Row label="Protocol contract"><AddressLink chainId={chainId} address={contractsFor(chainId).protocol} /></Row>
            </dl>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <ActionPanel invoice={invoice} />
          {invoice.status !== 'Submitted' && invoice.status !== 'Rejected' && invoice.status !== 'Cancelled' && (
            <div>
              <NftPreview chainId={chainId} id={id} />
              <p className="mt-2 text-center text-xs text-muted">The exporter's non-transferable trade record for this invoice</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionPanel({ invoice }: { invoice: Invoice }) {
  const { address } = useAccountSession();
  const { position, claimable, claimed } = usePosition(invoice.chainId, invoice.id, address);
  const token = tokenInfo(invoice.token);
  const isExporter = address?.toLowerCase() === invoice.supplier.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const { data: grace } = useReadContract({
    address: contractsFor(invoice.chainId).protocol,
    abi: protocolAbi,
    functionName: 'gracePeriod',
    chainId: invoice.chainId,
  });

  return (
    <div className="space-y-4">
      {invoice.status === 'Submitted' && (
        <Card className="p-6">
          <div className="font-semibold">Being verified</div>
          <p className="mt-1 text-sm text-muted">A verifier is checking the documents and pricing the risk. It opens for funding once approved.</p>
          {isExporter && <CancelButton invoice={invoice} />}
        </Card>
      )}
      {invoice.status === 'Funding' && (now <= invoice.fundingDeadline ? <InvestPanel invoice={invoice} isExporter={isExporter} /> : <ExpiredPanel invoice={invoice} />)}
      {position > 0n && (
        <Card className="p-6">
          <div className="font-semibold">Your position</div>
          <dl className="tabular mt-3 space-y-2 text-sm">
            <Row label="Invested">{money(position, token.decimals, { cents: true })} {token.symbol}</Row>
            <Row label="Already claimed">{money(claimed, token.decimals, { cents: true })} {token.symbol}</Row>
            <Row label="Ready to claim"><span className="font-semibold text-leaf">{money(claimable, token.decimals, { cents: true })} {token.symbol}</span></Row>
          </dl>
          {claimable > 0n && <ClaimButton invoice={invoice} />}
        </Card>
      )}
      {(invoice.status === 'Funded' || invoice.status === 'Defaulted') && <RepayPanel invoice={invoice} />}
      {invoice.status === 'Funded' && grace !== undefined && now > invoice.dueDate + Number(grace) && <DefaultPanel invoice={invoice} />}
      {invoice.status === 'Repaid' && (
        <Card className="p-6">
          <div className="font-semibold">Repaid in full</div>
          <p className="mt-1 text-sm text-muted">
            The buyer paid {money(invoice.repaid, token.decimals, { cents: true })} {token.symbol}. Investors can claim their share at any time.
          </p>
        </Card>
      )}
    </div>
  );
}

function InvestPanel({ invoice, isExporter }: { invoice: Invoice; isExporter: boolean }) {
  const { address } = useAccountSession();
  const token = tokenInfo(invoice.token);
  const remaining = invoice.fundingTarget - invoice.funded;
  const [amount, setAmount] = useState('');
  const tx = useEarnXWrite();
  const { data: balance } = useReadContract({
    address: invoice.token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: invoice.chainId,
    query: { enabled: Boolean(address) },
  });
  let units = 0n;
  try {
    units = amount ? parseUnits(amount, token.decimals) : 0n;
  } catch {
    units = 0n;
  }
  const capped = units > remaining ? remaining : units;

  async function invest() {
    if (!address || capped === 0n) return;
    const calls = await tx.withApproval(invoice.chainId, invoice.token, address, capped,
      protocolCall(invoice.chainId, 'invest', [invoice.id, capped]));
    await tx.run(invoice.chainId, calls, 'Funding the invoice').catch(() => {});
  }

  return (
    <Card className="p-6">
      <div className="font-semibold">Fund this invoice</div>
      <p className="mt-1 text-sm text-muted">
        {money(remaining, token.decimals, { cents: true })} {token.symbol} still needed · closes {relativeDays(invoice.fundingDeadline)}
      </p>
      {isExporter ? (
        <p className="mt-4 rounded-2xl bg-gold-soft p-3 text-sm text-ink">This is your invoice, so you can't fund it yourself.</p>
      ) : (
        <>
          <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="amount">Amount</label>
          <div className="mt-1 flex items-center rounded-2xl border border-line bg-paper px-4 focus-within:border-ink">
            <input
              id="amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="tabular w-full bg-transparent py-3 text-xl font-semibold outline-none"
            />
            <span className="font-semibold text-muted">{token.symbol}</span>
          </div>
          {address && balance !== undefined && (
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>Balance: {money(balance, token.decimals, { cents: true })} {token.symbol}</span>
              {balance === 0n ? (
                <a className="font-semibold text-leaf underline" href={token.faucet} target="_blank" rel="noreferrer">Get test {token.symbol}</a>
              ) : (
                <button className="font-semibold text-leaf" onClick={() => setAmount(String(Number(balance < remaining ? balance : remaining) / 10 ** token.decimals))}>Max</button>
              )}
            </div>
          )}
          {capped > 0n && (
            <p className="tabular mt-4 rounded-2xl bg-leaf-soft p-3 text-sm text-ink">
              You get back about <b>{money(expectedReturn(invoice, capped), token.decimals, { cents: true })} {token.symbol}</b> when the buyer pays on {date(invoice.dueDate)}.
            </p>
          )}
          <Button className="mt-4 w-full" disabled={!address || capped === 0n || tx.state.status === 'pending'} onClick={invest}>
            {address ? 'Fund invoice' : 'Connect a wallet or passkey to fund'}
          </Button>
          <TxStatus state={tx.state} chainId={invoice.chainId} />
        </>
      )}
    </Card>
  );
}

function RepayPanel({ invoice }: { invoice: Invoice }) {
  const { address } = useAccountSession();
  const token = tokenInfo(invoice.token);
  const outstanding = invoice.repaymentDue - invoice.repaid;
  const tx = useEarnXWrite();
  if (outstanding <= 0n) return null;
  async function repay() {
    if (!address) return;
    const calls = await tx.withApproval(invoice.chainId, invoice.token, address, outstanding,
      protocolCall(invoice.chainId, 'repay', [invoice.id, outstanding]));
    await tx.run(invoice.chainId, calls, 'Repaying').catch(() => {});
  }
  return (
    <Card className="p-6">
      <div className="font-semibold">Repayment</div>
      <p className="tabular mt-1 text-sm text-muted">
        {money(outstanding, token.decimals, { cents: true })} {token.symbol} outstanding · due {date(invoice.dueDate)}. The buyer, the exporter or anyone else can pay it.
      </p>
      <Button variant="ghost" className="mt-4 w-full" disabled={!address || tx.state.status === 'pending'} onClick={repay}>
        Repay {money(outstanding, token.decimals, { cents: true })} {token.symbol}
      </Button>
      <TxStatus state={tx.state} chainId={invoice.chainId} />
    </Card>
  );
}

function ClaimButton({ invoice }: { invoice: Invoice }) {
  const tx = useEarnXWrite();
  return (
    <>
      <Button variant="secondary" className="mt-4 w-full" disabled={tx.state.status === 'pending'}
        onClick={() => tx.run(invoice.chainId, [protocolCall(invoice.chainId, 'claim', [invoice.id])], 'Claiming').catch(() => {})}>
        Claim
      </Button>
      <TxStatus state={tx.state} chainId={invoice.chainId} />
    </>
  );
}

function CancelButton({ invoice }: { invoice: Invoice }) {
  const tx = useEarnXWrite();
  return (
    <>
      <Button variant="ghost" className="mt-4 w-full" disabled={tx.state.status === 'pending'}
        onClick={() => tx.run(invoice.chainId, [protocolCall(invoice.chainId, 'cancelInvoice', [invoice.id])], 'Cancelling').catch(() => {})}>
        Withdraw invoice
      </Button>
      <TxStatus state={tx.state} chainId={invoice.chainId} />
    </>
  );
}

function ExpiredPanel({ invoice }: { invoice: Invoice }) {
  return (
    <Card className="p-6">
      <div className="font-semibold">Funding window closed</div>
      <p className="mt-1 text-sm text-muted">It didn't reach its target in time. Anyone can close it so investors get their money back.</p>
      <CancelButton invoice={invoice} />
    </Card>
  );
}

function DefaultPanel({ invoice }: { invoice: Invoice }) {
  const tx = useEarnXWrite();
  return (
    <Card className="border-clay/40 p-6">
      <div className="font-semibold text-clay">Past due</div>
      <p className="mt-1 text-sm text-muted">The grace period has ended. Marking it as defaulted releases the first-loss reserve to investors.</p>
      <Button variant="ghost" className="mt-4 w-full" disabled={tx.state.status === 'pending'}
        onClick={() => tx.run(invoice.chainId, [protocolCall(invoice.chainId, 'markDefault', [invoice.id])], 'Marking default').catch(() => {})}>
        Mark as defaulted
      </Button>
      <TxStatus state={tx.state} chainId={invoice.chainId} />
    </Card>
  );
}

function Timeline({ invoice }: { invoice: Invoice }) {
  const token = tokenInfo(invoice.token);
  const order = ['Submitted', 'Funding', 'Funded', 'Repaid'];
  const reached = (s: string) => order.indexOf(invoice.status) >= order.indexOf(s) && order.includes(invoice.status);
  const steps: { done: boolean; title: string; detail: string; tone?: 'bad' }[] = [
    { done: true, title: 'Submitted by the exporter', detail: date(invoice.submittedAt) },
    { done: reached('Funding'), title: 'Verified and priced', detail: invoice.riskScore ? `Risk ${invoice.riskScore}/100 · ${percentFromBps(invoice.aprBps)} APR` : 'Waiting for a verifier' },
    { done: reached('Funded') || invoice.status === 'Defaulted', title: 'Funded, exporter paid', detail: invoice.fundedAt ? `${date(invoice.fundedAt)} · ${money(invoice.funded, token.decimals, { cents: true })} ${token.symbol} raised` : 'When fully funded' },
    invoice.status === 'Defaulted'
      ? { done: true, tone: 'bad', title: 'Defaulted', detail: `Reserve covered ${money(invoice.reserveCover, token.decimals, { cents: true })} ${token.symbol}` }
      : { done: invoice.status === 'Repaid', title: 'Buyer repaid, investors claim', detail: invoice.status === 'Repaid' ? `${money(invoice.repaid, token.decimals, { cents: true })} ${token.symbol} repaid` : `Due ${date(invoice.dueDate)}` },
  ];
  if (invoice.status === 'Rejected' || invoice.status === 'Cancelled') {
    steps.splice(1, 3, { done: true, tone: 'bad', title: invoice.status, detail: invoice.status === 'Rejected' ? 'The verifier did not approve it' : 'Withdrawn before funding; investors can claim refunds' });
  }
  return (
    <ol className="mt-4 space-y-4">
      {steps.map((s) => (
        <li key={s.title} className="flex gap-3">
          <span className={`mt-1.5 h-3 w-3 flex-none rounded-full border-2 ${s.done ? (s.tone === 'bad' ? 'border-clay bg-clay' : 'border-leaf bg-leaf') : 'border-line bg-card'}`} />
          <div>
            <div className={`text-sm font-semibold ${s.done ? 'text-ink' : 'text-muted'}`}>{s.title}</div>
            <div className="text-xs text-muted">{s.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RiskBar({ score }: { score: number }) {
  const label = score <= 30 ? 'Lower risk' : score <= 50 ? 'Moderate risk' : 'Higher risk';
  return (
    <div className="mt-6">
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-semibold">Risk score {score}/100</span>
        <span className="text-muted">{label}</span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-leaf via-gold to-clay">
        <span className="absolute -top-1 h-4 w-1 rounded bg-ink" style={{ left: `${score}%` }} />
      </div>
    </div>
  );
}

function Term({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${accent ? 'text-leaf' : 'text-ink'}`}>{value}</dd>
    </div>
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

function AddressLink({ chainId, address }: { chainId: number; address: string }) {
  return (
    <a className="font-mono text-leaf underline" href={explorerUrl(chainId, 'address', address)} target="_blank" rel="noreferrer">
      {shortAddress(address)}
    </a>
  );
}
