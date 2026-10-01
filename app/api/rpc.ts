/**
 * JSON-RPC proxy to Alchemy so the API key stays on the server. Only read methods are forwarded;
 * wallets send transactions through their own providers. The app falls back to public RPCs if
 * this endpoint fails, so it is an upgrade, never a single point of failure.
 */
const UPSTREAM: Record<string, string> = {
  '46630': 'https://robinhood-testnet.g.alchemy.com/v2/',
  '421614': 'https://arb-sepolia.g.alchemy.com/v2/',
};

const ALLOWED = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_maxPriorityFeePerGas',
  'net_version',
]);

type RpcRequest = { method?: string; id?: unknown };

export async function POST(request: Request) {
  const key = process.env.ALCHEMY_API_KEY;
  const chain = new URL(request.url).searchParams.get('chain') ?? '';
  const upstream = UPSTREAM[chain];
  if (!key || !upstream) return Response.json({ error: 'RPC proxy unavailable for this chain' }, { status: 503 });

  const body = (await request.json().catch(() => undefined)) as RpcRequest | RpcRequest[] | undefined;
  const calls = Array.isArray(body) ? body : body ? [body] : [];
  if (calls.length === 0 || calls.length > 50) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const blocked = calls.find((c) => !c.method || !ALLOWED.has(c.method));
  if (blocked) return Response.json({ error: `Method not allowed: ${blocked.method}` }, { status: 403 });

  const res = await fetch(upstream + key, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } });
}
