import { useTitle } from '../hooks/useTitle';
import { Card, SectionTitle } from '../components/ui';
import { contractsFor, explorerUrl, supportedChains, chainMeta, tokensFor } from '../lib/chains';

const FAQ: [string, string][] = [
  ['Who verifies invoices?', 'On this testnet, an automated pre-screen re-downloads the documents from IPFS, checks they match the hash on-chain, and prices the risk with published rules. The contract accepts any approved verifier, including signed approvals from a human reviewer or a partner, so buyer confirmation and licensed checks slot in without changing the contract.'],
  ['What happens if a buyer does not pay?', 'After the due date plus a 30-day grace period, anyone can mark the invoice as defaulted. The first-loss reserve then covers as much of the investors’ principal as it holds. Any money recovered later goes to investors first, then refills the reserve.'],
  ['Where does the reserve come from?', '1% of every advance is paid into it automatically, and anyone (for example a development-finance partner) can add first-loss capital. It can only be used to cover investor losses.'],
  ['Why stablecoins?', 'Exporters are paid in dollar stablecoins (Paxos USDG or Circle USDC), which removes the currency risk of holding naira or cedis between shipment and payment, and lets investors anywhere take part.'],
  ['Why Robinhood Chain and Arbitrum?', 'Both are Arbitrum chains with low fees and fast blocks. Robinhood Chain is built for real-world assets and has USDG natively; Arbitrum has deep stablecoin liquidity. The same contracts run on both.'],
  ['Is this live with real money?', 'Not yet. It runs on testnets with test tokens and the contracts have not been audited. Invoices labelled “sample” are fictional.'],
];

export function HowItWorks() {
  useTitle('How it works');
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionTitle eyebrow="How it works" title="The whole lifecycle is enforced by the contract.">
        Nothing here depends on trusting EarnX to move money: the exporter is paid, investors are repaid and losses are
        covered by rules anyone can read.
      </SectionTitle>

      <ol className="mt-10 grid gap-4 md:grid-cols-2">
        {[
          ['1. Submit', 'The exporter uploads documents to IPFS and submits the invoice. The contract stores the buyer, the goods, the amount, the due date and the documents’ hash.'],
          ['2. Verify and price', 'A verifier checks the documents and sets a risk score (0–100). The APR investors earn and the share advanced to the exporter are then computed on-chain by a risk engine written in Rust (an Arbitrum Stylus contract) from a published formula. Scores above 80 cannot be funded. The exporter receives a non-transferable record of the invoice.'],
          ['3. Fund', 'Investors fund it in USDG or USDC during a 14-day window. When the target is reached, the advance (minus a 1% reserve fee) goes to the exporter in the same transaction. If it isn’t reached, investors get refunds.'],
          ['4. Repay and claim', 'The buyer (or the exporter) repays principal plus interest, in parts or in full. Each investor claims their share whenever money arrives.'],
        ].map(([t, d]) => (
          <Card key={t} className="p-6">
            <div className="font-display text-xl font-semibold">{t}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
          </Card>
        ))}
      </ol>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">Questions</h2>
        <div className="mt-6 divide-y divide-line rounded-3xl border border-line bg-card">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-6">
              <summary className="cursor-pointer list-none font-semibold text-ink">
                {q} <span className="float-right text-muted group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">Contracts</h2>
        <p className="mt-2 text-sm text-muted">Source-verified on Blockscout. Code and tests on GitHub.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {supportedChains.map((c) => {
            const d = contractsFor(c.id);
            return (
              <Card key={c.id} className="p-6 text-sm">
                <div className="font-semibold">{chainMeta[c.id].short} testnet <span className="text-muted">({c.id})</span></div>
                <dl className="mt-3 space-y-2">
                  <Addr label="EarnXProtocol" chainId={c.id} address={d.protocol} />
                  <Addr label="EarnXInvoiceNFT" chainId={c.id} address={d.invoiceNFT} />
                  {d.riskEngine && <Addr label="Risk engine (Rust, Stylus)" chainId={c.id} address={d.riskEngine} />}
                  {tokensFor(c.id).map((t) => <Addr key={t.address} label={t.symbol} chainId={c.id} address={t.address} />)}
                </dl>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Addr({ label, chainId, address }: { label: string; chainId: number; address: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd>
        <a className="break-all font-mono text-xs text-leaf underline" href={explorerUrl(chainId, 'address', address)} target="_blank" rel="noreferrer">
          {address}
        </a>
      </dd>
    </div>
  );
}
