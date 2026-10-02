import { createPublicClient, erc20Abi, http, isAddress, isHex, type Address, type Hex } from 'viem';
import { arbitrumSepolia, robinhoodTestnet } from 'viem/chains';
import { deployments, protocolAbi } from '../src/abi/earnx.js';
import { findPins, pinJson } from '../src/lib/pinata.js';
import { buyerStatement, invoiceKey, type BuyerConfirmation } from '../src/lib/trust.js';

/**
 * Buyer confirmation. The buyer signs a statement built from the invoice's on-chain facts: they ordered
 * the goods, the invoice is genuine, and they will pay the EarnX contract. The signature is checked
 * here (wallets, and passkey smart accounts through ERC-1271 / ERC-6492), then the signed statement is
 * pinned to IPFS so anyone can re-check it, and indexed by invoice.
 *
 * GET  ?chainId=&invoiceId=  the statement to sign and the confirmation, if any
 * GET  ?chainId=             every confirmation on that chain, by invoice id
 * POST { chainId, invoiceId, buyerName, signer, signature }
 */
const CHAINS = { [robinhoodTestnet.id]: robinhoodTestnet, [arbitrumSepolia.id]: arbitrumSepolia } as const;
const OPEN = [0, 1, 2]; // Submitted, Funding, Funded: the debt is still outstanding

export async function GET(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return Response.json({ error: 'Confirmations are not configured.' }, { status: 503 });
  const url = new URL(request.url);
  const chain = CHAINS[Number(url.searchParams.get('chainId')) as keyof typeof CHAINS];
  if (!chain) return Response.json({ error: 'Unsupported chain.' }, { status: 400 });
  const invoiceId = url.searchParams.get('invoiceId');
  const headers = { 'cache-control': 's-maxage=10, stale-while-revalidate=30' };

  if (!invoiceId) {
    const pins = await findPins(jwt, { earnx: 'buyer-confirmation', chain: String(chain.id) }, 500);
    const confirmations: Record<string, BuyerConfirmation> = {};
    for (const p of pins.reverse()) confirmations[p.keyvalues.invoiceId] = fromPin(chain.id, p);
    return Response.json({ confirmations }, { headers });
  }
  if (!/^\d+$/.test(invoiceId)) return Response.json({ error: 'Bad invoice id.' }, { status: 400 });
  const facts = await loadFacts(chain, BigInt(invoiceId));
  if (!facts) return Response.json({ error: 'Invoice not found.' }, { status: 404 });
  const [pin] = await findPins(jwt, { earnx: 'buyer-confirmation', invoice: invoiceKey(chain.id, invoiceId) }, 1);
  return Response.json({ statement: facts.statement, status: facts.status, confirmation: pin ? fromPin(chain.id, pin) : null });
}

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return Response.json({ error: 'Confirmations are not configured.' }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as {
    chainId?: number; invoiceId?: string; buyerName?: string; signer?: string; signature?: string;
  };
  const chain = CHAINS[body.chainId as keyof typeof CHAINS];
  const buyerName = String(body.buyerName ?? '').trim().slice(0, 80);
  if (!chain || !/^\d+$/.test(body.invoiceId ?? '') || !isAddress(body.signer ?? '') || !isHex(body.signature) || buyerName.length < 2) {
    return Response.json({ error: 'Send { chainId, invoiceId, buyerName, signer, signature }.' }, { status: 400 });
  }
  const facts = await loadFacts(chain, BigInt(body.invoiceId!));
  if (!facts) return Response.json({ error: 'Invoice not found.' }, { status: 404 });
  if (!OPEN.includes(facts.status)) return Response.json({ error: 'This invoice is no longer open.' }, { status: 409 });
  if (facts.buyer.startsWith('Sample buyer')) return Response.json({ error: 'Sample invoices have a fictional buyer, so they cannot be confirmed.' }, { status: 409 });
  const signer = body.signer as Address;
  if (signer.toLowerCase() === facts.supplier.toLowerCase()) {
    return Response.json({ error: "The exporter can't confirm their own invoice. The buyer signs from their own account." }, { status: 403 });
  }
  const key = invoiceKey(chain.id, body.invoiceId!);
  const [existing] = await findPins(jwt, { earnx: 'buyer-confirmation', invoice: key }, 1);
  if (existing) return Response.json({ error: 'The buyer has already confirmed this invoice.', confirmation: fromPin(chain.id, existing) }, { status: 409 });

  const valid = await facts.client.verifyMessage({ address: signer, message: facts.statement, signature: body.signature as Hex }).catch(() => false);
  if (!valid) return Response.json({ error: 'The signature does not match the statement and the signing account.' }, { status: 400 });

  const confirmedAt = new Date().toISOString();
  const record = {
    app: 'EarnX',
    kind: 'buyer-confirmation',
    version: 1,
    chainId: chain.id,
    protocol: facts.protocol,
    invoiceId: body.invoiceId,
    docsHash: facts.docsHash,
    buyerName,
    signer,
    statement: facts.statement,
    signature: body.signature,
    confirmedAt,
  };
  const cid = await pinJson(jwt, `earnx-buyer-confirmation-${chain.id}-${body.invoiceId}`, record, {
    earnx: 'buyer-confirmation',
    invoice: key,
    chain: String(chain.id),
    invoiceId: body.invoiceId!,
    signer,
    buyerName,
    confirmedAt,
  });
  const confirmation: BuyerConfirmation = { chainId: chain.id, invoiceId: body.invoiceId!, buyerName, signer, confirmedAt, cid };
  return Response.json({ confirmation });
}

async function loadFacts(chain: (typeof CHAINS)[keyof typeof CHAINS], id: bigint) {
  const protocol = deployments[String(chain.id) as keyof typeof deployments].protocol as Address;
  const client = createPublicClient({ chain, transport: http() });
  const count = await client.readContract({ address: protocol, abi: protocolAbi, functionName: 'invoiceCount' });
  if (id < 1n || id > count) return undefined;
  const inv = await client.readContract({ address: protocol, abi: protocolAbi, functionName: 'getInvoice', args: [id] });
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: inv.token, abi: erc20Abi, functionName: 'symbol' }),
    client.readContract({ address: inv.token, abi: erc20Abi, functionName: 'decimals' }),
  ]);
  const statement = buyerStatement({
    chainId: chain.id,
    chainName: chain.name,
    protocol,
    invoiceId: id,
    buyer: inv.buyer,
    supplier: inv.supplier,
    commodity: inv.commodity,
    origin: inv.origin,
    destination: inv.destination,
    faceValue: inv.faceValue,
    decimals,
    symbol,
    dueDate: inv.dueDate,
    docsHash: inv.docsHash,
  });
  return { client, protocol, statement, status: inv.status, supplier: inv.supplier, buyer: inv.buyer, docsHash: inv.docsHash };
}

function fromPin(chainId: number, p: { cid: string; keyvalues: Record<string, string> }): BuyerConfirmation {
  const kv = p.keyvalues;
  return { chainId, invoiceId: kv.invoiceId, buyerName: kv.buyerName, signer: kv.signer as Address, confirmedAt: kv.confirmedAt, cid: p.cid };
}
