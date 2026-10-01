import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { AccountButton } from './AccountButton';
import { ChainSwitcher } from './ChainSwitcher';

const NAV = [
  { to: '/invest', label: 'Invest' },
  { to: '/exporters', label: 'Get paid early' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/how-it-works', label: 'How it works' },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className={`font-display text-xl font-bold tracking-tight ${light ? 'text-paper' : 'text-ink'}`}>EarnX</span>
    </Link>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const dark = pathname === '/' && !scrolled && !open;
  return (
    <div className="flex min-h-screen flex-col">
      <header
        className={`sticky top-0 z-30 border-b transition-colors duration-300 ${
          dark ? 'border-white/10 bg-transparent' : 'border-line/70 bg-paper/90 backdrop-blur'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo light={dark} />
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? dark ? 'bg-paper text-ink' : 'bg-ink text-paper'
                      : dark ? 'text-paper/80 hover:bg-white/10' : 'text-ink-soft hover:bg-line/60'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <ChainSwitcher tone={dark ? 'dark' : 'light'} />
            </div>
            <AccountButton />
            <button
              className={`rounded-full border p-2 lg:hidden ${dark ? 'border-white/20 text-paper' : 'border-line'}`}
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 5h14M2 9h14M2 13h14" />
              </svg>
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-line px-4 pb-4 lg:hidden">
            <div className="mt-3 md:hidden">
              <ChainSwitcher />
            </div>
            <nav className="mt-2 flex flex-col">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-2 text-base font-medium">
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs">Invoice financing for African exporters, funded by investors anywhere.</p>
          </div>
          <div>
            <div className="font-semibold text-ink">Testnet beta</div>
            <p className="mt-2">
              Running on Robinhood Chain testnet and Arbitrum Sepolia with test USDG and USDC. Contracts are not audited
              yet. Invoices marked “sample” are fictional.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-semibold text-ink">Source</div>
            <a className="hover:text-ink" href="https://github.com/big14way/earnx" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a
              className="hover:text-ink"
              href="https://github.com/big14way/earnx/tree/main/contracts"
              target="_blank"
              rel="noreferrer"
            >
              Contracts and deployments
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
