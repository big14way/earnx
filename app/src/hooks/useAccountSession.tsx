import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import type { Address } from 'viem';
import { PasskeySession } from '../lib/passkey';
import { defaultChainId, isSupportedChain, type SupportedChainId } from '../lib/chains';

type AccountState = {
  /** The address actions are taken from: the passkey smart account if signed in, else the wallet. */
  address?: Address;
  kind?: 'passkey' | 'wallet';
  passkey?: PasskeySession;
  startPasskey: (mode: 'register' | 'login', name: string) => Promise<void>;
  signOut: () => void;
  /** The chain the user is browsing; reads and writes follow it. */
  chainId: SupportedChainId;
  setChainId: (id: SupportedChainId) => void;
};

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const wallet = useAccount();
  const { disconnect } = useDisconnect();
  const [passkey, setPasskey] = useState<PasskeySession>();
  const [chainId, setChainIdState] = useState<SupportedChainId>(() => {
    const saved = Number(safeStorage('get', 'earnx.chain'));
    return isSupportedChain(saved) ? saved : defaultChainId;
  });

  const value = useMemo<AccountState>(
    () => ({
      address: passkey?.address ?? wallet.address,
      kind: passkey ? 'passkey' : wallet.address ? 'wallet' : undefined,
      passkey,
      chainId,
      setChainId: (id) => {
        setChainIdState(id);
        safeStorage('set', 'earnx.chain', String(id));
      },
      startPasskey: async (mode, name) => {
        setPasskey(await PasskeySession.start(mode, name, chainId));
      },
      signOut: () => {
        setPasskey(undefined);
        if (wallet.address) disconnect();
      },
    }),
    [passkey, wallet.address, chainId, disconnect],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccountSession() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccountSession must be used inside AccountProvider');
  return ctx;
}

function safeStorage(op: 'get' | 'set', key: string, value?: string) {
  try {
    if (op === 'get') return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value!);
  } catch {
    // storage can be unavailable (private mode); the app works without it
  }
  return null;
}
