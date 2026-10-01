import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { readContract } from 'wagmi/actions';
import { useConfig } from 'wagmi';
import { parseUnits, type Address, type Hex } from 'viem';
import { protocolAbi } from '../abi/earnx';
import { ChainSwitcher } from '../components/ChainSwitcher';
import { InvoiceCard } from '../components/InvoiceCard';
import { Button, Card, SectionTitle, TxStatus } from '../components/ui';
import { useAccountSession } from '../hooks/useAccountSession';
import { protocolCall, readableError, useEarnXWrite } from '../hooks/useEarnXWrite';
import { useInvoices } from '../hooks/useInvoices';
import { chainMeta, contractsFor, explorerUrl, tokensFor } from '../lib/chains';
import { passkeysEnabled } from '../lib/passkey';
import { percentFromBps } from '../lib/format';

const AFRICAN_COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', "Cote d'Ivoire", 'South Africa', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda',
  'Senegal', 'Cameroon', 'Egypt', 'Morocco', 'Zambia', 'Malawi', 'Burkina Faso', 'Mali', 'Benin', 'Togo',
];

type Verdict =
  | { status: 'verified'; riskScore: number; aprBps: number; advanceBps: number; checks: Check[]; factors: string[]; txHash: Hex }
  | { status: 'rejected'; reason: string; checks: Check[]; txHash: Hex }
  | { status: 'skipped'; reason: string }
  | { error: string };
type Check = { ok: boolean; label: string };

export function Exporters() {
  const { address, chainId } = useAccountSession();
  const { invoices } = useInvoices(chainId);
  const mine = address ? invoices.filter((i) => i.supplier.toLowerCase() === address.toLowerCase()) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionTitle eyebrow="For exporters" title="Get paid for the shipment you already made.">
            Upload the invoice and shipping documents. Once verified, investors fund it and up to 90% of the invoice lands in
            your account the moment it is fully funded. You repay when your buyer pays you.
          </SectionTitle>
          <ul className="mt-8 space-y-3 text-sm text-ink-soft">
            <li>• No bank account, wallet app or crypto needed: sign in with your fingerprint or Face ID.</li>
            <li>• Network fees are covered for you.</li>
            <li>• Every repaid invoice adds to a trade record that belongs to you.</li>
          </ul>
          <div className="mt-8 flex items-center gap-3 text-sm text-muted">
            Network: <ChainSwitcher />
          </div>
        </div>
        <div>{address ? <SubmitForm /> : <SignIn />}</div>
      </div>

      {mine.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold">Your invoices on {chainMeta[chainId].short}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mine.map((inv) => <InvoiceCard key={inv.id.toString()} invoice={inv} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function SignIn() {
  const { startPasskey } = useAccountSession();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'register' | 'login'>();
  const [error, setError] = useState('');

  async function go(mode: 'register' | 'login') {
    setBusy(mode);
    setError('');
    try {
      await startPasskey(mode, name.trim() || 'EarnX exporter');
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h3 className="font-display text-2xl font-semibold">Start in under a minute</h3>
      {passkeysEnabled && (
        <>
          <p className="mt-2 text-sm text-muted">Create an account secured by your phone or laptop's fingerprint or Face ID.</p>
          <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="pk-name">Your business name</label>
          <input
            id="pk-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ada's Foods Ltd"
            className="mt-1 w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-ink"
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button onClick={() => go('register')} disabled={Boolean(busy)}>
              {busy === 'register' ? 'Creating…' : 'Create account with passkey'}
            </Button>
            <Button variant="ghost" onClick={() => go('login')} disabled={Boolean(busy)}>
              {busy === 'login' ? 'Signing in…' : 'I already have one'}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-clay">{error}</p>}
          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <ConnectButton label="Connect a crypto wallet" showBalance={false} />
    </Card>
  );
}

function SubmitForm() {
  const config = useConfig();
  const { address, chainId, kind } = useAccountSession();
  const tokens = tokensFor(chainId);
  const tx = useEarnXWrite();
  const [step, setStep] = useState<'form' | 'uploading' | 'submitting' | 'verifying' | 'done'>('form');
  const [error, setError] = useState('');
  const [verdict, setVerdict] = useState<Verdict>();
  const [invoiceId, setInvoiceId] = useState<bigint>();
  const minDate = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    setError('');
    setVerdict(undefined);
    try {
      if (files.length === 0) throw new Error('Attach your invoice and shipping documents.');
      setStep('uploading');
      const upload = new FormData();
      files.forEach((f) => upload.append('files', f));
      const res = await fetch('/api/upload', { method: 'POST', body: upload });
      const docs = (await res.json()) as { cid?: string; docsHash?: Hex; error?: string };
      if (!res.ok || !docs.cid || !docs.docsHash) throw new Error(docs.error ?? 'Upload failed.');

      setStep('submitting');
      const token = tokens.find((t) => t.address === form.get('token')) ?? tokens[0];
      const due = Math.floor(new Date(String(form.get('due'))).getTime() / 1000) + 12 * 3600;
      await tx.run(chainId, [
        protocolCall(chainId, 'submitInvoice', [{
          token: token.address,
          faceValue: parseUnits(String(form.get('amount')), token.decimals),
          dueDate: due,
          buyer: String(form.get('buyer')).trim(),
          commodity: String(form.get('commodity')).trim(),
          origin: String(form.get('origin')),
          destination: String(form.get('destination')).trim(),
          docsCID: docs.cid,
          docsHash: docs.docsHash,
        }]),
      ], 'Submitting your invoice');

      const ids = await readContract(config, {
        address: contractsFor(chainId).protocol,
        abi: protocolAbi,
        functionName: 'getSupplierInvoices',
        args: [address as Address],
        chainId,
      });
      const id = ids[ids.length - 1];
      setInvoiceId(id);

      setStep('verifying');
      const v = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chainId, invoiceId: id.toString() }),
      });
      setVerdict((await v.json()) as Verdict);
      setStep('done');
    } catch (err) {
      setError(readableError(err) === 'Something went wrong. Please try again.' ? (err as Error).message : readableError(err));
      setStep('form');
    }
  }

  if (step === 'done' && invoiceId !== undefined) {
    return <Result verdict={verdict} chainId={chainId} id={invoiceId} onAnother={() => setStep('form')} />;
  }

  const busy = step !== 'form';
  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="What did you ship?" className="sm:col-span-2">
          <input name="commodity" required maxLength={60} placeholder="e.g. Shea butter, 12 tonnes" className={inputCls} />
        </Field>
        <Field label="From">
          <select name="origin" required className={inputCls} defaultValue="Nigeria">
            {AFRICAN_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="To (country)">
          <input name="destination" required maxLength={40} placeholder="e.g. Ghana" className={inputCls} />
        </Field>
        <Field label="Buyer" className="sm:col-span-2">
          <input name="buyer" required maxLength={80} placeholder="Company name and city" className={inputCls} />
        </Field>
        <Field label="Invoice amount">
          <input name="amount" required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" placeholder="25000" className={inputCls} />
        </Field>
        <Field label="Paid out in">
          <select name="token" className={inputCls}>
            {tokens.map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
          </select>
        </Field>
        <Field label="Buyer pays by" className="sm:col-span-2">
          <input name="due" type="date" required min={minDate} max={maxDate} className={inputCls} />
        </Field>
        <Field label="Invoice and shipping documents (PDF or photos, up to 4 MB)" className="sm:col-span-2">
          <input name="files" type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="text-sm" />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full" disabled={busy}>
            {{ form: 'Submit for financing', uploading: 'Uploading documents to IPFS…', submitting: 'Recording on-chain…', verifying: 'Running the pre-screen…', done: '' }[step]}
          </Button>
          {kind === 'passkey' && <p className="mt-2 text-center text-xs text-muted">Network fees are sponsored. You'll confirm with your passkey.</p>}
          {error && <p className="mt-3 text-sm text-clay">{error}</p>}
          <TxStatus state={tx.state} chainId={chainId} />
        </div>
      </form>
    </Card>
  );
}

function Result({ verdict, chainId, id, onAnother }: { verdict?: Verdict; chainId: number; id: bigint; onAnother: () => void }) {
  const link = `/invoice/${chainId}/${id}`;
  if (!verdict || 'error' in verdict || verdict.status === 'skipped') {
    return (
      <Card className="p-6 sm:p-8">
        <h3 className="font-display text-2xl font-semibold">Invoice #{id.toString()} submitted</h3>
        <p className="mt-2 text-muted">It is on-chain and waiting for a verifier.</p>
        <Link to={link} className="mt-6 inline-block font-semibold text-leaf underline">Open the invoice</Link>
      </Card>
    );
  }
  const ok = verdict.status === 'verified';
  return (
    <Card className="p-6 sm:p-8">
      <div className={`text-xs font-semibold uppercase tracking-wider ${ok ? 'text-leaf' : 'text-clay'}`}>
        Automated pre-screen · {ok ? 'approved' : 'not approved'}
      </div>
      <h3 className="mt-2 font-display text-2xl font-semibold">
        {ok ? `Invoice #${id} is open for funding` : `Invoice #${id} needs another look`}
      </h3>
      {ok && (
        <p className="mt-2 text-ink-soft">
          Risk score {verdict.riskScore}/100. Investors earn {percentFromBps(verdict.aprBps)} APR and you receive{' '}
          {percentFromBps(verdict.advanceBps, 0)} of the invoice as soon as it is fully funded.
        </p>
      )}
      {!ok && <p className="mt-2 text-ink-soft">{verdict.reason}</p>}
      <ul className="mt-5 space-y-1.5 text-sm">
        {verdict.checks.map((c) => (
          <li key={c.label} className={c.ok ? 'text-ink' : 'text-clay'}>{c.ok ? '✓' : '✗'} {c.label}</li>
        ))}
        {ok && verdict.factors.map((f) => <li key={f} className="text-muted">· {f}</li>)}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        <Link to={link} className="rounded-full bg-ink px-5 py-2.5 text-paper">Open the invoice</Link>
        <a href={explorerUrl(chainId, 'tx', verdict.txHash)} target="_blank" rel="noreferrer" className="rounded-full border border-line px-5 py-2.5">
          Verifier transaction ↗
        </a>
        <button onClick={onAnother} className="px-2 text-muted underline">Submit another</button>
      </div>
    </Card>
  );
}

const inputCls = 'w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-ink';

function Field({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
