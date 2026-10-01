import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { tokenInfo } from '../lib/chains';
import { money, percentFromBps } from '../lib/format';
import type { Invoice } from '../lib/invoice';

/** Cycles through what is actually happening on-chain, derived from the live invoice book. */
export function LiveTicker({ invoices }: { invoices: Invoice[] }) {
  const events = invoices
    .filter((inv) => inv.status !== 'Rejected' && inv.status !== 'Cancelled')
    .slice(0, 8)
    .map((inv) => {
    const t = tokenInfo(inv.token);
    const label = `#${inv.id} ${inv.commodity}`;
    switch (inv.status) {
      case 'Repaid':
        return { tone: 'lime', text: `${label} repaid · ${money(inv.repaid, t.decimals, { cents: true })} ${t.symbol} back to investors` };
      case 'Funded':
        return { tone: 'lime', text: `${label} funded · exporter paid ${money(inv.funded, t.decimals)} ${t.symbol}` };
      case 'Funding':
        return { tone: 'gold', text: `${label} verified · investors earn ${percentFromBps(inv.aprBps)} APR` };
      case 'Submitted':
        return { tone: 'gold', text: `${label} submitted · documents under review` };
      default:
        return { tone: 'muted', text: `${label} ${inv.status.toLowerCase()}` };
    }
  });
  const [i, setI] = useState(0);
  useEffect(() => {
    if (events.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % events.length), 3200);
    return () => clearInterval(t);
  }, [events.length]);
  if (events.length === 0) return null;
  const e = events[i % events.length];
  return (
    <div className="flex h-10 min-w-0 items-center gap-3 overflow-hidden rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-paper/90 backdrop-blur-md">
      <span className="relative flex h-2.5 w-2.5 flex-none">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-lime" />
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className={`truncate ${e.tone === 'gold' ? 'text-[#f5c26b]' : ''}`}
        >
          {e.text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
