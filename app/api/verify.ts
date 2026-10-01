import { createPublicClient, createWalletClient, http, keccak256, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia, robinhoodTestnet } from 'viem/chains';
import { deployments, protocolAbi } from '../src/abi/earnx.js';

/**
 * Automated pre-screen for testnet invoices. It re-downloads the documents from IPFS, checks
 * they hash to the docsHash recorded on-chain, applies transparent risk rules, then verifies
 * (or rejects) the invoice on-chain with a key that holds VERIFIER_ROLE and nothing else.
 *
 * In production this step is where buyer confirmation and a licensed partner's checks happen;
 * the contract already accepts any verifier, including EIP-712 signatures from off-chain reviewers.
 */
const CHAINS = { [robinhoodTestnet.id]: robinhoodTestnet, [arbitrumSepolia.id]: arbitrumSepolia } as const;
const GATEWAYS = [
  ...(process.env.PINATA_GATEWAY ? [`https://${process.env.PINATA_GATEWAY}/ipfs/`] : []),
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
];
const MAX_AUTO_FACE_VALUE = 250_000n * 1_000_000n; // above this, a human reviews it
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
  const publicClient = createPublicClient({ chain, transport: http() });
  const id = BigInt(invoiceId);

  const inv = await publicClient.readContract({ address: protocol, abi: protocolAbi, functionName: 'getInvoice', args: [id] });
  if (inv.status !== 0) return Response.json({ status: 'skipped', reason: 'This invoice has already been reviewed.' });

  const checks: { ok: boolean; label: string }[] = [];
  const now = Math.floor(Date.now() / 1000);
  const tenorDays = Math.round((inv.dueDate - now) / 86_400);

  // 1. Documents: the manifest on IPFS must hash to the docsHash stored on-chain.
  let manifest: { files?: { name: string }[] } | undefined;
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
  // 2. Limits the automated pre-screen is allowed to approve on its own.
  checks.push({ ok: inv.faceValue <= MAX_AUTO_FACE_VALUE, label: 'Invoice value within the automated limit (250,000)' });
  checks.push({ ok: tenorDays >= 7 && tenorDays <= MAX_AUTO_TENOR_DAYS, label: `Term of ${tenorDays} days within 7–${MAX_AUTO_TENOR_DAYS}` });
  checks.push({ ok: inv.buyer.trim().length >= 3, label: 'Buyer is named' });

  const wallet = createWalletClient({ chain, transport: http(), account: privateKeyToAccount(key) });
  const failed = checks.find((c) => !c.ok);
  if (failed) {
    const hash = await wallet.writeContract({ address: protocol, abi: protocolAbi, functionName: 'rejectInvoice', args: [id, failed.label] });
    await publicClient.waitForTransactionReceipt({ hash });
    return Response.json({ status: 'rejected', reason: failed.label, checks, txHash: hash });
  }

  // 3. Transparent pricing: a base score, adjusted for term, size, commodity and paperwork.
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
  factors.push(commodity ? `${commodityPts ? '+' + commodityPts : '+0'}: ${commodity[2]}` : '+5 for a commodity outside our usual list');
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
  return Response.json({ status: 'verified', riskScore: score, aprBps, advanceBps, checks, factors, txHash: hash });
}

async function fetchFromIpfs(cid: string): Promise<Uint8Array | undefined> {
  for (const gateway of GATEWAYS) {
    try {
      const res = await fetch(gateway + cid, { signal: AbortSignal.timeout(8_000) });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {
      // try the next gateway
    }
  }
  return undefined;
}
