const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SimpleEarnXProtocol with USDC support...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MNT");

  // USDC Token address on Mantle Sepolia
  const USDC_ADDRESS = "0x211a38792781b2c7a584a96F0e735d56e809fe85";
  console.log("Using USDC token at:", USDC_ADDRESS);

  // Deploy SimpleEarnXProtocol with USDC address
  const SimpleEarnXProtocol = await ethers.getContractFactory("SimpleEarnXProtocol");
  const protocol = await SimpleEarnXProtocol.deploy(USDC_ADDRESS);
  await protocol.waitForDeployment();

  const protocolAddress = await protocol.getAddress();
  console.log("SimpleEarnXProtocol deployed to:", protocolAddress);

  // Verify USDC token is set correctly
  const usdcToken = await protocol.usdcToken();
  console.log("USDC token configured:", usdcToken);

  // Verify it's working
  const owner = await protocol.owner();
  console.log("Contract owner:", owner);

  const invoiceCounter = await protocol.invoiceCounter();
  console.log("Invoice counter:", invoiceCounter.toString());

  const isPaused = await protocol.paused();
  console.log("Is paused:", isPaused);

  // Test a submission
  console.log("\nTesting invoice submission...");

  const buyer = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const amount = ethers.parseUnits("50000", 6);
  const commodity = "Cassava";
  const supplierCountry = "Nigeria";
  const buyerCountry = "Ghana";
  const exporterName = "Amara Foods Ltd";
  const buyerName = "Ghana Import Co";
  const dueDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  const documentHash = "QmTest123456789";

  try {
    const tx = await protocol.submitInvoice(
      buyer,
      amount,
      commodity,
      supplierCountry,
      buyerCountry,
      exporterName,
      buyerName,
      dueDate,
      documentHash
    );
    console.log("Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Get the invoice
    const invoice = await protocol.getInvoice(1);
    console.log("\nInvoice details:");
    console.log("- ID:", invoice.id.toString());
    console.log("- Status:", invoice.status.toString(), "(2 = Verified)");
    console.log("- Risk Score:", invoice.riskScore.toString());
    console.log("- Credit Rating:", invoice.creditRating);
    console.log("- APR:", invoice.aprBasisPoints.toString(), "basis points");

  } catch (e) {
    console.error("❌ Error:", e.message);
  }

  console.log("\n========================================");
  console.log("UPDATE FRONTEND WITH THIS ADDRESS:");
  console.log("SimpleEarnXProtocol:", protocolAddress);
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
