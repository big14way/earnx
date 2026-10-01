import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { fallback, http } from 'wagmi';
import { arbitrumSepolia, publicRpcUrl, robinhoodTestnet, rpcUrl } from './chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'EarnX',
  projectId: import.meta.env.VITE_REOWN_PROJECT_ID as string,
  chains: [
    { ...robinhoodTestnet, iconUrl: '/chains/robinhood.svg', iconBackground: '#000000' },
    { ...arbitrumSepolia, iconUrl: '/chains/arbitrum.svg', iconBackground: '#213147' },
  ],
  transports: {
    // Alchemy first when configured, public RPC if it errors or is rate-limited.
    [robinhoodTestnet.id]: fallback([http(rpcUrl[robinhoodTestnet.id]), http(publicRpcUrl[robinhoodTestnet.id])]),
    [arbitrumSepolia.id]: fallback([http(rpcUrl[arbitrumSepolia.id]), http(publicRpcUrl[arbitrumSepolia.id])]),
  },
});
