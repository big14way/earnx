import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lightTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import './index.css';
import { wagmiConfig } from './lib/wagmi';
import { AccountProvider } from './hooks/useAccountSession';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Invest } from './pages/Invest';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Exporters } from './pages/Exporters';
import { Portfolio } from './pages/Portfolio';
import { HowItWorks } from './pages/HowItWorks';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme({ accentColor: '#10231a', borderRadius: 'large' })}>
          <AccountProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="invest" element={<Invest />} />
                  <Route path="invoice/:chainId/:id" element={<InvoiceDetail />} />
                  <Route path="exporters" element={<Exporters />} />
                  <Route path="portfolio" element={<Portfolio />} />
                  <Route path="how-it-works" element={<HowItWorks />} />
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
            </BrowserRouter>
          </AccountProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
