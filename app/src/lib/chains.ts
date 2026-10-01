import { arbitrumSepolia as arbitrumSepoliaBase, robinhoodTestnet } from 'viem/chains';
import { defineChain, type Address } from 'viem';
import { deployments } from '../abi/earnx';

// Contracts are source-verified on Blockscout, so link there rather than Arbiscan.
export const arbitrumSepolia = defineChain({
  ...arbitrumSepoliaBase,
  blockExplorers: { default: { name: 'Blockscout', url: 'https://arbitrum-sepolia.blockscout.com' } },
});

export { robinhoodTestnet };

export const supportedChains = [robinhoodTestnet, arbitrumSepolia] as const;
export type SupportedChainId = (typeof supportedChains)[number]['id'];
export const defaultChainId: SupportedChainId = robinhoodTestnet.id;

export const publicRpcUrl: Record<SupportedChainId, string> = {
  [robinhoodTestnet.id]: 'https://rpc.testnet.chain.robinhood.com',
  [arbitrumSepolia.id]: 'https://sepolia-rollup.arbitrum.io/rpc',
};

/** Our /api/rpc proxy (Alchemy, key kept server-side); wagmi falls back to publicRpcUrl if it fails. */
const proxy = (id: number) =>
  typeof window === 'undefined' ? publicRpcUrl[id as SupportedChainId] : `${window.location.origin}/api/rpc?chain=${id}`;

export const rpcUrl: Record<SupportedChainId, string> = {
  [robinhoodTestnet.id]: proxy(robinhoodTestnet.id),
  [arbitrumSepolia.id]: proxy(arbitrumSepolia.id),
};

export const chainMeta: Record<SupportedChainId, { short: string; faucet: string; accent: string }> = {
  [robinhoodTestnet.id]: {
    short: 'Robinhood Chain',
    faucet: 'https://faucet.testnet.chain.robinhood.com',
    accent: '#c8f169',
  },
  [arbitrumSepolia.id]: {
    short: 'Arbitrum',
    faucet: 'https://arbitrum.faucet.dev',
    accent: '#9dcced',
  },
};

export function chainById(id: number) {
  return supportedChains.find((c) => c.id === id);
}

export function isSupportedChain(id: number | undefined): id is SupportedChainId {
  return id !== undefined && supportedChains.some((c) => c.id === id);
}

export function contractsFor(chainId: SupportedChainId) {
  const d = deployments[String(chainId) as keyof typeof deployments];
  return {
    protocol: d.protocol as Address,
    invoiceNFT: d.invoiceNFT as Address,
    tokens: d.tokens as readonly Address[],
    deployedAtBlock: BigInt(d.deployedAtBlock),
  };
}

export function explorerUrl(chainId: number, kind: 'tx' | 'address' | 'token', value: string) {
  const base = chainById(chainId)?.blockExplorers.default.url;
  return `${base}/${kind}/${value}`;
}

export type TokenInfo = { address: Address; symbol: string; decimals: number; name: string; faucet: string };

const TOKENS: Record<string, Omit<TokenInfo, 'address'>> = {
  // Paxos Global Dollar
  '0x7e955252e15c84f5768b83c41a71f9eba181802f': {
    symbol: 'USDG',
    decimals: 6,
    name: 'Global Dollar',
    faucet: 'https://faucet.paxos.com',
  },
  '0xffc95faa3d63cde504a05b567c600b78c0b41892': {
    symbol: 'USDG',
    decimals: 6,
    name: 'Global Dollar',
    faucet: 'https://faucet.paxos.com',
  },
  // Circle USDC
  '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d': {
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
    faucet: 'https://faucet.circle.com',
  },
};

export function tokenInfo(address: Address): TokenInfo {
  const t = TOKENS[address.toLowerCase()];
  return t ? { address, ...t } : { address, symbol: 'TOKEN', decimals: 6, name: 'Token', faucet: '' };
}

export function tokensFor(chainId: SupportedChainId): TokenInfo[] {
  return contractsFor(chainId).tokens.map(tokenInfo);
}
