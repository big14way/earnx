// frontend1/src/hooks/useInvestmentOpportunities.ts
import { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { useAccount } from 'wagmi';
import { useEarnX } from './useEarnX';
import { getMantleExplorerUrl } from '../utils/transactionUtils';

export interface InvestmentOpportunity {
  id: string;
  invoiceId: string;
  supplier: string;
  buyer: string;
  amount: string; // In USDC (formatted)
  commodity: string;
  supplierCountry: string;
  buyerCountry: string;
  exporterName: string;
  buyerName: string;
  dueDate: number;
  riskScore: number;
  creditRating: string;
  aprBasisPoints: number; // APR in basis points (e.g., 1200 = 12%)
  targetFunding: string; // Amount needed for investment
  currentFunding: string; // Amount already funded
  fundingPercentage: number; // Percentage funded
  isBlockchainBacked: boolean; // Whether this is on blockchain or API-only
  txHash?: string; // Blockchain transaction hash if available
  blockNumber?: string; // Block number if available
  createdAt: number; // Timestamp
  status: 'available' | 'funding' | 'funded' | 'completed';
}

export interface InvestmentPortfolio {
  totalInvested: string;
  totalReturns: string;
  activeInvestments: number;
  completedInvestments: number;
  investments: Array<{
    id: string;
    invoiceId: string;
    amountInvested: string;
    expectedReturn: string;
    actualReturn?: string;
    status: 'active' | 'completed' | 'defaulted';
    investmentDate: number;
    maturityDate: number;
  }>;
}

export function useInvestmentOpportunities() {
  const { address } = useAccount();
  const {
    getInvestmentOpportunities: getBlockchainOpportunities,
    getInvoiceDetails,
    investInInvoice,
    approveUSDC,
    getUSDCAllowance,
    contractAddresses,
    usdcBalance
  } = useEarnX();
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [portfolio, setPortfolio] = useState<InvestmentPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate APR from risk score
  const calculateAPR = (riskScore: number): number => {
    const baseAPR = 800; // 8% in basis points
    const riskPremium = (riskScore * 1200) / 100; // Up to 12% additional based on risk
    const totalAPR = baseAPR + riskPremium;
    return Math.min(totalAPR, 2000); // Cap at 20%
  };

  // Calculate target funding (80% of invoice amount)
  const calculateTargetFunding = (amount: string): string => {
    const amountNum = parseFloat(amount);
    return (amountNum * 0.8).toFixed(2);
  };

  // Load opportunities from localStorage (API-only invoices)
  const loadAPIOpportunities = useCallback((): InvestmentOpportunity[] => {
    try {
      const storedInvoices = localStorage.getItem('demo_invoices');
      if (!storedInvoices) {
        return [];
      }

      const invoices = JSON.parse(storedInvoices);
      const apiOpportunities: InvestmentOpportunity[] = [];

      Object.values(invoices).forEach((invoice: any) => {
        console.log('🔍 Checking invoice for investment readiness:', {
          invoiceId: invoice.invoiceId || invoice.id,
          hasVerification: !!invoice.verification,
          verification: invoice.verification,
          isVerified: invoice.isVerified,
          investmentReady: invoice.investmentReady,
          riskScore: invoice.riskScore
        });

        // Check multiple possible structures for investment readiness
        let isInvestmentReady = false;
        let isValid = false;
        let riskScore = 50;
        let creditRating = 'B';

        // New structure with verification object
        if (invoice.verification) {
          isValid = invoice.verification.isValid;
          isInvestmentReady = invoice.verification.investmentReady;
          riskScore = invoice.verification.riskScore || 35;
          creditRating = invoice.verification.creditRating || 'B';
        }
        // Legacy structure with direct properties
        else if (invoice.isVerified !== undefined) {
          isValid = invoice.isVerified;
          isInvestmentReady = invoice.investmentReady || (invoice.isVerified && (invoice.riskScore || 35) < 50);
          riskScore = invoice.riskScore || 35;
          creditRating = invoice.creditRating || 'B';
        }

        console.log('📊 Processed verification:', { isValid, isInvestmentReady, riskScore, creditRating });

        // Include verified invoices that are investment ready
        if (isValid && isInvestmentReady) {
          const amount = parseFloat(invoice.amount || '0');
          const targetFunding = calculateTargetFunding(amount.toString());
          const aprBasisPoints = calculateAPR(riskScore);

          const opportunity = {
            id: `api-${invoice.invoiceId || invoice.id}`,
            invoiceId: invoice.invoiceId || invoice.id,
            supplier: invoice.supplier || address || 'Unknown',
            buyer: invoice.buyer || 'Unknown Buyer',
            amount: amount.toFixed(2),
            commodity: invoice.commodity || 'Trade Finance',
            supplierCountry: invoice.supplierCountry || 'Unknown',
            buyerCountry: invoice.buyerCountry || 'Unknown',
            exporterName: invoice.exporterName || 'Unknown Exporter',
            buyerName: invoice.buyerName || 'Unknown Buyer',
            dueDate: invoice.dueDate || Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
            riskScore: riskScore,
            creditRating: creditRating,
            aprBasisPoints,
            targetFunding,
            currentFunding: '0.00',
            fundingPercentage: 0,
            isBlockchainBacked: invoice.verification?.blockchainSubmitted || invoice.blockchainSubmitted || false,
            txHash: invoice.txHash,
            blockNumber: invoice.blockNumber,
            createdAt: invoice.createdAt || invoice.timestamp || Date.now(),
            status: 'available' as const
          };

          console.log('✅ Added investment opportunity:', opportunity);
          apiOpportunities.push(opportunity);
        } else {
          console.log('❌ Invoice not ready for investment:', {
            invoiceId: invoice.invoiceId || invoice.id,
            isValid,
            isInvestmentReady,
            reason: !isValid ? 'Not verified' : 'Not marked as investment ready'
          });
        }
      });

      return apiOpportunities;
    } catch (error) {
      console.error('Error loading API opportunities:', error);
      return [];
    }
  }, [address]);

  // Load blockchain opportunities
  const loadBlockchainOpportunities = useCallback(async (): Promise<InvestmentOpportunity[]> => {
    try {
      console.log('🔗 Loading blockchain investment opportunities...');

      // Get opportunity IDs from blockchain
      const opportunityIds = await getBlockchainOpportunities();
      console.log('📋 Found opportunity IDs:', opportunityIds);

      if (!opportunityIds || opportunityIds.length === 0) {
        console.log('📋 No blockchain opportunities found');
        return [];
      }

      const blockchainOpportunities: InvestmentOpportunity[] = [];

      // Fetch details for each opportunity
      for (const id of opportunityIds) {
        try {
          // Ensure id is a primitive value, not an object
          const invoiceId = typeof id === 'object' ? String(Object.values(id)[0] || id) : String(id);
          const details = await getInvoiceDetails(invoiceId);
          console.log(`📋 Invoice ${id} details:`, details);

          if (details) {
            // Handle amount as either string or number
            const detailsAmount = (details as any).amount;
            const amountValue = typeof detailsAmount === 'string' ? detailsAmount : String(detailsAmount || '0');
            const amount = parseFloat(amountValue);

            // Get target funding and current funding from blockchain data
            // Note: getInvoiceDetails already converts from wei to human-readable format
            const targetFundingRaw = (details as any).targetFunding;
            const currentFundingRaw = (details as any).currentFunding;

            // Values are already in human-readable format (getInvoiceDetails divides by 1e6)
            const targetFundingValue = targetFundingRaw
              ? parseFloat(String(targetFundingRaw))
              : parseFloat(calculateTargetFunding(amount.toString()));
            const currentFundingValue = currentFundingRaw
              ? parseFloat(String(currentFundingRaw))
              : 0;

            const fundingPercentage = targetFundingValue > 0 ? (currentFundingValue / targetFundingValue) * 100 : 0;

            // Get APR and risk from blockchain if available
            const riskScore = (details as any).riskScore ? Number((details as any).riskScore) : 35;
            const aprBasisPoints = (details as any).aprBasisPoints ? Number((details as any).aprBasisPoints) : calculateAPR(riskScore);
            const creditRating = (details as any).creditRating || 'B+';

            // Determine status based on invoice status from blockchain
            const invoiceStatus = (details as any).status;
            let opportunityStatus: 'available' | 'funding' | 'funded' | 'completed' = 'available';
            if (invoiceStatus === 2) opportunityStatus = 'available'; // Verified
            else if (invoiceStatus === 3) opportunityStatus = 'funded'; // FullyFunded
            else if (invoiceStatus >= 5) opportunityStatus = 'completed'; // Funded, Repaid, etc.

            // If has current funding but not fully funded, it's "funding"
            if (currentFundingValue > 0 && fundingPercentage < 100) {
              opportunityStatus = 'funding';
            }

            console.log(`📊 Invoice ${invoiceId} funding: ${currentFundingValue}/${targetFundingValue} (${fundingPercentage.toFixed(1)}%)`);

            blockchainOpportunities.push({
              id: `blockchain-${invoiceId}`,
              invoiceId: invoiceId,
              supplier: (details as any).supplier || 'Unknown',
              buyer: (details as any).buyer || 'Unknown Buyer',
              amount: amount.toFixed(2),
              commodity: (details as any).commodity || 'Trade Finance',
              supplierCountry: (details as any).supplierCountry || 'Unknown',
              buyerCountry: (details as any).buyerCountry || 'Unknown',
              exporterName: (details as any).exporterName || 'Unknown Exporter',
              buyerName: (details as any).buyerName || 'Unknown Buyer',
              dueDate: (details as any).dueDate || Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
              riskScore: riskScore,
              creditRating: creditRating,
              aprBasisPoints,
              targetFunding: targetFundingValue.toFixed(2),
              currentFunding: currentFundingValue.toFixed(2),
              fundingPercentage: Math.min(fundingPercentage, 100),
              isBlockchainBacked: true,
              txHash: undefined,
              blockNumber: undefined,
              createdAt: (details as any).createdAt ? Number((details as any).createdAt) * 1000 : Date.now(),
              status: opportunityStatus
            });
          }
        } catch (error) {
          console.error(`❌ Error loading details for opportunity ${id}:`, error);
        }
      }

      console.log('✅ Loaded blockchain opportunities:', blockchainOpportunities);
      return blockchainOpportunities;
    } catch (error) {
      console.error('❌ Error loading blockchain opportunities:', error);
      return [];
    }
  }, [getBlockchainOpportunities, getInvoiceDetails]);

  // Load investment opportunities
  const loadOpportunities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load blockchain opportunities ONLY (more reliable, no duplicates)
      const blockchainOpportunities = await loadBlockchainOpportunities();

      // Deduplicate by invoice ID (prefer blockchain version)
      const seenInvoiceIds = new Set<string>();
      const uniqueOpportunities: InvestmentOpportunity[] = [];

      // Add blockchain opportunities first (they take priority)
      for (const opp of blockchainOpportunities) {
        const invoiceId = opp.invoiceId;
        if (!seenInvoiceIds.has(invoiceId)) {
          seenInvoiceIds.add(invoiceId);
          uniqueOpportunities.push(opp);
        }
      }

      // Sort by creation date (newest first)
      uniqueOpportunities.sort((a, b) => b.createdAt - a.createdAt);

      console.log('✅ Loaded unique opportunities:', uniqueOpportunities.length);
      setOpportunities(uniqueOpportunities);

    } catch (error) {
      console.error('❌ Error loading opportunities:', error);
      setError(error instanceof Error ? error.message : 'Failed to load opportunities');
    } finally {
      setIsLoading(false);
    }
  }, [loadBlockchainOpportunities]);

  // Load user's investment portfolio
  const loadPortfolio = useCallback(async () => {
    if (!address) return;

    try {
      console.log('📊 Loading investment portfolio...');

      // Load from localStorage for now
      const storedPortfolio = localStorage.getItem(`portfolio_${address}`);
      if (storedPortfolio) {
        const portfolio = JSON.parse(storedPortfolio);
        setPortfolio(portfolio);
        console.log('✅ Portfolio loaded:', portfolio);
      } else {
        // Initialize empty portfolio
        const emptyPortfolio: InvestmentPortfolio = {
          totalInvested: '0.00',
          totalReturns: '0.00',
          activeInvestments: 0,
          completedInvestments: 0,
          investments: []
        };
        setPortfolio(emptyPortfolio);
      }

    } catch (error) {
      console.error('❌ Error loading portfolio:', error);
    }
  }, [address]);

  // Invest in an opportunity - REAL BLOCKCHAIN TRANSACTIONS
  const investInOpportunity = useCallback(async (
    opportunityId: string,
    investmentAmount: string
  ): Promise<{ success: boolean; error?: string; txHash?: string; step?: string }> => {
    if (!address) {
      return { success: false, error: 'Please connect your wallet' };
    }

    try {
      console.log(`💰 Investing ${investmentAmount} USDC in opportunity ${opportunityId}`);

      const opportunity = opportunities.find(op => op.id === opportunityId);
      if (!opportunity) {
        return { success: false, error: 'Opportunity not found' };
      }

      // Check if this is a blockchain-backed opportunity
      if (!opportunity.isBlockchainBacked) {
        return { success: false, error: 'This opportunity is not blockchain-verified. Only verified invoices can be invested in.' };
      }

      const amount = parseFloat(investmentAmount);

      // Check USDC balance
      if (!usdcBalance || usdcBalance < amount) {
        return { success: false, error: `Insufficient USDC balance. You have ${(usdcBalance || 0).toFixed(2)} USDC but need ${amount} USDC.` };
      }

      // Step 1: Check and approve USDC if needed
      console.log('💳 Checking USDC allowance...');
      const amountWei = amount * 1e6; // USDC has 6 decimals
      const allowance = await getUSDCAllowance(contractAddresses.PROTOCOL);

      console.log(`💳 USDC allowance: ${allowance / 1e6} USDC, need: ${amount} USDC`);

      if (allowance < amountWei) {
        console.log('💳 Insufficient allowance, requesting approval...');

        const approvalResult = await approveUSDC(contractAddresses.PROTOCOL, investmentAmount);

        if (!approvalResult.success) {
          return { success: false, error: approvalResult.error || 'Failed to approve USDC spending', step: 'approval' };
        }

        console.log('✅ USDC approval successful');
      }

      // Step 2: Execute investment on blockchain
      console.log('🔗 Executing blockchain investment for invoice:', opportunity.invoiceId);
      const result = await investInInvoice(opportunity.invoiceId, investmentAmount);

      if (!result.success) {
        return { success: false, error: result.error || 'Investment transaction failed', step: 'investment' };
      }

      console.log('✅ Blockchain investment successful!', result.txHash);

      // Step 3: Update local state after successful blockchain transaction
      const investment = {
        id: `inv-${Date.now()}`,
        invoiceId: opportunity.invoiceId,
        amountInvested: investmentAmount,
        expectedReturn: (parseFloat(investmentAmount) * (1 + opportunity.aprBasisPoints / 10000)).toFixed(2),
        status: 'active' as const,
        investmentDate: Date.now(),
        maturityDate: opportunity.dueDate * 1000
      };

      // Update portfolio
      const currentPortfolio = portfolio || {
        totalInvested: '0.00',
        totalReturns: '0.00',
        activeInvestments: 0,
        completedInvestments: 0,
        investments: []
      };

      const updatedPortfolio: InvestmentPortfolio = {
        ...currentPortfolio,
        totalInvested: (parseFloat(currentPortfolio.totalInvested) + parseFloat(investmentAmount)).toFixed(2),
        activeInvestments: currentPortfolio.activeInvestments + 1,
        investments: [...currentPortfolio.investments, investment]
      };

      // Save to localStorage
      localStorage.setItem(`portfolio_${address}`, JSON.stringify(updatedPortfolio));
      setPortfolio(updatedPortfolio);

      // Update opportunity funding
      const updatedOpportunities = opportunities.map(op => {
        if (op.id === opportunityId) {
          const newCurrentFunding = (parseFloat(op.currentFunding) + parseFloat(investmentAmount)).toFixed(2);
          const newFundingPercentage = (parseFloat(newCurrentFunding) / parseFloat(op.targetFunding)) * 100;

          return {
            ...op,
            currentFunding: newCurrentFunding,
            fundingPercentage: Math.min(newFundingPercentage, 100),
            status: newFundingPercentage >= 100 ? 'funded' as const : 'funding' as const
          };
        }
        return op;
      });

      setOpportunities(updatedOpportunities);

      return {
        success: true,
        txHash: result.txHash
      };

    } catch (error) {
      console.error('❌ Investment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Investment failed'
      };
    }
  }, [address, opportunities, portfolio, usdcBalance, getUSDCAllowance, approveUSDC, investInInvoice, contractAddresses]);

  // Load data on mount and when address changes
  useEffect(() => {
    loadOpportunities();
    loadPortfolio();
  }, [loadOpportunities, loadPortfolio]);

  return {
    opportunities,
    portfolio,
    isLoading,
    error,
    loadOpportunities,
    loadPortfolio,
    investInOpportunity
  };
}
