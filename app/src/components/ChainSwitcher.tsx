import { supportedChains, chainMeta } from '../lib/chains';
import { useAccountSession } from '../hooks/useAccountSession';

export function ChainSwitcher({ className = '' }: { className?: string }) {
  const { chainId, setChainId } = useAccountSession();
  return (
    <div className={`inline-flex rounded-full border border-line bg-card p-1 text-xs font-semibold ${className}`}>
      {supportedChains.map((c) => (
        <button
          key={c.id}
          onClick={() => setChainId(c.id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
            chainId === c.id ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: chainMeta[c.id].accent }} />
          {chainMeta[c.id].short}
        </button>
      ))}
    </div>
  );
}
