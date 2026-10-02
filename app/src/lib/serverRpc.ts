import { fallback, http } from 'viem';

/**
 * Transport for the serverless functions: Alchemy first when its key is set, the chain's public RPC
 * as a fallback. Requests made together are batched into one HTTP call.
 */
const ALCHEMY: Record<number, string> = {
  46630: 'https://robinhood-testnet.g.alchemy.com/v2/',
  421614: 'https://arb-sepolia.g.alchemy.com/v2/',
};

export function serverTransport(chainId: number) {
  const key = process.env.ALCHEMY_API_KEY;
  const publicRpc = http(undefined, { batch: true });
  return key && ALCHEMY[chainId] ? fallback([http(ALCHEMY[chainId] + key, { batch: true }), publicRpc]) : publicRpc;
}
