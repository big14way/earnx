const { ethers } = require("hardhat");

async function main() {
  const PROTOCOL_ADDRESS = "0x95EAb385c669aca31C0d406c270d6EdDFED0D1ee";

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Testing with address:", signer.address);

  // Get contract
  const protocol = await ethers.getContractAt("MantleEarnXProtocol", PROTOCOL_ADDRESS);

  // Check if paused
  const isPaused = await protocol.paused();
  console.log("Protocol paused:", isPaused);

  if (isPaused) {
    console.log("❌ PROTOCOL IS PAUSED - This is why transactions are reverting!");
    return;
  }

  // Check invoice counter
  const counter = await protocol.invoiceCounter();
  console.log("Current invoice count:", counter.toString());

  // Check verification module
  const verificationModule = await protocol.verificationModule();
  console.log("Verification module:", verificationModule);

  // Check if verification module has core contract set
  const verificationContract = await ethers.getContractAt("MantleEarnXVerificationModule", verificationModule);
  const coreContract = await verificationContract.coreContract();
  console.log("Core contract in verification module:", coreContract);
  console.log("Protocol address:", PROTOCOL_ADDRESS);
  console.log("Core contract matches protocol:", coreContract.toLowerCase() === PROTOCOL_ADDRESS.toLowerCase());

  if (coreContract === "0x0000000000000000000000000000000000000000") {
    console.log("❌ CORE CONTRACT NOT SET IN VERIFICATION MODULE!");
    console.log("This means initializeProtocol() was never called.");
    return;
  }

  // Test parameters
  const buyer = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const amount = ethers.parseUnits("50000", 6); // 50000 USDC
  const commodity = "Cassava";
  const supplierCountry = "Nigeria";
  const buyerCountry = "Ghana";
  const exporterName = "Amara Foods Ltd";
  const buyerName = "Ghana Import Co";
  const dueDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now
  const documentHash = "QmTest123456789";

  console.log("\nTest parameters:");
  console.log("- Signer (supplier):", signer.address);
  console.log("- Buyer:", buyer);
  console.log("- Buyer != Supplier:", buyer.toLowerCase() !== signer.address.toLowerCase());
  console.log("- Amount:", amount.toString());
  console.log("- Due date:", dueDate, "(", new Date(dueDate * 1000).toISOString(), ")");
  console.log("- Current time:", Math.floor(Date.now() / 1000));
  console.log("- Due date > now + 7 days:", dueDate > Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);

  // Try static call first to see if it would revert
  console.log("\nTrying static call to simulate transaction...");
  try {
    const result = await protocol.submitInvoice.staticCall(
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
    console.log("✅ Static call succeeded! Would return invoice ID:", result.toString());

    // Now try actual submission
    console.log("\nSubmitting actual transaction...");
    const tx = await protocol.submitInvoice(
      buyer,
      amount,
      commodity,
      supplierCountry,
      buyerCountry,
      exporterName,
      buyerName,
      dueDate,
      documentHash,
      { gasLimit: 500000000 } // 500M gas - Mantle requires very high gas limits
    );
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

  } catch (e) {
    console.log("❌ Call failed:", e.message);
    if (e.data) {
      console.log("Error data:", e.data);
    }
    if (e.reason) {
      console.log("Revert reason:", e.reason);
    }
  }
}

main().catch(console.error);
