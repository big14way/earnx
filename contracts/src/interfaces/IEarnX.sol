// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Shared types for the EarnX invoice-financing protocol.
interface IEarnX {
    /// Submitted -> Funding (verified, open to investors) -> Funded (cash sent to exporter)
    ///   -> Repaid | Defaulted. Submitted/Funding can also end in Rejected or Cancelled.
    enum Status {
        Submitted,
        Funding,
        Funded,
        Repaid,
        Defaulted,
        Rejected,
        Cancelled
    }

    struct Invoice {
        uint64 id;
        Status status;
        uint8 riskScore; // 0 (safest) - 100, set by the verifier
        uint16 aprBps; // annual yield paid to investors, in basis points
        uint16 advanceBps; // share of face value advanced to the exporter
        uint40 submittedAt;
        uint40 dueDate; // when the buyer is expected to pay
        uint40 fundingDeadline;
        uint40 fundedAt;
        address supplier; // the exporter
        address token; // settlement stablecoin (USDG / USDC)
        uint128 faceValue; // invoice amount, in token units
        uint128 fundingTarget; // faceValue * advanceBps
        uint128 funded; // raised from investors so far
        uint128 repaymentDue; // funded + interest, fixed at disbursement
        uint128 repaid; // paid back by buyer/exporter so far
        uint128 reserveCover; // paid out of the first-loss reserve after a default
        bytes32 docsHash; // hash of the document bundle the verifier reviewed
        string docsCID; // IPFS CID of the document bundle
        string buyer;
        string commodity;
        string origin;
        string destination;
    }

    struct SubmitParams {
        address token;
        uint128 faceValue;
        uint40 dueDate;
        string buyer;
        string commodity;
        string origin;
        string destination;
        string docsCID;
        bytes32 docsHash;
    }

    /// @dev Signed off-chain by an address holding VERIFIER_ROLE (EIP-712).
    struct Verification {
        uint256 invoiceId;
        bytes32 docsHash;
        uint8 riskScore;
        uint16 aprBps;
        uint16 advanceBps;
        uint256 nonce;
        uint256 deadline;
    }

    function getInvoice(uint256 id) external view returns (Invoice memory);
}
