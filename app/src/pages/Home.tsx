import { Link } from 'react-router';
import { InvoiceCard } from '../components/InvoiceCard';
import { Metric, SectionTitle, Skeleton } from '../components/ui';
import { NftPreview } from '../components/NftPreview';
import { founderStory } from '../content/story';
import { useAccountSession } from '../hooks/useAccountSession';
import { useInvoices, useProtocolStats } from '../hooks/useInvoices';
import { chainMeta } from '../lib/chains';
import { money, plural } from '../lib/format';

export function Home() {
  const { chainId } = useAccountSession();
  const { invoices, isLoading } = useInvoices(chainId);
  const stats = useProtocolStats(chainId);
  const open = invoices.filter((i) => i.status === 'Funding');
  const featured = open[0] ?? invoices[0];
  const repaid = invoices.find((i) => i.status === 'Repaid');

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-ink-soft">
            <span className="h-2 w-2 rounded-full bg-leaf" />
            Live on {chainMeta[chainId].short} testnet
          </div>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Get paid when you ship, not when your buyer pays.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            EarnX turns a verified export invoice into cash for an African exporter today. Investors anywhere fund it in
            USDG and earn the yield when the buyer pays.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/invest" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper hover:bg-ink-soft">
              Fund an invoice
            </Link>
            <Link
              to="/exporters"
              className="rounded-full border border-ink px-6 py-3 text-sm font-semibold text-ink hover:bg-ink hover:text-paper"
            >
              I'm an exporter
            </Link>
          </div>
        </div>
        <div>
          {isLoading || !featured ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="relative">
              <div className="absolute -inset-3 -z-10 rotate-2 rounded-[2rem] bg-lime/60" />
              <InvoiceCard invoice={featured} />
            </div>
          )}
          <p className="mt-3 text-center text-xs text-muted">Read live from the {chainMeta[chainId].short} contract</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Invoices" value={stats.invoiceCount.toString()} hint="submitted on-chain" />
          <Metric label="Paid to exporters" value={`$${money(stats.totalFunded)}`} hint={`${plural(stats.fundedCount, 'invoice')} funded`} />
          <Metric label="Repaid to investors" value={`$${money(stats.totalRepaid)}`} hint={`${stats.repaidCount} repaid in full`} />
          <Metric label="First-loss reserve" value={`$${money(stats.reserve, 6, { cents: true })}`} hint={`${plural(stats.defaultedCount, 'default')} so far`} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="The problem" title="Africa's exporters are profitable on paper and broke in practice.">
          A confirmed order is not cash. Exporters pay farmers, processors and freight up front, then wait for the buyer.
          Banks rarely lend against those invoices, so good orders get turned down or sold at a discount.
        </SectionTitle>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Fact
            value="$74–92B"
            text="of trade finance requested by African businesses went unmet in 2024."
            source="African Development Bank, 2025 Trade Finance in Africa report"
            href="https://www.gtreview.com/news/africa/africas-trade-finance-gap-tops-us74bn-as-banks-retreat-afdb-warns/"
          />
          <Fact
            value="37%"
            text="of trade finance applications from African firms were rejected (2020–2024)."
            source="African Development Bank"
            href="https://www.gtreview.com/news/africa/africas-trade-finance-gap-tops-us74bn-as-banks-retreat-afdb-warns/"
          />
          <Fact
            value="€50B → €240B"
            text="Africa's factoring market today, and what it needs to reach to close the SME gap."
            source="Afreximbank"
            href="https://www.gtreview.com/news/africa/factoring-volumes-must-reach-e240bn-to-close-sme-financing-gap-afreximbank-says/"
          />
        </div>
      </section>

      {founderStory && (
        <section className="bg-ink text-paper">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_1.2fr] md:items-center">
            {founderStory.photo && (
              <img src={founderStory.photo.src} alt={founderStory.photo.alt} className="w-full rounded-3xl object-cover" />
            )}
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-lime">{founderStory.eyebrow}</div>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">{founderStory.title}</h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-paper/85">
                {founderStory.paragraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
              <p className="mt-6 font-display text-lg italic text-lime">{founderStory.signature}</p>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="How it works" title="One invoice, four steps, all on-chain." />
        <ol className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            ['Submit', 'The exporter uploads the invoice and shipping documents. Their fingerprint goes on-chain, the files go to IPFS.'],
            ['Verify', 'A verifier checks the documents and prices the risk: a score, the APR investors earn and how much is advanced.'],
            ['Fund', 'Investors fund it in USDG or USDC. The moment it is fully funded, the exporter is paid in the same transaction.'],
            ['Repay', 'The buyer pays at the due date. Investors claim principal plus yield, in proportion to what they put in.'],
          ].map(([title, text], i) => (
            <li key={title} className="rounded-3xl border border-line bg-card p-6">
              <div className="font-display text-4xl font-semibold text-leaf">{i + 1}</div>
              <div className="mt-3 font-semibold text-ink">{title}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionTitle eyebrow="Built for trust" title="What stops this from going wrong.">
              On-chain lending to emerging markets has failed before when loans were long, unsecured and opaque. EarnX is
              designed around those failures.
            </SectionTitle>
            <ul className="mt-8 space-y-5">
              {[
                ['Short, self-liquidating', 'Each advance is tied to one shipment and repaid when that buyer pays: weeks or months, not years. Terms are capped at 365 days on-chain.'],
                ['First-loss reserve', '1% of every advance, plus capital from partners, covers investor principal before investors lose anything.'],
                ['Documents you can check', 'Every invoice carries the hash of the documents the verifier reviewed. Change one byte and it no longer matches.'],
                ['A trade record that stays', 'Each verified invoice mints a non-transferable record to the exporter, building the history banks ask for.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-4">
                  <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-leaf" />
                  <div>
                    <div className="font-semibold text-ink">{t}</div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-md">
            {repaid ? <NftPreview chainId={chainId} id={repaid.id} /> : <Skeleton className="aspect-[8/5]" />}
            <p className="mt-3 text-center text-xs text-muted">
              A real invoice record on {chainMeta[chainId].short}, rendered from the contract
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle eyebrow="Open now" title="Invoices waiting for funding" />
          <Link to="/invest" className="text-sm font-semibold text-leaf hover:underline">
            See all invoices →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)
            : open.slice(0, 3).map((inv) => <InvoiceCard key={inv.id.toString()} invoice={inv} />)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-3xl border border-line px-6 py-6 text-sm font-semibold text-muted">
          <span>Robinhood Chain</span>
          <span>Arbitrum</span>
          <span>Paxos USDG</span>
          <span>Circle USDC</span>
          <span>OpenZeppelin</span>
          <span>ZeroDev passkeys</span>
          <span>IPFS</span>
        </div>
      </section>
    </>
  );
}

function Fact({ value, text, source, href }: { value: string; text: string; source: string; href: string }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-6">
      <div className="tabular font-display text-4xl font-semibold text-ink">{value}</div>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{text}</p>
      <a href={href} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-muted underline">
        {source}
      </a>
    </div>
  );
}
