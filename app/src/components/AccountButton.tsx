import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccountSession } from '../hooks/useAccountSession';
import { shortAddress } from '../lib/format';

export function AccountButton() {
  const { passkey, signOut } = useAccountSession();
  if (passkey) {
    return (
      <button
        onClick={signOut}
        title="Sign out"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold"
      >
        <span aria-hidden>🔑</span>
        {passkey.name} · {shortAddress(passkey.address)}
      </button>
    );
  }
  return <ConnectButton accountStatus="address" chainStatus="none" showBalance={false} label="Connect wallet" />;
}
