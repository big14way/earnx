# EarnX contracts

Foundry project for the EarnX invoice-financing protocol.

| Contract | What it does |
|---|---|
| `EarnXProtocol` | Invoice lifecycle: submit, verify, invest, automatic payout to the exporter, repay, pro-rata claims, default with a first-loss reserve |
| `EarnXInvoiceNFT` | One non-transferable (ERC-5192) token per verified invoice, minted to the exporter as an on-chain trade history. Metadata and SVG are rendered on-chain from the live invoice |

## Lifecycle

```
exporter          verifier                 investors                  buyer / exporter
   |  submitInvoice   |                         |                              |
   |----------------->|  verifyInvoice          |                              |
   |                  |  (or EIP-712 signature) |                              |
   |   NFT minted <---|------------------------>|  invest (USDG / USDC)        |
   |                  |                         |  ... target reached:         |
   |<========= advance paid to exporter, same transaction ==========           |
   |                  |                         |                              |  repay (in parts or in full)
   |                  |                         |<-- claim pro-rata share -----|
   |                  |                         |                              |
   |   past due + grace period: anyone can markDefault; the reserve covers      |
   |   investor principal and is paid back first from any later recovery       |
```

- **Pricing:** the verifier sets a risk score (0-100), the APR for investors and the advance rate (10-95% of face value). Invoices scored above 80 cannot be funded. An optional `IRiskEngine` can be plugged in to price invoices on-chain instead.
- **Fees:** 1% of every advance goes into the first-loss reserve. Anyone can add more first-loss capital with `fundReserve`; it can only be used to cover investor losses.
- **Safety:** OpenZeppelin `AccessControl`, `SafeERC20`, `ReentrancyGuard`, `Pausable`, EIP-712 signatures with nonces bound to the document hash.

## Deployments

| Network | EarnXProtocol | EarnXInvoiceNFT | Settlement |
|---|---|---|---|
| Arbitrum Sepolia (421614) | [`0x0D0C0eE2a93D4E6d912da43810Ca8f327BDc7341`](https://arbitrum-sepolia.blockscout.com/address/0x0D0C0eE2a93D4E6d912da43810Ca8f327BDc7341) | [`0xc9A10EDA07ea8D90dB95254540efb7F00907f888`](https://arbitrum-sepolia.blockscout.com/address/0xc9A10EDA07ea8D90dB95254540efb7F00907f888) | Paxos USDG, Circle USDC |
| Robinhood Chain testnet (46630) | [`0xA7fC55ca10c05aA2a0e0Cef5e00f15B08Caf4a99`](https://explorer.testnet.chain.robinhood.com/address/0xA7fC55ca10c05aA2a0e0Cef5e00f15B08Caf4a99) | [`0x7c2e27323578C67B4c2E847024D80091586503d6`](https://explorer.testnet.chain.robinhood.com/address/0x7c2e27323578C67B4c2E847024D80091586503d6) | Paxos USDG |

Both are source-verified on Blockscout. Addresses are also in [`deployments/`](deployments/).

Test tokens: USDG from the [Paxos faucet](https://faucet.paxos.com), USDC from the [Circle faucet](https://faucet.circle.com), testnet ETH from [arbitrum.faucet.dev](https://arbitrum.faucet.dev) and the [Robinhood Chain faucet](https://faucet.testnet.chain.robinhood.com).

## Sample invoices

Each network is seeded with five fictional sample invoices from [`demo/invoices`](demo/invoices), submitted by a separate demo exporter wallet. An invoice's `docsHash` is `keccak256` of its JSON file, so you can check it yourself:

```bash
cast keccak 0x$(xxd -p demo/invoices/04-cassava-nigeria-ghana.json | tr -d '\n')
```

## Develop

```bash
git submodule update --init --recursive
cd contracts
forge test                     # 29 tests, including fuzz tests
forge build --sizes

set -a && source ../.env && set +a
forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast \
  --verify --verifier blockscout --verifier-url https://arbitrum-sepolia.blockscout.com/api/
forge script script/Seed.s.sol --rpc-url arbitrum_sepolia --broadcast
```
