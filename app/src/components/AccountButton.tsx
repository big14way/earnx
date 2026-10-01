import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccountSession } from '../hooks/useAccountSession';
import { shortAddress } from '../lib/format';

/**
 * Connect / account button. The app switches networks itself when the user acts, so a wallet that is
 * on some other chain is not shown as an error: it shows the address, and clicking it offers networks.
 */
export function AccountButton() {
  const { passkey, signOut } = useAccountSession();
  if (passkey) {
    return (
      <button
        onClick={signOut}
        title="Sign out"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-ink"
      >
        <span aria-hidden>🔑</span>
        <span className="hidden sm:inline">{passkey.name} ·</span> {shortAddress(passkey.address)}
      </button>
    );
  }
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        if (!mounted) return <span aria-hidden className="inline-block h-10 w-24" />;
        if (!account) {
          return (
            <button
              onClick={openConnectModal}
              className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-ink shadow-[0_8px_24px_-12px_rgba(200,241,105,0.9)] transition hover:-translate-y-0.5"
            >
              Connect<span className="hidden sm:inline"> wallet</span>
            </button>
          );
        }
        return (
          <button
            onClick={chain?.unsupported ? openChainModal : openAccountModal}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-sm font-semibold text-ink"
          >
            <span className="h-2 w-2 rounded-full bg-leaf" />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
