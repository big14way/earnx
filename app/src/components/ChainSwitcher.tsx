import { supportedChains, chainMeta } from '../lib/chains';
import { useAccountSession } from '../hooks/useAccountSession';

export function ChainSwitcher({ className = '', tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const { chainId, setChainId } = useAccountSession();
  return (
    <div className={`inline-flex rounded-full border p-1 text-xs font-semibold ${tone === 'dark' ? 'border-white/15 bg-white/5' : 'border-line bg-card'} ${className}`}>
      {supportedChains.map((c) => (
        <button
          key={c.id}
          onClick={() => setChainId(c.id)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
            chainId === c.id
              ? tone === 'dark' ? 'bg-paper text-ink' : 'bg-ink text-paper'
              : tone === 'dark' ? 'text-paper/70 hover:text-paper' : 'text-muted hover:text-ink'
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: chainMeta[c.id].accent }} />
          {chainMeta[c.id].short}
        </button>
      ))}
    </div>
  );
}
