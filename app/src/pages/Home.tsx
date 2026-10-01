import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Globe } from '../components/Globe';
import { HeroBackground } from '../components/HeroBackground';
import { InvoiceCard } from '../components/InvoiceCard';
import { LiveTicker } from '../components/LiveTicker';
import { NftPreview } from '../components/NftPreview';
import { CountUp, Float, Reveal, Stagger, TiltCard, WordReveal } from '../components/motion';
import { Skeleton } from '../components/ui';
import { founderStory } from '../content/story';
import { useAccountSession } from '../hooks/useAccountSession';
import { useAllInvoices, useInvoices, useProtocolStats } from '../hooks/useInvoices';
import { chainMeta } from '../lib/chains';
import { money, plural } from '../lib/format';

const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

export function Home() {
  const { chainId } = useAccountSession();
  const { invoices, isLoading } = useInvoices(chainId);
  const all = useAllInvoices();
  const stats = useProtocolStats(chainId);
  const open = invoices.filter((i) => i.status === 'Funding');
  const featured = open[0] ?? invoices[0];
  const repaid = invoices.find((i) => i.status === 'Repaid');

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative -mt-[65px] overflow-hidden bg-[#0a160f] pt-[65px] text-paper">
        <HeroBackground />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 pb-24 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-paper/80"
            >
              <span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_12px_#c8f169]" />
              Live on {chainMeta[chainId].short} testnet · settled in USDG
            </motion.div>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.6rem]">
              <WordReveal text="Get paid when you ship," delay={0.1} />{' '}
              <WordReveal text="not when your buyer pays." delay={0.45} className="text-lime" />
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-paper/75"
            >
              EarnX turns a verified export invoice into cash for an African exporter today. Investors anywhere fund it in
              USDG and earn the yield when the buyer pays.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.05 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to="/invest"
                className="group inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold text-ink shadow-[0_10px_40px_-10px_rgba(200,241,105,0.7)] transition hover:-translate-y-0.5"
              >
                Fund an invoice <span className="transition group-hover:translate-x-1">→</span>
              </Link>
              <Link
                to="/exporters"
                className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-paper transition hover:bg-white/10"
              >
                I'm an exporter
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.8 }} className="mt-10 max-w-md">
              <LiveTicker invoices={all.invoices} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[560px]"
          >
            <div className="absolute inset-[12%] rounded-full bg-[#2f8f5f]/30 blur-3xl" />
            <Globe invoices={all.invoices} />
            {featured && (
              <Float className="relative mt-4 w-full sm:absolute sm:-bottom-4 sm:-left-6 sm:mt-0 sm:w-[78%] sm:max-w-sm" delay={0.5}>
                <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-1.5 shadow-2xl backdrop-blur-xl">
                  <InvoiceCard invoice={featured} />
                </div>
              </Float>
            )}
            <div className="absolute right-0 top-4 hidden rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-paper/70 backdrop-blur sm:block">
              <div className="flex items-center gap-2"><span className="h-1.5 w-4 rounded-full bg-lime" /> funded / repaid</div>
              <div className="mt-1 flex items-center gap-2"><span className="h-1.5 w-4 rounded-full bg-[#f5bd4a]" /> raising now</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Live numbers ---------------- */}
      <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-4 sm:px-6">
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4" gap={0.07}>
          {[
            { label: 'Invoices on-chain', value: Number(stats.invoiceCount), fmt: (n: number) => Math.round(n).toString(), hint: 'submitted and verified' },
            { label: 'Paid to exporters', value: Number(stats.totalFunded) / 1e6, fmt: usd, hint: `${plural(stats.fundedCount, 'invoice')} funded` },
            { label: 'Repaid to investors', value: Number(stats.totalRepaid) / 1e6, fmt: usd, hint: `${stats.repaidCount} repaid in full` },
            { label: 'First-loss reserve', value: Number(stats.reserve) / 1e6, fmt: (n: number) => `$${n.toFixed(2)}`, hint: `${plural(stats.defaultedCount, 'default')} so far` },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-line bg-card px-5 py-4 shadow-[0_20px_50px_-30px_rgba(16,35,26,0.5)]">
              <div className="text-xs font-medium uppercase tracking-wider text-muted">{m.label}</div>
              <div className="tabular mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">
                <CountUp value={m.value} format={m.fmt} />
              </div>
              <div className="mt-1 text-xs text-muted">{m.hint}</div>
            </div>
          ))}
        </Stagger>
      </section>

      {/* ---------------- Problem ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">The problem</div>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Africa's exporters are profitable on paper and broke in practice.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
            A confirmed order is not cash. Exporters pay farmers, processors and freight up front, then wait for the buyer.
            Banks rarely lend against those invoices, so good orders get turned down or sold at a discount.
          </p>
        </Reveal>
        <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { big: <>$<CountUp value={74} format={(n) => Math.round(n).toString()} />–92B</>, text: 'of trade finance requested by African businesses went unmet in 2024.', source: 'African Development Bank', href: 'https://www.gtreview.com/news/africa/africas-trade-finance-gap-tops-us74bn-as-banks-retreat-afdb-warns/' },
            { big: <><CountUp value={37} format={(n) => Math.round(n).toString()} />%</>, text: 'of trade finance applications from African firms were rejected (2020–2024).', source: 'African Development Bank', href: 'https://www.gtreview.com/news/africa/africas-trade-finance-gap-tops-us74bn-as-banks-retreat-afdb-warns/' },
            { big: <>€50B → €<CountUp value={240} format={(n) => Math.round(n).toString()} />B</>, text: "Africa's factoring market today, and what it must reach to close the SME gap.", source: 'Afreximbank', href: 'https://www.gtreview.com/news/africa/factoring-volumes-must-reach-e240bn-to-close-sme-financing-gap-afreximbank-says/' },
          ].map((f) => (
            <div key={f.source + f.text} className="h-full rounded-3xl border border-line bg-card p-7 transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-30px_rgba(16,35,26,0.45)]">
              <div className="tabular font-display text-5xl font-semibold text-ink">{f.big}</div>
              <p className="mt-4 leading-relaxed text-ink-soft">{f.text}</p>
              <a href={f.href} target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs text-muted underline">{f.source}</a>
            </div>
          ))}
        </Stagger>
      </section>

      {/* ---------------- Founder story (hidden until written) ---------------- */}
      {founderStory && (
        <section className="relative overflow-hidden bg-[#0a160f] text-paper">
          <div className="grain absolute inset-0" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            {founderStory.photo && (
              <Reveal>
                <img src={founderStory.photo.src} alt={founderStory.photo.alt} className="w-full rounded-3xl object-cover" />
              </Reveal>
            )}
            <Reveal delay={0.1} className={founderStory.photo ? '' : 'md:col-span-2 md:max-w-3xl'}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-lime">{founderStory.eyebrow}</div>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">{founderStory.title}</h2>
              <div className="mt-8 space-y-5 text-lg leading-relaxed text-paper/80">
                {founderStory.paragraphs.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
              </div>
              <p className="mt-8 font-display text-xl italic text-lime">{founderStory.signature}</p>
            </Reveal>
          </div>
        </section>
      )}

      {/* ---------------- How it works ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">How it works</div>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">One invoice, four steps, all on-chain.</h2>
        </Reveal>
        <div className="relative mt-14">
          <svg className="absolute left-0 right-0 top-9 hidden h-2 w-full md:block" viewBox="0 0 1000 8" preserveAspectRatio="none" aria-hidden>
            <motion.path
              d="M 60 4 L 940 4"
              stroke="#1f6b47"
              strokeWidth="2"
              strokeDasharray="6 8"
              fill="none"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
            />
          </svg>
          <Stagger className="relative grid gap-4 md:grid-cols-4" gap={0.18}>
            {[
              ['Submit', 'The exporter uploads the invoice and shipping documents. Their fingerprint goes on-chain, the files go to IPFS.'],
              ['Verify', 'A verifier checks the documents and prices the risk: a score, the APR investors earn and how much is advanced.'],
              ['Fund', 'Investors fund it in USDG or USDC. The moment it is fully funded, the exporter is paid in the same transaction.'],
              ['Repay', 'The buyer pays at the due date. Investors claim principal plus yield, in proportion to what they put in.'],
            ].map(([title, text], i) => (
              <div key={title} className="h-full rounded-3xl border border-line bg-card p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink font-display text-xl font-semibold text-lime">{i + 1}</div>
                <div className="mt-5 text-lg font-semibold text-ink">{title}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------------- Trust ---------------- */}
      <section className="relative overflow-hidden border-y border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <Reveal>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">Built for trust</div>
              <h2 className="mt-2 font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">What stops this from going wrong.</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                On-chain lending to emerging markets has failed before when loans were long, unsecured and opaque. EarnX is
                designed around those failures.
              </p>
            </Reveal>
            <Stagger className="mt-10 space-y-6" gap={0.1}>
              {[
                ['Short, self-liquidating', 'Each advance is tied to one shipment and repaid when that buyer pays: weeks or months, not years. Terms are capped at 365 days on-chain.'],
                ['First-loss reserve', '1% of every advance, plus capital from partners, covers investor principal before investors lose anything.'],
                ['Documents you can check', 'Every invoice carries the hash of the documents the verifier reviewed. Change one byte and it no longer matches.'],
                ['A trade record that stays', 'Each verified invoice mints a non-transferable record to the exporter, building the history banks ask for.'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-4">
                  <span className="mt-1.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-leaf text-[10px] text-white">✓</span>
                  <div>
                    <div className="font-semibold text-ink">{t}</div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
                  </div>
                </div>
              ))}
            </Stagger>
          </div>
          <Reveal delay={0.15} className="mx-auto w-full max-w-md">
            <TiltCard className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(circle_at_30%_20%,rgba(200,241,105,0.55),transparent_60%)] blur-2xl" />
              {repaid ? <NftPreview chainId={chainId} id={repaid.id} /> : <Skeleton className="aspect-[8/5]" />}
            </TiltCard>
            <p className="mt-4 text-center text-xs text-muted">A real invoice record on {chainMeta[chainId].short}, rendered by the contract itself</p>
          </Reveal>
        </div>
      </section>

      {/* ---------------- Open invoices ---------------- */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">Open now</div>
            <h2 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">Invoices waiting for funding</h2>
          </div>
          <Link to="/invest" className="text-sm font-semibold text-leaf hover:underline">See all invoices →</Link>
        </Reveal>
        {isLoading ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
        ) : (
          <Stagger className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {open.slice(0, 3).map((inv) => <InvoiceCard key={inv.id.toString()} invoice={inv} />)}
          </Stagger>
        )}
      </section>

      {/* ---------------- Built with ---------------- */}
      <section className="pb-24">
        <div className="marquee overflow-hidden border-y border-line bg-card py-5">
          <div className="marquee-track gap-14 pr-14 text-lg font-semibold text-muted">
            {[0, 1].map((k) => (
              <div key={k} className="flex gap-14" aria-hidden={k === 1}>
                {['Robinhood Chain', 'Arbitrum', 'Paxos USDG', 'Circle USDC', 'OpenZeppelin', 'ZeroDev passkeys', 'Alchemy', 'IPFS'].map((name) => (
                  <span key={name} className="flex items-center gap-3 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-leaf" /> {name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="relative overflow-hidden bg-[#0a160f] text-paper">
        <HeroBackground />
        <Reveal className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:px-6">
          <h2 className="font-display text-4xl font-semibold leading-tight sm:text-6xl">
            Money already earned shouldn't be <span className="text-lime">money out of reach.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-paper/70">
            Fund a shipment from {money(1n * 10n ** 6n)} USDG, or turn your next invoice into cash this week.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/invest" className="rounded-full bg-lime px-7 py-3.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5">Fund an invoice</Link>
            <Link to="/exporters" className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold transition hover:bg-white/10">Get paid early</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
