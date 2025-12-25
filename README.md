# EarnX Protocol

### Democratizing Trade Finance for Africa's Next Generation of Exporters

---

## The $1.6 Trillion Problem

**Africa has a trade finance crisis.**

Every year, African businesses face a staggering **$1.6 trillion trade finance gap**—the largest in the world relative to GDP. This isn't just a statistic; it's millions of farmers, manufacturers, and entrepreneurs who can't access the capital they need to participate in global trade.

### The Reality on the Ground

Meet Amara, a cassava flour exporter in Lagos, Nigeria. Her company, Amara Foods Ltd, has a confirmed $50,000 order from a buyer in Accra, Ghana. The buyer will pay in 60 days. But Amara needs capital **now** to:

- Purchase raw cassava from farmers
- Process and package the flour
- Ship the goods to Ghana
- Pay her workers

**What happens when Amara goes to a traditional bank?**

| Challenge | Traditional Banking Reality |
|-----------|---------------------------|
| **Approval Time** | 60-90 days (by then, she's lost the order) |
| **Interest Rate** | 15-25% APR |
| **Funding Ratio** | 70-80% of invoice value |
| **Minimum Amount** | Often $100,000+ |
| **Documentation** | Weeks of paperwork |
| **Collateral** | Physical assets required |
| **Result** | **70% of SMEs are rejected** |

Amara's story repeats itself across the continent—**70% of African SMEs lack access to trade finance**. The consequences are devastating:

- Exporters sell to local wholesalers at heavy discounts
- Farmers receive lower prices for their crops
- Jobs aren't created
- Communities stay impoverished
- Africa's potential remains locked

---

## Our Solution: EarnX Protocol

**EarnX is the "Robinhood of African Trade Finance"**—a decentralized platform that connects African exporters directly with global investors, bypassing the broken traditional banking system.

### How It Works

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   EXPORTER      │         │   EARNX         │         │   INVESTOR      │
│   (Africa)      │────────▶│   PROTOCOL      │◀────────│   (Global)      │
│                 │         │                 │         │                 │
│ • Submit Invoice│         │ • Verify Trade  │         │ • Browse Deals  │
│ • Upload Docs   │         │ • Assess Risk   │         │ • Fund Invoices │
│ • Get Funded    │         │ • Manage Funds  │         │ • Earn Returns  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### The EarnX Difference

| Metric | Traditional Banking | EarnX Protocol |
|--------|-------------------|----------------|
| **Approval Time** | 60-90 days | **24 hours** |
| **Interest Rate** | 15-25% APR | **8-20% APR** |
| **Funding Ratio** | 70-80% | **90%** |
| **Minimum Investment** | $50,000+ | **$1,000** |
| **Risk Assessment** | Manual (2-3 weeks) | **Real-time (Chainlink)** |
| **Transparency** | Limited | **Full on-chain** |
| **Global Access** | Restricted | **Worldwide** |
| **Currency Risk** | High exposure | **Mitigated with oracles** |

---

## Why Africa? Why Now?

### The Opportunity

- **1.3 billion people** and growing—Africa is the world's youngest and fastest-growing continent
- **$40 billion** in annual trade finance that SMEs need but can't access
- **African Continental Free Trade Area (AfCFTA)** creating the world's largest free trade zone
- **Mobile money adoption** making Africans more financially connected than ever
- **Growing diaspora** eager to invest in continental development

### The Problem We're Solving

Traditional banks have failed African trade for decades because:

1. **High perceived risk** — Banks see Africa as risky without understanding local trade dynamics
2. **Expensive due diligence** — Physical verification costs more than small deals are worth
3. **Currency volatility** — No efficient way to hedge African currency exposure
4. **Information asymmetry** — No standardized way to assess African supplier creditworthiness
5. **Regulatory complexity** — Cross-border compliance is a nightmare

### Our Answer

EarnX uses blockchain technology to solve each of these problems:

| Problem | EarnX Solution |
|---------|---------------|
| High perceived risk | Chainlink oracles for real-time commodity prices and automated risk scoring |
| Expensive due diligence | Smart contract verification with cryptographic document proofs |
| Currency volatility | Real-time currency feeds (NGN, GHS, KES, ZAR) with USDC settlement |
| Information asymmetry | On-chain track record building for African exporters |
| Regulatory complexity | Transparent audit trail for compliance |

---

## Features

### For Exporters

- **Fast Invoice Submission** — Upload trade invoices with export documentation (commercial invoice, certificate of origin, bill of lading, export declaration)
- **Automated Verification** — AI and Chainlink-powered risk assessment in hours, not weeks
- **90% Funding Ratio** — Get most of your invoice value upfront
- **Fair APR** — 8-20% based on actual risk, not arbitrary bank decisions
- **Track Record Building** — Every successful trade builds your on-chain reputation

### For Investors

- **Verified Opportunities** — Browse risk-scored, verified trade finance deals
- **Low Minimum** — Start investing with just $1,000 USDC
- **Real-time Data** — Live commodity prices and currency rates via Chainlink
- **Portfolio Dashboard** — Track investments, returns, and performance
- **NFT Receipts** — Each investment minted as an ERC-721 token for transparency and tradability
- **Automated Returns** — Smart contracts distribute profits upon invoice repayment

### Technology Highlights

- **Chainlink Price Feeds** — Real-time pricing for coffee, cocoa, gold, cotton, cassava, and more
- **Chainlink VRF** — Cryptographically secure random invoice ID generation
- **Cross-Chain (CCIP)** — Bridge invoices between Mantle and Ethereum for liquidity
- **IPFS Storage** — All documents stored permanently via Pinata
- **Gas Optimized** — Built on Mantle for sub-cent transaction fees

---

## Supported Markets

### African Commodities

| Commodity | Common Export Routes |
|-----------|---------------------|
| Cassava | Nigeria → Ghana, Cameroon |
| Coffee | Ethiopia, Kenya → Global |
| Cocoa | Ghana, Ivory Coast → Europe, USA |
| Cotton | Burkina Faso, Mali → Asia |
| Gold | Ghana, Tanzania → Global |
| Tea | Kenya, Rwanda → Global |
| Spices | Madagascar, Tanzania → Global |

### African Currencies (Real-time Conversion)

- 🇳🇬 **NGN** — Nigerian Naira
- 🇬🇭 **GHS** — Ghanaian Cedi
- 🇰🇪 **KES** — Kenyan Shilling
- 🇿🇦 **ZAR** — South African Rand

---

## Live Demo

**Try EarnX now:** [https://frontend1-ten-umber.vercel.app/](https://frontend1-ten-umber.vercel.app/)

> Note: This is a testnet deployment. Use Mantle Sepolia testnet tokens for testing.

---

## Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS with custom animations
- **Web3:** wagmi, viem, ethers.js
- **Wallet:** RainbowKit for multi-wallet support
- **State:** React Context + React Query

### Smart Contracts (Solidity 0.8.19+)
- **Core Protocol:** MantleEarnXProtocol.sol
- **Price Management:** ChainlinkEnhancedPriceManager.sol
- **Random Generation:** ChainlinkVRFInvoiceGenerator.sol
- **Cross-Chain:** CCIPSourceMinterMantle.sol, CCIPDestinationMinterEthereum.sol
- **NFT System:** EarnXInvoiceNFT.sol (ERC-721)
- **Investment Module:** EarnXInvestmentModule.sol
- **Verification:** MantleEarnXVerificationModule.sol

### Backend
- **Framework:** NestJS
- **Database:** MongoDB
- **Document Storage:** IPFS via Pinata
- **Verification:** EIP-712 signature verification

### Blockchain
- **Primary Network:** Mantle Sepolia (Chain ID: 5003)
- **Secondary:** Ethereum Sepolia (for cross-chain NFTs)
- **Oracles:** Chainlink Price Feeds, VRF, CCIP

---

## Project Structure

```
EarnX/
│
├── contracts/                          # Smart Contracts (16 Solidity files)
│   ├── MantleEarnXProtocol.sol        # Core protocol - invoice lifecycle
│   ├── ChainlinkEnhancedPriceManager.sol  # Real-time price feeds
│   ├── ChainlinkVRFInvoiceGenerator.sol   # Secure random ID generation
│   ├── CCIPSourceMinterMantle.sol     # Cross-chain sender (Mantle)
│   ├── CCIPDestinationMinterEthereum.sol  # Cross-chain receiver (Ethereum)
│   ├── EarnXInvoiceNFT.sol            # ERC-721 tokenized invoices
│   ├── MantleEarnXVerificationModule.sol  # EIP-712 verification
│   ├── EarnXInvestmentModule.sol      # Investment management
│   ├── MantleUSDC.sol                 # Test USDC with faucet
│   └── mocks/                         # Mock contracts for testing
│
├── src/                               # React Frontend
│   ├── components/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # Hero, features, CTA
│   │   │   ├── Dashboard.tsx          # Portfolio tracking
│   │   │   ├── InvestPage.tsx         # Investment opportunities
│   │   │   └── SubmitInvoice.tsx      # Invoice submission form
│   │   ├── ui/                        # Reusable UI components
│   │   │   ├── InvestmentModal.tsx
│   │   │   ├── InvestmentCalculator.tsx
│   │   │   ├── LiveMarketData.tsx
│   │   │   └── StatsCard.tsx
│   │   └── layout/
│   │       ├── Navigation.tsx
│   │       └── Footer.tsx
│   │
│   ├── hooks/                         # Custom React Hooks
│   │   ├── useEarnX.ts               # Main protocol interactions
│   │   ├── useMantleEarnX.ts         # Mantle-specific functions
│   │   ├── useNFTInvoiceSystem.ts    # NFT management
│   │   └── useMarketData.ts          # Price feed integration
│   │
│   ├── abis/                          # Contract ABIs (13 files)
│   ├── config/
│   │   ├── wagmi.ts                  # Web3 configuration
│   │   └── mantle.ts                 # Network settings
│   ├── services/
│   │   └── pinataService.ts          # IPFS upload service
│   ├── types/                         # TypeScript definitions
│   └── utils/                         # Helper functions
│
├── earnx-verification-api/            # Backend Service (NestJS)
│   ├── src/
│   └── Dockerfile
│
├── scripts/                           # Deployment Scripts (27 files)
│   ├── deploy-mantle.js              # Main deployment
│   ├── deploy-chainlink-enhanced.js  # Chainlink integration
│   └── test-complete-flow.js         # E2E testing
│
├── test/                              # Contract Tests
├── docs/                              # Documentation
├── hardhat.config.ts                  # Hardhat configuration
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 16+
- MetaMask or compatible Web3 wallet
- MNT tokens for gas (Mantle Sepolia testnet)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/big14way/earnmant.git
   cd earnmant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   npm start
   ```

### Environment Variables

```env
# IPFS (Pinata)
REACT_APP_PINATA_API_KEY=your_pinata_api_key
REACT_APP_PINATA_SECRET_KEY=your_pinata_secret_key

# Backend API
REACT_APP_VERIFICATION_API_URL=https://earnx-verification-api.onrender.com

# Deployment (for contract deployment)
MANTLE_TESTNET_PRIVATE_KEY=your_private_key
```

---

## Network Configuration

### Mantle Sepolia Testnet

| Property | Value |
|----------|-------|
| **Chain ID** | 5003 |
| **RPC URL** | https://rpc.sepolia.mantle.xyz |
| **Block Explorer** | https://explorer.sepolia.mantle.xyz |
| **Native Token** | MNT |
| **Gas Price** | ~0.1 gwei |

### Deployed Contract Addresses

| Contract | Address |
|----------|---------|
| MantleEarnXProtocol | `0x95EAb385c669aca31C0d406c270d6EdDFED0D1ee` |
| EarnXInvoiceNFT | `0x4f330C74c7bd84665722bA0664705e2f2E6080DC` |
| MantleEarnXVerificationModule | `0x4adDFcfa066E0c955bC0347d9565454AD7Ceaae1` |
| EarnXInvestmentModule | `0x199516b47F1ce8C77617b58526ad701bF1f750FA` |
| MantlePriceManager | `0x789f82778A8d9eB6514a457112a563A89F79A2f1` |
| MantleUSDC (Test) | `0x211a38792781b2c7a584a96F0e735d56e809fe85` |

---

## Smart Contract Architecture

### Invoice Lifecycle

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌─────────────┐
│ Submitted│───▶│ Verifying │───▶│ Verified │───▶│ FullyFunded │
└──────────┘    └───────────┘    └──────────┘    └─────────────┘
                     │                                  │
                     ▼                                  ▼
               ┌──────────┐                      ┌──────────┐
               │ Rejected │                      │  Funded  │
               └──────────┘                      └──────────┘
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    ▼                                     ▼
                              ┌──────────┐                          ┌───────────┐
                              │  Repaid  │                          │ Defaulted │
                              └──────────┘                          └───────────┘
```

### Key Smart Contract Features

- **90% Funding Ratio** — Invoices receive 90% of their value in USDC
- **Dynamic APR** — 8-20% range based on real-time risk assessment
- **IPFS Integration** — All documents stored permanently on IPFS
- **ERC-721 Tokenization** — Each invoice becomes a tradeable NFT
- **Role-Based Access** — Separate permissions for suppliers, investors, and committee
- **Gas Optimized** — Designed for Mantle's efficient execution

### Chainlink Integration

| Service | Purpose |
|---------|---------|
| **Price Feeds** | Real-time commodity and currency pricing |
| **VRF** | Cryptographically secure random invoice IDs |
| **CCIP** | Cross-chain NFT minting (Mantle ↔ Ethereum) |

---

## Usage Guide

### For Exporters (Suppliers)

1. **Connect Wallet**
   - Click "Connect Wallet" and select your Web3 wallet
   - Ensure you're on Mantle Sepolia network

2. **Submit an Invoice**
   - Navigate to "Submit Invoice"
   - Fill in trade details:
     - Invoice amount and currency
     - Buyer information
     - Commodity type
     - Trade route (origin → destination)
   - Upload required documents to IPFS
   - Submit for verification

3. **Track Your Invoice**
   - Monitor verification status in Dashboard
   - Once verified, investors can fund your invoice
   - Receive funds when fully funded

### For Investors

1. **Connect Wallet**
   - Connect your Web3 wallet
   - Get test USDC from the built-in faucet

2. **Browse Opportunities**
   - Visit "Invest" page
   - Review verified invoices with:
     - Risk scores
     - Expected APR
     - Funding progress
     - Trade details

3. **Make an Investment**
   - Click "Invest" on a verified invoice
   - Enter investment amount (min $1,000)
   - Confirm transaction

4. **Track Returns**
   - Monitor portfolio in Dashboard
   - Receive returns when invoice is repaid

### Getting Test Tokens

- **MNT:** [Mantle Sepolia Faucet](https://faucet.sepolia.mantle.xyz)
- **USDC:** Use the built-in faucet in the app

---

## Development

### Available Scripts

```bash
# Frontend
npm start          # Start development server
npm run build      # Build for production
npm run test       # Run tests

# Smart Contracts
npx hardhat compile                    # Compile contracts
npx hardhat test                       # Run contract tests
npx hardhat run scripts/deploy-mantle.js --network mantleSepolia  # Deploy
```

### Running Tests

```bash
# Smart contract tests
npx hardhat test

# Frontend tests
npm run test

# End-to-end flow test
npx hardhat run scripts/test-complete-flow.js --network mantleSepolia
```

---

## Impact & Vision

### What Success Looks Like

**For Amara (and millions like her):**
- Receives 90% of her $50,000 invoice within 24 hours
- Pays 12% APR instead of 25%
- Fulfills her order to Ghana on time
- Builds an on-chain credit history for future trades
- Grows her business and employs more workers

**For the African Diaspora:**
- Directly invests in continental growth
- Earns competitive returns (8-20% APR)
- Full transparency on where money goes
- Supports community economic development

**For Africa:**
- Unlocks billions in trapped trade value
- Creates jobs across the supply chain
- Builds financial infrastructure
- Accelerates integration under AfCFTA

### Roadmap

- [x] Core protocol development
- [x] Chainlink oracle integration
- [x] Cross-chain NFT bridge (CCIP)
- [x] Testnet deployment (Mantle Sepolia)
- [ ] Security audit
- [ ] Mainnet deployment
- [ ] Mobile application
- [ ] Additional African currencies
- [ ] Traditional banking API integration
- [ ] KYC/AML compliance module
- [ ] Secondary NFT marketplace

---

## Contributing

We welcome contributions from developers passionate about African trade finance!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Security

This is a testnet deployment for demonstration purposes.

- **Do not use real funds**
- **Smart contracts have not been audited**
- **Do not submit real trade documentation**

For security concerns, please open a GitHub issue or contact the team directly.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Contact & Support

- **GitHub Issues:** Report bugs or request features
- **Documentation:** Check `/docs` folder for technical details

---

## Acknowledgments

- **Mantle Network** — For providing a fast, low-cost L2 infrastructure
- **Chainlink** — For reliable oracle services enabling real-world data integration
- **African Trade Community** — For inspiring us to build solutions that matter

---

<div align="center">

**Built with purpose for Africa's future**

[Live Demo](https://frontend1-ten-umber.vercel.app/) · [Report Bug](https://github.com/big14way/earnmant/issues) · [Request Feature](https://github.com/big14way/earnmant/issues)

</div>
