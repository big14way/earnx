import { createPublicClient, createWalletClient, keccak256, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia, robinhoodTestnet } from 'viem/chains';
import { deployments, protocolAbi } from '../src/abi/earnx.js';
import { benchmarkFor, benchmarkSource, compareToMarket, type Trade } from '../src/lib/market.js';
import { findPins } from '../src/lib/pinata.js';
import { serverTransport } from '../src/lib/serverRpc.js';
import {
  AUTO_LIMIT_UNVERIFIED,
  AUTO_LIMIT_VERIFIED,
  BUYER_CONFIRMATION_ABOVE,
  VERIFIED_EXPORTER_ROLE,
  invoiceKey,
  normalizeParty,
} from '../src/lib/trust.js';

/**
 * Automated pre-screen for testnet invoices. It re-downloads the documents from IPFS, checks
 * they hash to the docsHash recorded on-chain, applies transparent risk rules, then verifies
 * (or rejects) the invoice on-chain with a key that holds VERIFIER_ROLE and nothing else.
 *
 * Hard failures (documents, numbers, market price, a duplicate of an invoice on either chain) reject
 * the invoice on-chain. Soft gates leave it in review: an exporter who hasn't verified their business
 * is limited to small invoices, and larger invoices wait for the buyer's signed confirmation.
 * In production a licensed partner's checks sit here too; the contract already accepts any verifier,
 * including EIP-712 signatures from off-chain reviewers.
 */
const CHAINS = { [robinhoodTestnet.id]: robinhoodTestnet, [arbitrumSepolia.id]: arbitrumSepolia } as const;
const GATEWAYS = [
  ...(process.env.PINATA_GATEWAY ? [`https://${process.env.PINATA_GATEWAY}/ipfs/`] : []),
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
];
const MAX_AUTO_TENOR_DAYS = 180;

const COMMODITY_RISK: [RegExp, number, string][] = [
  [/cocoa|coffee|tea|cashew|sesame|shea|cassava|maize|rice|soy|groundnut|palm|cotton|spice|vanilla|ginger|hibiscus/i, 0, 'Agricultural staple with deep buyer markets'],
  [/gold|copper|cobalt|lithium|mineral|ore/i, 10, 'Minerals carry more price and compliance risk'],
];

export async function POST(request: Request) {
  const key = process.env.SERVER_VERIFIER_PRIVATE_KEY as Hex | undefined;
  if (!key) return Response.json({ error: 'Verification is not configured.' }, { status: 503 });

  const { chainId, invoiceId } = (await request.json().catch(() => ({}))) as { chainId?: number; invoiceId?: string };
  const chain = CHAINS[chainId as keyof typeof CHAINS];
  if (!chain || !invoiceId || !/^\d+$/.test(invoiceId)) {
    return Response.json({ error: 'Send { chainId, invoiceId } for a supported chain.' }, { status: 400 });
  }
  const protocol = deployments[String(chain.id) as keyof typeof deployments].protocol as Hex;
  const publicClient = createPublicClient({ chain, transport: serverTransport(chain.id) });
  const id = BigInt(invoiceId);

  const inv = await publicClient.readContract({ address: protocol, abi: protocolAbi, functionName: 'getInvoice', args: [id] });
  if (inv.status !== 0) return Response.json({ status: 'skipped', reason: 'This invoice has already been reviewed.' });

  // `soft` failures hold the invoice in review instead of rejecting it.
  const checks: { ok: boolean; label: string; soft?: boolean }[] = [];
  const now = Math.floor(Date.now() / 1000);
  const tenorDays = Math.round((inv.dueDate - now) / 86_400);

  // 1. Documents: the manifest on IPFS must hash to the docsHash stored on-chain.
  let manifest: Manifest | undefined;
  if (!inv.docsCID) {
    checks.push({ ok: false, label: 'No documents were uploaded to IPFS' });
  } else {
    const bytes = await fetchFromIpfs(inv.docsCID);
    // Freshly pinned files can take a moment to reach gateways: ask the caller to retry rather than reject.
    if (!bytes) return Response.json({ status: 'pending', reason: 'Documents are still propagating on IPFS. Try again shortly.' });
    if (keccak256(bytes) !== inv.docsHash) checks.push({ ok: false, label: 'Documents do not match the hash on-chain' });
    else {
      manifest = JSON.parse(new TextDecoder().decode(bytes));
      checks.push({ ok: true, label: `${manifest?.files?.length ?? 0} document(s) retrieved and match the on-chain hash` });
    }
  }
  // 2. Term and parties.
  checks.push({ ok: tenorDays >= 7 && tenorDays <= MAX_AUTO_TENOR_DAYS, label: `Term of ${tenorDays} days within 7–${MAX_AUTO_TENOR_DAYS}` });
  checks.push({ ok: inv.buyer.trim().length >= 3, label: 'Buyer is named' });

  // 3. The numbers add up, and the price is in line with the market (over-invoicing is the classic fraud).
  const trade = manifest?.trade;
  const marketFactors: string[] = [];
  let marketPts = 0;
  if (trade) {
    const declared = trade.quantity * trade.unitPriceUsd;
    const face = Number(inv.faceValue) / 1e6;
    checks.push({ ok: Math.abs(declared - face) <= face * 0.02, label: `Quantity × unit price ($${declared.toLocaleString('en-US')}) matches the invoice total` });
    const benchmark = benchmarkFor(inv.commodity, inv.origin);
    if (benchmark) {
      const m = compareToMarket(trade, benchmark);
      const source = `World Bank ${benchmark.name}, ${benchmark.month.replace('M', '-')}: $${benchmark.usdPerTonne.toLocaleString('en-US')}/t`;
      checks.push({ ok: m.level !== 'far-above', label: `Unit price vs ${source}: ${m.label}` });
      if (m.level === 'above') { marketPts = 10; marketFactors.push(`+10: price ${m.label}`); }
      else if (m.level === 'below') { marketPts = 5; marketFactors.push(`+5: price ${m.label}`); }
      else if (m.level === 'in-line') { marketPts = -3; marketFactors.push('−3: price in line with the World Bank benchmark'); }
    } else {
      marketFactors.push(`No public benchmark for "${inv.commodity}" yet (${benchmarkSource.name})`);
    }
  }

  // 4. The same trade must not be financed twice, on either chain.
  const duplicate = await findDuplicate(chain.id, id, inv, manifest);
  checks.push(duplicate ? { ok: false, label: duplicate } : { ok: true, label: 'Not a duplicate: documents and invoice number are new on both chains' });

  // 5. Who stands behind it: the exporter's verified business sets the limit; big invoices need the buyer's signature.
  const [verifiedExporter, confirmation] = await Promise.all([
    publicClient.readContract({ address: protocol, abi: protocolAbi, functionName: 'hasRole', args: [VERIFIED_EXPORTER_ROLE, inv.supplier] }),
    buyerConfirmation(chain.id, id),
  ]);
  const limit = verifiedExporter ? AUTO_LIMIT_VERIFIED : AUTO_LIMIT_UNVERIFIED;
  const withinLimit = inv.faceValue <= limit;
  checks.push(
    verifiedExporter
      ? { ok: withinLimit, soft: true, label: withinLimit ? "Exporter's business is verified (on-chain registry)" : `Above the automated limit of ${usd(limit)}: a reviewer checks it` }
      : { ok: withinLimit, soft: true, label: withinLimit ? `Within the ${usd(limit)} limit for exporters who haven't verified their business yet` : `Above the ${usd(limit)} limit for exporters who haven't verified their business yet` },
  );
  if (confirmation) checks.push({ ok: true, label: `Buyer confirmed the invoice (signed by ${short(confirmation.signer)})` });
  else if (inv.faceValue > BUYER_CONFIRMATION_ABOVE) checks.push({ ok: false, soft: true, label: `Waiting for the buyer's signed confirmation (required above ${usd(BUYER_CONFIRMATION_ABOVE)})` });

  const wallet = createWalletClient({ chain, transport: serverTransport(chain.id), account: privateKeyToAccount(key) });
  const failed = checks.find((c) => !c.ok && !c.soft);
  if (failed) {
    const hash = await wallet.writeContract({ address: protocol, abi: protocolAbi, functionName: 'rejectInvoice', args: [id, failed.label] });
    await publicClient.waitForTransactionReceipt({ hash });
    return Response.json({ status: 'rejected', reason: failed.label, checks, txHash: hash });
  }
  if (!withinLimit) {
    const reason = verifiedExporter
      ? 'This invoice is above the automated limit, so a reviewer will check it before it opens for funding.'
      : `This invoice is above the ${usd(limit)} limit for exporters who haven't verified their business. Request verification on the exporter page, then run the pre-screen again.`;
    return Response.json({ status: 'review', reason, checks });
  }
  if (checks.some((c) => !c.ok)) {
    return Response.json({ status: 'waiting-buyer', reason: 'Waiting for the buyer to confirm. Send them the confirmation link; the invoice opens for funding as soon as they sign.', checks });
  }

  // 6. Transparent pricing: a base score, adjusted for term, size, commodity and paperwork.
  const factors: string[] = [];
  let score = 25;
  const termPts = Math.round((tenorDays / 180) * 15);
  score += termPts;
  factors.push(`+${termPts} for a ${tenorDays}-day term`);
  const sizePts = inv.faceValue > 100_000_000_000n ? 10 : inv.faceValue > 50_000_000_000n ? 5 : 0;
  if (sizePts) factors.push(`+${sizePts} for invoice size`);
  score += sizePts;
  const commodity = COMMODITY_RISK.find(([re]) => re.test(inv.commodity));
  const commodityPts = commodity ? commodity[1] : 5;
  score += commodityPts;
  score += marketPts;
  factors.push(...marketFactors);
  factors.push(commodity ? `${commodityPts ? '+' + commodityPts : '+0'}: ${commodity[2]}` : '+5 for a commodity outside our usual list');
  if (verifiedExporter) {
    score -= 5;
    factors.push("−5: the exporter's business is verified");
  }
  if (confirmation) {
    score -= 5;
    factors.push('−5: the buyer confirmed the invoice');
  } else {
    factors.push(`Buyer hasn't confirmed yet (optional up to ${usd(BUYER_CONFIRMATION_ABOVE)})`);
  }
  const docCount = manifest?.files?.length ?? 0;
  if (docCount >= 3) {
    score -= 5;
    factors.push('−5 for a full document set (3 or more files)');
  }
  score = Math.max(10, Math.min(75, score));
  const aprBps = 800 + score * 15; // 8% + 0.15% per risk point
  const advanceBps = Math.max(7000, 9000 - Math.max(0, score - 30) * 25); // 90% down to 70%

  const hash = await wallet.writeContract({
    address: protocol,
    abi: protocolAbi,
    functionName: 'verifyInvoice',
    args: [id, score, aprBps, advanceBps],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  // When a risk engine is set (the Rust/Stylus contract), it sets the final APR and advance on-chain,
  // so report what the contract actually stored rather than the proposal above.
  const [stored, engine] = await Promise.all([
    publicClient.readContract({ address: protocol, abi: protocolAbi, functionName: 'getInvoice', args: [id] }),
    publicClient.readContract({ address: protocol, abi: protocolAbi, functionName: 'riskEngine' }),
  ]);
  const pricedByEngine = engine !== '0x0000000000000000000000000000000000000000';
  return Response.json({
    status: 'verified',
    riskScore: score,
    aprBps: stored.aprBps,
    advanceBps: stored.advanceBps,
    pricedBy: pricedByEngine ? { kind: 'stylus', address: engine } : { kind: 'verifier' },
    checks,
    factors: pricedByEngine ? [...factors, 'APR and advance set on-chain by the Rust (Stylus) risk engine'] : factors,
    txHash: hash,
  });
}

type Manifest = { invoiceNumber?: string; files?: { name: string; keccak256?: Hex }[]; trade?: Trade };
type OnChainInvoice = { id: bigint; status: number; supplier: Hex; buyer: string; docsHash: Hex; docsCID: string; submittedAt: number };

/**
 * Looks for the same trade on both chains: the same document bundle, any identical document file, or
 * the same invoice number for the same buyer. A resubmission by the same exporter after a rejection or
 * cancellation is allowed. (Fine at testnet scale; production keeps an index of document fingerprints.)
 */
async function findDuplicate(chainId: number, id: bigint, inv: OnChainInvoice, manifest?: Manifest) {
  const others = (
    await Promise.all(
      Object.values(CHAINS).map(async (c) => {
        const protocol = deployments[String(c.id) as keyof typeof deployments].protocol as Hex;
        const client = createPublicClient({ chain: c, transport: serverTransport(c.id) });
        const count = await client.readContract({ address: protocol, abi: protocolAbi, functionName: 'invoiceCount' });
        if (count === 0n) return [];
        const list = await client.readContract({ address: protocol, abi: protocolAbi, functionName: 'getInvoices', args: [1n, count] });
        return list.map((o) => ({ chain: c, o: o as OnChainInvoice }));
      }),
    )
  )
    .flat()
    .filter(({ chain, o }) => !(chain.id === chainId && o.id === id))
    .filter(({ o }) => !(o.supplier.toLowerCase() === inv.supplier.toLowerCase() && (o.status === 5 || o.status === 6)));
  const where = (x: (typeof others)[number]) => `invoice #${x.o.id} on ${x.chain.name}`;

  const sameBundle = others.find((x) => x.o.docsHash === inv.docsHash);
  if (sameBundle) return `Duplicate: this document bundle was already submitted as ${where(sameBundle)}`;

  const mine = new Set((manifest?.files ?? []).map((f) => f.keccak256).filter(Boolean));
  const number = manifest?.invoiceNumber ? normalizeParty(manifest.invoiceNumber) : '';
  const buyer = normalizeParty(inv.buyer);
  const recent = others.filter((x) => x.o.docsCID).sort((a, b) => b.o.submittedAt - a.o.submittedAt).slice(0, 60);
  const manifests = await Promise.all(recent.map(async (x) => ({ x, m: await fetchManifest(x.o.docsCID) })));
  for (const { x, m } of manifests) {
    const shared = m?.files?.find((f) => f.keccak256 && mine.has(f.keccak256));
    if (shared) return `Duplicate: "${shared.name}" was already used for ${where(x)}`;
    const theirs = m?.invoiceNumber ? normalizeParty(m.invoiceNumber) : '';
    if (number && theirs === number && normalizeParty(x.o.buyer) === buyer) {
      return `Duplicate: invoice number ${manifest!.invoiceNumber} for this buyer was already submitted as ${where(x)}`;
    }
  }
  return undefined;
}

async function fetchManifest(cid: string): Promise<Manifest | undefined> {
  const bytes = await fetchFromIpfs(cid, 5_000, 1);
  if (!bytes) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as Manifest;
  } catch {
    return undefined;
  }
}

async function buyerConfirmation(chainId: number, id: bigint) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return undefined;
  try {
    const [pin] = await findPins(jwt, { earnx: 'buyer-confirmation', invoice: invoiceKey(chainId, id) }, 1);
    return pin ? { signer: pin.keyvalues.signer as Hex, cid: pin.cid } : undefined;
  } catch {
    return undefined;
  }
}

const usd = (units: bigint) => `$${(units / 1_000_000n).toLocaleString('en-US')}`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function fetchFromIpfs(cid: string, timeoutMs = 8_000, gateways = GATEWAYS.length): Promise<Uint8Array | undefined> {
  for (const gateway of GATEWAYS.slice(0, gateways)) {
    try {
      const res = await fetch(gateway + cid, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {
      // try the next gateway
    }
  }
  return undefined;
}
