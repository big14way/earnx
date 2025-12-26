const { ethers } = require("hardhat");

async function main() {
  const VERIFICATION_MODULE = "0x4adDFcfa066E0c955bC0347d9565454AD7Ceaae1";

  const [signer] = await ethers.getSigners();
  console.log("Testing with address:", signer.address);

  const verification = await ethers.getContractAt("MantleEarnXVerificationModule", VERIFICATION_MODULE);

  // Check owner
  const owner = await verification.owner();
  console.log("Verification module owner:", owner);

  // Check core contract
  const coreContract = await verification.coreContract();
  console.log("Core contract:", coreContract);

  // Check verification authority
  const authority = await verification.verificationAuthority();
  console.log("Verification authority:", authority);

  // Try to estimate gas for a direct verification call (this should fail since we're not the core contract)
  console.log("\nChecking if calling startDocumentVerification directly would work...");

  try {
    // This should fail because we're not the core contract
    const gas = await verification.startDocumentVerification.estimateGas(
      1, // invoiceId
      "QmTest123",
      "Cassava",
      50000000000n,
      "Nigeria",
      "Ghana",
      "Amara Foods",
      "Ghana Import"
    );
    console.log("Estimated gas:", gas.toString());
  } catch (e) {
    console.log("Expected error (not core contract):", e.message?.substring(0, 100));
  }
}

main().catch(console.error);
