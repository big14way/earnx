import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useAccountSession } from '../hooks/useAccountSession';
import { confirmLink, useBuyerConfirmation, useExporterVerified, useVerificationRequest } from '../hooks/useTrust';
import { explorerUrl, type SupportedChainId } from '../lib/chains';
import { shortAddress } from '../lib/format';
import { isSample, type Invoice } from '../lib/invoice';
import { AUTO_LIMIT_UNVERIFIED, AUTO_LIMIT_VERIFIED, BUYER_CONFIRMATION_ABOVE } from '../lib/trust';
import { Section } from './InvoiceSections';
import { Button, Card } from './ui';

const IPFS_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? 'https://gateway.pinata.cloud/ipfs/';
const usd = (units: bigint) => `$${(units / 1_000_000n).toLocaleString('en-US')}`;

/** The deal sheet's answer to "who stands behind this invoice?". */
export function TrustCard({ invoice }: { invoice: Invoice }) {
  const { address } = useAccountSession();
  const { verified } = useExporterVerified(invoice.chainId, invoice.supplier);
  const conf = useBuyerConfirmation(invoice.chainId, invoice.id);
  const confirmation = conf.data?.confirmation;
  const isExporter = address?.toLowerCase() === invoice.supplier.toLowerCase();
  const open = ['Submitted', 'Funding', 'Funded'].includes(invoice.status);

  if (isSample(invoice)) {
    // Seeded before these checks existed, with fictional parties: say so rather than show a verdict.
    return (
      <Section id="trust" title="Who stands behind it">
        <ul className="space-y-4 text-sm">
          <TrustRow ok={null} title="Sample invoice: the exporter and buyer are fictional">
            It was seeded to show the product. Real exporters verify their business to be approved above {usd(AUTO_LIMIT_UNVERIFIED)},
            and above {usd(BUYER_CONFIRMATION_ABOVE)} the buyer must sign that they owe the invoice and will pay the EarnX contract.
          </TrustRow>
        </ul>
      </Section>
    );
  }

  return (
    <Section id="trust" title="Who stands behind it">
      <ul className="space-y-4 text-sm">
        <TrustRow ok={verified} title={verified ? "Exporter's business is verified" : "Exporter's business not verified yet"}>
          {verified
            ? <>Checked against the business registry and recorded on-chain. Automated limit {usd(AUTO_LIMIT_VERIFIED)} per invoice.</>
            : <>Unverified exporters can only be approved automatically up to {usd(AUTO_LIMIT_UNVERIFIED)} per invoice.</>}
        </TrustRow>
        <TrustRow ok={Boolean(confirmation)} title={confirmation ? `Buyer confirmed: ${confirmation.buyerName}` : 'Buyer has not confirmed yet'}>
          {confirmation ? (
            <>
              Signed by <a className="font-mono text-leaf underline" href={explorerUrl(invoice.chainId, 'address', confirmation.signer)} target="_blank" rel="noreferrer">{shortAddress(confirmation.signer)}</a>{' '}
              on {new Date(confirmation.confirmedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}: they ordered the goods,
              the invoice is genuine, and they will pay the EarnX contract.{' '}
              <a className="text-leaf underline" href={`${IPFS_GATEWAY}${confirmation.cid}`} target="_blank" rel="noreferrer">Signed statement ↗</a>
            </>
          ) : (
            <>Required above {usd(BUYER_CONFIRMATION_ABOVE)}. The buyer signs a statement that they owe this invoice and will pay the EarnX contract.</>
          )}
        </TrustRow>
        <TrustRow ok={invoice.status !== 'Submitted' && invoice.status !== 'Rejected'} title="Documents fingerprinted on-chain">
          Their hash is on-chain, and the pre-screen refuses documents or invoice numbers already used on either chain.
        </TrustRow>
      </ul>
      {isExporter && open && !confirmation && <CopyLink label="Send your buyer this link to confirm" url={confirmLink(invoice.chainId, invoice.id)} />}
      {!isExporter && open && !confirmation && (
        <Link to={`/confirm/${invoice.chainId}/${invoice.id}`} className="mt-5 inline-block text-sm font-semibold text-leaf underline">Are you the buyer? Confirm this invoice</Link>
      )}
      {invoice.status === 'Submitted' && <RerunPrescreen chainId={invoice.chainId} id={invoice.id} />}
    </Section>
  );
}

function TrustRow({ ok, title, children }: { ok: boolean | null; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ok ? 'bg-leaf text-white' : ok === null ? 'bg-line text-muted' : 'bg-gold-soft text-gold'}`}>
        {ok ? '✓' : ok === null ? 'i' : '!'}
      </span>
      <div>
        <div className="font-semibold text-ink">{title}</div>
        <p className="mt-0.5 text-muted">{children}</p>
      </div>
    </li>
  );
}

export function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-5 rounded-2xl bg-gold-soft p-4 text-sm">
      <div className="font-semibold text-ink">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-paper px-3 py-2 text-xs text-ink">{url}</code>
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // clipboard can be blocked; the link is visible to copy by hand
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function RerunPrescreen({ chainId, id }: { chainId: SupportedChainId; id: bigint }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <div className="mt-5 border-t border-line pt-4 text-sm">
      <Button
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage('');
          try {
            const res = await fetch('/api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chainId, invoiceId: id.toString() }) });
            const out = (await res.json()) as { status?: string; reason?: string; error?: string };
            setMessage(out.status === 'verified' ? 'Approved: the invoice is open for funding.' : out.reason ?? out.error ?? 'Still in review.');
            await queryClient.invalidateQueries();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Running the pre-screen…' : 'Run the pre-screen again'}
      </Button>
      {message && <p className="mt-2 text-muted">{message}</p>}
    </div>
  );
}

/** Lets a signed-in exporter see their verification status and ask for a business check. */
export function BusinessVerification({ chainId, address }: { chainId: SupportedChainId; address: Address }) {
  const { verified } = useExporterVerified(chainId, address);
  const request = useVerificationRequest(address);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/kyb', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, ...Object.fromEntries(form.entries()) }),
      });
      const out = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? 'The request failed.');
      await request.refetch();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-8 p-6" >
      <div id="verify" className="scroll-mt-24 text-xs font-semibold uppercase tracking-wider text-leaf">Business verification</div>
      {verified ? (
        <p className="mt-2 text-sm text-ink-soft">✓ Your business is verified on-chain. The pre-screen can approve invoices up to {usd(AUTO_LIMIT_VERIFIED)}.</p>
      ) : request.data?.requested ? (
        <p className="mt-2 text-sm text-ink-soft">
          Request received{request.data.requestedAt ? ` on ${new Date(request.data.requestedAt).toLocaleDateString('en-GB')}` : ''}. We check your registration
          with the national registry, then record the result on-chain. Until then invoices up to {usd(AUTO_LIMIT_UNVERIFIED)} are approved automatically.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            Invoices up to {usd(AUTO_LIMIT_UNVERIFIED)} are approved without it. Verify your registered business to finance up to {usd(AUTO_LIMIT_VERIFIED)}.
            Your details are encrypted; only the reviewer can read them.
          </p>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <input name="businessName" required placeholder="Registered business name" className={inputCls} />
            <input name="country" required placeholder="Country of registration" defaultValue="Nigeria" className={inputCls} />
            <input name="registrationNumber" required placeholder="Registration number (e.g. CAC RC)" className={inputCls} />
            <input name="contact" required placeholder="Email or phone" className={inputCls} />
            <div>
              <Button type="submit" variant="ghost" disabled={busy}>{busy ? 'Sending…' : 'Request verification'}</Button>
              {error && <p className="mt-2 text-sm text-clay">{error}</p>}
            </div>
          </form>
        </>
      )}
    </Card>
  );
}

/** Small badge for an exporter's page. */
export function VerifiedBadge({ chainId, address }: { chainId: SupportedChainId; address: Address }) {
  const { verified, isLoading } = useExporterVerified(chainId, address);
  if (isLoading) return null;
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-leaf px-2.5 py-1 text-xs font-semibold text-white">✓ Business verified</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-semibold text-gold">Business not verified yet</span>
  );
}

const inputCls = 'w-full rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-ink';
