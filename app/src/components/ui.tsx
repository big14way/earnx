import type { ReactNode } from 'react';
import { explorerUrl } from '../lib/chains';
import { statusStyle, type StatusName } from '../lib/invoice';
import type { TxState } from '../hooks/useEarnXWrite';

export function StatusBadge({ status }: { status: StatusName }) {
  const s = statusStyle[status];
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}

export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="tabular mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value}>
      <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const styles = {
    primary: 'bg-ink text-paper hover:bg-ink-soft disabled:bg-muted',
    secondary: 'bg-leaf text-white hover:bg-leaf-dark disabled:bg-muted',
    ghost: 'border border-line bg-card text-ink hover:border-ink',
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function TxStatus({ state, chainId }: { state: TxState; chainId: number }) {
  if (state.status === 'idle') return null;
  if (state.status === 'pending')
    return <p className="mt-3 text-sm text-muted">⏳ {state.step ?? 'Confirm in your wallet…'}</p>;
  if (state.status === 'error') return <p className="mt-3 text-sm font-medium text-clay">{state.error}</p>;
  return (
    <p className="mt-3 text-sm font-medium text-leaf">
      ✓ Confirmed.{' '}
      {state.hash && (
        <a className="underline" href={explorerUrl(chainId, 'tx', state.hash)} target="_blank" rel="noreferrer">
          View transaction
        </a>
      )}
    </p>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-line/60 ${className}`} />;
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">{eyebrow}</div>}
      <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-base leading-relaxed text-muted">{children}</p>}
    </div>
  );
}
