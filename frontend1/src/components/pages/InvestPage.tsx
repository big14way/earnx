// Fixed InvestPage with Proper TypeScript Types & Null Safety
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Clock, ExternalLink, Loader2, RefreshCw, TrendingUp, DollarSign, AlertCircle, FileText, Zap, CheckCircle, MapPin, Building, Users, X, Check, AlertTriangle } from 'lucide-react';
import { useEarnX } from '../../hooks/useEarnX';
import { useInvestmentOpportunities } from '../../hooks/useInvestmentOpportunities';
import { InvestmentSkeleton, LoadingSkeleton } from '../ui/LoadingSkeleton';

// ✅ FIXED: Use the correct interface from the hook
import { InvestmentOpportunity } from '../../hooks/useInvestmentOpportunities';

// Additional interface for display formatting
interface FormattedOpportunity extends InvestmentOpportunity {
  // Computed properties for display
  totalAmount: number;
  remainingFunding: number;
  fundingProgress: number;
  apr: number;
  numInvestors: number;
  minInvestment: number;
  maxInvestment: number;
  daysToMaturity: number;
  documentVerified: boolean;
  riskCategory: string;
  isAvailable: boolean;
  isFullyFunded: boolean;
  formatted: {
    totalAmount: string;
    targetFunding: string;
    currentFunding: string;
    remainingFunding: string;
    apr: string;
    fundingProgress: string;
    tradeRoute: string;
    dueDate: string;
  };
}

interface PortfolioInvestment {
  id: number; // Required - must exist
  status: number;
  supplier: string;
  buyer: string;
  totalAmount: number;
  targetFunding: number;
  currentFunding: number;
  remainingFunding: number;
  fundingProgress: number;
  apr: number;
  aprBasisPoints?: number; // Optional
  numInvestors: number;
  minInvestment: number;
  maxInvestment: number;
  commodity: string;
  exporterName: string;
  buyerName: string;
  supplierCountry: string;
  buyerCountry: string;
  daysToMaturity: number;
  submittedDate?: number; // Optional
  dueDate?: number; // Optional
  documentVerified: boolean;
  riskScore: number;
  riskCategory: string;
  creditRating: string;
  isAvailable: boolean;
  isFullyFunded?: boolean; // Optional
  tradeDuration?: number; // Optional
  formatted?: { // Optional - might not exist initially
    totalAmount: string;
    targetFunding: string;
    currentFunding: string;
    remainingFunding: string;
    apr: string;
    fundingProgress: string;
    tradeRoute: string;
    dueDate: string;
  };
  investment: {
    amount: number;
    share: number;
    potentialReturn: number;
    potentialProfit: number;
    formatted: {
      amount: string;
      share: string;
      potentialReturn: string;
      potentialProfit: string;
    };
  };
}

interface TransactionStatus {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  txHash?: string;
  show: boolean;
}

// ✅ FIXED: Helper function to safely check if object is valid opportunity
const isValidOpportunity = (opp: any): opp is InvestmentOpportunity => {
  // Handle both numeric IDs (from blockchain) and string IDs (from hybrid hook like "blockchain-1")
  const hasValidId = opp && (typeof opp.id === 'number' || typeof opp.id === 'string');
  // Status can be number (from blockchain) or string (from hybrid hook like 'available')
  const hasValidStatus = typeof opp.status === 'number' ? opp.status === 2 : opp.status === 'available' || opp.status === 'funding';
  // Remaining funding can be calculated or direct
  const hasRemainingFunding = (typeof opp.remainingFunding === 'number' && opp.remainingFunding > 0) ||
                               (opp.targetFunding && opp.currentFunding &&
                                parseFloat(opp.targetFunding) > parseFloat(opp.currentFunding));

  return hasValidId && hasValidStatus && hasRemainingFunding;
};

// ✅ FIXED: Helper function to safely check if object is valid portfolio investment
const isValidPortfolioInvestment = (inv: any): inv is PortfolioInvestment => {
  return inv && 
         typeof inv === 'object' && 
         typeof inv.id === 'number' && 
         inv.investment &&
         typeof inv.investment === 'object' &&
         typeof inv.investment.amount === 'number' &&
         inv.investment.amount > 0;
};

const InvestPage: React.FC = () => {
  const {
    isConnected,
    address,
    isLoading,
    protocolStats,
    usdcBalance,
    getInvestmentOpportunities,
    investInInvoice,
    approveUSDC,
    getUSDCAllowance,
    mintTestUSDC,
    contractAddresses,
    refreshBalance,
  } = useEarnX();

  // ✅ NEW: Use the hybrid investment opportunities hook for API + blockchain data
  const {
    opportunities: hybridOpportunities,
    portfolio: hybridPortfolio,
    isLoading: hybridLoading,
    error: hybridError,
    loadOpportunities: reloadOpportunities,
    investInOpportunity: hybridInvestInOpportunity
  } = useInvestmentOpportunities();

  const [opportunities, setOpportunities] = useState<FormattedOpportunity[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioInvestment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [processingStep, setProcessingStep] = useState<'idle' | 'checking' | 'approving' | 'investing'>('idle');
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>({
    type: 'info',
    message: '',
    show: false,
  });

  const showStatus = useCallback((type: TransactionStatus['type'], message: string, txHash?: string) => {
    setTransactionStatus({ type, message, txHash, show: true });
    // Auto-dismiss success and warning messages
    if (type === 'success' || type === 'warning') {
      setTimeout(() => setTransactionStatus(prev => ({ ...prev, show: false })), 5000);
    }
  }, []);

  // ✅ FIXED: Enhanced data loading with proper null safety
  const loadData = useCallback(async () => {
    if (!isConnected) {
      setLoading(false);
      return;
    }

    if (!getInvestmentOpportunities) {
      console.log('❌ Required functions not available');
      showStatus('warning', 'Some required functions are not available. Please check your useEarnX hook.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('📊 Loading investment opportunities and portfolio...');

      // ✅ NEW: Use hybrid opportunities from API + blockchain
      console.log('✅ Using hybrid opportunities:', hybridOpportunities);
      console.log('✅ Using hybrid portfolio:', hybridPortfolio);

      // Convert hybrid opportunities to the expected format
      const validOpportunities: FormattedOpportunity[] = hybridOpportunities.map((hybridOp) => {
          // Convert hybrid opportunity to expected format
          const totalAmount = parseFloat(hybridOp.amount);
          const targetFunding = parseFloat(hybridOp.targetFunding);
          const currentFunding = parseFloat(hybridOp.currentFunding);
          const remainingFunding = targetFunding - currentFunding;
          const apr = hybridOp.aprBasisPoints / 100; // Convert basis points to percentage
          const daysToMaturity = Math.ceil((hybridOp.dueDate * 1000 - Date.now()) / (24 * 60 * 60 * 1000));

          return {
            // Original hook properties
            ...hybridOp,
            totalAmount,
            remainingFunding,
            fundingProgress: hybridOp.fundingPercentage,
            apr,
            numInvestors: Math.floor(currentFunding / 1000), // Estimate based on funding
            minInvestment: 100,
            maxInvestment: Math.max(remainingFunding, 100),
            daysToMaturity,
            documentVerified: true,
            riskCategory: hybridOp.riskScore < 30 ? 'Low' as const : hybridOp.riskScore < 60 ? 'Medium' as const : 'High' as const,
            isAvailable: hybridOp.status === 'available',
            isFullyFunded: hybridOp.fundingPercentage >= 100,
            formatted: {
              totalAmount: `$${totalAmount.toLocaleString()}`,
              targetFunding: `$${targetFunding.toLocaleString()}`,
              currentFunding: `$${currentFunding.toLocaleString()}`,
              remainingFunding: `$${remainingFunding.toLocaleString()}`,
              apr: `${apr.toFixed(2)}%`,
              fundingProgress: `${hybridOp.fundingPercentage.toFixed(1)}%`,
              tradeRoute: `${hybridOp.supplierCountry} → ${hybridOp.buyerCountry}`,
              dueDate: new Date(hybridOp.dueDate * 1000).toLocaleDateString(),
            }
          };
        });
      
      // Portfolio data processing - convert hybrid portfolio to expected format
      const validPortfolio: PortfolioInvestment[] = hybridPortfolio?.investments.map((investment) => {
        // Find the corresponding opportunity to get full details
        const correspondingOpportunity = hybridOpportunities.find(op => op.invoiceId === investment.invoiceId);
        const investmentAmount = parseFloat(investment.amountInvested);
        const expectedReturn = parseFloat(investment.expectedReturn);
        const potentialProfit = expectedReturn - investmentAmount;
        const sharePercentage = correspondingOpportunity ? (investmentAmount / parseFloat(correspondingOpportunity.targetFunding)) * 100 : 0;

        return {
          id: parseInt(investment.id.replace('inv-', '')),
          status: investment.status === 'active' ? 1 : investment.status === 'completed' ? 2 : 0,
          supplier: correspondingOpportunity?.supplier || 'Unknown',
          buyer: correspondingOpportunity?.buyer || 'Unknown',
          totalAmount: correspondingOpportunity ? parseFloat(correspondingOpportunity.amount) : investmentAmount,
          targetFunding: correspondingOpportunity ? parseFloat(correspondingOpportunity.targetFunding) : investmentAmount,
          currentFunding: correspondingOpportunity ? parseFloat(correspondingOpportunity.currentFunding) : investmentAmount,
          remainingFunding: correspondingOpportunity ? parseFloat(correspondingOpportunity.targetFunding) - parseFloat(correspondingOpportunity.currentFunding) : 0,
          fundingProgress: correspondingOpportunity ? correspondingOpportunity.fundingPercentage : 100,
          apr: correspondingOpportunity ? correspondingOpportunity.aprBasisPoints / 100 : 12,
          aprBasisPoints: correspondingOpportunity?.aprBasisPoints || 1200,
          numInvestors: 1, // Simplified
          minInvestment: 100,
          maxInvestment: investmentAmount,
          commodity: correspondingOpportunity?.commodity || 'Trade Finance',
          exporterName: correspondingOpportunity?.exporterName || 'Unknown Exporter',
          buyerName: correspondingOpportunity?.buyerName || 'Unknown Buyer',
          supplierCountry: correspondingOpportunity?.supplierCountry || 'Unknown',
          buyerCountry: correspondingOpportunity?.buyerCountry || 'Unknown',
          daysToMaturity: Math.ceil((investment.maturityDate - Date.now()) / (24 * 60 * 60 * 1000)),
          submittedDate: Math.floor(investment.investmentDate / 1000),
          dueDate: Math.floor(investment.maturityDate / 1000),
          documentVerified: true,
          riskScore: correspondingOpportunity?.riskScore || 35,
          riskCategory: correspondingOpportunity ? (correspondingOpportunity.riskScore < 30 ? 'Low' : correspondingOpportunity.riskScore < 60 ? 'Medium' : 'High') : 'Medium',
          creditRating: correspondingOpportunity?.creditRating || 'B',
          isAvailable: false, // Already invested
          isFullyFunded: correspondingOpportunity ? correspondingOpportunity.fundingPercentage >= 100 : false,
          tradeDuration: Math.ceil((investment.maturityDate - investment.investmentDate) / (24 * 60 * 60 * 1000)),
          formatted: {
            totalAmount: `$${(correspondingOpportunity ? parseFloat(correspondingOpportunity.amount) : investmentAmount).toLocaleString()}`,
            targetFunding: `$${(correspondingOpportunity ? parseFloat(correspondingOpportunity.targetFunding) : investmentAmount).toLocaleString()}`,
            currentFunding: `$${(correspondingOpportunity ? parseFloat(correspondingOpportunity.currentFunding) : investmentAmount).toLocaleString()}`,
            remainingFunding: `$${(correspondingOpportunity ? parseFloat(correspondingOpportunity.targetFunding) - parseFloat(correspondingOpportunity.currentFunding) : 0).toLocaleString()}`,
            apr: `${(correspondingOpportunity ? correspondingOpportunity.aprBasisPoints / 100 : 12).toFixed(2)}%`,
            fundingProgress: `${(correspondingOpportunity ? correspondingOpportunity.fundingPercentage : 100).toFixed(1)}%`,
            tradeRoute: `${correspondingOpportunity?.supplierCountry || 'Unknown'} → ${correspondingOpportunity?.buyerCountry || 'Unknown'}`,
            dueDate: new Date(investment.maturityDate).toLocaleDateString(),
          },
          investment: {
            amount: investmentAmount,
            share: sharePercentage,
            potentialReturn: expectedReturn,
            potentialProfit: potentialProfit,
            formatted: {
              amount: `$${investmentAmount.toLocaleString()}`,
              share: `${sharePercentage.toFixed(2)}%`,
              potentialReturn: `$${expectedReturn.toLocaleString()}`,
              potentialProfit: `$${potentialProfit.toLocaleString()}`,
            }
          }
        };
      }) || [];

      setOpportunities(validOpportunities);
      setPortfolio(validPortfolio);

      if (validOpportunities.length === 0 && address) {
        // Check what's actually in localStorage for debugging
        const storedInvoices = localStorage.getItem('demo_invoices');
        const invoiceCount = storedInvoices ? Object.keys(JSON.parse(storedInvoices)).length : 0;

        if (invoiceCount > 0) {
          showStatus('warning', `Found ${invoiceCount} submitted invoices but none are investment-ready. Check that invoices are verified and marked as investment-ready.`);
        } else {
          showStatus('info', 'No investment opportunities available. Submit and verify invoices to create opportunities.');
        }
      } else if (validOpportunities.length > 0) {
        showStatus('success', `Found ${validOpportunities.length} investment opportunities!`);
      }
      
    } catch (error) {
      console.error('❌ Error loading investment data:', error);
      setOpportunities([]);
      setPortfolio([]);
      showStatus('error', `Failed to load investment data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, getInvestmentOpportunities, showStatus, hybridOpportunities, hybridPortfolio]);

  // Refresh data with user feedback
  const handleRefresh = async () => {
    setRefreshing(true);
    showStatus('info', 'Refreshing investment opportunities...');

    try {
      // Reload hybrid opportunities first
      await reloadOpportunities();

      // Then reload the page data
      await loadData();

      if (refreshBalance) {
        await refreshBalance();
      }
      showStatus('success', 'Investment opportunities refreshed successfully!');
    } catch (error) {
      showStatus('error', `Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ FIXED: Investment handler with hybrid approach (API + blockchain)
  const handleInvest = async (invoiceId: string, amount: string) => {
    if (!amount || !invoiceId) {
      showStatus('error', 'Please enter a valid investment amount and select an opportunity.');
      return;
    }

    // Find the opportunity to get the hybrid ID
    console.log('🔍 Looking for opportunity with ID:', invoiceId);
    console.log('🔍 Available opportunities:', opportunities.map(op => ({ id: op.id, invoiceId: op.invoiceId })));

    const opportunity = opportunities.find(op => op.id === invoiceId);
    if (!opportunity) {
      console.error('❌ Opportunity not found. Available IDs:', opportunities.map(op => op.id));
      showStatus('error', 'Investment opportunity not found.');
      return;
    }

    console.log('✅ Found opportunity:', opportunity);

    // Use the hybrid investment function - use the original ID from the hook
    const hybridOpportunityId = opportunity.id; // Use the actual ID from the hook

    try {
      setProcessingStep('checking');
      const amountNum = parseFloat(amount);

      if (isNaN(amountNum) || amountNum <= 0) {
        showStatus('error', 'Please enter a valid investment amount');
        return;
      }

      console.log(`🚀 Starting hybrid investment: ${amount} USDC in opportunity ${hybridOpportunityId}`);

      // Use the hybrid investment function (works with API data)
      showStatus('info', 'Processing investment...');
      setProcessingStep('investing');

      const result = await hybridInvestInOpportunity(hybridOpportunityId, amount);

      // Handle different return types from Para vs Wagmi
      if (typeof result === 'object' && result !== null && 'success' in result && result.success) {
        showStatus('success', `Successfully invested ${amount} USDC!`, 'txHash' in result ? result.txHash : undefined);

        // Reset processing step
        setProcessingStep('idle');

        // Refresh the data to show updated funding
        await reloadOpportunities();

        // Clear the investment form
        setSelectedInvoice(null);
        setInvestmentAmount('');

        console.log('✅ Investment completed successfully');
      } else {
        throw new Error(result.error || 'Investment failed');
      }

    } catch (error) {
      console.error('❌ Investment error:', error);
      setProcessingStep('idle');
      
      let errorMessage = 'Investment failed';
      if (error instanceof Error) {
        if (error.message.includes('insufficient')) {
          errorMessage = error.message;
        } else if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was cancelled by user';
        } else if (error.message.includes('exceeds')) {
          errorMessage = 'Investment amount too high';
        } else if (error.message.includes('not available') || error.message.includes('not ready')) {
          errorMessage = 'Invoice not ready for investment';
        } else {
          errorMessage = error.message;
        }
      }
      
      showStatus('error', errorMessage);
    }
  };

  // Quick USDC mint for testing
  const handleMintUSDC = async () => {
    try {
      showStatus('info', 'Checking USDC balance and minting if needed...');
      const result = await mintTestUSDC('10000');
      console.log('Mint result:', result);

      // Handle different return types from Para vs Wagmi
      if (typeof result === 'object' && result !== null && 'success' in result) {
        if (result.success) {
          if ('skipMint' in result && result.skipMint) {
            showStatus('info', result.message || 'You already have sufficient USDC balance!');
          } else {
            showStatus('success', result.message || 'Successfully minted 10,000 test USDC!', 'txHash' in result ? result.txHash : undefined);
          }
        }
        setTimeout(async () => {
          if (refreshBalance) await refreshBalance();
        }, 3000);
      } else if (typeof result === 'object' && result !== null && 'error' in result) {
        showStatus('error', (result as any).error || 'Failed to mint USDC');
      } else {
        showStatus('error', 'Failed to mint USDC');
      }
    } catch (error) {
      showStatus('error', 'Failed to mint test USDC');
    }
  };

  // Load data on mount and when connection changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Transaction status component
  const TransactionStatusAlert = () => {
    if (!transactionStatus.show) return null;

    return (
      <div className={`fixed top-4 left-4 right-4 z-50 ${
        transactionStatus.type === 'success' ? 'bg-green-100 border-green-400 text-green-700' :
        transactionStatus.type === 'error' ? 'bg-red-100 border-red-400 text-red-700' :
        transactionStatus.type === 'warning' ? 'bg-yellow-100 border-yellow-400 text-yellow-700' :
        'bg-blue-100 border-blue-400 text-blue-700'
      } border rounded-lg p-4 shadow-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {transactionStatus.type === 'success' && <Check className="w-5 h-5" />}
            {transactionStatus.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {transactionStatus.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
            {transactionStatus.type === 'info' && <AlertCircle className="w-5 h-5" />}
            <div>
              <p className="font-medium">{transactionStatus.message}</p>
              {transactionStatus.txHash && (
                <a 
                  href={`https://explorer.sepolia.mantle.xyz/tx/${transactionStatus.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline hover:no-underline"
                >
                  View transaction ↗
                </a>
              )}
            </div>
          </div>
          <button
            onClick={() => setTransactionStatus(prev => ({ ...prev, show: false }))}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Processing indicator
  const getProcessingMessage = () => {
    switch (processingStep) {
      case 'checking': return 'Checking balances and allowances...';
      case 'approving': return 'Approving USDC. Please confirm in wallet...';
      case 'investing': return 'Making investment. Please confirm in wallet...';
      default: return '';
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 text-center">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600">Please connect your wallet to view investment opportunities.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
     <div>
      <TransactionStatusAlert />
      
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 pt-32 sm:px-6 sm:pt-28 ">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          
          {/* Mobile-Optimized Header */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 ">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Investment Opportunities</h1>
                <p className="text-gray-600 text-sm sm:text-base">Invest in verified African trade receivables</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="text-center sm:text-right">
                  <p className="text-sm text-gray-500">Your Balance</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">${(usdcBalance || 0).toFixed(2)} USDC</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleMintUSDC}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    🏦 Mint USDC
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Protocol Stats */}
          {protocolStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500">Funds Raised</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">${protocolStats.totalFundsRaised.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500">Available</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{opportunities.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500">Your Investments</p>
                <p className="text-lg sm:text-2xl font-bold text-indigo-600">{portfolio.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 col-span-2 sm:col-span-1">
                <p className="text-xs sm:text-sm text-gray-500">Verified</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-600">{protocolStats.verifiedInvoices}</p>
              </div>
            </div>
          )}

          {/* Processing Status */}
          {processingStep !== 'idle' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <div>
                  <h3 className="font-medium text-blue-900">Processing Investment</h3>
                  <p className="text-blue-700 text-sm">{getProcessingMessage()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Loading State */}
          {loading && <InvestmentSkeleton />}


          {/* No Opportunities State */}
          {!loading && opportunities.length === 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 text-center">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No Investment Opportunities</h3>
              <p className="text-gray-600 mb-4 text-sm sm:text-base">There are currently no verified invoices available for investment.</p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <h4 className="font-medium text-blue-900 mb-2">📋 To create investment opportunities:</h4>
                <ol className="text-sm text-blue-800 space-y-1 text-left">
                  <li>1. Submit an invoice with trade documents</li>
                  <li>2. Complete oracle verification</li>
                  <li>3. Invoice becomes available for investment</li>
                </ol>
              </div>
            </div>
          )}

          {/* Investment Opportunities */}
          {!loading && opportunities.length > 0 && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Available Opportunities ({opportunities.length})</h2>
              
              <div className="space-y-4 sm:space-y-6">
                {opportunities.map((opportunity) => (
                  <div key={opportunity.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden card-modern hover:shadow-2xl transition-all duration-500 border border-gray-100 dark:border-gray-700">
                    <div className="p-4 sm:p-6">
                      
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Invoice #{opportunity.id}</h3>
                            <p className="text-sm text-gray-500">{opportunity.commodity} Export</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between sm:justify-end sm:space-x-4">
                          <div className="text-center sm:text-right">
                            <p className="text-xl sm:text-2xl font-bold text-green-600">{opportunity.formatted.apr}</p>
                            <p className="text-xs sm:text-sm text-gray-500">Expected APR</p>
                          </div>
                          
                          <div className="text-center sm:text-right">
                            <p className="text-lg font-semibold text-gray-900">{opportunity.formatted.remainingFunding}</p>
                            <p className="text-xs sm:text-sm text-gray-500">Available</p>
                          </div>
                        </div>
                      </div>

                      {/* Trade Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-gray-500">Trade Route</p>
                          <p className="font-medium">{opportunity.formatted.tradeRoute}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Maturity</p>
                          <p className="font-medium">{opportunity.daysToMaturity} days</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Risk Level</p>
                          <p className="font-medium">{opportunity.riskCategory}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Progress</p>
                          <p className="font-medium">{opportunity.formatted.fundingProgress}</p>
                        </div>
                      </div>

                      {/* Funding Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Funding Progress</span>
                          <span>{opportunity.formatted.fundingProgress}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(opportunity.fundingProgress, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{opportunity.formatted.currentFunding} raised</span>
                          <span>{opportunity.formatted.remainingFunding} needed</span>
                        </div>
                      </div>
                      
                      {/* Investment Section */}
                      {selectedInvoice === opportunity.id ? (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-3">Invest in this opportunity</h4>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Investment Amount (USDC)
                              </label>
                              <input
                                type="number"
                                value={investmentAmount}
                                onChange={(e) => setInvestmentAmount(e.target.value)}
                                placeholder={`Min: ${opportunity.minInvestment.toFixed(0)}`}
                                min={opportunity.minInvestment}
                                max={Math.min(opportunity.maxInvestment, usdcBalance || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-base"
                                disabled={processingStep !== 'idle'}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Min: ${opportunity.minInvestment.toFixed(0)} • Max: ${Math.min(opportunity.maxInvestment, usdcBalance || 0).toFixed(2)} • Balance: ${(usdcBalance || 0).toFixed(2)} USDC
                              </p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                              <button
                                onClick={() => handleInvest(opportunity.id, investmentAmount)}
                                disabled={
                                  processingStep !== 'idle' || 
                                  !investmentAmount || 
                                  parseFloat(investmentAmount) < opportunity.minInvestment ||
                                  parseFloat(investmentAmount) > Math.min(opportunity.maxInvestment, usdcBalance || 0)
                                }
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 text-base"
                              >
                                {processingStep !== 'idle' ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <DollarSign className="w-4 h-4" />
                                )}
                                <span>
                                  {processingStep !== 'idle' ? 'Processing...' : 'Invest Now'}
                                </span>
                              </button>
                              
                              <button
                                onClick={() => {
                                  setSelectedInvoice(null);
                                  setInvestmentAmount('');
                                }}
                                disabled={processingStep !== 'idle'}
                                className="px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedInvoice(opportunity.id)}
                          disabled={processingStep !== 'idle'}
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 btn-modern transform transition-all duration-300 micro-bounce focus-modern"
                        >
                          <TrendingUp className="w-4 h-4" />
                          <span>Invest in this Opportunity</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio Section */}
          {portfolio.length > 0 && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your Investment Portfolio ({portfolio.length})</h2>
              
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="space-y-4">
                  {portfolio.map((investment) => (
                    <div key={investment.id} className="border-b last:border-b-0 pb-4 last:pb-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                        <div>
                          <h4 className="font-semibold text-gray-900">Invoice #{investment.id}</h4>
                          <p className="text-sm text-gray-600">
                            Invested: {investment.investment.formatted.amount}
                          </p>
                          <p className="text-xs text-gray-500">
                            {investment.commodity} • {investment.formatted?.tradeRoute || `${investment.supplierCountry} → ${investment.buyerCountry}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Expected Return</p>
                          <p className="font-semibold text-green-600">
                            {investment.investment.formatted.potentialReturn}
                          </p>
                          <p className="text-xs text-gray-500">
                            {investment.formatted?.apr || `${(investment.apr || 0).toFixed(2)}%`} APR
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-4 sm:p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto sm:mx-0">
                <Zap className="w-6 h-6" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-bold mb-2">How EarnX Investments Work</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-medium mb-1">1. Real Trade Finance</p>
                    <p className="opacity-90">Invest in verified invoices from African exporters backed by real trade transactions.</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">2. Oracle Verified</p>
                    <p className="opacity-90">All invoices are verified through secure oracles using real trade documentation.</p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">3. Automated Returns</p>
                    <p className="opacity-90">Earn yield when buyers pay invoices, with returns automatically distributed to investors.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
     </div>
    </>
  );
};

export default InvestPage;