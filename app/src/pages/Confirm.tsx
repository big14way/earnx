import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSignMessage } from 'wagmi';
import { Button, Card, Skeleton } from '../components/ui';
import { useAccountSession } from '../hooks/useAccountSession';
import { readableError } from '../hooks/useEarnXWrite';
import { useInvoice } from '../hooks/useInvoices';
import { useBuyerConfirmation } from '../hooks/useTrust';
import { useTitle } from '../hooks/useTitle';
import { chainMeta, isSupportedChain, tokenInfo, type SupportedChainId } from '../lib/chains';
import { countryFlag, date, money, shortAddress } from '../lib/format';
import { passkeysEnabled } from '../lib/passkeyConfig';
import { isSample } from '../lib/invoice';

const IPFS_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? 'https://gateway.pinata.cloud/ipfs/';

/** The page an exporter sends their buyer: read the invoice, sign that it is real and will be paid. */
export function Confirm() {
  const params = useParams();
  const chainId = Number(params.chainId);
  if (!isSupportedChain(chainId) || !/^\d+$/.test(params.id ?? '')) {
    return <p className="mx-auto max-w-6xl px-6 py-20 text-muted">This confirmation link is not valid.</p>;
  }
  return <ConfirmView chainId={chainId} id={BigInt(params.id!)} />;
}

function ConfirmView({ chainId, id }: { chainId: SupportedChainId; id: bigint }) {
  useTitle(`Confirm invoice #${id}`);
  const { invoice, isLoading } = useInvoice(chainId, id);
  const conf = useBuyerConfirmation(chainId, id);
  const { address, kind, passkey, startPasskey } = useAccountSession();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string>();
  const [step, setStep] = useState<'idle' | 'passkey' | 'signing' | 'saving' | 'verifying'>('idle');
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState('');

  if (isLoading || conf.isLoading) return <div className="mx-auto max-w-3xl px-6 py-12"><Skeleton className="h-96" /></div>;
  if (!invoice || !conf.data) return <p className="mx-auto max-w-3xl px-6 py-20 text-muted">Invoice #{id.toString()} was not found.</p>;

  const token = tokenInfo(invoice.token);
  const buyerName = name ?? invoice.buyer;
  const confirmation = conf.data.confirmation;
  const open = ['Submitted', 'Funding', 'Funded'].includes(invoice.status);
  const isExporter = address?.toLowerCase() === invoice.supplier.toLowerCase();

  async function signIn(mode: 'register' | 'login') {
    setError('');
    setStep('passkey');
    try {
      await startPasskey(mode, buyerName.trim() || 'EarnX buyer');
    } catch (e) {
      const { explainPasskeyError } = await import('../lib/passkey');
      setError(await explainPasskeyError(e));
    } finally {
      setStep('idle');
    }
  }

  async function confirm() {
    setError('');
    try {
      setStep('signing');
      const statement = conf.data!.statement;
      const signature = kind === 'passkey' && passkey
        ? await passkey.signMessage(chainId, statement)
        : await signMessageAsync({ message: statement });
      setStep('saving');
      const res = await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chainId, invoiceId: id.toString(), buyerName: buyerName.trim(), signer: address, signature }),
      });
      const out = (await res.json()) as { error?: string; confirmation?: unknown };
      if (!res.ok) throw new Error(out.error ?? 'The confirmation was not accepted.');
      // Show it straight away rather than waiting for the next fetch.
      queryClient.setQueryData(['buyer-confirmation', chainId, id.toString()], { ...conf.data!, confirmation: out.confirmation });
      if (invoice!.status === 'Submitted') {
        // A larger invoice waits for this signature: run the pre-screen again now that it exists.
        setStep('verifying');
        const v = await fetch('/api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chainId, invoiceId: id.toString() }) });
        const r = (await v.json()) as { status?: string; reason?: string };
        setOutcome(r.status === 'verified' ? 'The invoice passed the pre-screen and is now open for funding.' : r.reason ?? '');
      }
      void conf.refetch();
    } catch (e) {
      const msg = readableError(e);
      setError(msg === 'Something went wrong. Please try again.' ? (e as Error).message : msg);
    } finally {
      setStep('idle');
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">For buyers · {chainMeta[chainId].short}</div>
      <h1 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">Confirm invoice #{id.toString()}</h1>
      <p className="mt-3 text-lg text-ink-soft">
        Investors are paying your supplier now, before you pay. Your confirmation tells them the trade is real. Signing is free and moves no money.
      </p>

      <Card className="mt-8 p-6">
        <dl className="tabular grid grid-cols-2 gap-5 text-sm sm:grid-cols-3">
          <Fact label="Buyer" value={invoice.buyer} />
          <Fact label="Goods" value={`${invoice.commodity}`} />
          <Fact label="Route" value={`${countryFlag(invoice.origin)} ${invoice.origin} → ${countryFlag(invoice.destination)} ${invoice.destination}`} />
          <Fact label="Amount" value={`${money(invoice.faceValue, token.decimals, { cents: true })} ${token.symbol}`} />
          <Fact label="Due" value={date(invoice.dueDate)} />
          <Fact label="Exporter" value={shortAddress(invoice.supplier)} />
        </dl>
        <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">What you sign</div>
        <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-paper p-4 font-mono text-xs leading-relaxed text-ink">{conf.data.statement}</pre>
      </Card>

      <Card className="mt-6 p-6">
        {confirmation ? (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-leaf">Confirmed</div>
            <p className="mt-2 text-lg font-semibold text-ink">✓ {confirmation.buyerName} confirmed this invoice</p>
            <p className="mt-1 text-sm text-muted">
              Signed by <span className="font-mono">{shortAddress(confirmation.signer)}</span> on {new Date(confirmation.confirmedAt).toLocaleString('en-GB')}.{' '}
              <a className="text-leaf underline" href={`${IPFS_GATEWAY}${confirmation.cid}`} target="_blank" rel="noreferrer">Signed statement on IPFS ↗</a>
            </p>
            {outcome && <p className="mt-3 text-sm text-ink-soft">{outcome}</p>}
            <Link to={`/invoice/${chainId}/${id}`} className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">Open the invoice</Link>
          </div>
        ) : isSample(invoice) ? (
          <p className="text-ink-soft">This is a sample invoice with a fictional buyer, so there is nothing to confirm.</p>
        ) : !open ? (
          <p className="text-ink-soft">This invoice is no longer open, so there is nothing to confirm.</p>
        ) : !address ? (
          <div>
            <NameField value={buyerName} onChange={setName} />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {passkeysEnabled && (
                <>
                  <Button onClick={() => signIn('register')} disabled={step !== 'idle'}>{step === 'passkey' ? 'Opening passkey…' : 'Confirm with a passkey'}</Button>
                  <Button variant="ghost" onClick={() => signIn('login')} disabled={step !== 'idle'}>I already have a passkey</Button>
                </>
              )}
            </div>
            <div className="mt-4"><ConnectButton label="Use a crypto wallet" showBalance={false} /></div>
          </div>
        ) : isExporter ? (
          <p className="text-ink-soft">
            You're signed in as the exporter. Your buyer confirms from their own account: send them this page's link.
          </p>
        ) : (
          <div>
            <NameField value={buyerName} onChange={setName} />
            <Button className="mt-4 w-full" onClick={confirm} disabled={step !== 'idle' || buyerName.trim().length < 2}>
              {{ idle: 'Sign and confirm', passkey: 'Opening passkey…', signing: 'Waiting for your signature…', saving: 'Recording the signed statement…', verifying: 'Running the pre-screen…' }[step]}
            </Button>
            <p className="mt-2 text-center text-xs text-muted">
              Signing as {kind === 'passkey' ? `${passkey?.name} (passkey)` : 'your wallet'} · {shortAddress(address)}
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      </Card>
    </div>
  );
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Your company</span>
      <input id="buyer-name" value={value} maxLength={80} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-ink" />
    </label>
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
