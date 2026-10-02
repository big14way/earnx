import './polyfills';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { WagmiProvider } from 'wagmi';
import { MotionConfig } from 'motion/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lightTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import './index.css';
import { wagmiConfig } from './lib/wagmi';
import { AccountProvider } from './hooks/useAccountSession';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './pages/Home';
const Invest = lazy(() => import('./pages/Invest').then((m) => ({ default: m.Invest })));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail').then((m) => ({ default: m.InvoiceDetail })));
const Exporters = lazy(() => import('./pages/Exporters').then((m) => ({ default: m.Exporters })));
const Portfolio = lazy(() => import('./pages/Portfolio').then((m) => ({ default: m.Portfolio })));
const HowItWorks = lazy(() => import('./pages/HowItWorks').then((m) => ({ default: m.HowItWorks })));
const ExporterProfile = lazy(() => import('./pages/ExporterProfile').then((m) => ({ default: m.ExporterProfile })));
const Confirm = lazy(() => import('./pages/Confirm').then((m) => ({ default: m.Confirm })));

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <MotionConfig reducedMotion="user">
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme({ accentColor: '#c8f169', accentColorForeground: '#10231a', borderRadius: 'large' })}>
          <AccountProvider>
            <BrowserRouter>
              <Suspense fallback={<div className="min-h-screen" />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="invest" element={<Invest />} />
                  <Route path="invoice/:chainId/:id" element={<InvoiceDetail />} />
                  <Route path="exporters" element={<Exporters />} />
                  <Route path="portfolio" element={<Portfolio />} />
                  <Route path="how-it-works" element={<HowItWorks />} />
                  <Route path="exporter/:chainId/:address" element={<ExporterProfile />} />
                  <Route path="confirm/:chainId/:id" element={<Confirm />} />
                  <Route
                    path="*"
                    element={
                      <div className="mx-auto max-w-xl px-4 py-24 text-center">
                        <h1 className="font-display text-4xl font-semibold">Page not found</h1>
                        <Link to="/" className="mt-4 inline-block font-semibold text-leaf underline">Back home</Link>
                      </div>
                    }
                  />
                </Route>
              </Routes>
              </Suspense>
            </BrowserRouter>
          </AccountProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
    </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
);
