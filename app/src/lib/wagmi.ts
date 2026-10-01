import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { arbitrumSepolia, robinhoodTestnet, rpcUrl } from './chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'EarnX',
  projectId: import.meta.env.VITE_REOWN_PROJECT_ID as string,
  chains: [
    { ...robinhoodTestnet, iconUrl: '/chains/robinhood.svg', iconBackground: '#000000' },
    { ...arbitrumSepolia, iconUrl: '/chains/arbitrum.svg', iconBackground: '#213147' },
  ],
  transports: {
    [robinhoodTestnet.id]: http(rpcUrl[robinhoodTestnet.id]),
    [arbitrumSepolia.id]: http(rpcUrl[arbitrumSepolia.id]),
  },
});
